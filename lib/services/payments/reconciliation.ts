import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import {
  DepositIntentStatus,
  DepositProvider,
} from "@/lib/generated/prisma/client";
import { reconcileNowPaymentsUsdtPayment } from "@/lib/services/payments/nowpayments";
import { reconcileSePayDepositIntent } from "@/lib/services/payments/sepay";

const RECONCILABLE_DEPOSIT_STATUSES = [
  DepositIntentStatus.PENDING,
  DepositIntentStatus.CONFIRMING,
  DepositIntentStatus.EXPIRED,
] satisfies DepositIntentStatus[];

const DEFAULT_RECONCILIATION_BATCH_SIZE = 50;
const MAX_RECONCILIATION_BATCH_SIZE = 100;
const DEFAULT_RECONCILIATION_LOOKBACK_HOURS = 48;
const MAX_RECONCILIATION_LOOKBACK_HOURS = 168;

type ReconciliationStatus =
  | "PROCESSED"
  | "DUPLICATED"
  | "IGNORED"
  | "CONFIRMING"
  | "FAILED"
  | "EXPIRED"
  | "UNDERPAID"
  | "OVERPAID"
  | "MANUAL_REVIEW_REQUIRED"
  | "SKIPPED";

export type DepositReconciliationItemResult = {
  depositIntentId: string;
  provider: DepositProvider;
  paymentCode: string;
  status: ReconciliationStatus;
  message: string;
};

export type DepositReconciliationSummary = {
  ok: boolean;
  scannedCount: number;
  processedCount: number;
  confirmingCount: number;
  skippedCount: number;
  failedCount: number;
  manualReviewCount: number;
  underpaidCount: number;
  overpaidCount: number;
  results: DepositReconciliationItemResult[];
  failures: Array<{
    depositIntentId: string;
    provider: DepositProvider;
    paymentCode: string;
    error: string;
  }>;
};

function normalizeBatchSize(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_RECONCILIATION_BATCH_SIZE;
  }

  return Math.max(1, Math.min(MAX_RECONCILIATION_BATCH_SIZE, Math.floor(value)));
}

function normalizeLookbackHours(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_RECONCILIATION_LOOKBACK_HOURS;
  }

  return Math.max(1, Math.min(MAX_RECONCILIATION_LOOKBACK_HOURS, Math.floor(value)));
}

function readDefaultLookbackHours() {
  const rawValue = process.env.DEPOSIT_RECONCILIATION_LOOKBACK_HOURS?.trim();

  if (!rawValue) {
    return DEFAULT_RECONCILIATION_LOOKBACK_HOURS;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  return normalizeLookbackHours(parsedValue);
}

function resolveNowPaymentsPaymentId(params: {
  providerTransactionId: string | null;
  providerReference: string | null;
}) {
  if (params.providerTransactionId) {
    return params.providerTransactionId;
  }

  if (params.providerReference && /^\d+$/.test(params.providerReference)) {
    return params.providerReference;
  }

  return null;
}

function getFailureMessage(error: unknown) {
  return error instanceof Error ? error.message : "Không thể đối soát lệnh nạp tiền này.";
}

export async function reconcileDepositIntents(params?: {
  batchSize?: number | null;
  lookbackHours?: number | null;
  now?: Date;
}): Promise<DepositReconciliationSummary> {
  const prisma = getPrisma();
  const now = params?.now ?? new Date();
  const batchSize = normalizeBatchSize(params?.batchSize);
  const lookbackHours = normalizeLookbackHours(params?.lookbackHours ?? readDefaultLookbackHours());
  const createdAfter = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const intents = await prisma.depositIntent.findMany({
    where: {
      provider: {
        in: [DepositProvider.SEPAY, DepositProvider.USDT],
      },
      status: {
        in: RECONCILABLE_DEPOSIT_STATUSES,
      },
      createdAt: {
        gte: createdAfter,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: batchSize,
    select: {
      id: true,
      provider: true,
      paymentCode: true,
      amount: true,
      providerTransactionId: true,
      providerReference: true,
      createdAt: true,
    },
  });
  const results: DepositReconciliationItemResult[] = [];
  const failures: DepositReconciliationSummary["failures"] = [];

  for (const intent of intents) {
    try {
      const result =
        intent.provider === DepositProvider.SEPAY
          ? await reconcileSePayDepositIntent({
              paymentCode: intent.paymentCode,
              expectedAmount: intent.amount.toString(),
              createdAt: intent.createdAt,
            })
          : await reconcileNowPaymentsUsdtPayment({
              paymentId: resolveNowPaymentsPaymentId({
                providerTransactionId: intent.providerTransactionId,
                providerReference: intent.providerReference,
              }),
              paymentCode: intent.paymentCode,
            });

      results.push({
        depositIntentId: result.depositIntentId ?? intent.id,
        provider: intent.provider,
        paymentCode: result.paymentCode ?? intent.paymentCode,
        status: result.status,
        message: result.message,
      });
    } catch (error) {
      failures.push({
        depositIntentId: intent.id,
        provider: intent.provider,
        paymentCode: intent.paymentCode,
        error: getFailureMessage(error),
      });
    }
  }

  const processedCount = results.filter((result) => result.status === "PROCESSED").length;
  const confirmingCount = results.filter((result) => result.status === "CONFIRMING").length;
  const skippedCount = results.filter(
    (result) => result.status === "SKIPPED" || result.status === "IGNORED" || result.status === "DUPLICATED",
  ).length;
  const manualReviewCount = results.filter(
    (result) => result.status === "MANUAL_REVIEW_REQUIRED",
  ).length;
  const underpaidCount = results.filter((result) => result.status === "UNDERPAID").length;
  const overpaidCount = results.filter((result) => result.status === "OVERPAID").length;

  if (
    processedCount > 0 ||
    confirmingCount > 0 ||
    manualReviewCount > 0 ||
    underpaidCount > 0 ||
    overpaidCount > 0
  ) {
    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/deposit");
  }

  return {
    ok: failures.length === 0,
    scannedCount: intents.length,
    processedCount,
    confirmingCount,
    skippedCount,
    failedCount: failures.length,
    manualReviewCount,
    underpaidCount,
    overpaidCount,
    results,
    failures,
  };
}
