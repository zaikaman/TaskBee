import type { TaskStatus, TaskType } from "@/lib/generated/prisma/browser";

type MoneyLike = {
  toString(): string;
};

export type SerializableTask = {
  id: string;
  employerId: string;
  taskType: TaskType;
  title: string;
  description: string;
  instructions: string;
  proofRequirements: string | null;
  category: string | null;
  subcategory: string | null;
  targetListId: string | null;
  rewardAmount: string;
  totalSlots: number;
  availableSlots: number;
  claimedSlots: number;
  submittedSlots: number;
  approvedSlots: number;
  rejectedSlots: number;
  escrowAmount: string;
  platformFeeAmount: string;
  status: TaskStatus;
  autoApproveDays: number;
  holdTimeMinutes: number;
  expiresAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SerializableTaskSource = Omit<SerializableTask, "rewardAmount" | "escrowAmount" | "platformFeeAmount"> & {
  rewardAmount: MoneyLike;
  escrowAmount: MoneyLike;
  platformFeeAmount: MoneyLike;
  submissions?: unknown;
};

export function serializeTaskForClient(task: SerializableTaskSource): SerializableTask {
  const {
    submissions: _submissions,
    rewardAmount,
    escrowAmount,
    platformFeeAmount,
    ...rest
  } = task;

  return {
    ...rest,
    rewardAmount: rewardAmount.toString(),
    escrowAmount: escrowAmount.toString(),
    platformFeeAmount: platformFeeAmount.toString(),
  };
}
