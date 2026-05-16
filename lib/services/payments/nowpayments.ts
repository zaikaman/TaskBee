import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { PAYMENT_CONFIG } from "@/config/app";
import { getPrisma } from "@/lib/db/prisma";
import {
  DepositConfirmationStatus,
  DepositIntentStatus,
  DepositNetwork,
  DepositProvider,
  Prisma,
  TransactionType,
  UserStatus,
} from "@/lib/generated/prisma/client";
import { formatVnd, fromMinorUnits, toMinorUnits } from "@/lib/utils/money";

export const NOWPAYMENTS_CURRENCY_BY_NETWORK: Record<DepositNetwork, string> = {
  TRC20: "usdttrc20",
  BEP20: "usdtbsc",
  ERC20: "usdterc20",
};
const CRYPTO_DECIMAL_SCALE = BigInt(1_000_000_000_000_000_000);

const NETWORK_BY_NOWPAYMENTS_CURRENCY = new Map(
  Object.entries(NOWPAYMENTS_CURRENCY_BY_NETWORK).map(([network, currency]) => [
    currency,
    network as DepositNetwork,
  ]),
);

const PAYMENT_CODE_PATTERN = new RegExp(
  `^${PAYMENT_CONFIG.paymentCode.prefix}[A-Z0-9]{1,${PAYMENT_CONFIG.paymentCode.maxLength}}$`,
);

export type NowPaymentsIpnPayload = {
  payment_id?: number | string | null;
  parent_payment_id?: number | string | null;
  invoice_id?: number | string | null;
  payment_status?: string | null;
  pay_address?: string | null;
  price_amount?: number | string | null;
  price_currency?: string | null;
  pay_amount?: number | string | null;
  actually_paid?: number | string | null;
  actually_paid_at_fiat?: number | string | null;
  pay_currency?: string | null;
  order_id?: string | null;
  order_description?: string | null;
  purchase_id?: string | null;
  outcome_amount?: number | string | null;
  outcome_currency?: string | null;
  payment_extra_ids?: Prisma.JsonValue | null;
  fee?: Prisma.JsonValue | null;
};

export type NowPaymentsUsdtExchangeRateSnapshot = {
  provider: "NOWPAYMENTS";
  source: "NOWPAYMENTS_ESTIMATE" | "COINGECKO_TETHER_MARKET";
  requestedAmountVnd: string;
  priceCurrency: string;
  payCurrency: string;
  network: DepositNetwork;
  expectedUsdtAmount: string;
  expectedUsdtAmountAtomic: string;
  vndPerUsdt: string;
  usdPerUsdt: string | null;
  vndPerUsd: string | null;
  vndPerUsdtScale: number;
  quoteToleranceBps: number;
  quotedAt: string;
  expiresAt: string;
  rawEstimate: Prisma.JsonValue;
};

export type NowPaymentsWebhookProcessResult = {
  ok: true;
  status:
    | "PROCESSED"
    | "DUPLICATED"
    | "IGNORED"
    | "CONFIRMING"
    | "FAILED"
    | "EXPIRED"
    | "UNDERPAID"
    | "OVERPAID"
    | "MANUAL_REVIEW_REQUIRED";
  depositIntentId?: string;
  paymentCode?: string;
  message: string;
};

export type NowPaymentsReconciliationResult =
  | {
      ok: true;
      status: "SKIPPED";
      depositIntentId?: string;
      paymentCode: string;
      message: string;
    }
  | NowPaymentsWebhookProcessResult;

type NormalizedNowPaymentsPayload = {
  providerTransactionId: string;
  providerReference: string | null;
  providerEventId: string;
  paymentStatus: string;
  paymentCode: string | null;
  priceAmount: string | null;
  priceAmountMinor: bigint | null;
  priceCurrency: string | null;
  payAmount: string | null;
  actuallyPaid: string | null;
  actuallyPaidAtFiat: string | null;
  payCurrency: string | null;
  network: DepositNetwork | null;
  payAddress: string | null;
  rawPayload: NowPaymentsIpnPayload;
};

type JsonRecord = Record<string, unknown>;

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return "";
}

function normalizeLowerCode(value: unknown) {
  const text = normalizeText(value).toLowerCase();

  return text.length > 0 ? text : null;
}

function normalizePaymentCode(value: unknown) {
  const normalized = normalizeText(value).toUpperCase().replaceAll(/\s+/g, "");

  if (
    normalized.length > 0 &&
    normalized.length <= PAYMENT_CONFIG.paymentCode.maxLength &&
    PAYMENT_CODE_PATTERN.test(normalized)
  ) {
    return normalized;
  }

  return null;
}

function normalizeAddress(value: unknown) {
  const address = normalizeText(value);

  return address.length > 0 ? address : null;
}

function normalizeDecimalAmount(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("Payload NOWPayments chứa số tiền không hợp lệ.");
  }

  const normalized = typeof value === "string" ? value.trim().replaceAll(",", "") : value.toString();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("Payload NOWPayments chứa số tiền không đúng định dạng.");
  }

  return normalized;
}

function decimalToAtomicUnits(value: string, scale = CRYPTO_DECIMAL_SCALE) {
  const normalized = value.trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Giá trị crypto không hợp lệ: ${value}`);
  }

  const [majorRaw, fractionRaw = ""] = normalized.split(".");
  const major = BigInt(majorRaw || "0") * scale;
  const fraction = BigInt(fractionRaw.padEnd(18, "0").slice(0, 18));

  return major + fraction;
}

function atomicUnitsToDecimal(value: bigint, decimals = 18) {
  const major = value / CRYPTO_DECIMAL_SCALE;
  const fraction = value % CRYPTO_DECIMAL_SCALE;
  const trimmedFraction = fraction.toString().padStart(18, "0").slice(0, decimals).replace(/0+$/, "");

  return trimmedFraction ? `${major}.${trimmedFraction}` : major.toString();
}

function formatDecimalRatio(numerator: bigint, denominator: bigint, decimals = 8) {
  if (denominator <= BigInt(0)) {
    throw new Error("Không thể tính tỷ giá với mẫu số bằng 0.");
  }

  const scaled = (numerator * CRYPTO_DECIMAL_SCALE) / denominator;

  return atomicUnitsToDecimal(scaled, decimals);
}

function compareDecimalAmounts(left: string, right: string) {
  const leftAtomic = decimalToAtomicUnits(left);
  const rightAtomic = decimalToAtomicUnits(right);

  if (leftAtomic < rightAtomic) {
    return -1;
  }

  if (leftAtomic > rightAtomic) {
    return 1;
  }

  return 0;
}

function calculateMinimumExpectedAtomic(expectedAtomic: bigint, toleranceBps: number) {
  const normalizedToleranceBps = BigInt(Math.max(0, Math.min(10_000, Math.floor(toleranceBps))));

  return (expectedAtomic * (BigInt(10_000) - normalizedToleranceBps)) / BigInt(10_000);
}

function calculateMaximumExpectedAtomic(expectedAtomic: bigint, toleranceBps: number) {
  const normalizedToleranceBps = BigInt(Math.max(0, Math.min(10_000, Math.floor(toleranceBps))));

  return (expectedAtomic * (BigInt(10_000) + normalizedToleranceBps)) / BigInt(10_000);
}

function getUsdtPaidAmount(payload: NormalizedNowPaymentsPayload) {
  return payload.actuallyPaid ?? payload.payAmount;
}

function normalizeVndAmount(value: unknown) {
  const amount = normalizeDecimalAmount(value);

  if (!amount) {
    return {
      amount: null,
      amountMinor: null,
    };
  }

  const amountMinor = toMinorUnits(amount);

  if (amountMinor <= BigInt(0) || amountMinor % BigInt(100) !== BigInt(0)) {
    throw new Error("Số tiền VND từ NOWPayments phải là số nguyên dương.");
  }

  return {
    amount: fromMinorUnits(amountMinor),
    amountMinor,
  };
}

function normalizeNowPaymentsPayload(
  rawPayload: NowPaymentsIpnPayload,
): NormalizedNowPaymentsPayload {
  const providerTransactionId = normalizeText(rawPayload.payment_id);

  if (!providerTransactionId) {
    throw new Error("Webhook NOWPayments thiếu payment_id.");
  }

  const paymentStatus = normalizeText(rawPayload.payment_status).toLowerCase();

  if (!paymentStatus) {
    throw new Error("Webhook NOWPayments thiếu payment_status.");
  }

  const priceCurrency = normalizeLowerCode(rawPayload.price_currency);
  const payCurrency = normalizeLowerCode(rawPayload.pay_currency);
  const { amount: priceAmount, amountMinor: priceAmountMinor } = normalizeVndAmount(
    rawPayload.price_amount,
  );

  return {
    providerTransactionId,
    providerReference: normalizeText(rawPayload.purchase_id) || null,
    providerEventId: `${providerTransactionId}:${paymentStatus}`,
    paymentStatus,
    paymentCode: normalizePaymentCode(rawPayload.order_id),
    priceAmount,
    priceAmountMinor,
    priceCurrency,
    payAmount: normalizeDecimalAmount(rawPayload.pay_amount),
    actuallyPaid: normalizeDecimalAmount(rawPayload.actually_paid),
    actuallyPaidAtFiat: normalizeDecimalAmount(rawPayload.actually_paid_at_fiat),
    payCurrency,
    network: payCurrency ? (NETWORK_BY_NOWPAYMENTS_CURRENCY.get(payCurrency) ?? null) : null,
    payAddress: normalizeAddress(rawPayload.pay_address),
    rawPayload,
  };
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as JsonRecord)
      .sort()
      .reduce<JsonRecord>((sorted, key) => {
        sorted[key] = sortJsonValue((value as JsonRecord)[key]);
        return sorted;
      }, {});
  }

  return value;
}

export function verifyNowPaymentsSignature(
  payload: NowPaymentsIpnPayload,
  signatureHeader: string | null,
  secret: string,
) {
  const providedSignature = signatureHeader?.trim() ?? "";

  if (!providedSignature) {
    return false;
  }

  const expectedSignature = createHmac("sha512", secret)
    .update(JSON.stringify(sortJsonValue(payload)), "utf8")
    .digest("hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function isPendingStatus(status: string) {
  return (PAYMENT_CONFIG.usdt.nowPayments.paymentStatus.pending as readonly string[]).includes(
    status,
  );
}

function isConfirmingStatus(status: string) {
  return (PAYMENT_CONFIG.usdt.nowPayments.paymentStatus.confirming as readonly string[]).includes(
    status,
  );
}

function isPaidStatus(status: string) {
  return (PAYMENT_CONFIG.usdt.nowPayments.paymentStatus.paid as readonly string[]).includes(status);
}

function isFailedStatus(status: string) {
  return (PAYMENT_CONFIG.usdt.nowPayments.paymentStatus.failed as readonly string[]).includes(
    status,
  );
}

function isExpiredStatus(status: string) {
  return (PAYMENT_CONFIG.usdt.nowPayments.paymentStatus.expired as readonly string[]).includes(
    status,
  );
}

function createProviderMetadata(payload: NormalizedNowPaymentsPayload) {
  return {
    provider: PAYMENT_CONFIG.usdt.nowPayments.providerName,
    webhook: {
      receivedAt: new Date().toISOString(),
      providerTransactionId: payload.providerTransactionId,
      providerReference: payload.providerReference,
      providerEventId: payload.providerEventId,
      paymentStatus: payload.paymentStatus,
      priceAmount: payload.priceAmount,
      priceCurrency: payload.priceCurrency,
      payAmount: payload.payAmount,
      actuallyPaid: payload.actuallyPaid,
      actuallyPaidAtFiat: payload.actuallyPaidAtFiat,
      payCurrency: payload.payCurrency,
      network: payload.network,
      payAddress: payload.payAddress,
    },
    rawPayload: payload.rawPayload as Prisma.InputJsonObject,
  } satisfies Prisma.InputJsonValue;
}

function readNowPaymentsApiKey() {
  const apiKey = process.env.USDT_PROVIDER_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("USDT_PROVIDER_API_KEY chưa được cấu hình để lấy tỷ giá NOWPayments.");
  }

  return apiKey;
}

function buildNowPaymentsUrl(path: string, searchParams: URLSearchParams) {
  const url = new URL(path, PAYMENT_CONFIG.usdt.nowPayments.apiBaseUrl);
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  return url;
}

function buildNowPaymentsPaymentStatusUrl(paymentId: string) {
  return new URL(
    `${PAYMENT_CONFIG.usdt.nowPayments.apiBaseUrl.replace(/\/$/, "")}/payment/${encodeURIComponent(paymentId)}`,
  );
}

function parseNowPaymentsEstimatePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("NOWPayments trả về dữ liệu estimate không hợp lệ.");
  }

  const data = payload as {
    estimated_amount?: unknown;
    currency_from?: unknown;
    currency_to?: unknown;
    amount_from?: unknown;
  };
  const estimatedAmount = normalizeDecimalAmount(data.estimated_amount);

  if (!estimatedAmount || decimalToAtomicUnits(estimatedAmount) <= BigInt(0)) {
    throw new Error("NOWPayments không trả về số USDT ước tính hợp lệ.");
  }

  return {
    estimatedAmount,
    rawPayload: payload as Prisma.JsonValue,
  };
}

function parseCoinGeckoTetherPricePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("CoinGecko trả về dữ liệu tỷ giá không hợp lệ.");
  }

  const tether = (payload as { tether?: { vnd?: unknown; usd?: unknown } }).tether;
  const vndPerUsdt = normalizeDecimalAmount(tether?.vnd);
  const usdPerUsdt = normalizeDecimalAmount(tether?.usd);

  if (!vndPerUsdt || !usdPerUsdt) {
    throw new Error("CoinGecko không trả về đủ tỷ giá VND/USDT và USD/USDT.");
  }

  return {
    vndPerUsdt,
    usdPerUsdt,
    rawPayload: payload as Prisma.JsonValue,
  };
}

async function fetchCoinGeckoTetherSnapshot(params: {
  amountVnd: string;
  network: DepositNetwork;
  payCurrency: string;
  quotedAt: Date;
}): Promise<NowPaymentsUsdtExchangeRateSnapshot> {
  const response = await fetch(PAYMENT_CONFIG.usdt.nowPayments.fallbackMarketPriceUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const responsePayload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error("Không thể lấy tỷ giá USDT thị trường để tạo lệnh nạp.");
  }

  const marketPrice = parseCoinGeckoTetherPricePayload(responsePayload);
  const amountVndWhole = toMinorUnits(params.amountVnd) / BigInt(100);
  const vndPerUsdtAtomic = decimalToAtomicUnits(marketPrice.vndPerUsdt);
  const usdPerUsdtAtomic = decimalToAtomicUnits(marketPrice.usdPerUsdt);
  const expectedUsdtAtomic =
    vndPerUsdtAtomic > BigInt(0)
      ? (amountVndWhole * CRYPTO_DECIMAL_SCALE * CRYPTO_DECIMAL_SCALE) / vndPerUsdtAtomic
      : BigInt(0);
  const vndPerUsd =
    usdPerUsdtAtomic > BigInt(0)
      ? formatDecimalRatio(vndPerUsdtAtomic, usdPerUsdtAtomic, 6)
      : null;

  if (expectedUsdtAtomic <= BigInt(0)) {
    throw new Error("Không thể tính số USDT kỳ vọng từ tỷ giá thị trường.");
  }

  return {
    provider: "NOWPAYMENTS",
    source: "COINGECKO_TETHER_MARKET",
    requestedAmountVnd: fromMinorUnits(toMinorUnits(params.amountVnd)),
    priceCurrency: PAYMENT_CONFIG.usdt.nowPayments.fallbackPriceCurrency,
    payCurrency: params.payCurrency,
    network: params.network,
    expectedUsdtAmount: atomicUnitsToDecimal(expectedUsdtAtomic, 8),
    expectedUsdtAmountAtomic: expectedUsdtAtomic.toString(),
    vndPerUsdt: marketPrice.vndPerUsdt,
    usdPerUsdt: marketPrice.usdPerUsdt,
    vndPerUsd,
    vndPerUsdtScale: 18,
    quoteToleranceBps: PAYMENT_CONFIG.usdt.nowPayments.quoteToleranceBps,
    quotedAt: params.quotedAt.toISOString(),
    expiresAt: new Date(
      params.quotedAt.getTime() + PAYMENT_CONFIG.usdt.exchangeRateTtlSeconds * 1000,
    ).toISOString(),
    rawEstimate: marketPrice.rawPayload,
  };
}

export async function createNowPaymentsUsdtExchangeRateSnapshot(params: {
  amountVnd: string;
  network: DepositNetwork;
  now?: Date;
}): Promise<NowPaymentsUsdtExchangeRateSnapshot> {
  const apiKey = readNowPaymentsApiKey();
  const payCurrency = NOWPAYMENTS_CURRENCY_BY_NETWORK[params.network];
  const quotedAt = params.now ?? new Date();
  const searchParams = new URLSearchParams({
    amount: fromMinorUnits(toMinorUnits(params.amountVnd)),
    currency_from: PAYMENT_CONFIG.usdt.nowPayments.priceCurrency,
    currency_to: payCurrency,
  });
  const url = buildNowPaymentsUrl(PAYMENT_CONFIG.usdt.nowPayments.estimateEndpoint, searchParams);
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const responsePayload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    return fetchCoinGeckoTetherSnapshot({
      amountVnd: params.amountVnd,
      network: params.network,
      payCurrency,
      quotedAt,
    });
  }

  const estimate = parseNowPaymentsEstimatePayload(responsePayload);
  const expectedUsdtAtomic = decimalToAtomicUnits(estimate.estimatedAmount);
  const amountVndMinor = toMinorUnits(params.amountVnd);
  const amountVndWhole = amountVndMinor / BigInt(100);
  const vndPerUsdtScaled =
    expectedUsdtAtomic > BigInt(0)
      ? (amountVndWhole * CRYPTO_DECIMAL_SCALE * CRYPTO_DECIMAL_SCALE) / expectedUsdtAtomic
      : BigInt(0);

  return {
    provider: "NOWPAYMENTS",
    source: "NOWPAYMENTS_ESTIMATE",
    requestedAmountVnd: fromMinorUnits(amountVndMinor),
    priceCurrency: PAYMENT_CONFIG.usdt.nowPayments.priceCurrency,
    payCurrency,
    network: params.network,
    expectedUsdtAmount: estimate.estimatedAmount,
    expectedUsdtAmountAtomic: expectedUsdtAtomic.toString(),
    vndPerUsdt: atomicUnitsToDecimal(vndPerUsdtScaled, 8),
    usdPerUsdt: null,
    vndPerUsd: null,
    vndPerUsdtScale: 18,
    quoteToleranceBps: PAYMENT_CONFIG.usdt.nowPayments.quoteToleranceBps,
    quotedAt: quotedAt.toISOString(),
    expiresAt: new Date(
      quotedAt.getTime() + PAYMENT_CONFIG.usdt.exchangeRateTtlSeconds * 1000,
    ).toISOString(),
    rawEstimate: estimate.rawPayload,
  };
}

export async function reconcileNowPaymentsUsdtPayment(params: {
  paymentId: string | null;
  paymentCode: string;
}): Promise<NowPaymentsReconciliationResult> {
  const paymentId = normalizeText(params.paymentId);

  if (!paymentId) {
    return {
      ok: true,
      status: "SKIPPED",
      paymentCode: params.paymentCode,
      message:
        "Lệnh nạp USDT chưa có payment_id NOWPayments nên cron chưa thể truy vấn trạng thái provider.",
    };
  }

  const response = await fetch(buildNowPaymentsPaymentStatusUrl(paymentId), {
    method: "GET",
    headers: {
      "x-api-key": readNowPaymentsApiKey(),
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const responsePayload = (await response.json().catch(() => null)) as NowPaymentsIpnPayload | null;

  if (!response.ok || !responsePayload || typeof responsePayload !== "object") {
    throw new Error(`NOWPayments trả về lỗi ${response.status} khi đối soát payment_id ${paymentId}.`);
  }

  return processNowPaymentsUsdtWebhookPayload({
    ...responsePayload,
    payment_id: responsePayload.payment_id ?? paymentId,
    order_id: responsePayload.order_id ?? params.paymentCode,
  });
}

function parseExchangeRateSnapshot(
  value: Prisma.JsonValue | null,
): NowPaymentsUsdtExchangeRateSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const snapshot = value as Partial<NowPaymentsUsdtExchangeRateSnapshot>;

  if (
    snapshot.provider !== "NOWPAYMENTS" ||
    (snapshot.source !== "NOWPAYMENTS_ESTIMATE" &&
      snapshot.source !== "COINGECKO_TETHER_MARKET") ||
    typeof snapshot.expectedUsdtAmount !== "string" ||
    typeof snapshot.expectedUsdtAmountAtomic !== "string" ||
    typeof snapshot.payCurrency !== "string" ||
    typeof snapshot.quoteToleranceBps !== "number"
  ) {
    return null;
  }

  return snapshot as NowPaymentsUsdtExchangeRateSnapshot;
}

function resolveSnapshotSettlementAmount(params: {
  payload: NormalizedNowPaymentsPayload;
  snapshot: NowPaymentsUsdtExchangeRateSnapshot | null;
}) {
  const paidAmount = getUsdtPaidAmount(params.payload);

  if (!params.snapshot || !paidAmount) {
    return null;
  }

  if (params.payload.payCurrency !== params.snapshot.payCurrency) {
    return null;
  }

  const paidAtomic = decimalToAtomicUnits(paidAmount);
  const expectedAtomic = BigInt(params.snapshot.expectedUsdtAmountAtomic);
  const minimumExpectedAtomic = calculateMinimumExpectedAtomic(
    expectedAtomic,
    params.snapshot.quoteToleranceBps,
  );
  const maximumExpectedAtomic = calculateMaximumExpectedAtomic(
    expectedAtomic,
    params.snapshot.quoteToleranceBps,
  );

  return {
    paidAmount,
    paidAtomic,
    expectedAtomic,
    minimumExpectedAtomic,
    maximumExpectedAtomic,
    isUnderpaid: paidAtomic < minimumExpectedAtomic,
    isOverpaid: paidAtomic > maximumExpectedAtomic,
  };
}

function createIgnoredResult(
  message: string,
  payload: NormalizedNowPaymentsPayload,
): NowPaymentsWebhookProcessResult {
  return {
    ok: true,
    status: "IGNORED",
    paymentCode: payload.paymentCode ?? undefined,
    message,
  };
}

async function findIntentByProviderTransaction(providerTransactionId: string) {
  const prisma = getPrisma();

  return prisma.depositIntent.findUnique({
    where: {
      provider_providerTransactionId: {
        provider: DepositProvider.USDT,
        providerTransactionId,
      },
    },
    select: {
      id: true,
      paymentCode: true,
      status: true,
    },
  });
}

export async function processNowPaymentsUsdtWebhookPayload(
  rawPayload: NowPaymentsIpnPayload,
): Promise<NowPaymentsWebhookProcessResult> {
  const payload = normalizeNowPaymentsPayload(rawPayload);

  if (!payload.paymentCode && !payload.providerTransactionId) {
    return createIgnoredResult("Đã bỏ qua IPN NOWPayments không có mã tham chiếu.", payload);
  }

  const processedIntent = await findIntentByProviderTransaction(payload.providerTransactionId);

  if (processedIntent?.status === DepositIntentStatus.PAID) {
    return {
      ok: true,
      status: "DUPLICATED",
      depositIntentId: processedIntent.id,
      paymentCode: processedIntent.paymentCode,
      message: "Giao dịch NOWPayments đã được cộng ví trước đó.",
    };
  }

  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => {
    if (payload.paymentCode) {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "DepositIntent" WHERE "paymentCode" = ${payload.paymentCode} FOR UPDATE`,
      );
    }

    const depositIntent = await tx.depositIntent.findFirst({
      where: {
        provider: DepositProvider.USDT,
        OR: [
          ...(payload.paymentCode ? [{ paymentCode: payload.paymentCode }] : []),
          { providerTransactionId: payload.providerTransactionId },
          { providerReference: payload.providerTransactionId },
        ],
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        status: true,
        provider: true,
        providerTransactionId: true,
        providerReference: true,
        paymentCode: true,
        network: true,
        destinationAddress: true,
        exchangeRateSnapshot: true,
        requiredConfirmations: true,
        user: {
          select: {
            availableBalance: true,
            status: true,
          },
        },
      },
    });

    if (!depositIntent) {
      return createIgnoredResult(
        "Không tìm thấy lệnh nạp USDT khớp mã thanh toán hoặc payment_id NOWPayments.",
        payload,
      );
    }

    if (depositIntent.status === DepositIntentStatus.PAID) {
      return {
        ok: true as const,
        status: "DUPLICATED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Lệnh nạp USDT đã được xác nhận trước đó.",
      };
    }

    if (depositIntent.providerTransactionId && depositIntent.providerTransactionId !== payload.providerTransactionId) {
      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status: DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: "MANUAL_REVIEW_REQUIRED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Lệnh nạp USDT nhận nhiều payment_id khác nhau, cần admin kiểm tra.",
      };
    }

    if (payload.network && depositIntent.network && payload.network !== depositIntent.network) {
      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status: DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerEventId,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: "MANUAL_REVIEW_REQUIRED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Mạng USDT từ NOWPayments không khớp lệnh nạp, không tự động cộng ví.",
      };
    }

    if (
      payload.payAddress &&
      depositIntent.destinationAddress &&
      payload.payAddress.toLowerCase() !== depositIntent.destinationAddress.toLowerCase()
    ) {
      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status: DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerEventId,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: "MANUAL_REVIEW_REQUIRED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Địa chỉ nhận USDT từ NOWPayments không khớp lệnh nạp, cần admin kiểm tra.",
      };
    }

    if (isPendingStatus(payload.paymentStatus)) {
      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status: DepositIntentStatus.PENDING,
          confirmationStatus: DepositConfirmationStatus.UNCONFIRMED,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerEventId,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: "IGNORED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "NOWPayments báo giao dịch đang chờ thanh toán.",
      };
    }

    if (isConfirmingStatus(payload.paymentStatus)) {
      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status: DepositIntentStatus.CONFIRMING,
          confirmationStatus: DepositConfirmationStatus.PARTIALLY_CONFIRMED,
          confirmations: Math.max(1, depositIntent.requiredConfirmations - 1),
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerEventId,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: "CONFIRMING" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "NOWPayments đã thấy giao dịch USDT và đang chờ đủ xác nhận blockchain.",
      };
    }

    if (isExpiredStatus(payload.paymentStatus) || isFailedStatus(payload.paymentStatus)) {
      const status = isExpiredStatus(payload.paymentStatus)
        ? DepositIntentStatus.EXPIRED
        : DepositIntentStatus.FAILED;

      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerEventId,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: isExpiredStatus(payload.paymentStatus) ? ("EXPIRED" as const) : ("FAILED" as const),
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "NOWPayments báo giao dịch USDT đã hết hạn hoặc thất bại.",
      };
    }

    if (!isPaidStatus(payload.paymentStatus)) {
      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status: DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerEventId,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: "MANUAL_REVIEW_REQUIRED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Trạng thái NOWPayments chưa được hệ thống hỗ trợ tự động, cần admin kiểm tra.",
      };
    }

    if (depositIntent.user.status !== UserStatus.ACTIVE) {
      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status: DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          confirmations: depositIntent.requiredConfirmations,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerEventId,
          confirmedAmount: payload.priceAmount,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: "MANUAL_REVIEW_REQUIRED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Tài khoản nhận USDT không hoạt động, cần admin kiểm tra trước khi cộng ví.",
      };
    }

    const expectedAmountMinor = toMinorUnits(depositIntent.amount.toString());
    const exchangeRateSnapshot = parseExchangeRateSnapshot(depositIntent.exchangeRateSnapshot);
    const snapshotSettlement = resolveSnapshotSettlementAmount({
      payload,
      snapshot: exchangeRateSnapshot,
    });

    if (
      payload.priceCurrency !== PAYMENT_CONFIG.usdt.nowPayments.priceCurrency &&
      !snapshotSettlement
    ) {
      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status: DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          confirmations: depositIntent.requiredConfirmations,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerEventId,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: "MANUAL_REVIEW_REQUIRED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Đơn vị định giá NOWPayments không phải VND và lệnh nạp không có snapshot tỷ giá hợp lệ.",
      };
    }

    if (
      payload.priceCurrency === PAYMENT_CONFIG.usdt.nowPayments.priceCurrency &&
      (!payload.priceAmount ||
        payload.priceAmountMinor === null ||
        payload.priceAmountMinor !== expectedAmountMinor)
    ) {
      const status =
        payload.priceAmountMinor !== null && payload.priceAmountMinor < expectedAmountMinor
          ? DepositIntentStatus.UNDERPAID
          : DepositIntentStatus.OVERPAID;

      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          confirmations: depositIntent.requiredConfirmations,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerEventId,
          confirmedAmount: payload.priceAmount,
          rawProviderMetadata: createProviderMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status:
          status === DepositIntentStatus.UNDERPAID
            ? ("UNDERPAID" as const)
            : ("OVERPAID" as const),
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Số tiền NOWPayments không khớp lệnh nạp, không tự động cộng ví.",
      };
    }

    if (payload.priceCurrency !== PAYMENT_CONFIG.usdt.nowPayments.priceCurrency) {
      if (!snapshotSettlement || snapshotSettlement.isUnderpaid || snapshotSettlement.isOverpaid) {
        const status = snapshotSettlement?.isUnderpaid
          ? DepositIntentStatus.UNDERPAID
          : DepositIntentStatus.OVERPAID;

        await tx.depositIntent.update({
          where: {
            id: depositIntent.id,
          },
          data: {
            status,
            confirmationStatus: DepositConfirmationStatus.REJECTED,
            confirmations: depositIntent.requiredConfirmations,
            providerTransactionId: payload.providerTransactionId,
            providerReference: payload.providerReference,
            providerEventId: payload.providerEventId,
            confirmedAmount: depositIntent.amount.toString(),
            rawProviderMetadata: createProviderMetadata(payload),
          },
        });

        return {
          ok: true as const,
          status:
            status === DepositIntentStatus.UNDERPAID
              ? ("UNDERPAID" as const)
              : ("OVERPAID" as const),
          depositIntentId: depositIntent.id,
          paymentCode: depositIntent.paymentCode,
          message: "Số USDT NOWPayments không khớp snapshot tỷ giá đã lưu, không tự động cộng ví.",
        };
      }
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "User" WHERE id = ${depositIntent.userId}::uuid FOR UPDATE`,
    );

    const updatedDepositIntent = await tx.depositIntent.updateMany({
      where: {
        id: depositIntent.id,
        status: {
          not: DepositIntentStatus.PAID,
        },
        providerTransactionId: null,
      },
      data: {
        status: DepositIntentStatus.PAID,
        confirmationStatus: DepositConfirmationStatus.CONFIRMED,
        confirmations: depositIntent.requiredConfirmations,
        providerTransactionId: payload.providerTransactionId,
        providerReference: payload.providerReference,
        providerEventId: payload.providerEventId,
        confirmedAmount: depositIntent.amount.toString(),
        confirmedAt: new Date(),
        rawProviderMetadata: createProviderMetadata(payload),
      },
    });

    if (updatedDepositIntent.count !== 1) {
      return {
        ok: true as const,
        status: "DUPLICATED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Lệnh nạp USDT đã được xử lý bởi tiến trình khác, không cộng ví lần hai.",
      };
    }

    const updatedUser = await tx.user.update({
      where: {
        id: depositIntent.userId,
      },
      data: {
        availableBalance: {
          increment: depositIntent.amount.toString(),
        },
      },
      select: {
        availableBalance: true,
      },
    });

    await tx.transaction.create({
      data: {
        userId: depositIntent.userId,
        type: TransactionType.DEPOSIT,
        amount: depositIntent.amount.toString(),
        balanceAfter: updatedUser.availableBalance.toString(),
        referenceId: depositIntent.id,
        description: `Nạp USDT qua NOWPayments ${formatVnd(depositIntent.amount.toString())} với mã thanh toán ${depositIntent.paymentCode}.`,
        metadata: {
          depositIntentId: depositIntent.id,
          paymentCode: depositIntent.paymentCode,
          provider: PAYMENT_CONFIG.usdt.nowPayments.providerName,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          paymentStatus: payload.paymentStatus,
          payCurrency: payload.payCurrency,
          payAmount: payload.payAmount,
          actuallyPaid: payload.actuallyPaid,
          exchangeRateSnapshot,
          snapshotSettlement: snapshotSettlement
            ? {
                paidAmount: snapshotSettlement.paidAmount,
                expectedUsdtAmount: exchangeRateSnapshot?.expectedUsdtAmount,
                minimumExpectedUsdtAmount: atomicUnitsToDecimal(
                  snapshotSettlement.minimumExpectedAtomic,
                  8,
                ),
                maximumExpectedUsdtAmount: atomicUnitsToDecimal(
                  snapshotSettlement.maximumExpectedAtomic,
                  8,
                ),
              }
            : null,
          rawPayload: payload.rawPayload as Prisma.InputJsonObject,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ok: true as const,
      status: "PROCESSED" as const,
      depositIntentId: depositIntent.id,
      paymentCode: depositIntent.paymentCode,
      message: "Đã xác nhận USDT qua NOWPayments và cộng số dư ví.",
    };
  });

  if (result.status === "PROCESSED" || result.status === "CONFIRMING") {
    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/deposit");
  }

  return result;
}
