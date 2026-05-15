"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  SubmissionStatus,
  TaskClaimStatus,
  TaskStatus,
  TransactionType,
  UserRole,
} from "@/lib/generated/prisma/client";
import { addMoney, formatVnd } from "@/lib/utils/money";

export type ReviewSubmissionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

const initialReviewSubmissionState: ReviewSubmissionState = {
  ok: false,
};

type ReviewAction = "APPROVE" | "REJECT";

interface ReviewSubmissionInput {
  submissionId: string;
  action: ReviewAction;
  feedback?: string;
}

async function validateSubmissionOwnership(
  submissionId: string,
  employerId: string,
) {
  const prisma = getPrisma();

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      task: {
        select: {
          id: true,
          employerId: true,
          title: true,
          rewardAmount: true,
          status: true,
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
    },
  });

  if (!submission) {
    throw new Error("Không tìm thấy submission này.");
  }

  if (submission.task.employerId !== employerId) {
    throw new Error("Bạn không có quyền review submission này.");
  }

  if (submission.status !== SubmissionStatus.PENDING) {
    throw new Error("Submission này đã được review rồi.");
  }

  if (submission.task.status !== TaskStatus.ACTIVE) {
    throw new Error("Task này không còn active nên không thể review submission.");
  }

  return submission;
}

async function countRejectedSubmissions(
  taskId: string,
  workerId: string,
): Promise<number> {
  const prisma = getPrisma();

  return prisma.submission.count({
    where: {
      taskId,
      workerId,
      status: SubmissionStatus.REJECTED,
    },
  });
}

async function approveSubmission(
  submissionId: string,
  employerId: string,
  feedback?: string,
) {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findUniqueOrThrow({
      where: { id: submissionId },
      include: {
        task: true,
        worker: true,
        claim: true,
      },
    });

    // Update submission status
    await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.APPROVED,
        employerFeedback: feedback ?? null,
        reviewedAt: now,
      },
    });

    // Update claim status
    await tx.taskClaim.update({
      where: { id: submission.claimId },
      data: {
        status: TaskClaimStatus.SUBMITTED,
      },
    });

    // Update task counters
    const updatedTask = await tx.task.update({
      where: { id: submission.taskId },
      data: {
        approvedSlots: { increment: 1 },
        availableSlots: { decrement: 1 },
      },
    });

    const rewardAmount = submission.task.rewardAmount.toString();

    // Release escrow from employer
    await tx.user.update({
      where: { id: employerId },
      data: {
        escrowBalance: { decrement: rewardAmount },
      },
    });

    // Transfer reward to worker
    const updatedWorker = await tx.user.update({
      where: { id: submission.workerId },
      data: {
        availableBalance: { increment: rewardAmount },
      },
    });

    const workerBalanceAfter = updatedWorker.availableBalance.toString();

    // Record transaction for worker
    await tx.transaction.create({
      data: {
        userId: submission.workerId,
        type: TransactionType.TASK_REWARD,
        amount: rewardAmount,
        balanceAfter: workerBalanceAfter,
        referenceId: submission.taskId,
        description: `Nhận thưởng cho task "${submission.task.title}".`,
        metadata: {
          taskId: submission.taskId,
          submissionId: submission.id,
          rewardAmount,
        },
      },
    });

    // Record escrow release for employer
    const employer = await tx.user.findUniqueOrThrow({
      where: { id: employerId },
      select: { escrowBalance: true },
    });

    await tx.transaction.create({
      data: {
        userId: employerId,
        type: TransactionType.TASK_ESCROW_RELEASE,
        amount: `-${rewardAmount}`,
        balanceAfter: employer.escrowBalance.toString(),
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

    // Check if task is completed
    if (updatedTask.availableSlots === 0) {
      await tx.task.update({
        where: { id: submission.taskId },
        data: {
          status: TaskStatus.COMPLETED,
        },
      });
    }

    return {
      submission,
      rewardAmount,
      taskCompleted: updatedTask.availableSlots === 0,
    };
  });
}

async function rejectSubmission(
  submissionId: string,
  employerId: string,
  feedback?: string,
) {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findUniqueOrThrow({
      where: { id: submissionId },
      include: {
        task: true,
        worker: true,
        claim: true,
      },
    });

    // Count previous rejections for this worker on this task
    const previousRejections = await tx.submission.count({
      where: {
        taskId: submission.taskId,
        workerId: submission.workerId,
        status: SubmissionStatus.REJECTED,
        id: { not: submissionId }, // Don't count current submission
      },
    });

    const isSecondRejection = previousRejections >= 1;

    // Update submission status
    await tx.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.REJECTED,
        employerFeedback: feedback ?? null,
        reviewedAt: now,
      },
    });

    if (isSecondRejection) {
      // Second rejection: Cancel the claim and free up the slot
      await tx.taskClaim.update({
        where: { id: submission.claimId },
        data: {
          status: TaskClaimStatus.CANCELLED,
        },
      });

      // Update task counters - free up the slot
      await tx.task.update({
        where: { id: submission.taskId },
        data: {
          rejectedSlots: { increment: 1 },
          claimedSlots: { decrement: 1 },
          submittedSlots: { decrement: 1 },
          availableSlots: { increment: 1 }, // Return slot to available pool
        },
      });

      return {
        submission,
        isSecondRejection: true,
        message: `Submission đã bị từ chối lần thứ 2. Worker này đã bị hủy job và slot đã được trả lại.`,
      };
    } else {
      // First rejection: Worker gets another chance
      await tx.taskClaim.update({
        where: { id: submission.claimId },
        data: {
          status: TaskClaimStatus.CLAIMED, // Reset to CLAIMED so worker can resubmit
        },
      });

      // Update task counters
      await tx.task.update({
        where: { id: submission.taskId },
        data: {
          rejectedSlots: { increment: 1 },
          submittedSlots: { decrement: 1 }, // Decrease submitted count
        },
      });

      return {
        submission,
        isSecondRejection: false,
        message: `Submission đã bị từ chối. Worker có thêm 1 cơ hội để resubmit.`,
      };
    }
  });
}

export async function reviewSubmission(
  input: ReviewSubmissionInput,
  _prevState: ReviewSubmissionState = initialReviewSubmissionState,
): Promise<ReviewSubmissionState> {
  void _prevState;

  const session = await requireRole(UserRole.EMPLOYER);
  const profile = session.profile;

  if (!profile) {
    return {
      ok: false,
      error: "Hồ sơ Employer chưa được khởi tạo. Vui lòng đăng nhập lại.",
    };
  }

  try {
    // Validate ownership and submission state
    const submission = await validateSubmissionOwnership(
      input.submissionId,
      profile.id,
    );

    if (input.action === "APPROVE") {
      const result = await approveSubmission(
        input.submissionId,
        profile.id,
        input.feedback,
      );

      revalidatePath("/dashboard/employer/tasks");
      revalidatePath(`/dashboard/employer/tasks/${submission.taskId}`);
      revalidatePath("/marketplace");

      return {
        ok: true,
        message: `Submission đã được chấp nhận và ${formatVnd(result.rewardAmount)} đã được chuyển cho worker.${result.taskCompleted ? " Task đã hoàn thành." : ""}`,
      };
    } else if (input.action === "REJECT") {
      const result = await rejectSubmission(
        input.submissionId,
        profile.id,
        input.feedback,
      );

      revalidatePath("/dashboard/employer/tasks");
      revalidatePath(`/dashboard/employer/tasks/${submission.taskId}`);
      revalidatePath("/marketplace");

      return {
        ok: true,
        message: result.message,
      };
    } else {
      return {
        ok: false,
        error: "Action không hợp lệ. Chỉ chấp nhận APPROVE hoặc REJECT.",
      };
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể review submission lúc này. Vui lòng thử lại sau.",
    };
  }
}
