"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { uploadProofImage } from "@/lib/services/storage";
import {
  Prisma,
  SubmissionStatus,
  TaskClaimStatus,
  TaskStatus,
  TransactionType,
  UserRole,
} from "@/lib/generated/prisma/client";
import { formatVnd } from "@/lib/utils/money";

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;
const SUBMISSION_PROOF_TEXT_MAX_LENGTH = 2000;
const SUBMISSION_PROOF_IMAGE_MAX_COUNT = 10;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CreateSubmissionState = {
  ok: boolean;
  message?: string;
  error?: string;
  submissionId?: string;
};

const initialCreateSubmissionState: CreateSubmissionState = {
  ok: false,
};

export type ReviewSubmissionState = {
  ok: boolean;
  message?: string;
  error?: string;
};

const initialReviewSubmissionState: ReviewSubmissionState = {
  ok: false,
};

interface CreateSubmissionInput {
  taskId: string;
  proofText: string | null;
  proofImages: string[];
}

type ReviewAction = "APPROVE" | "REJECT";

interface ReviewSubmissionInput {
  submissionId: string;
  action: ReviewAction;
  feedback?: string;
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function normalizeStringValue(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeOptionalSubmissionText(value: FormDataEntryValue | null) {
  const normalized = normalizeStringValue(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeProofImageUrl(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(normalized);
  } catch {
    throw new Error("Đường dẫn ảnh bằng chứng không hợp lệ.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Đường dẫn ảnh bằng chứng phải dùng giao thức http hoặc https.");
  }

  return parsedUrl.toString();
}

function parseSubmissionProofImages(formData: FormData) {
  const rawEntries = formData.getAll("proofImages");

  if (rawEntries.some((entry) => typeof entry !== "string")) {
    throw new Error("Ảnh bằng chứng phải được tải lên trước khi gửi submission.");
  }

  const normalizedEntries = rawEntries
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);

  if (normalizedEntries.length === 1 && normalizedEntries[0].startsWith("[")) {
    try {
      const parsed = JSON.parse(normalizedEntries[0]);

      if (!Array.isArray(parsed)) {
        throw new Error("Danh sách ảnh bằng chứng không hợp lệ.");
      }

      const parsedUrls = parsed
        .map((entry) => {
          if (typeof entry !== "string") {
            throw new Error("Danh sách ảnh bằng chứng không hợp lệ.");
          }

          const normalizedUrl = normalizeProofImageUrl(entry);

          if (!normalizedUrl) {
            throw new Error("Đường dẫn ảnh bằng chứng không được để trống.");
          }

          return normalizedUrl;
        })
        .filter((entry) => entry.length > 0);

      return Array.from(new Set(parsedUrls));
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error("Danh sách ảnh bằng chứng không hợp lệ.");
    }
  }

  const normalizedUrls = normalizedEntries
    .map((entry) => {
      const normalizedUrl = normalizeProofImageUrl(entry);

      if (!normalizedUrl) {
        throw new Error("Đường dẫn ảnh bằng chứng không được để trống.");
      }

      return normalizedUrl;
    })
    .filter((entry) => entry.length > 0);

  return Array.from(new Set(normalizedUrls));
}

function parseCreateSubmissionInput(formData: FormData): CreateSubmissionInput {
  const taskId = normalizeStringValue(formData.get("taskId"));

  if (!taskId) {
    throw new Error("Không tìm thấy ID của task cần nộp bằng chứng.");
  }

  if (!isUuid(taskId)) {
    throw new Error("ID task không hợp lệ.");
  }

  const proofText = normalizeOptionalSubmissionText(formData.get("proofText"));

  if (proofText && proofText.length < 10) {
    throw new Error("Mô tả bằng chứng phải có ít nhất 10 ký tự.");
  }

  if (proofText && proofText.length > SUBMISSION_PROOF_TEXT_MAX_LENGTH) {
    throw new Error(
      `Mô tả bằng chứng không được vượt quá ${SUBMISSION_PROOF_TEXT_MAX_LENGTH} ký tự.`,
    );
  }

  const proofImages = parseSubmissionProofImages(formData);

  if (proofImages.length > SUBMISSION_PROOF_IMAGE_MAX_COUNT) {
    throw new Error(
      `Tối đa ${SUBMISSION_PROOF_IMAGE_MAX_COUNT} ảnh bằng chứng cho mỗi submission.`,
    );
  }

  if (!proofText && proofImages.length === 0) {
    throw new Error("Vui lòng cung cấp mô tả bằng chứng hoặc ít nhất một ảnh bằng chứng.");
  }

  return {
    taskId,
    proofText,
    proofImages,
  };
}

function revalidateSubmissionPaths(taskId: string) {
  revalidatePath("/dashboard/employer/tasks");
  revalidatePath(`/dashboard/employer/tasks/${taskId}`);
  revalidatePath("/dashboard/worker/tasks");
  revalidatePath("/viec-lam");
  revalidatePath(`/viec-lam/${taskId}`);
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

async function createSubmissionRecord(
  workerId: string,
  input: CreateSubmissionInput,
) {
  const prisma = getPrisma();
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const claim = await tx.taskClaim.findFirst({
      where: {
        taskId: input.taskId,
        workerId,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            rewardAmount: true,
            status: true,
            autoApproveDays: true,
          },
        },
        submission: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!claim) {
      throw new Error("Bạn chưa nhận task này. Hãy claim task trước khi nộp bằng chứng.");
    }

    if (claim.task.status !== TaskStatus.ACTIVE) {
      throw new Error("Task này không còn active nên không thể nộp bằng chứng.");
    }

    if (claim.submission?.status === SubmissionStatus.PENDING) {
      throw new Error("Bạn đã có submission đang chờ duyệt cho task này.");
    }

    if (claim.submission?.status === SubmissionStatus.APPROVED) {
      throw new Error("Submission của bạn đã được duyệt rồi.");
    }

    if (claim.status !== TaskClaimStatus.CLAIMED) {
      throw new Error("Claim này không còn ở trạng thái hợp lệ để nộp bằng chứng.");
    }

    const claimUpdateResult = await tx.taskClaim.updateMany({
      where: {
        id: claim.id,
        workerId,
        taskId: input.taskId,
        status: TaskClaimStatus.CLAIMED,
      },
      data: {
        status: TaskClaimStatus.SUBMITTED,
        submittedAt: now,
      },
    });

    if (claimUpdateResult.count !== 1) {
      throw new Error("Không thể gửi submission lúc này. Vui lòng thử lại sau.");
    }

    const autoApproveAt = new Date(
      now.getTime() + claim.task.autoApproveDays * ONE_DAY_IN_MS,
    );

    const submission = await tx.submission.upsert({
      where: {
        claimId: claim.id,
      },
      create: {
        taskId: input.taskId,
        workerId,
        claimId: claim.id,
        status: SubmissionStatus.PENDING,
        proofText: input.proofText,
        proofImages:
          input.proofImages.length > 0 ? input.proofImages : Prisma.DbNull,
        employerFeedback: null,
        reviewedAt: null,
        autoApproveAt,
        createdAt: now,
      },
      update: {
        taskId: input.taskId,
        workerId,
        status: SubmissionStatus.PENDING,
        proofText: input.proofText,
        proofImages:
          input.proofImages.length > 0 ? input.proofImages : Prisma.DbNull,
        employerFeedback: null,
        reviewedAt: null,
        autoApproveAt,
        createdAt: now,
      },
      select: {
        id: true,
      },
    });

    await tx.task.update({
      where: { id: input.taskId },
      data: {
        submittedSlots: {
          increment: 1,
        },
      },
    });

    return {
      submissionId: submission.id,
      taskTitle: claim.task.title,
      rewardAmount: claim.task.rewardAmount.toString(),
      autoApproveDays: claim.task.autoApproveDays,
      hadExistingSubmission: Boolean(claim.submission),
    };
  });
}

export async function createSubmission(
  _prevState: CreateSubmissionState = initialCreateSubmissionState,
  formData: FormData,
): Promise<CreateSubmissionState> {
  void _prevState;

  const session = await requireRole(UserRole.WORKER);
  const profile = session.profile;

  if (!profile) {
    return {
      ok: false,
      error: "Hồ sơ người làm chưa được khởi tạo. Vui lòng đăng nhập lại.",
    };
  }

  try {
    const input = parseCreateSubmissionInput(formData);
    const result = await createSubmissionRecord(profile.id, input);

    revalidateSubmissionPaths(input.taskId);

    return {
      ok: true,
      submissionId: result.submissionId,
      message: result.hadExistingSubmission
        ? `Bạn đã gửi lại bằng chứng cho task "${result.taskTitle}". Hệ thống sẽ tự động duyệt sau ${result.autoApproveDays} ngày nếu chưa được review.`
        : `Bạn đã gửi bằng chứng cho task "${result.taskTitle}". Hệ thống sẽ tự động duyệt sau ${result.autoApproveDays} ngày nếu chưa được review.`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể gửi submission lúc này. Vui lòng thử lại sau.",
    };
  }
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
  _prevState: ReviewSubmissionState = initialReviewSubmissionState,
  formData: FormData,
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

  // Parse form data
  const submissionId = formData.get("submissionId") as string;
  const action = formData.get("action") as ReviewAction;
  const feedback = formData.get("feedback") as string | null;

  const input: ReviewSubmissionInput = {
    submissionId,
    action,
    feedback: feedback || undefined,
  };

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

      revalidateSubmissionPaths(submission.taskId);

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

      revalidateSubmissionPaths(submission.taskId);

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
export type UploadProofState = {
  ok: boolean;
  url?: string;
  error?: string;
};

export async function uploadProofFileAction(
  _prevState: UploadProofState,
  formData: FormData,
): Promise<UploadProofState> {
  try {
    const session = await requireRole(UserRole.WORKER);
    const profile = session.profile;

    if (!profile) {
      return { ok: false, error: "Bạn chưa đăng nhập hoặc không có quyền Worker." };
    }

    const taskId = formData.get("taskId");
    const file = formData.get("file");

    if (!taskId || typeof taskId !== "string") {
      return { ok: false, error: "Thiếu thông tin taskId." };
    }

    if (!file || !(file instanceof File)) {
      return { ok: false, error: "Vui lòng chọn ảnh để tải lên." };
    }

    const result = await uploadProofImage({
      userId: profile.id,
      taskId,
      file,
    });

    return {
      ok: true,
      url: result.url,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Lỗi tải ảnh. Vui lòng thử lại." };
  }
}
