export const TaskStatus = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  DRAFT: "DRAFT",
} as const;

export const TransactionType = {
  DEPOSIT: "DEPOSIT",
  DEPOSIT_FEE: "DEPOSIT_FEE",
  WITHDRAWAL: "WITHDRAWAL",
  WITHDRAWAL_FEE: "WITHDRAWAL_FEE",
  TASK_ESCROW_LOCK: "TASK_ESCROW_LOCK",
  TASK_ESCROW_RELEASE: "TASK_ESCROW_RELEASE",
  TASK_REWARD: "TASK_REWARD",
  WORKER_TO_EMPLOYER_TRANSFER: "WORKER_TO_EMPLOYER_TRANSFER",
  TASK_CREATION_FEE: "TASK_CREATION_FEE",
  ADMIN_ADJUSTMENT: "ADMIN_ADJUSTMENT",
} as const;

export const UserStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  BANNED: "BANNED",
} as const;

export const WithdrawalStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export const Prisma = {
  DbNull: null,
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
};
