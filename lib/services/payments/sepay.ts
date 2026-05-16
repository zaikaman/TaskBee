import { revalidatePath } from "next/cache";
import { PAYMENT_CONFIG } from "@/config/app";
import { getPrisma } from "@/lib/db/prisma";
import { DepositProvider, Prisma } from "@/lib/generated/prisma/client";
import { settleConfirmedDepositIntent } from "@/lib/services/payments/deposit-confirmation";
import { formatVnd, fromMinorUnits, toMinorUnits } from "@/lib/utils/money";

const SEPAY_INCOMING_TRANSFER_TYPES = new Set(["in", "incoming", "credit"]);

export type SePayBankTransferInstructions = {
  bankName: string;
  bankShortName: string;
  accountNumber: string;
  accountName: string;
  amount: string;
  paymentCode: string;
  transferContent: string;
};

export type SePayWebhookPayload = {
  id: number | string;
  gateway?: string | null;
  transactionDate?: string | null;
  accountNumber?: string | null;
  subAccount?: string | null;
  code?: string | null;
  content?: string | null;
  transferType?: string | null;
  description?: string | null;
  transferAmount: number | string;
  accumulated?: number | string | null;
  referenceCode?: string | null;
};

export type SePayWebhookProcessResult = {
  ok: true;
  status:
    | "PROCESSED"
    | "DUPLICATED"
    | "IGNORED"
    | "UNDERPAID"
    | "OVERPAID"
    | "MANUAL_REVIEW_REQUIRED";
  depositIntentId?: string;
  paymentCode?: string;
  message: string;
};

type NormalizedSePayWebhookPayload = {
  providerTransactionId: string;
  providerReference: string | null;
  paymentCode: string | null;
  amount: string;
  amountMinor: bigint;
  accountNumber: string | null;
  transferType: string;
  rawPayload: SePayWebhookPayload;
};

type SePayApiTransactionRecord = Record<string, unknown>;

export type SePayReconciliationResult =
  | {
      ok: true;
      status: "SKIPPED";
      depositIntentId?: string;
      paymentCode: string;
      message: string;
    }
  | SePayWebhookProcessResult;

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return "";
}

function normalizeDateForSePay(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hour = `${value.getHours()}`.padStart(2, "0");
  const minute = `${value.getMinutes()}`.padStart(2, "0");
  const second = `${value.getSeconds()}`.padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function normalizeDateToEndOfDayForSePay(value: Date) {
  const endOfDay = new Date(value);

  endOfDay.setHours(23, 59, 59, 999);

  return normalizeDateForSePay(endOfDay);
}

function readRequiredPaymentEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Chưa cấu hình ${name} cho luồng nạp tiền SePay.`);
  }

  return value;
}

export function buildSePayBankTransferInstructions(params: {
  amount: string;
  paymentCode: string;
}): SePayBankTransferInstructions {
  const paymentCode = normalizePaymentCode(params.paymentCode);

  if (!paymentCode) {
    throw new Error("Mã thanh toán SePay không hợp lệ.");
  }

  return {
    bankName: readRequiredPaymentEnv(PAYMENT_CONFIG.sepay.env.bankName),
    bankShortName: readRequiredPaymentEnv(PAYMENT_CONFIG.sepay.env.bankShortName),
    accountNumber: readRequiredPaymentEnv(PAYMENT_CONFIG.sepay.env.bankAccountNumber),
    accountName: readRequiredPaymentEnv(PAYMENT_CONFIG.sepay.env.bankAccountName),
    amount: params.amount,
    paymentCode,
    transferContent: `${PAYMENT_CONFIG.sepay.bankTransferContentPrefix}${paymentCode.replace(
      new RegExp(`^${PAYMENT_CONFIG.sepay.bankTransferContentPrefix}`),
      "",
    )}`,
  };
}

function normalizeAccountNumber(value: unknown) {
  const normalized = normalizeText(value).replaceAll(/[\s.-]/g, "");

  return normalized.length > 0 ? normalized : null;
}

function normalizePaymentCode(value: unknown) {
  const normalized = normalizeText(value).toUpperCase().replaceAll(/\s+/g, "");
  const paymentCodePattern = new RegExp(PAYMENT_CONFIG.paymentCode.allowedPattern);

  if (
    normalized.length > 0 &&
    normalized.length <= PAYMENT_CONFIG.paymentCode.maxLength &&
    normalized.startsWith(PAYMENT_CONFIG.paymentCode.prefix) &&
    paymentCodePattern.test(normalized)
  ) {
    return normalized;
  }

  return null;
}

function extractPaymentCode(payload: SePayWebhookPayload) {
  const explicitCode = normalizePaymentCode(payload.code);

  if (explicitCode) {
    return explicitCode;
  }

  const text = `${payload.content ?? ""} ${payload.description ?? ""}`.toUpperCase();
  const prefix = PAYMENT_CONFIG.paymentCode.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`\\b${prefix}[A-Z0-9]{1,62}\\b`));

  return normalizePaymentCode(match?.[0]);
}

function normalizeTransferAmount(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("Webhook SePay thiếu số tiền giao dịch hợp lệ.");
  }

  const normalizedValue =
    typeof value === "string" ? value.trim().replaceAll(",", "") : value.toString();
  const amountMinor = toMinorUnits(normalizedValue);

  if (amountMinor <= BigInt(0) || amountMinor % BigInt(100) !== BigInt(0)) {
    throw new Error("Số tiền giao dịch SePay phải là số nguyên VND dương.");
  }

  return {
    amount: fromMinorUnits(amountMinor),
    amountMinor,
  };
}

function normalizeOptionalPositiveAmount(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  try {
    return normalizeTransferAmount(value);
  } catch {
    return null;
  }
}

function normalizeSePayPayload(payload: SePayWebhookPayload): NormalizedSePayWebhookPayload {
  const providerTransactionId = normalizeText(payload.id);

  if (!providerTransactionId) {
    throw new Error("Webhook SePay thiếu mã giao dịch provider.");
  }

  const transferType = normalizeText(payload.transferType).toLowerCase();
  const { amount, amountMinor } = normalizeTransferAmount(payload.transferAmount);

  return {
    providerTransactionId,
    providerReference: normalizeText(payload.referenceCode) || null,
    paymentCode: extractPaymentCode(payload),
    amount,
    amountMinor,
    accountNumber: normalizeAccountNumber(payload.accountNumber),
    transferType,
    rawPayload: payload,
  };
}

function isIncomingTransfer(transferType: string) {
  return SEPAY_INCOMING_TRANSFER_TYPES.has(transferType);
}

function isExpectedAccount(accountNumber: string | null) {
  const configuredAccount = normalizeAccountNumber(process.env.SEPAY_BANK_ACCOUNT_NUMBER);

  if (!configuredAccount || !accountNumber) {
    return true;
  }

  return configuredAccount === accountNumber;
}

async function findProcessedSePayTransaction(providerTransactionId: string) {
  const prisma = getPrisma();

  return prisma.depositIntent.findUnique({
    where: {
      provider_providerTransactionId: {
        provider: DepositProvider.SEPAY,
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

function createWebhookMetadata(payload: NormalizedSePayWebhookPayload) {
  return {
    provider: "SEPAY",
    webhook: {
      receivedAt: new Date().toISOString(),
      providerTransactionId: payload.providerTransactionId,
      providerReference: payload.providerReference,
      accountNumber: payload.accountNumber,
      transferType: payload.transferType,
      amount: payload.amount,
    },
    rawPayload: payload.rawPayload,
  } satisfies Prisma.InputJsonValue;
}

function readSePayApiToken() {
  const apiToken = process.env.SEPAY_API_TOKEN?.trim();

  if (!apiToken) {
    throw new Error("SEPAY_API_TOKEN chưa được cấu hình để đối soát giao dịch SePay.");
  }

  return apiToken;
}

function readSePayTransactionsApiUrl() {
  return process.env.SEPAY_TRANSACTIONS_API_URL?.trim() || "https://userapi.sepay.vn/v2/transactions";
}

function extractSePayTransactionRows(payload: unknown): SePayApiTransactionRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is SePayApiTransactionRecord =>
      Boolean(item && typeof item === "object"),
    );
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.data, record.transactions, record.items, record.records];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is SePayApiTransactionRecord =>
        Boolean(item && typeof item === "object"),
      );
    }

    if (candidate && typeof candidate === "object") {
      const nested = candidate as Record<string, unknown>;

      for (const nestedCandidate of [nested.data, nested.transactions, nested.items, nested.records]) {
        if (Array.isArray(nestedCandidate)) {
          return nestedCandidate.filter((item): item is SePayApiTransactionRecord =>
            Boolean(item && typeof item === "object"),
          );
        }
      }
    }
  }

  return [];
}

function getRecordValue(record: SePayApiTransactionRecord, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== "") {
      return record[key];
    }
  }

  return null;
}

function normalizeSePayApiTransaction(record: SePayApiTransactionRecord): SePayWebhookPayload | null {
  const id = getRecordValue(record, [
    "id",
    "transaction_id",
    "transactionId",
    "reference_id",
    "referenceId",
  ]);
  const content = getRecordValue(record, [
    "transaction_content",
    "transactionContent",
    "content",
    "description",
  ]);
  const amount =
    normalizeOptionalPositiveAmount(
      getRecordValue(record, [
        "amount_in",
        "amountIn",
        "transfer_amount",
        "transferAmount",
        "credit_amount",
        "creditAmount",
        "amount",
      ]),
    ) ??
    normalizeOptionalPositiveAmount(
      getRecordValue(record, ["money_in", "moneyIn", "in_amount", "inAmount"]),
    );

  if (!id || !amount) {
    return null;
  }

  return {
    id: normalizeText(id),
    gateway: normalizeText(getRecordValue(record, ["gateway", "bank_brand_name", "bankBrandName"])) || null,
    transactionDate:
      normalizeText(getRecordValue(record, ["transaction_date", "transactionDate", "created_at", "createdAt"])) ||
      null,
    accountNumber:
      normalizeText(getRecordValue(record, ["account_number", "accountNumber", "bank_account_number"])) || null,
    code: normalizePaymentCode(getRecordValue(record, ["code", "payment_code", "paymentCode"])),
    content: normalizeText(content) || null,
    transferType: normalizeText(getRecordValue(record, ["transfer_type", "transferType"])) || "in",
    description: normalizeText(getRecordValue(record, ["description", "transaction_content", "content"])) || null,
    transferAmount: amount.amount,
    accumulated: getRecordValue(record, ["accumulated", "balance"]) as string | number | null,
    referenceCode:
      normalizeText(getRecordValue(record, ["reference_code", "referenceCode", "reference", "bank_reference"])) ||
      null,
  };
}

function isMatchingReconciliationTransaction(params: {
  payload: SePayWebhookPayload;
  paymentCode: string;
  expectedAmount: string;
}) {
  const normalizedPayload = normalizeSePayPayload(params.payload);

  return (
    normalizedPayload.paymentCode === params.paymentCode &&
    isIncomingTransfer(normalizedPayload.transferType) &&
    isExpectedAccount(normalizedPayload.accountNumber) &&
    normalizedPayload.amountMinor === toMinorUnits(params.expectedAmount)
  );
}

async function fetchSePayTransactionsForReconciliation(params: {
  paymentCode: string;
  createdAt: Date;
  expectedAmount: string;
}) {
  const url = new URL(readSePayTransactionsApiUrl());
  const fromDate = new Date(params.createdAt.getTime() - 10 * 60 * 1000);
  const toDate = new Date();

  url.searchParams.set("q", params.paymentCode);
  url.searchParams.set("transaction_content", params.paymentCode);
  url.searchParams.set("transaction_date_from", normalizeDateForSePay(fromDate));
  url.searchParams.set("transaction_date_to", normalizeDateToEndOfDayForSePay(toDate));
  url.searchParams.set("amount_in_min", params.expectedAmount);
  url.searchParams.set("amount_in_max", params.expectedAmount);
  url.searchParams.set("transfer_type", "in");
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "100");
  url.searchParams.set("timestamp_format", "iso8601");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${readSePayApiToken()}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const responsePayload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(`SePay trả về lỗi ${response.status} khi đối soát giao dịch.`);
  }

  return extractSePayTransactionRows(responsePayload)
    .map(normalizeSePayApiTransaction)
    .filter((payload): payload is SePayWebhookPayload => payload !== null);
}

export async function reconcileSePayDepositIntent(params: {
  paymentCode: string;
  expectedAmount: string;
  createdAt: Date;
}): Promise<SePayReconciliationResult> {
  const paymentCode = normalizePaymentCode(params.paymentCode);

  if (!paymentCode) {
    return {
      ok: true,
      status: "SKIPPED",
      paymentCode: params.paymentCode,
      message: "Mã thanh toán SePay không hợp lệ nên không thể đối soát tự động.",
    };
  }

  const transactions = await fetchSePayTransactionsForReconciliation({
    paymentCode,
    createdAt: params.createdAt,
    expectedAmount: params.expectedAmount,
  });
  const matchedTransaction = transactions.find((transaction) =>
    isMatchingReconciliationTransaction({
      payload: transaction,
      paymentCode,
      expectedAmount: params.expectedAmount,
    }),
  );

  if (!matchedTransaction) {
    return {
      ok: true,
      status: "SKIPPED",
      paymentCode,
      message: "Chưa tìm thấy giao dịch SePay khớp mã thanh toán và số tiền.",
    };
  }

  return processSePayWebhookPayload(matchedTransaction);
}

function createIgnoredResult(
  message: string,
  payload: NormalizedSePayWebhookPayload,
): SePayWebhookProcessResult {
  return {
    ok: true as const,
    status: "IGNORED",
    paymentCode: payload.paymentCode ?? undefined,
    message,
  };
}

export async function processSePayWebhookPayload(
  rawPayload: SePayWebhookPayload,
): Promise<SePayWebhookProcessResult> {
  const payload = normalizeSePayPayload(rawPayload);

  if (!isIncomingTransfer(payload.transferType)) {
    return createIgnoredResult("Đã bỏ qua giao dịch SePay không phải tiền vào.", payload);
  }

  if (!isExpectedAccount(payload.accountNumber)) {
    return createIgnoredResult("Đã bỏ qua giao dịch SePay không khớp tài khoản nhận.", payload);
  }

  if (!payload.paymentCode) {
    return createIgnoredResult("Đã bỏ qua giao dịch SePay không có mã thanh toán TaskBee.", payload);
  }

  const paymentCode = payload.paymentCode;
  const processedIntent = await findProcessedSePayTransaction(payload.providerTransactionId);

  if (processedIntent) {
    return {
      ok: true as const,
      status: "DUPLICATED",
      depositIntentId: processedIntent.id,
      paymentCode: processedIntent.paymentCode,
      message: "Giao dịch SePay đã được xử lý trước đó, không cộng ví lần hai.",
    };
  }

  const settledResult = await settleConfirmedDepositIntent({
    provider: DepositProvider.SEPAY,
    paymentCode,
    providerTransactionId: payload.providerTransactionId,
    providerReference: payload.providerReference,
    providerEventId: payload.providerTransactionId,
    confirmations: 1,
    confirmedAmountVnd: payload.amount,
    providerReportedAmountVnd: payload.amount,
    rawProviderMetadata: createWebhookMetadata(payload),
    ledgerDescription: (depositIntent) =>
      `Nạp tiền SePay ${formatVnd(payload.amount)} với mã thanh toán ${depositIntent.paymentCode}.`,
    ledgerMetadata: (depositIntent) =>
      ({
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        provider: "SEPAY",
        providerTransactionId: payload.providerTransactionId,
        providerReference: payload.providerReference,
        rawPayload: payload.rawPayload,
      }) as Prisma.InputJsonValue,
  });

  if (settledResult.status === "PROCESSED") {
    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/deposit");
  }

  return {
    ok: true as const,
    ...settledResult,
  };
}
