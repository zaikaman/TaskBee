import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import {
  Prisma,
  SubmissionStatus,
  TaskClaimStatus,
  TaskStatus,
  TransactionType,
} from "@/lib/generated/prisma/client";

const submissionReviewInclude = {
  task: {
    select: {
      id: true,
      title: true,
      rewardAmount: true,
      totalSlots: true,
      status: true,
      employerId: true,
    },
  },
  worker: {
    select: {
      id: true,
      email: true,
    },
  },
  claim: {
    select: {
      id: true,
      status: true,
    },
  },
} as const;

export type SubmissionReviewContext = Prisma.SubmissionGetPayload<{
  include: typeof submissionReviewInclude;
}>;

export type SubmissionApprovalResult = {
  taskId: string;
  taskTitle: string;
  rewardAmount: string;
  taskCompleted: boolean;
};

export type SubmissionRejectionResult = {
  taskId: string;
  isSecondRejection: boolean;
  message: string;
};

function createReviewConflictError() {
  return new Error("Submission này đã được review rồi.");
}

function createInactiveTaskError() {
  return new Error("Task này không còn active nên không thể duyệt submission.");
}

export async function loadSubmissionReviewContext(
  submissionId: string,
): Promise<SubmissionReviewContext | null> {
  const prisma = getPrisma();

  return prisma.submission.findUnique({
    where: { id: submissionId },
    include: submissionReviewInclude,
  });
}

export async function loadExpiredPendingSubmissionContexts(now: Date) {
  const prisma = getPrisma();

  return prisma.submission.findMany({
    where: {
      status: SubmissionStatus.PENDING,
      autoApproveAt: {
        lte: now,
      },
      task: {
        status: {
          in: [TaskStatus.ACTIVE, TaskStatus.PAUSED],
        },
      },
    },
    orderBy: [
      {
        autoApproveAt: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
    include: submissionReviewInclude,
  });
}

export async function approveSubmissionTransaction(
  tx: Prisma.TransactionClient,
  submission: SubmissionReviewContext,
  feedback?: string | null,
): Promise<SubmissionApprovalResult> {
  const now = new Date();

  const currentTask = await tx.task.findUnique({
    where: {
      id: submission.taskId,
    },
    select: {
      status: true,
    },
  });

  if (!currentTask || (currentTask.status !== TaskStatus.ACTIVE && currentTask.status !== TaskStatus.PAUSED)) {
    throw createInactiveTaskError();
  }

  const updateResult = await tx.submission.updateMany({
    where: {
      id: submission.id,
      status: SubmissionStatus.PENDING,
    },
    data: {
      status: SubmissionStatus.APPROVED,
      employerFeedback: feedback ?? null,
      reviewedAt: now,
    },
  });

  if (updateResult.count !== 1) {
    throw createReviewConflictError();
  }

  await tx.taskClaim.update({
    where: {
      id: submission.claimId,
    },
    data: {
      status: TaskClaimStatus.SUBMITTED,
    },
  });

  const updatedTask = await tx.task.update({
    where: {
      id: submission.taskId,
    },
    data: {
      approvedSlots: {
        increment: 1,
      },
    },
    select: {
      approvedSlots: true,
      totalSlots: true,
    },
  });

  const taskCompleted = updatedTask.approvedSlots >= updatedTask.totalSlots;

  if (taskCompleted) {
    await tx.task.update({
      where: {
        id: submission.taskId,
      },
      data: {
        status: TaskStatus.COMPLETED,
      },
    });
  }

  const rewardAmount = submission.task.rewardAmount.toString();

  const updatedEmployer = await tx.user.update({
    where: {
      id: submission.task.employerId,
    },
    data: {
      escrowBalance: {
        decrement: rewardAmount,
      },
    },
    select: {
      escrowBalance: true,
    },
  });

  const updatedWorker = await tx.user.update({
    where: {
      id: submission.workerId,
    },
    data: {
      availableBalance: {
        increment: rewardAmount,
      },
    },
    select: {
      availableBalance: true,
    },
  });

  await tx.transaction.create({
    data: {
      userId: submission.workerId,
      type: TransactionType.TASK_REWARD,
      amount: rewardAmount,
      balanceAfter: updatedWorker.availableBalance.toString(),
      referenceId: submission.taskId,
      description: `Nhận thưởng cho task "${submission.task.title}".`,
      metadata: {
        taskId: submission.taskId,
        submissionId: submission.id,
        rewardAmount,
      },
    },
  });

  await tx.transaction.create({
    data: {
      userId: submission.task.employerId,
      type: TransactionType.TASK_ESCROW_RELEASE,
      amount: `-${rewardAmount}`,
      balanceAfter: updatedEmployer.escrowBalance.toString(),
      referenceId: submission.taskId,
      description: `Giải phóng escrow cho submission của task "${submission.task.title}".`,
      metadata: {
        taskId: submission.taskId,
        submissionId: submission.id,
        workerId: submission.workerId,
        rewardAmount,
      },
    },
  });

  return {
    taskId: submission.taskId,
    taskTitle: submission.task.title,
    rewardAmount,
    taskCompleted,
  };
}

export async function rejectSubmissionTransaction(
  tx: Prisma.TransactionClient,
  submission: SubmissionReviewContext,
  feedback?: string | null,
): Promise<SubmissionRejectionResult> {
  const now = new Date();

  const currentTask = await tx.task.findUnique({
    where: {
      id: submission.taskId,
    },
    select: {
      status: true,
    },
  });

  if (!currentTask || currentTask.status !== TaskStatus.ACTIVE) {
    throw createInactiveTaskError();
  }

  const previousRejections = await tx.submission.count({
    where: {
      taskId: submission.taskId,
      workerId: submission.workerId,
      status: SubmissionStatus.REJECTED,
      id: {
        not: submission.id,
      },
    },
  });

  const updateResult = await tx.submission.updateMany({
    where: {
      id: submission.id,
      status: SubmissionStatus.PENDING,
    },
    data: {
      status: SubmissionStatus.REJECTED,
      employerFeedback: feedback ?? null,
      reviewedAt: now,
    },
  });

  if (updateResult.count !== 1) {
    throw createReviewConflictError();
  }

  if (previousRejections >= 1) {
    await tx.taskClaim.update({
      where: {
        id: submission.claimId,
      },
      data: {
        status: TaskClaimStatus.CANCELLED,
      },
    });

    await tx.task.update({
      where: {
        id: submission.taskId,
      },
      data: {
        rejectedSlots: {
          increment: 1,
        },
        claimedSlots: {
          decrement: 1,
        },
        availableSlots: {
          increment: 1,
        },
      },
    });

    return {
      taskId: submission.taskId,
      isSecondRejection: true,
      message: `Submission đã bị từ chối lần thứ 2. Worker này đã bị hủy job và slot đã được trả lại.`,
    };
  }

  await tx.taskClaim.update({
    where: {
      id: submission.claimId,
    },
    data: {
      status: TaskClaimStatus.CLAIMED,
    },
  });

  await tx.task.update({
    where: {
      id: submission.taskId,
    },
    data: {
      rejectedSlots: {
        increment: 1,
      },
    },
  });

  return {
    taskId: submission.taskId,
    isSecondRejection: false,
    message: `Submission đã bị từ chối. Worker có thêm 1 cơ hội để resubmit.`,
  };
}