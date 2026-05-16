import { revalidatePath } from "next/cache";
import { PAYMENT_CONFIG } from "@/config/app";
import { getPrisma } from "@/lib/db/prisma";
import {
  DepositConfirmationStatus,
  DepositIntentStatus,
  DepositProvider,
  Prisma,
  TransactionType,
  UserStatus,
} from "@/lib/generated/prisma/client";
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

function normalizeText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }

  return "";
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

  const prisma = getPrisma();
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "DepositIntent" WHERE "paymentCode" = ${paymentCode} FOR UPDATE`,
    );

    const depositIntent = await tx.depositIntent.findUnique({
      where: {
        paymentCode,
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        status: true,
        provider: true,
        providerTransactionId: true,
        paymentCode: true,
        rawProviderMetadata: true,
        user: {
          select: {
            availableBalance: true,
            status: true,
          },
        },
      },
    });

    if (!depositIntent || depositIntent.provider !== DepositProvider.SEPAY) {
      return createIgnoredResult("Không tìm thấy lệnh nạp SePay khớp mã thanh toán.", payload);
    }

    if (depositIntent.providerTransactionId) {
      return {
        ok: true as const,
        status: "DUPLICATED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Lệnh nạp đã có giao dịch provider, không cộng ví lần hai.",
      };
    }

    if (depositIntent.status === DepositIntentStatus.PAID) {
      return {
        ok: true as const,
        status: "DUPLICATED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Lệnh nạp đã được xác nhận trước đó.",
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
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerTransactionId,
          rawProviderMetadata: createWebhookMetadata(payload),
        },
      });

      return {
        ok: true as const,
        status: "MANUAL_REVIEW_REQUIRED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Tài khoản nhận tiền không ở trạng thái hoạt động, cần admin kiểm tra.",
      };
    }

    const expectedAmountMinor = toMinorUnits(depositIntent.amount.toString());

    if (payload.amountMinor !== expectedAmountMinor) {
      const status =
        payload.amountMinor < expectedAmountMinor
          ? DepositIntentStatus.UNDERPAID
          : DepositIntentStatus.OVERPAID;

      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          confirmations: 1,
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          providerEventId: payload.providerTransactionId,
          confirmedAmount: payload.amount,
          rawProviderMetadata: createWebhookMetadata(payload),
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
        message: "Số tiền SePay không khớp lệnh nạp, không tự động cộng ví.",
      };
    }

    const updatedUser = await tx.user.update({
      where: {
        id: depositIntent.userId,
      },
      data: {
        availableBalance: {
          increment: payload.amount,
        },
      },
      select: {
        availableBalance: true,
      },
    });

    await tx.depositIntent.update({
      where: {
        id: depositIntent.id,
      },
      data: {
        status: DepositIntentStatus.PAID,
        confirmationStatus: DepositConfirmationStatus.CONFIRMED,
        confirmations: 1,
        providerTransactionId: payload.providerTransactionId,
        providerReference: payload.providerReference,
        providerEventId: payload.providerTransactionId,
        confirmedAmount: payload.amount,
        confirmedAt: new Date(),
        rawProviderMetadata: createWebhookMetadata(payload),
      },
    });

    await tx.transaction.create({
      data: {
        userId: depositIntent.userId,
        type: TransactionType.DEPOSIT,
        amount: payload.amount,
        balanceAfter: updatedUser.availableBalance.toString(),
        referenceId: depositIntent.id,
        description: `Nạp tiền SePay ${formatVnd(payload.amount)} với mã thanh toán ${depositIntent.paymentCode}.`,
        metadata: {
          depositIntentId: depositIntent.id,
          paymentCode: depositIntent.paymentCode,
          provider: "SEPAY",
          providerTransactionId: payload.providerTransactionId,
          providerReference: payload.providerReference,
          rawPayload: payload.rawPayload,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ok: true as const,
      status: "PROCESSED" as const,
      depositIntentId: depositIntent.id,
      paymentCode: depositIntent.paymentCode,
      message: "Đã xác nhận giao dịch SePay và cộng số dư ví.",
    };
  });

  if (result.status === "PROCESSED") {
    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/deposit");
  }

  return result;
}
