import { getPrisma } from "@/lib/db/prisma";
import {
  DepositConfirmationStatus,
  DepositIntentStatus,
  DepositProvider,
  Prisma,
  TransactionType,
  UserStatus,
} from "@/lib/generated/prisma/client";
import { toMinorUnits } from "@/lib/utils/money";

export type DepositSettlementStatus =
  | "PROCESSED"
  | "DUPLICATED"
  | "UNDERPAID"
  | "OVERPAID"
  | "MANUAL_REVIEW_REQUIRED";

export type DepositSettlementResult = {
  status: DepositSettlementStatus;
  depositIntentId: string;
  paymentCode: string;
  message: string;
};

type DepositSettlementInput = {
  provider: DepositProvider;
  paymentCode: string;
  providerTransactionId: string;
  providerReference: string | null;
  providerEventId: string;
  confirmations: number;
  confirmedAmountVnd: string;
  providerReportedAmountVnd?: string | null;
  rawProviderMetadata: Prisma.InputJsonValue;
  ledgerDescription: (depositIntent: {
    id: string;
    paymentCode: string;
    amount: Prisma.Decimal;
  }) => string;
  ledgerMetadata: (depositIntent: {
    id: string;
    paymentCode: string;
    amount: Prisma.Decimal;
  }) => Prisma.InputJsonValue;
};

function mapAmountMismatchStatus(expectedAmount: string, receivedAmount: string) {
  return toMinorUnits(receivedAmount) < toMinorUnits(expectedAmount)
    ? DepositIntentStatus.UNDERPAID
    : DepositIntentStatus.OVERPAID;
}

function mapSettlementStatus(status: DepositIntentStatus) {
  return status === DepositIntentStatus.UNDERPAID
    ? ("UNDERPAID" as const)
    : ("OVERPAID" as const);
}

export async function settleConfirmedDepositIntent(
  input: DepositSettlementInput,
): Promise<DepositSettlementResult> {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "DepositIntent" WHERE "paymentCode" = ${input.paymentCode} FOR UPDATE`,
    );

    const existingProviderTransaction = await tx.depositIntent.findUnique({
      where: {
        provider_providerTransactionId: {
          provider: input.provider,
          providerTransactionId: input.providerTransactionId,
        },
      },
      select: {
        id: true,
        paymentCode: true,
        status: true,
      },
    });

    if (existingProviderTransaction) {
      return {
        status: "DUPLICATED" as const,
        depositIntentId: existingProviderTransaction.id,
        paymentCode: existingProviderTransaction.paymentCode,
        message: "Giao dịch provider đã được ghi nhận trước đó, không cộng ví lần hai.",
      };
    }

    const depositIntent = await tx.depositIntent.findUnique({
      where: {
        paymentCode: input.paymentCode,
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        status: true,
        provider: true,
        providerTransactionId: true,
        paymentCode: true,
      },
    });

    if (!depositIntent || depositIntent.provider !== input.provider) {
      return {
        status: "MANUAL_REVIEW_REQUIRED" as const,
        depositIntentId: "00000000-0000-0000-0000-000000000000",
        paymentCode: input.paymentCode,
        message: "Không tìm thấy lệnh nạp khớp provider và mã thanh toán.",
      };
    }

    if (depositIntent.status === DepositIntentStatus.PAID || depositIntent.providerTransactionId) {
      return {
        status: "DUPLICATED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Lệnh nạp đã có giao dịch provider hoặc đã được cộng ví trước đó.",
      };
    }

    const expectedAmount = depositIntent.amount.toString();
    const reportedAmount = input.providerReportedAmountVnd ?? input.confirmedAmountVnd;

    if (toMinorUnits(reportedAmount) !== toMinorUnits(expectedAmount)) {
      const status = mapAmountMismatchStatus(expectedAmount, reportedAmount);

      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          confirmations: input.confirmations,
          providerTransactionId: input.providerTransactionId,
          providerReference: input.providerReference,
          providerEventId: input.providerEventId,
          confirmedAmount: reportedAmount,
          rawProviderMetadata: input.rawProviderMetadata,
        },
      });

      return {
        status: mapSettlementStatus(status),
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Số tiền provider xác nhận không khớp lệnh nạp, không tự động cộng ví.",
      };
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "User" WHERE id = ${depositIntent.userId}::uuid FOR UPDATE`,
    );

    const user = await tx.user.findUniqueOrThrow({
      where: {
        id: depositIntent.userId,
      },
      select: {
        status: true,
      },
    });

    if (user.status !== UserStatus.ACTIVE) {
      await tx.depositIntent.update({
        where: {
          id: depositIntent.id,
        },
        data: {
          status: DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
          confirmations: input.confirmations,
          providerTransactionId: input.providerTransactionId,
          providerReference: input.providerReference,
          providerEventId: input.providerEventId,
          confirmedAmount: reportedAmount,
          rawProviderMetadata: input.rawProviderMetadata,
        },
      });

      return {
        status: "MANUAL_REVIEW_REQUIRED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Tài khoản nhận tiền không hoạt động, cần admin kiểm tra trước khi cộng ví.",
      };
    }

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
        confirmations: input.confirmations,
        providerTransactionId: input.providerTransactionId,
        providerReference: input.providerReference,
        providerEventId: input.providerEventId,
        confirmedAmount: input.confirmedAmountVnd,
        confirmedAt: new Date(),
        rawProviderMetadata: input.rawProviderMetadata,
      },
    });

    if (updatedDepositIntent.count !== 1) {
      return {
        status: "DUPLICATED" as const,
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        message: "Lệnh nạp đã được xử lý bởi tiến trình khác, không cộng ví lần hai.",
      };
    }

    const updatedUser = await tx.user.update({
      where: {
        id: depositIntent.userId,
      },
      data: {
        availableBalance: {
          increment: input.confirmedAmountVnd,
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
        amount: input.confirmedAmountVnd,
        balanceAfter: updatedUser.availableBalance.toString(),
        referenceId: depositIntent.id,
        description: input.ledgerDescription(depositIntent),
        metadata: input.ledgerMetadata(depositIntent),
      },
    });

    return {
      status: "PROCESSED" as const,
      depositIntentId: depositIntent.id,
      paymentCode: depositIntent.paymentCode,
      message: "Đã xác nhận giao dịch provider và cộng số dư ví đúng một lần.",
    };
  });
}
