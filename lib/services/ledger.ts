import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  Prisma,
  TaskStatus,
  TransactionType,
  UserStatus,
  WithdrawalStatus,
} from "@/lib/generated/prisma/client";
import { fromMinorUnits, toMinorUnits } from "@/lib/utils/money";

export type LedgerReconciliationSeverity = "ERROR" | "WARNING";

export type LedgerReconciliationIssueCode =
  | "INVALID_MONEY_VALUE"
  | "NEGATIVE_WALLET_BALANCE"
  | "NEGATIVE_TRANSACTION_BALANCE"
  | "UNEXPECTED_TRANSACTION_SIGN"
  | "MISSING_REFERENCE"
  | "BROKEN_REFERENCE"
  | "PENDING_BALANCE_MISMATCH"
  | "ESCROW_BALANCE_MISMATCH"
  | "TRANSACTION_BALANCE_CHAIN_MISMATCH"
  | "TRANSACTION_BALANCE_FINAL_MISMATCH"
  | "NEGATIVE_OPENING_BALANCE";

export type LedgerReconciliationIssue = {
  severity: LedgerReconciliationSeverity;
  code: LedgerReconciliationIssueCode;
  message: string;
  userId?: string;
  transactionId?: string;
  referenceId?: string | null;
  expected?: string;
  actual?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type LedgerReconciledUser = {
  userId: string;
  email: string;
  availableBalance: string;
  pendingBalance: string;
  escrowBalance: string;
  totalBalance: string;
  expectedPendingBalance: string;
  expectedEscrowBalance: string;
  transactionCount: number;
  issues: LedgerReconciliationIssue[];
};

export type LedgerReconciliationSummary = {
  checkedUsers: number;
  checkedTransactions: number;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  isConsistent: boolean;
};

export type LedgerReconciliationResult = {
  summary: LedgerReconciliationSummary;
  users: LedgerReconciledUser[];
  issues: LedgerReconciliationIssue[];
};

export type ReconcileLedgerOptions = {
  userId?: string;
  includeHealthyUsers?: boolean;
};

export type AdminAdjustmentLedgerInput = {
  adminId: string;
  targetUserId: string;
  amount: string;
  reason: string;
  metadata?: Prisma.InputJsonValue;
};

type WalletBucket = "available" | "escrow";

type WalletEffect = {
  bucket: WalletBucket;
  amountMinor: bigint;
  hasBalanceAfter: boolean;
};

type SelectedTransaction = Awaited<
  ReturnType<typeof loadTransactions>
>[number];

type SelectedUser = Awaited<ReturnType<typeof loadUsers>>[number];

const TASK_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.TASK_ESCROW_LOCK,
  TransactionType.TASK_ESCROW_RELEASE,
  TransactionType.TASK_REWARD,
  TransactionType.TASK_CREATION_FEE,
]);

const WITHDRAWAL_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.WITHDRAWAL,
  TransactionType.WITHDRAWAL_FEE,
]);

const DEPOSIT_TRANSACTION_TYPES = new Set<TransactionType>([
  TransactionType.DEPOSIT,
  TransactionType.DEPOSIT_FEE,
]);

const ALWAYS_POSITIVE_TYPES = new Set<TransactionType>([
  TransactionType.DEPOSIT,
  TransactionType.TASK_REWARD,
]);

const ALWAYS_NEGATIVE_TYPES = new Set<TransactionType>([
  TransactionType.DEPOSIT_FEE,
  TransactionType.WITHDRAWAL_FEE,
  TransactionType.TASK_ESCROW_LOCK,
  TransactionType.TASK_CREATION_FEE,
]);

function createIssue(issue: LedgerReconciliationIssue): LedgerReconciliationIssue {
  return issue;
}

function compareMoney(left: bigint, right: bigint) {
  return left === right;
}

function toMoneyString(value: bigint) {
  return fromMinorUnits(value);
}

function assertNonZeroMoneyAmount(amount: string) {
  const amountMinor = toMinorUnits(amount);

  if (amountMinor === BigInt(0)) {
    throw new Error("Bút toán điều chỉnh phải có số tiền khác 0.");
  }

  return amountMinor;
}

function assertAdjustmentReason(reason: string) {
  const normalizedReason = reason.trim();

  if (normalizedReason.length < 10) {
    throw new Error("Lý do điều chỉnh ledger phải có ít nhất 10 ký tự.");
  }

  if (normalizedReason.length > 500) {
    throw new Error("Lý do điều chỉnh ledger không được vượt quá 500 ký tự.");
  }

  return normalizedReason;
}

function createAdjustmentMetadata(params: {
  adminId: string;
  targetUserId: string;
  reason: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return {
    kind: "ADMIN_ADJUSTMENT",
    adminId: params.adminId,
    targetUserId: params.targetUserId,
    reason: params.reason,
    source: "LEDGER_ADJUSTMENT_SERVICE",
    metadata: params.metadata ?? null,
  } satisfies Prisma.InputJsonValue;
}

export async function recordAdminAdjustmentLedgerEntry(input: AdminAdjustmentLedgerInput) {
  const prisma = getPrisma();
  const amountMinor = assertNonZeroMoneyAmount(input.amount);
  const normalizedAmount = fromMinorUnits(amountMinor);
  const reason = assertAdjustmentReason(input.reason);

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "User" WHERE id = ${input.targetUserId}::uuid FOR UPDATE`,
    );

    const targetUser = await tx.user.findUniqueOrThrow({
      where: {
        id: input.targetUserId,
      },
      select: {
        availableBalance: true,
        status: true,
      },
    });

    if (targetUser.status !== UserStatus.ACTIVE) {
      throw new Error("Chỉ có thể ghi điều chỉnh ledger cho tài khoản đang hoạt động.");
    }

    const currentAvailableMinor = toMinorUnits(targetUser.availableBalance.toString());
    const nextAvailableMinor = currentAvailableMinor + amountMinor;

    if (nextAvailableMinor < BigInt(0)) {
      throw new Error("Điều chỉnh ledger sẽ làm số dư khả dụng âm nên đã bị từ chối.");
    }

    const updatedUser = await tx.user.update({
      where: {
        id: input.targetUserId,
      },
      data: {
        availableBalance: {
          increment: normalizedAmount,
        },
      },
      select: {
        availableBalance: true,
      },
    });

    return tx.transaction.create({
      data: {
        userId: input.targetUserId,
        type: TransactionType.ADMIN_ADJUSTMENT,
        amount: normalizedAmount,
        balanceAfter: updatedUser.availableBalance.toString(),
        referenceId: null,
        description: `Điều chỉnh số dư bởi quản trị viên. Lý do: ${reason}`,
        metadata: createAdjustmentMetadata({
          adminId: input.adminId,
          targetUserId: input.targetUserId,
          reason,
          metadata: input.metadata,
        }),
      },
    });
  });
}

function parseMoneyIssue(
  value: Prisma.Decimal,
  fieldName: string,
  userId: string,
  issues: LedgerReconciliationIssue[],
  transactionId?: string,
) {
  try {
    return toMinorUnits(value.toString());
  } catch {
    issues.push(
      createIssue({
        severity: "ERROR",
        code: "INVALID_MONEY_VALUE",
        message: `Giá trị tiền ở trường ${fieldName} không hợp lệ.`,
        userId,
        transactionId,
        actual: value.toString(),
      }),
    );

    return BigInt(0);
  }
}

function getTransactionEffects(
  transaction: Pick<SelectedTransaction, "type">,
  amountMinor: bigint,
): WalletEffect[] {
  if (transaction.type === TransactionType.TASK_ESCROW_LOCK) {
    return [
      {
        bucket: "available",
        amountMinor,
        hasBalanceAfter: true,
      },
      {
        bucket: "escrow",
        amountMinor: -amountMinor,
        hasBalanceAfter: false,
      },
    ];
  }

  if (transaction.type === TransactionType.TASK_ESCROW_RELEASE && amountMinor > BigInt(0)) {
    return [
      {
        bucket: "available",
        amountMinor,
        hasBalanceAfter: true,
      },
      {
        bucket: "escrow",
        amountMinor: -amountMinor,
        hasBalanceAfter: false,
      },
    ];
  }

  if (transaction.type === TransactionType.TASK_ESCROW_RELEASE && amountMinor < BigInt(0)) {
    return [
      {
        bucket: "escrow",
        amountMinor,
        hasBalanceAfter: true,
      },
    ];
  }

  return [
    {
      bucket: "available",
      amountMinor,
      hasBalanceAfter: true,
    },
  ];
}

function validateTransactionSign(transaction: SelectedTransaction, amountMinor: bigint) {
  if (amountMinor === BigInt(0)) {
    return createIssue({
      severity: "WARNING" as const,
      code: "UNEXPECTED_TRANSACTION_SIGN" as const,
      message: "Giao dịch có số tiền bằng 0 nên cần kiểm tra lại nguồn ghi ledger.",
      userId: transaction.userId,
      transactionId: transaction.id,
      referenceId: transaction.referenceId,
      actual: transaction.amount.toString(),
    });
  }

  if (ALWAYS_POSITIVE_TYPES.has(transaction.type) && amountMinor < BigInt(0)) {
    return createIssue({
      severity: "ERROR" as const,
      code: "UNEXPECTED_TRANSACTION_SIGN" as const,
      message: `Giao dịch ${transaction.type} phải ghi số tiền dương.`,
      userId: transaction.userId,
      transactionId: transaction.id,
      referenceId: transaction.referenceId,
      actual: transaction.amount.toString(),
    });
  }

  if (ALWAYS_NEGATIVE_TYPES.has(transaction.type) && amountMinor > BigInt(0)) {
    return createIssue({
      severity: "ERROR" as const,
      code: "UNEXPECTED_TRANSACTION_SIGN" as const,
      message: `Giao dịch ${transaction.type} phải ghi số tiền âm.`,
      userId: transaction.userId,
      transactionId: transaction.id,
      referenceId: transaction.referenceId,
      actual: transaction.amount.toString(),
    });
  }

  return null;
}

function getReferenceType(transactionType: TransactionType) {
  if (TASK_TRANSACTION_TYPES.has(transactionType)) {
    return "task";
  }

  if (WITHDRAWAL_TRANSACTION_TYPES.has(transactionType)) {
    return "withdrawal";
  }

  if (DEPOSIT_TRANSACTION_TYPES.has(transactionType)) {
    return "deposit";
  }

  return null;
}

function validateReference(
  transaction: SelectedTransaction,
  references: {
    taskIds: ReadonlySet<string>;
    withdrawalIds: ReadonlySet<string>;
    depositIntentIds: ReadonlySet<string>;
    manualDepositIds: ReadonlySet<string>;
  },
) {
  const referenceType = getReferenceType(transaction.type);

  if (!referenceType) {
    return null;
  }

  if (!transaction.referenceId) {
    return createIssue({
      severity: "ERROR" as const,
      code: "MISSING_REFERENCE" as const,
      message: `Giao dịch ${transaction.type} thiếu referenceId để đối soát.`,
      userId: transaction.userId,
      transactionId: transaction.id,
    });
  }

  const referenceExists =
    (referenceType === "task" && references.taskIds.has(transaction.referenceId)) ||
    (referenceType === "withdrawal" && references.withdrawalIds.has(transaction.referenceId)) ||
    (referenceType === "deposit" &&
      (references.depositIntentIds.has(transaction.referenceId) ||
        references.manualDepositIds.has(transaction.referenceId)));

  if (!referenceExists) {
    return createIssue({
      severity: "ERROR" as const,
      code: "BROKEN_REFERENCE" as const,
      message: `Không tìm thấy dữ liệu gốc cho giao dịch ${transaction.type}.`,
      userId: transaction.userId,
      transactionId: transaction.id,
      referenceId: transaction.referenceId,
      metadata: {
        referenceType,
      },
    });
  }

  return null;
}

function groupByUserId<T extends { userId: string }>(records: T[]) {
  const groups = new Map<string, T[]>();

  for (const record of records) {
    const current = groups.get(record.userId) ?? [];
    current.push(record);
    groups.set(record.userId, current);
  }

  return groups;
}

async function loadUsers(userId?: string) {
  const prisma = getPrisma();

  return prisma.user.findMany({
    where: userId ? { id: userId } : undefined,
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      email: true,
      availableBalance: true,
      pendingBalance: true,
      escrowBalance: true,
    },
  });
}

async function loadTransactions(userIds: string[]) {
  const prisma = getPrisma();

  if (userIds.length === 0) {
    return [];
  }

  return prisma.transaction.findMany({
    where: {
      userId: {
        in: userIds,
      },
    },
    orderBy: [
      {
        userId: "asc",
      },
      {
        createdAt: "asc",
      },
      {
        id: "asc",
      },
    ],
    select: {
      id: true,
      userId: true,
      type: true,
      amount: true,
      balanceAfter: true,
      referenceId: true,
      createdAt: true,
    },
  });
}

async function loadExpectedPendingBalances(userIds: string[]) {
  const prisma = getPrisma();
  const pendingByUserId = new Map<string, bigint>();

  if (userIds.length === 0) {
    return pendingByUserId;
  }

  const pendingWithdrawals = await prisma.withdrawal.findMany({
    where: {
      userId: {
        in: userIds,
      },
      status: WithdrawalStatus.PENDING,
    },
    select: {
      userId: true,
      amount: true,
    },
  });

  for (const withdrawal of pendingWithdrawals) {
    const current = pendingByUserId.get(withdrawal.userId) ?? BigInt(0);
    pendingByUserId.set(withdrawal.userId, current + toMinorUnits(withdrawal.amount.toString()));
  }

  return pendingByUserId;
}

async function loadExpectedEscrowBalances(userIds: string[]) {
  const prisma = getPrisma();
  const escrowByUserId = new Map<string, bigint>();

  if (userIds.length === 0) {
    return escrowByUserId;
  }

  const openTasks = await prisma.task.findMany({
    where: {
      employerId: {
        in: userIds,
      },
      status: {
        in: [TaskStatus.ACTIVE, TaskStatus.PAUSED],
      },
    },
    select: {
      employerId: true,
      escrowAmount: true,
      rewardAmount: true,
      approvedSlots: true,
      id: true,
    },
  });

  for (const task of openTasks) {
    const escrowAmountMinor = toMinorUnits(task.escrowAmount.toString());
    const paidOutMinor = toMinorUnits(task.rewardAmount.toString()) * BigInt(task.approvedSlots);
    const remainingEscrowMinor = escrowAmountMinor - paidOutMinor;
    const current = escrowByUserId.get(task.employerId) ?? BigInt(0);

    escrowByUserId.set(
      task.employerId,
      current + (remainingEscrowMinor > BigInt(0) ? remainingEscrowMinor : BigInt(0)),
    );
  }

  return escrowByUserId;
}

async function loadReferenceSets(transactions: SelectedTransaction[]) {
  const prisma = getPrisma();
  const taskReferenceIds = new Set<string>();
  const withdrawalReferenceIds = new Set<string>();
  const depositReferenceIds = new Set<string>();

  for (const transaction of transactions) {
    if (!transaction.referenceId) {
      continue;
    }

    const referenceType = getReferenceType(transaction.type);

    if (referenceType === "task") {
      taskReferenceIds.add(transaction.referenceId);
    } else if (referenceType === "withdrawal") {
      withdrawalReferenceIds.add(transaction.referenceId);
    } else if (referenceType === "deposit") {
      depositReferenceIds.add(transaction.referenceId);
    }
  }

  const [tasks, withdrawals, depositIntents, manualDeposits] = await Promise.all([
    taskReferenceIds.size > 0
      ? prisma.task.findMany({
          where: {
            id: {
              in: Array.from(taskReferenceIds),
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve([]),
    withdrawalReferenceIds.size > 0
      ? prisma.withdrawal.findMany({
          where: {
            id: {
              in: Array.from(withdrawalReferenceIds),
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve([]),
    depositReferenceIds.size > 0
      ? prisma.depositIntent.findMany({
          where: {
            id: {
              in: Array.from(depositReferenceIds),
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve([]),
    depositReferenceIds.size > 0
      ? prisma.manualDeposit.findMany({
          where: {
            id: {
              in: Array.from(depositReferenceIds),
            },
          },
          select: {
            id: true,
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    taskIds: new Set(tasks.map((task) => task.id)),
    withdrawalIds: new Set(withdrawals.map((withdrawal) => withdrawal.id)),
    depositIntentIds: new Set(depositIntents.map((depositIntent) => depositIntent.id)),
    manualDepositIds: new Set(manualDeposits.map((manualDeposit) => manualDeposit.id)),
  };
}

function reconcileTransactionChain(
  user: SelectedUser,
  transactions: SelectedTransaction[],
  allIssues: LedgerReconciliationIssue[],
) {
  const trackedBalanceByBucket = new Map<WalletBucket, bigint>();
  const bucketHasTransaction = new Set<WalletBucket>();

  for (const transaction of transactions) {
    const transactionIssues: LedgerReconciliationIssue[] = [];
    const amountMinor = parseMoneyIssue(
      transaction.amount,
      "amount",
      transaction.userId,
      transactionIssues,
      transaction.id,
    );
    const balanceAfterMinor = parseMoneyIssue(
      transaction.balanceAfter,
      "balanceAfter",
      transaction.userId,
      transactionIssues,
      transaction.id,
    );
    const signIssue = validateTransactionSign(transaction, amountMinor);

    if (signIssue) {
      transactionIssues.push(signIssue);
    }

    if (balanceAfterMinor < BigInt(0)) {
      transactionIssues.push(
        createIssue({
          severity: "ERROR",
          code: "NEGATIVE_TRANSACTION_BALANCE",
          message: "balanceAfter của giao dịch bị âm.",
          userId: transaction.userId,
          transactionId: transaction.id,
          referenceId: transaction.referenceId,
          actual: toMoneyString(balanceAfterMinor),
        }),
      );
    }

    allIssues.push(...transactionIssues);

    for (const effect of getTransactionEffects(transaction, amountMinor)) {
      const previousBalance = trackedBalanceByBucket.get(effect.bucket);

      if (!effect.hasBalanceAfter) {
        trackedBalanceByBucket.set(
          effect.bucket,
          previousBalance === undefined ? effect.amountMinor : previousBalance + effect.amountMinor,
        );
        bucketHasTransaction.add(effect.bucket);
        continue;
      }

      if (previousBalance === undefined) {
        const openingBalance = balanceAfterMinor - effect.amountMinor;

        if (openingBalance < BigInt(0)) {
          allIssues.push(
            createIssue({
              severity: "WARNING",
              code: "NEGATIVE_OPENING_BALANCE",
              message: "Số dư đầu kỳ suy ra từ giao dịch đầu tiên của bucket bị âm.",
              userId: transaction.userId,
              transactionId: transaction.id,
              referenceId: transaction.referenceId,
              expected: ">= 0.00",
              actual: toMoneyString(openingBalance),
              metadata: {
                bucket: effect.bucket,
              },
            }),
          );
        }
      } else {
        const expectedBalanceAfter = previousBalance + effect.amountMinor;

        if (!compareMoney(expectedBalanceAfter, balanceAfterMinor)) {
          allIssues.push(
            createIssue({
              severity: "ERROR",
              code: "TRANSACTION_BALANCE_CHAIN_MISMATCH",
              message: "Chuỗi balanceAfter không khớp với giao dịch liền trước.",
              userId: transaction.userId,
              transactionId: transaction.id,
              referenceId: transaction.referenceId,
              expected: toMoneyString(expectedBalanceAfter),
              actual: toMoneyString(balanceAfterMinor),
              metadata: {
                bucket: effect.bucket,
              },
            }),
          );
        }
      }

      trackedBalanceByBucket.set(effect.bucket, balanceAfterMinor);
      bucketHasTransaction.add(effect.bucket);
    }
  }

  const currentAvailableMinor = toMinorUnits(user.availableBalance.toString());
  const currentEscrowMinor = toMinorUnits(user.escrowBalance.toString());
  const finalAvailableMinor = trackedBalanceByBucket.get("available");
  const finalEscrowMinor = trackedBalanceByBucket.get("escrow");

  if (
    bucketHasTransaction.has("available") &&
    finalAvailableMinor !== undefined &&
    !compareMoney(finalAvailableMinor, currentAvailableMinor)
  ) {
    allIssues.push(
      createIssue({
        severity: "ERROR",
        code: "TRANSACTION_BALANCE_FINAL_MISMATCH",
        message: "Số dư available hiện tại không khớp balanceAfter cuối cùng trong ledger.",
        userId: user.id,
        expected: toMoneyString(finalAvailableMinor),
        actual: user.availableBalance.toString(),
        metadata: {
          bucket: "available",
        },
      }),
    );
  }

  if (
    bucketHasTransaction.has("escrow") &&
    finalEscrowMinor !== undefined &&
    !compareMoney(finalEscrowMinor, currentEscrowMinor)
  ) {
    allIssues.push(
      createIssue({
        severity: "ERROR",
        code: "TRANSACTION_BALANCE_FINAL_MISMATCH",
        message: "Số dư escrow hiện tại không khớp balanceAfter cuối cùng trong ledger.",
        userId: user.id,
        expected: toMoneyString(finalEscrowMinor),
        actual: user.escrowBalance.toString(),
        metadata: {
          bucket: "escrow",
        },
      }),
    );
  }
}

function reconcileWalletTotals(
  user: SelectedUser,
  expectedPendingBalanceMinor: bigint,
  expectedEscrowBalanceMinor: bigint,
) {
  const issues: LedgerReconciliationIssue[] = [];
  const availableBalanceMinor = toMinorUnits(user.availableBalance.toString());
  const pendingBalanceMinor = toMinorUnits(user.pendingBalance.toString());
  const escrowBalanceMinor = toMinorUnits(user.escrowBalance.toString());

  const balances = [
    ["availableBalance", availableBalanceMinor],
    ["pendingBalance", pendingBalanceMinor],
    ["escrowBalance", escrowBalanceMinor],
  ] as const;

  for (const [fieldName, balanceMinor] of balances) {
    if (balanceMinor < BigInt(0)) {
      issues.push(
        createIssue({
          severity: "ERROR",
          code: "NEGATIVE_WALLET_BALANCE",
          message: `Số dư ${fieldName} của ví bị âm.`,
          userId: user.id,
          actual: toMoneyString(balanceMinor),
        }),
      );
    }
  }

  if (!compareMoney(pendingBalanceMinor, expectedPendingBalanceMinor)) {
    issues.push(
      createIssue({
        severity: "ERROR",
        code: "PENDING_BALANCE_MISMATCH",
        message: "pendingBalance không khớp tổng withdrawal đang chờ xử lý.",
        userId: user.id,
        expected: toMoneyString(expectedPendingBalanceMinor),
        actual: user.pendingBalance.toString(),
      }),
    );
  }

  if (!compareMoney(escrowBalanceMinor, expectedEscrowBalanceMinor)) {
    issues.push(
      createIssue({
        severity: "ERROR",
        code: "ESCROW_BALANCE_MISMATCH",
        message: "escrowBalance không khớp tổng tiền ký quỹ còn mở của các task ACTIVE/PAUSED.",
        userId: user.id,
        expected: toMoneyString(expectedEscrowBalanceMinor),
        actual: user.escrowBalance.toString(),
      }),
    );
  }

  return issues;
}

export async function reconcileLedger(
  options: ReconcileLedgerOptions = {},
): Promise<LedgerReconciliationResult> {
  const users = await loadUsers(options.userId);
  const userIds = users.map((user) => user.id);
  const [transactions, expectedPendingBalances, expectedEscrowBalances] = await Promise.all([
    loadTransactions(userIds),
    loadExpectedPendingBalances(userIds),
    loadExpectedEscrowBalances(userIds),
  ]);
  const transactionReferences = await loadReferenceSets(transactions);
  const transactionsByUserId = groupByUserId(transactions);
  const allIssues: LedgerReconciliationIssue[] = [];
  const reconciledUsers: LedgerReconciledUser[] = [];

  for (const transaction of transactions) {
    const referenceIssue = validateReference(transaction, transactionReferences);

    if (referenceIssue) {
      allIssues.push(referenceIssue);
    }
  }

  for (const user of users) {
    const userTransactions = transactionsByUserId.get(user.id) ?? [];
    const expectedPendingBalanceMinor = expectedPendingBalances.get(user.id) ?? BigInt(0);
    const expectedEscrowBalanceMinor = expectedEscrowBalances.get(user.id) ?? BigInt(0);
    const userIssues = reconcileWalletTotals(
      user,
      expectedPendingBalanceMinor,
      expectedEscrowBalanceMinor,
    );

    allIssues.push(...userIssues);
    reconcileTransactionChain(user, userTransactions, allIssues);

    const userAllIssues = allIssues.filter((issue) => issue.userId === user.id);
    const totalBalanceMinor =
      toMinorUnits(user.availableBalance.toString()) +
      toMinorUnits(user.pendingBalance.toString()) +
      toMinorUnits(user.escrowBalance.toString());

    if (options.includeHealthyUsers || userAllIssues.length > 0) {
      reconciledUsers.push({
        userId: user.id,
        email: user.email,
        availableBalance: user.availableBalance.toString(),
        pendingBalance: user.pendingBalance.toString(),
        escrowBalance: user.escrowBalance.toString(),
        totalBalance: toMoneyString(totalBalanceMinor),
        expectedPendingBalance: toMoneyString(expectedPendingBalanceMinor),
        expectedEscrowBalance: toMoneyString(expectedEscrowBalanceMinor),
        transactionCount: userTransactions.length,
        issues: userAllIssues,
      });
    }
  }

  const errorCount = allIssues.filter((issue) => issue.severity === "ERROR").length;
  const warningCount = allIssues.filter((issue) => issue.severity === "WARNING").length;

  return {
    summary: {
      checkedUsers: users.length,
      checkedTransactions: transactions.length,
      issueCount: allIssues.length,
      errorCount,
      warningCount,
      isConsistent: errorCount === 0,
    },
    users: reconciledUsers,
    issues: allIssues,
  };
}
