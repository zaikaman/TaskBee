"use server";

import { createHash, randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { PLATFORM_FEES, WALLET_LIMITS } from "@/config/app";
import { PAYMENT_CONFIG } from "@/config/app";
import { auth, requireAuth } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  buildSePayBankTransferInstructions,
  reconcileSePayDepositIntent,
  type SePayBankTransferInstructions,
} from "@/lib/services/payments/sepay";
import { createNowPaymentsUsdtExchangeRateSnapshot } from "@/lib/services/payments/nowpayments";
import {
  DepositConfirmationStatus,
  DepositIntentStatus,
  DepositNetwork,
  DepositPaymentMethod,
  DepositProvider,
  NotificationType,
  Prisma,
  TransactionType,
  UserStatus,
  WithdrawalStatus,
} from "@/lib/generated/prisma/client";
import {
  calculateWithdrawalNet,
  formatVnd,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/utils/money";
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/utils/rate-limit";
import { notifyUser } from "@/lib/services/notifications";
import { captureTaskFlowEvent } from "@/lib/services/analytics";
import { getWithdrawalIntervalRequirementMessage } from "@/lib/services/worker-task-interval";
import {
  bankDetailsSchema,
  depositRequestSchema,
  getWalletValidationError,
  withdrawalAmountSchema,
  type BankDetails,
  type DepositRequest,
  type DepositRequestInput,
} from "@/lib/validators/wallet";

/**
 * Thông tin số dư ví của người dùng
 */
export type WalletBalance = {
  availableBalance: string;
  employerAvailableBalance: string;
  workerAvailableBalance: string;
  pendingBalance: string;
  escrowBalance: string;
  totalBalance: string;
  submitTaskIntervalSeconds: number;
  lastTaskCompletedAt: Date | null;
  canWithdrawByTaskInterval: boolean;
};

/**
 * Thông tin giao dịch trong lịch sử
 */
export type TransactionHistoryItem = {
  id: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  description: string;
  referenceId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

/**
 * Kết quả phân trang lịch sử giao dịch
 */
export type TransactionHistory = {
  transactions: TransactionHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

/**
 * Kết quả yêu cầu rút tiền
 */
export type RequestWithdrawalResult = {
  ok: boolean;
  message?: string;
  error?: string;
  errorCode?: WithdrawalRequestErrorCode;
  withdrawalId?: string;
  fee?: string;
  netAmount?: string;
};

export type TransferWorkerFundsToEmployerResult = {
  ok: boolean;
  message?: string;
  error?: string;
  transferredAmount?: string;
  employerAvailableBalance?: string;
  workerAvailableBalance?: string;
};

export type DepositLifecycleStatus = "PENDING" | "EXPIRED" | "CANCELLED" | "CONFIRMED";

export type DepositIntentDetails = {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  provider: DepositProvider;
  paymentMethod: DepositPaymentMethod;
  network: DepositNetwork | null;
  destinationAddress: string | null;
  paymentCode: string;
  status: DepositIntentStatus;
  lifecycleStatus: DepositLifecycleStatus;
  confirmationStatus: DepositConfirmationStatus;
  confirmations: number;
  requiredConfirmations: number;
  providerReference: string | null;
  providerTransactionId: string | null;
  confirmedAmount: string | null;
  confirmedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  exchangeRateSnapshot: Prisma.JsonValue | null;
  sepayTransferInstructions: SePayBankTransferInstructions | null;
};

export type CreateDepositIntentResult = {
  ok: boolean;
  message?: string;
  error?: string;
  depositIntent?: DepositIntentDetails;
};

export type CancelDepositIntentResult = {
  ok: boolean;
  message?: string;
  error?: string;
  depositIntent?: DepositIntentDetails;
};

export type WithdrawalRequestErrorCode =
  | "MINIMUM_WITHDRAWAL_NOT_MET"
  | "INSUFFICIENT_AVAILABLE_BALANCE"
  | "ACCOUNT_NOT_ACTIVE"
  | "TASK_INTERVAL_REQUIRED"
  | "PROFILE_REQUIRED";

type NormalizedWithdrawalInput = {
  amount: string;
  amountMinor: bigint;
  bankDetails: BankDetails;
};

type DepositIntentRecord = {
  id: string;
  userId: string;
  amount: Prisma.Decimal;
  currency: string;
  status: DepositIntentStatus;
  provider: DepositProvider;
  providerReference: string | null;
  providerTransactionId: string | null;
  paymentCode: string;
  paymentMethod: DepositPaymentMethod;
  network: DepositNetwork | null;
  destinationAddress: string | null;
  exchangeRateSnapshot: Prisma.JsonValue | null;
  confirmationStatus: DepositConfirmationStatus;
  confirmations: number;
  requiredConfirmations: number;
  confirmedAmount: Prisma.Decimal | null;
  confirmedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const depositIntentSelect = {
  id: true,
  userId: true,
  amount: true,
  currency: true,
  status: true,
  provider: true,
  providerReference: true,
  providerTransactionId: true,
  paymentCode: true,
  paymentMethod: true,
  network: true,
  destinationAddress: true,
  exchangeRateSnapshot: true,
  confirmationStatus: true,
  confirmations: true,
  requiredConfirmations: true,
  confirmedAmount: true,
  confirmedAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DepositIntentSelect;

const PAYMENT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEPOSIT_TERMINAL_STATUSES = new Set<DepositIntentStatus>([
  DepositIntentStatus.PAID,
  DepositIntentStatus.EXPIRED,
  DepositIntentStatus.CANCELLED,
  DepositIntentStatus.FAILED,
  DepositIntentStatus.UNDERPAID,
  DepositIntentStatus.OVERPAID,
  DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
]);
const DEPOSIT_REUSABLE_STATUSES = [
  DepositIntentStatus.PENDING,
  DepositIntentStatus.CONFIRMING,
] satisfies DepositIntentStatus[];
const DEPOSIT_PROVIDER_REFRESHABLE_STATUSES = new Set<DepositIntentStatus>([
  DepositIntentStatus.PENDING,
  DepositIntentStatus.CONFIRMING,
]);

class WithdrawalRequestError extends Error {
  constructor(
    message: string,
    readonly code: WithdrawalRequestErrorCode,
  ) {
    super(message);
    this.name = "WithdrawalRequestError";
  }
}

class DepositIntentServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DepositIntentServiceError";
  }
}

type WalletLedgerClient = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

function toNonNegativeMoneyString(amountMinor: bigint) {
  return fromMinorUnits(amountMinor > BigInt(0) ? amountMinor : BigInt(0));
}

function getAbsoluteMinorUnits(value: string | null | undefined) {
  if (!value) {
    return BigInt(0);
  }

  const amountMinor = toMinorUnits(value);

  return amountMinor < BigInt(0) ? -amountMinor : amountMinor;
}

export async function getWorkerAvailableBalanceMinor(db: WalletLedgerClient, userId: string) {
  const [rewardAggregate, transferAggregate, withdrawalAggregate] = await Promise.all([
    db.transaction.aggregate({
      where: {
        userId,
        type: TransactionType.TASK_REWARD,
      },
      _sum: {
        amount: true,
      },
    }),
    db.transaction.aggregate({
      where: {
        userId,
        type: TransactionType.WORKER_TO_EMPLOYER_TRANSFER,
      },
      _sum: {
        amount: true,
      },
    }),
    db.withdrawal.aggregate({
      where: {
        userId,
        status: {
          in: [WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED],
        },
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const rewardMinor = getAbsoluteMinorUnits(rewardAggregate._sum.amount?.toString());
  const transferredMinor = getAbsoluteMinorUnits(transferAggregate._sum.amount?.toString());
  const withdrawalMinor = getAbsoluteMinorUnits(withdrawalAggregate._sum.amount?.toString());

  return rewardMinor - transferredMinor - withdrawalMinor;
}

async function getWorkerAvailableBalance(db: WalletLedgerClient, userId: string) {
  return toNonNegativeMoneyString(await getWorkerAvailableBalanceMinor(db, userId));
}

function getDepositExpiresAt(now = new Date()) {
  return new Date(now.getTime() + PAYMENT_CONFIG.depositIntent.expiresAfterMinutes * 60_000);
}

function createDepositIdempotencyKey(userId: string, input: DepositRequest, now = new Date()) {
  const windowMs = PAYMENT_CONFIG.depositIntent.expiresAfterMinutes * 60_000;
  const retryWindow = Math.floor(now.getTime() / windowMs);
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        userId,
        amount: input.amount,
        provider: input.provider,
        currency: input.currency,
        paymentMethod: input.paymentMethod,
        network: input.usdtNetwork,
        retryWindow,
      }),
    )
    .digest("hex");

  return `deposit:${hash}`;
}

function createRandomIdempotencyKey() {
  return `deposit:${createHash("sha256")
    .update(`${Date.now()}:${randomInt(0, Number.MAX_SAFE_INTEGER)}`)
    .digest("hex")}`;
}

function generatePaymentCodeCandidate() {
  let suffix = "";

  for (let index = 0; index < PAYMENT_CONFIG.paymentCode.randomLength; index += 1) {
    suffix += PAYMENT_CODE_ALPHABET[randomInt(0, PAYMENT_CODE_ALPHABET.length)];
  }

  return `${PAYMENT_CONFIG.paymentCode.prefix}${PAYMENT_CONFIG.paymentCode.separator}${suffix}`;
}

async function generateUniquePaymentCode() {
  const prisma = getPrisma();

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const paymentCode = generatePaymentCodeCandidate();
    const existingIntent = await prisma.depositIntent.findUnique({
      where: {
        paymentCode,
      },
      select: {
        id: true,
      },
    });

    if (!existingIntent) {
      return paymentCode;
    }
  }

  throw new DepositIntentServiceError(
    "Không thể tạo mã thanh toán duy nhất lúc này. Vui lòng thử lại sau.",
  );
}

function resolveUsdtDestinationAddress(network: DepositNetwork | null) {
  if (!network) {
    return null;
  }

  const networkConfig = PAYMENT_CONFIG.usdt.networks.find((item) => item.code === network);

  if (!networkConfig) {
    throw new DepositIntentServiceError("Mạng USDT không được hỗ trợ.");
  }

  const destinationAddress = process.env[networkConfig.destinationAddressEnvVar]?.trim();

  if (!destinationAddress) {
    throw new DepositIntentServiceError(
      `Chưa cấu hình địa chỉ ví nhận tiền cho mạng ${network}. Vui lòng liên hệ quản trị viên.`,
    );
  }

  return destinationAddress;
}

function mapDepositLifecycleStatus(status: DepositIntentStatus): DepositLifecycleStatus {
  if (status === DepositIntentStatus.PAID) {
    return "CONFIRMED";
  }

  if (status === DepositIntentStatus.EXPIRED) {
    return "EXPIRED";
  }

  if (status === DepositIntentStatus.CANCELLED) {
    return "CANCELLED";
  }

  return "PENDING";
}

function serializeDepositIntent(depositIntent: DepositIntentRecord): DepositIntentDetails {
  return {
    id: depositIntent.id,
    userId: depositIntent.userId,
    amount: depositIntent.amount.toString(),
    currency: depositIntent.currency,
    provider: depositIntent.provider,
    paymentMethod: depositIntent.paymentMethod,
    network: depositIntent.network,
    destinationAddress: depositIntent.destinationAddress,
    paymentCode: depositIntent.paymentCode,
    status: depositIntent.status,
    lifecycleStatus: mapDepositLifecycleStatus(depositIntent.status),
    confirmationStatus: depositIntent.confirmationStatus,
    confirmations: depositIntent.confirmations,
    requiredConfirmations: depositIntent.requiredConfirmations,
    providerReference: depositIntent.providerReference,
    providerTransactionId: depositIntent.providerTransactionId,
    confirmedAmount: depositIntent.confirmedAmount?.toString() ?? null,
    confirmedAt: depositIntent.confirmedAt,
    expiresAt: depositIntent.expiresAt,
    createdAt: depositIntent.createdAt,
    updatedAt: depositIntent.updatedAt,
    exchangeRateSnapshot: depositIntent.exchangeRateSnapshot,
    sepayTransferInstructions:
      depositIntent.provider === DepositProvider.SEPAY
        ? buildSePayBankTransferInstructions({
            amount: depositIntent.amount.toString(),
            paymentCode: depositIntent.paymentCode,
          })
        : null,
  };
}

async function findReusableDepositIntent(userId: string, input: DepositRequest, now = new Date()) {
  const prisma = getPrisma();

  return prisma.depositIntent.findFirst({
    where: {
      userId,
      amount: input.amount,
      currency: input.currency,
      provider: input.provider as DepositProvider,
      paymentMethod: input.paymentMethod as DepositPaymentMethod,
      network: input.usdtNetwork as DepositNetwork | null,
      status: {
        in: DEPOSIT_REUSABLE_STATUSES,
      },
      expiresAt: {
        gt: now,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: depositIntentSelect,
  });
}

async function markExpiredDepositIntentIfNeeded(
  depositIntent: DepositIntentRecord,
  now = new Date(),
) {
  if (depositIntent.expiresAt > now || DEPOSIT_TERMINAL_STATUSES.has(depositIntent.status)) {
    return depositIntent;
  }

  const prisma = getPrisma();

  return prisma.depositIntent.update({
    where: {
      id: depositIntent.id,
    },
    data: {
      status: DepositIntentStatus.EXPIRED,
      confirmationStatus: DepositConfirmationStatus.REJECTED,
    },
    select: depositIntentSelect,
  });
}

function createMinimumWithdrawalError() {
  return new WithdrawalRequestError(
    `Số tiền rút tối thiểu là ${formatVnd(WALLET_LIMITS.minimumWithdrawalVnd)}.`,
    "MINIMUM_WITHDRAWAL_NOT_MET",
  );
}

function createInsufficientBalanceError(availableBalance: string, requestedAmount: string) {
  return new WithdrawalRequestError(
    `Số dư khả dụng không đủ. Bạn có ${formatVnd(availableBalance)} nhưng cần ${formatVnd(requestedAmount)} để tạo yêu cầu rút tiền.`,
    "INSUFFICIENT_AVAILABLE_BALANCE",
  );
}

function assertMinimumWithdrawalThreshold(amountMinor: bigint) {
  const minimumWithdrawalMinor = toMinorUnits(WALLET_LIMITS.minimumWithdrawalVnd);

  if (amountMinor < minimumWithdrawalMinor) {
    throw createMinimumWithdrawalError();
  }
}

function tryParseWithdrawalAmountMinor(amount: string | number) {
  try {
    const amountMinor = toMinorUnits(amount);

    if (amountMinor > BigInt(0) && amountMinor % BigInt(100) === BigInt(0)) {
      return amountMinor;
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeWithdrawalAmount(amount: string | number) {
  const normalizedAmountResult = withdrawalAmountSchema.safeParse(amount);

  if (!normalizedAmountResult.success) {
    const amountMinor = tryParseWithdrawalAmountMinor(amount);

    if (amountMinor !== null) {
      assertMinimumWithdrawalThreshold(amountMinor);
    }

    throw normalizedAmountResult.error;
  }

  const normalizedAmount = normalizedAmountResult.data;
  const amountMinor = toMinorUnits(normalizedAmount);
  assertMinimumWithdrawalThreshold(amountMinor);

  return {
    amount: fromMinorUnits(amountMinor),
    amountMinor,
  };
}

function normalizeWorkerTransferAmount(amount: string | number) {
  const normalizedAmount =
    typeof amount === "string"
      ? amount.trim().replaceAll(/[₫\s.]/g, "").replaceAll(",", "")
      : amount;
  const amountMinor = toMinorUnits(normalizedAmount);

  if (amountMinor <= BigInt(0) || amountMinor % BigInt(100) !== BigInt(0)) {
    throw new DepositIntentServiceError("Số tiền chuyển phải là số nguyên VND hợp lệ.");
  }

  return {
    amount: fromMinorUnits(amountMinor),
    amountMinor,
  };
}

function normalizeWithdrawalInput(
  amount: string | number,
  bankDetails: BankDetails,
): NormalizedWithdrawalInput {
  const normalizedAmount = normalizeWithdrawalAmount(amount);

  return {
    ...normalizedAmount,
    bankDetails: bankDetailsSchema.parse(bankDetails),
  };
}

/**
 * Tạo lệnh nạp tiền trung lập provider.
 *
 * Hàm này chỉ tạo intent, mã thanh toán ổn định và thông tin đối soát. Không cập nhật số dư ví.
 * Số dư chỉ được cộng bởi luồng xác nhận provider đáng tin cậy ở webhook hoặc reconciliation.
 */
export async function createDepositIntent(
  input: DepositRequestInput,
): Promise<CreateDepositIntentResult> {
  const session = await auth();

  try {

    if (!session.profile) {
      return {
        ok: false,
        error: "Vui lòng hoàn tất hồ sơ trước khi tạo lệnh nạp tiền.",
      };
    }

    const userId = session.profile.id;
    await enforceRateLimit({
      scope: "wallet:deposit:create",
      key: userId,
      limit: 30,
      windowSeconds: 60 * 60,
    });

    const normalizedInput = depositRequestSchema.parse(input);
    const now = new Date();
    const reusableIntent = await findReusableDepositIntent(userId, normalizedInput, now);

    if (reusableIntent) {
      return {
        ok: true,
        message: "Đã tìm thấy lệnh nạp tiền đang chờ xử lý. Vui lòng dùng lại mã thanh toán hiện có.",
        depositIntent: serializeDepositIntent(reusableIntent),
      };
    }

    const prisma = getPrisma();
    const deterministicIdempotencyKey = createDepositIdempotencyKey(userId, normalizedInput, now);
    const existingIntent = await prisma.depositIntent.findUnique({
      where: {
        idempotencyKey: deterministicIdempotencyKey,
      },
      select: depositIntentSelect,
    });

    if (existingIntent && !DEPOSIT_TERMINAL_STATUSES.has(existingIntent.status)) {
      const refreshedIntent = await markExpiredDepositIntentIfNeeded(existingIntent, now);

      if (!DEPOSIT_TERMINAL_STATUSES.has(refreshedIntent.status)) {
        return {
          ok: true,
          message: "Lệnh nạp tiền đã được tạo trước đó. Mã thanh toán được giữ nguyên.",
          depositIntent: serializeDepositIntent(refreshedIntent),
        };
      }
    }

    const idempotencyKey = existingIntent
      ? createRandomIdempotencyKey()
      : deterministicIdempotencyKey;
    const paymentCode = await generateUniquePaymentCode();
    const network = normalizedInput.usdtNetwork as DepositNetwork | null;
    const destinationAddress =
      normalizedInput.provider === DepositProvider.USDT ? resolveUsdtDestinationAddress(network) : null;
    const exchangeRateSnapshot =
      normalizedInput.provider === DepositProvider.USDT && network
        ? await createNowPaymentsUsdtExchangeRateSnapshot({
            amountVnd: normalizedInput.amount,
            network,
            now,
          })
        : null;

    if (normalizedInput.provider === DepositProvider.SEPAY) {
      buildSePayBankTransferInstructions({
        amount: normalizedInput.amount,
        paymentCode,
      });
    }

    const depositIntent = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`,
      );

      const user = await tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          status: true,
        },
      });

      if (user.status !== UserStatus.ACTIVE) {
        throw new DepositIntentServiceError(
          "Tài khoản không ở trạng thái hoạt động nên không thể tạo lệnh nạp tiền.",
        );
      }

      return tx.depositIntent.create({
        data: {
          userId,
          amount: normalizedInput.amount,
          currency: normalizedInput.currency,
          status: DepositIntentStatus.PENDING,
          provider: normalizedInput.provider as DepositProvider,
          idempotencyKey,
          paymentCode,
          paymentMethod: normalizedInput.paymentMethod as DepositPaymentMethod,
          network,
          destinationAddress,
          ...(exchangeRateSnapshot
            ? { exchangeRateSnapshot: exchangeRateSnapshot as Prisma.InputJsonValue }
            : {}),
          confirmationStatus: DepositConfirmationStatus.UNCONFIRMED,
          requiredConfirmations: normalizedInput.requiredConfirmations,
          expiresAt: getDepositExpiresAt(now),
        },
        select: depositIntentSelect,
      });
    });

    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/deposit");
    await notifyUser({
      userId,
      type: NotificationType.DEPOSIT_STATUS,
      title: "Lệnh nạp tiền đã được tạo",
      body: `Vui lòng thanh toán đúng số tiền ${formatVnd(normalizedInput.amount)} với mã ${depositIntent.paymentCode} để TaskBee tự động ghi có.`,
      data: {
        depositIntentId: depositIntent.id,
        paymentCode: depositIntent.paymentCode,
        provider: depositIntent.provider,
      },
      email: {
        subject: "TaskBee: Hướng dẫn thanh toán lệnh nạp tiền",
      },
    });
    await captureTaskFlowEvent(userId, "deposit_intent_created", {
      depositIntentId: depositIntent.id,
      provider: depositIntent.provider,
      paymentMethod: depositIntent.paymentMethod,
    });

    return {
      ok: true,
      message: `Đã tạo lệnh nạp tiền ${formatVnd(normalizedInput.amount)}. Vui lòng thanh toán đúng mã ${depositIntent.paymentCode}.`,
      depositIntent: serializeDepositIntent(depositIntent),
    };
  } catch (error) {
    console.error("Lỗi khi tạo lệnh nạp tiền:", error);

    return {
      ok: false,
      error: getRateLimitErrorMessage(error) ?? getWalletValidationError(error),
    };
  }
}

export async function transferWorkerFundsToEmployer(
  amount: string | number,
): Promise<TransferWorkerFundsToEmployerResult> {
  const session = await auth();

  try {

    if (!session.profile) {
      return {
        ok: false,
        error: "Vui lòng hoàn tất hồ sơ trước khi chuyển thu nhập sang ngân sách employer.",
      };
    }

    const normalizedAmount = normalizeWorkerTransferAmount(amount);
    const userId = session.profile.id;

    await enforceRateLimit({
      scope: "wallet:worker-to-employer-transfer",
      key: userId,
      limit: 20,
      windowSeconds: 60 * 60,
    });

    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`,
      );

      const user = await tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          availableBalance: true,
          submitTaskIntervalSeconds: true,
          status: true,
        },
      });

      if (user.status !== UserStatus.ACTIVE) {
        throw new DepositIntentServiceError(
          "Tài khoản không ở trạng thái hoạt động nên không thể chuyển thu nhập sang ngân sách employer.",
        );
      }

      const workerAvailableMinor = await getWorkerAvailableBalanceMinor(tx, userId);

      if (workerAvailableMinor < normalizedAmount.amountMinor) {
        throw new DepositIntentServiceError(
          `Thu nhập freelancer có thể chuyển không đủ. Bạn có ${formatVnd(toNonNegativeMoneyString(workerAvailableMinor))} nhưng cần ${formatVnd(normalizedAmount.amount)}.`,
        );
      }

      const nextWorkerAvailableMinor = workerAvailableMinor - normalizedAmount.amountMinor;
      const employerAvailableBalance = toNonNegativeMoneyString(
        toMinorUnits(user.availableBalance.toString()) - nextWorkerAvailableMinor,
      );

      await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.WORKER_TO_EMPLOYER_TRANSFER,
          amount: `-${normalizedAmount.amount}`,
          balanceAfter: user.availableBalance.toString(),
          description: `Chuyển ${formatVnd(normalizedAmount.amount)} từ thu nhập freelancer sang ngân sách employer.`,
          metadata: {
            amount: normalizedAmount.amount,
            workerAvailableBefore: toNonNegativeMoneyString(workerAvailableMinor),
            workerAvailableAfter: toNonNegativeMoneyString(nextWorkerAvailableMinor),
            employerAvailableAfter: employerAvailableBalance,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        transferredAmount: normalizedAmount.amount,
        employerAvailableBalance,
        workerAvailableBalance: toNonNegativeMoneyString(nextWorkerAvailableMinor),
      };
    });

    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/employer/tasks");

    return {
      ok: true,
      message: `Đã chuyển ${formatVnd(result.transferredAmount)} sang ngân sách employer. Khoản này sẽ không thể rút ở ví worker nữa.`,
      ...result,
    };
  } catch (error) {
    console.error("Lỗi khi chuyển thu nhập worker sang ngân sách employer:", error);

    return {
      ok: false,
      error: getRateLimitErrorMessage(error) ?? getWalletValidationError(error),
    };
  }
}

export async function getDepositIntent(depositIntentId: string) {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return null;
    }

    const prisma = getPrisma();
    const depositIntent = await prisma.depositIntent.findUnique({
      where: {
        id: depositIntentId,
        userId: session.profile.id,
      },
      select: depositIntentSelect,
    });

    if (!depositIntent) {
      return null;
    }

    const refreshedIntent = await markExpiredDepositIntentIfNeeded(depositIntent);

    return serializeDepositIntent(refreshedIntent);
  } catch (error) {
    console.error("Lỗi khi lấy lệnh nạp tiền:", error);
    return null;
  }
}

export async function refreshDepositIntentFromProvider(depositIntentId: string) {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return null;
    }

    const prisma = getPrisma();
    const depositIntent = await prisma.depositIntent.findUnique({
      where: {
        id: depositIntentId,
        userId: session.profile.id,
      },
      select: depositIntentSelect,
    });

    if (!depositIntent) {
      return null;
    }

    if (
      depositIntent.provider === DepositProvider.SEPAY &&
      DEPOSIT_PROVIDER_REFRESHABLE_STATUSES.has(depositIntent.status)
    ) {
      await enforceRateLimit({
        scope: "wallet:deposit-provider-refresh",
        key: `${session.profile.id}:${depositIntent.id}`,
        limit: 12,
        windowSeconds: 60,
      });

      const reconciliationResult = await reconcileSePayDepositIntent({
        paymentCode: depositIntent.paymentCode,
        expectedAmount: depositIntent.amount.toString(),
        createdAt: depositIntent.createdAt,
      });

      console.info("Kết quả đối soát nhanh lệnh nạp SePay:", {
        status: reconciliationResult.status,
        depositIntentId: reconciliationResult.depositIntentId ?? depositIntent.id,
        paymentCode: reconciliationResult.paymentCode,
        message: reconciliationResult.message,
      });
    }

    return getDepositIntent(depositIntentId);
  } catch (error) {
    console.error("Lỗi khi refresh lệnh nạp tiền từ provider:", error);

    return getDepositIntent(depositIntentId);
  }
}

export async function getDepositIntents(page = 1, pageSize = 10) {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return {
        depositIntents: [],
        pagination: {
          page: 1,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    const prisma = getPrisma();
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
    const skip = (normalizedPage - 1) * normalizedPageSize;
    const where: Prisma.DepositIntentWhereInput = {
      userId: session.profile.id,
    };
    const [totalCount, depositIntents] = await Promise.all([
      prisma.depositIntent.count({ where }),
      prisma.depositIntent.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: normalizedPageSize,
        select: depositIntentSelect,
      }),
    ]);
    const totalPages = Math.ceil(totalCount / normalizedPageSize);

    return {
      depositIntents: depositIntents.map(serializeDepositIntent),
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalCount,
        totalPages,
        hasNextPage: normalizedPage < totalPages,
        hasPreviousPage: normalizedPage > 1,
      },
    };
  } catch (error) {
    console.error("Lỗi khi lấy danh sách lệnh nạp tiền:", error);

    return {
      depositIntents: [],
      pagination: {
        page: 1,
        pageSize,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }
}

export async function cancelDepositIntent(
  depositIntentId: string,
): Promise<CancelDepositIntentResult> {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return {
        ok: false,
        error: "Vui lòng đăng nhập để hủy lệnh nạp tiền.",
      };
    }

    const userId = session.profile.id;
    const prisma = getPrisma();
    const depositIntent = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "DepositIntent" WHERE id = ${depositIntentId}::uuid FOR UPDATE`,
      );

      const currentIntent = await tx.depositIntent.findUnique({
        where: {
          id: depositIntentId,
          userId,
        },
        select: depositIntentSelect,
      });

      if (!currentIntent) {
        throw new DepositIntentServiceError(
          "Không tìm thấy lệnh nạp tiền hoặc bạn không có quyền hủy lệnh này.",
        );
      }

      const refreshedIntent =
        currentIntent.expiresAt <= new Date() &&
        !DEPOSIT_TERMINAL_STATUSES.has(currentIntent.status)
          ? await tx.depositIntent.update({
              where: {
                id: currentIntent.id,
              },
              data: {
                status: DepositIntentStatus.EXPIRED,
                confirmationStatus: DepositConfirmationStatus.REJECTED,
              },
              select: depositIntentSelect,
            })
          : currentIntent;

      if (refreshedIntent.status !== DepositIntentStatus.PENDING) {
        throw new DepositIntentServiceError(
          "Chỉ có thể hủy lệnh nạp tiền đang chờ thanh toán và chưa được provider xác nhận.",
        );
      }

      return tx.depositIntent.update({
        where: {
          id: refreshedIntent.id,
        },
        data: {
          status: DepositIntentStatus.CANCELLED,
          confirmationStatus: DepositConfirmationStatus.REJECTED,
        },
        select: depositIntentSelect,
      });
    });

    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/deposit");

    return {
      ok: true,
      message: "Đã hủy lệnh nạp tiền. Số dư ví không thay đổi.",
      depositIntent: serializeDepositIntent(depositIntent),
    };
  } catch (error) {
    console.error("Lỗi khi hủy lệnh nạp tiền:", error);

    return {
      ok: false,
      error: getWalletValidationError(error),
    };
  }
}

export async function expireDepositIntents(batchSize = 100) {
  const prisma = getPrisma();
  const normalizedBatchSize = Math.max(1, Math.min(500, Math.floor(batchSize)));
  const expiredIntents = await prisma.depositIntent.findMany({
    where: {
      status: {
        in: DEPOSIT_REUSABLE_STATUSES,
      },
      expiresAt: {
        lte: new Date(),
      },
    },
    take: normalizedBatchSize,
    select: {
      id: true,
    },
  });
  const expiredIds = expiredIntents.map((intent) => intent.id);

  if (expiredIds.length === 0) {
    return {
      expiredCount: 0,
    };
  }

  const result = await prisma.depositIntent.updateMany({
    where: {
      id: {
        in: expiredIds,
      },
      status: {
        in: DEPOSIT_REUSABLE_STATUSES,
      },
    },
    data: {
      status: DepositIntentStatus.EXPIRED,
      confirmationStatus: DepositConfirmationStatus.REJECTED,
    },
  });

  return {
    expiredCount: result.count,
  };
}

/**
 * Lấy thông tin số dư ví của người dùng hiện tại
 * 
 * @returns Thông tin số dư ví hoặc null nếu chưa đăng nhập
 */
export async function getWalletBalance(): Promise<WalletBalance | null> {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return null;
    }

    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: {
        id: session.profile.id,
      },
      select: {
        availableBalance: true,
        pendingBalance: true,
        escrowBalance: true,
        submitTaskIntervalSeconds: true,
        lastTaskCompletedAt: true,
      },
    });

    if (!user) {
      return null;
    }

    const availableBalance = user.availableBalance.toString();
    const pendingBalance = user.pendingBalance.toString();
    const escrowBalance = user.escrowBalance.toString();
    const workerAvailableBalance = await getWorkerAvailableBalance(prisma, session.profile.id);
    const employerAvailableBalance = toNonNegativeMoneyString(
      toMinorUnits(availableBalance) - toMinorUnits(workerAvailableBalance),
    );

    // Tính tổng số dư
    const totalBalanceMinor =
      toMinorUnits(availableBalance) +
      toMinorUnits(pendingBalance) +
      toMinorUnits(escrowBalance);

    return {
      availableBalance,
      employerAvailableBalance,
      workerAvailableBalance,
      pendingBalance,
      escrowBalance,
      totalBalance: fromMinorUnits(totalBalanceMinor),
      submitTaskIntervalSeconds: user.submitTaskIntervalSeconds,
      lastTaskCompletedAt: user.lastTaskCompletedAt,
      canWithdrawByTaskInterval: user.submitTaskIntervalSeconds <= 0,
    };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin số dư ví:", error);
    return null;
  }
}

/**
 * Lấy lịch sử giao dịch của người dùng hiện tại với phân trang
 * 
 * @param page - Trang hiện tại (bắt đầu từ 1)
 * @param pageSize - Số lượng giao dịch mỗi trang (mặc định 20)
 * @param type - Lọc theo loại giao dịch (tùy chọn)
 * @returns Lịch sử giao dịch với thông tin phân trang
 */
export async function getTransactionHistory(
  page = 1,
  pageSize = 20,
  type?: TransactionType,
): Promise<TransactionHistory> {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return {
        transactions: [],
        pagination: {
          page: 1,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    const prisma = getPrisma();

    // Validate và normalize page
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.max(1, Math.min(100, Math.floor(pageSize)));
    const skip = (normalizedPage - 1) * normalizedPageSize;

    // Build where clause
    const where: Prisma.TransactionWhereInput = {
      userId: session.profile.id,
      ...(type && { type }),
    };

    // Lấy tổng số giao dịch
    const totalCount = await prisma.transaction.count({
      where,
    });

    // Lấy danh sách giao dịch
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: normalizedPageSize,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        description: true,
        referenceId: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Tính toán thông tin phân trang
    const totalPages = Math.ceil(totalCount / normalizedPageSize);
    const hasNextPage = normalizedPage < totalPages;
    const hasPreviousPage = normalizedPage > 1;

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.toString(),
        balanceAfter: tx.balanceAfter.toString(),
        description: tx.description,
        referenceId: tx.referenceId,
        metadata: tx.metadata,
        createdAt: tx.createdAt,
      })),
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  } catch (error) {
    console.error("Lỗi khi lấy lịch sử giao dịch:", error);
    return {
      transactions: [],
      pagination: {
        page: 1,
        pageSize,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }
}

/**
 * Tạo yêu cầu rút tiền với phí 10%
 * 
 * Quy trình:
 * 1. Kiểm tra số dư khả dụng
 * 2. Kiểm tra ngưỡng rút tiền tối thiểu
 * 3. Tính phí rút tiền (10%)
 * 4. Trừ số dư khả dụng, cộng số dư đang chờ
 * 5. Tạo bản ghi withdrawal với trạng thái PENDING
 * 6. Ghi bút toán vào ledger
 * 
 * @param amount - Số tiền muốn rút (trước khi trừ phí)
 * @param bankDetails - Thông tin tài khoản ngân hàng
 * @returns Kết quả yêu cầu rút tiền
 */
export async function requestWithdrawal(
  amount: string | number,
  bankDetails: BankDetails,
): Promise<RequestWithdrawalResult> {
  const session = await auth();

  try {

    if (!session.profile) {
      return {
        ok: false,
        error: "Vui lòng hoàn tất hồ sơ trước khi thực hiện rút tiền.",
        errorCode: "PROFILE_REQUIRED",
      };
    }

    const userId = session.profile.id;
    await enforceRateLimit({
      scope: "wallet:withdrawal:create",
      key: userId,
      limit: 10,
      windowSeconds: 60 * 60,
    });

    const input = normalizeWithdrawalInput(amount, bankDetails);
    const { fee, netAmount } = calculateWithdrawalNet(input.amount);
    const feeMinor = toMinorUnits(fee);
    const netAmountMinor = toMinorUnits(netAmount);

    const prisma = getPrisma();

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`,
      );

      const currentUser = await tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          availableBalance: true,
          submitTaskIntervalSeconds: true,
          status: true,
        },
      });

      if (currentUser.status !== UserStatus.ACTIVE) {
        throw new WithdrawalRequestError(
          "Tài khoản không ở trạng thái hoạt động nên không thể rút tiền.",
          "ACCOUNT_NOT_ACTIVE",
        );
      }

      if (currentUser.submitTaskIntervalSeconds > 0) {
        throw new WithdrawalRequestError(
          getWithdrawalIntervalRequirementMessage(currentUser.submitTaskIntervalSeconds),
          "TASK_INTERVAL_REQUIRED",
        );
      }

      const currentAvailableMinor = toMinorUnits(currentUser.availableBalance.toString());
      const workerAvailableMinor = await getWorkerAvailableBalanceMinor(tx, userId);
      const withdrawableMinor =
        currentAvailableMinor < workerAvailableMinor ? currentAvailableMinor : workerAvailableMinor;

      if (withdrawableMinor < input.amountMinor) {
        throw createInsufficientBalanceError(fromMinorUnits(withdrawableMinor), input.amount);
      }

      const walletUpdate = await tx.user.updateMany({
        where: {
          id: userId,
          status: UserStatus.ACTIVE,
          availableBalance: {
            gte: input.amount,
          },
        },
        data: {
          availableBalance: {
            decrement: input.amount,
          },
          pendingBalance: {
            increment: input.amount,
          },
        },
      });

      if (walletUpdate.count !== 1) {
        throw createInsufficientBalanceError(fromMinorUnits(withdrawableMinor), input.amount);
      }

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          availableBalance: true,
          pendingBalance: true,
        },
      });

      const newAvailableBalance = updatedUser.availableBalance.toString();
      const newPendingBalance = updatedUser.pendingBalance.toString();

      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          amount: input.amount,
          fee: fee,
          netAmount: netAmount,
          status: WithdrawalStatus.PENDING,
          bankDetails: input.bankDetails as Prisma.InputJsonValue,
        },
      });

      const ledgerEntries: Prisma.TransactionCreateManyInput[] = [
        {
          userId,
          type: TransactionType.WITHDRAWAL,
          amount: `-${netAmount}`,
          balanceAfter: fromMinorUnits(currentAvailableMinor - netAmountMinor),
          referenceId: withdrawal.id,
          description: `Tạo yêu cầu rút tiền ${formatVnd(input.amount)} về tài khoản ${input.bankDetails.bankName} - ${input.bankDetails.accountNumber}. Số tiền thực nhận dự kiến là ${formatVnd(netAmount)}.`,
          metadata: {
            withdrawalId: withdrawal.id,
            requestedAmount: input.amount,
            fee,
            netAmount,
            feeRate: PLATFORM_FEES.workerWithdrawalRate,
            bankDetails: input.bankDetails,
            pendingBalanceAfter: newPendingBalance,
          } as Prisma.InputJsonValue,
        },
      ];

      if (feeMinor > BigInt(0)) {
        ledgerEntries.push({
          userId,
          type: TransactionType.WITHDRAWAL_FEE,
          amount: `-${fee}`,
          balanceAfter: newAvailableBalance,
          referenceId: withdrawal.id,
          description: `Phí rút tiền ${formatVnd(fee)} (10% của ${formatVnd(input.amount)}).`,
          metadata: {
            withdrawalId: withdrawal.id,
            requestedAmount: input.amount,
            fee,
            netAmount,
            feeRate: PLATFORM_FEES.workerWithdrawalRate,
            pendingBalanceAfter: newPendingBalance,
          } as Prisma.InputJsonValue,
        });
      }

      await tx.transaction.createMany({
        data: ledgerEntries,
      });

      return {
        withdrawalId: withdrawal.id,
        fee,
        netAmount,
        requestedAmount: input.amount,
      };
    });

    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/history");
    await notifyUser({
      userId,
      type: NotificationType.WITHDRAWAL_STATUS,
      title: "Yêu cầu rút tiền đã được tạo",
      body: `TaskBee đã nhận yêu cầu rút ${formatVnd(result.requestedAmount)}. Bạn sẽ nhận ${formatVnd(result.netAmount)} sau khi admin duyệt.`,
      data: {
        withdrawalId: result.withdrawalId,
        amount: result.requestedAmount,
        fee: result.fee,
        netAmount: result.netAmount,
      },
      email: {
        subject: "TaskBee: Đã nhận yêu cầu rút tiền",
      },
    });
    await captureTaskFlowEvent(userId, "withdrawal_requested", {
      withdrawalId: result.withdrawalId,
      amount: result.requestedAmount,
    });

    return {
      ok: true,
      message: `Yêu cầu rút tiền ${formatVnd(result.requestedAmount)} đã được tạo thành công. Bạn sẽ nhận ${formatVnd(result.netAmount)} sau khi admin duyệt (phí ${formatVnd(result.fee)}).`,
      withdrawalId: result.withdrawalId,
      fee: result.fee,
      netAmount: result.netAmount,
    };
  } catch (error) {
    if (!(error instanceof WithdrawalRequestError)) {
      console.error("Lỗi khi tạo yêu cầu rút tiền:", error);
    }

    return {
      ok: false,
      error: getRateLimitErrorMessage(error) ?? getWalletValidationError(error),
      errorCode: error instanceof WithdrawalRequestError ? error.code : undefined,
    };
  }
}

/**
 * Lấy danh sách yêu cầu rút tiền của người dùng hiện tại
 * 
 * @param status - Lọc theo trạng thái (tùy chọn)
 * @param page - Trang hiện tại (bắt đầu từ 1)
 * @param pageSize - Số lượng mỗi trang (mặc định 10)
 * @returns Danh sách yêu cầu rút tiền với phân trang
 */
export async function getWithdrawalRequests(
  status?: WithdrawalStatus,
  page = 1,
  pageSize = 10,
) {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return {
        withdrawals: [],
        pagination: {
          page: 1,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    const prisma = getPrisma();

    // Validate và normalize page
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
    const skip = (normalizedPage - 1) * normalizedPageSize;

    // Build where clause
    const where: Prisma.WithdrawalWhereInput = {
      userId: session.profile.id,
      ...(status && { status }),
    };

    // Lấy tổng số withdrawal
    const totalCount = await prisma.withdrawal.count({
      where,
    });

    // Lấy danh sách withdrawal
    const withdrawals = await prisma.withdrawal.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: normalizedPageSize,
      select: {
        id: true,
        amount: true,
        fee: true,
        netAmount: true,
        status: true,
        bankDetails: true,
        adminFeedback: true,
        processedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Tính toán thông tin phân trang
    const totalPages = Math.ceil(totalCount / normalizedPageSize);
    const hasNextPage = normalizedPage < totalPages;
    const hasPreviousPage = normalizedPage > 1;

    return {
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount.toString(),
        fee: w.fee.toString(),
        netAmount: w.netAmount.toString(),
        status: w.status,
        bankDetails: w.bankDetails as BankDetails,
        adminFeedback: w.adminFeedback,
        processedAt: w.processedAt,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  } catch (error) {
    console.error("Lỗi khi lấy danh sách yêu cầu rút tiền:", error);
    return {
      withdrawals: [],
      pagination: {
        page: 1,
        pageSize,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }
}

/**
 * Hủy yêu cầu rút tiền đang PENDING
 * Hoàn lại số tiền từ pending về available
 * 
 * @param withdrawalId - ID của yêu cầu rút tiền
 * @returns Kết quả hủy yêu cầu
 */
export async function cancelWithdrawal(withdrawalId: string): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return {
        ok: false,
        error: "Vui lòng đăng nhập để thực hiện thao tác này.",
      };
    }

    const prisma = getPrisma();

    return await prisma.$transaction(async (tx) => {
      // Lấy thông tin withdrawal
      const withdrawal = await tx.withdrawal.findUnique({
        where: {
          id: withdrawalId,
          userId: session.profile!.id,
        },
        select: {
          id: true,
          amount: true,
          status: true,
          userId: true,
        },
      });

      if (!withdrawal) {
        return {
          ok: false,
          error: "Không tìm thấy yêu cầu rút tiền hoặc bạn không có quyền hủy yêu cầu này.",
        };
      }

      // Chỉ có thể hủy withdrawal đang PENDING
      if (withdrawal.status !== WithdrawalStatus.PENDING) {
        return {
          ok: false,
          error: `Không thể hủy yêu cầu rút tiền đang ở trạng thái ${withdrawal.status}. Chỉ có thể hủy yêu cầu đang chờ xử lý.`,
        };
      }

      const amount = withdrawal.amount.toString();

      // Cập nhật trạng thái withdrawal
      await tx.withdrawal.update({
        where: {
          id: withdrawalId,
        },
        data: {
          status: WithdrawalStatus.CANCELLED,
          updatedAt: new Date(),
        },
      });

      // Hoàn lại số dư: trừ pending, cộng available
      const updatedUser = await tx.user.update({
        where: {
          id: session.profile!.id,
        },
        data: {
          pendingBalance: {
            decrement: amount,
          },
          availableBalance: {
            increment: amount,
          },
        },
        select: {
          availableBalance: true,
        },
      });

      const newAvailableBalance = updatedUser.availableBalance.toString();

      // Ghi bút toán hoàn tiền
      await tx.transaction.create({
        data: {
          userId: session.profile!.id,
          type: TransactionType.WITHDRAWAL,
          amount: amount,
          balanceAfter: newAvailableBalance,
          referenceId: withdrawalId,
          description: `Hủy yêu cầu rút tiền ${formatVnd(amount)}. Số tiền đã được hoàn lại vào ví.`,
          metadata: {
            withdrawalId: withdrawalId,
            cancelledAmount: amount,
            reason: "Người dùng hủy yêu cầu",
          } as Prisma.InputJsonValue,
        },
      });

      return {
        ok: true,
        message: `Yêu cầu rút tiền ${formatVnd(amount)} đã được hủy thành công. Số tiền đã được hoàn lại vào ví.`,
      };
    });
  } catch (error) {
    console.error("Lỗi khi hủy yêu cầu rút tiền:", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể hủy yêu cầu rút tiền lúc này. Vui lòng thử lại sau.",
    };
  } finally {
    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/history");
  }
}
