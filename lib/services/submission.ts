"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { uploadProofImage } from "@/lib/services/storage";
import {
  approveSubmissionTransaction,
  loadSubmissionReviewContext,
  rejectSubmissionTransaction,
  type SubmissionReviewContext,
} from "@/lib/services/submission-workflow";
import { expireStaleTaskClaims } from "@/lib/services/task-claim-expiration";
import {
  Prisma,
  NotificationType,
  SubmissionStatus,
  TaskClaimStatus,
  TaskStatus,
  UserRole,
} from "@/lib/generated/prisma/client";
import { formatVnd } from "@/lib/utils/money";
import { enforceRateLimit, getRateLimitErrorMessage, RateLimitError } from "@/lib/utils/rate-limit";
import { notifyUser } from "@/lib/services/notifications";
import { captureTaskFlowEvent } from "@/lib/services/analytics";
import {
  applyWorkerTaskIntervalAdjustment,
  assertWorkerCanSubmitTask,
  WORKER_TASK_INTERVAL_SPAM_PROOF_DELTA_SECONDS,
} from "@/lib/services/worker-task-interval";

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
  revalidatePath("/marketplace");
  revalidatePath(`/marketplace/${taskId}`);
}

async function validateSubmissionOwnership(
  submissionId: string,
  employerId: string,
): Promise<SubmissionReviewContext> {
  const submission = await loadSubmissionReviewContext(submissionId);

  if (!submission) {
    throw new Error("Không tìm thấy submission này.");
  }

  if (submission.task.employerId !== employerId) {
    throw new Error("Bạn không có quyền review submission này.");
  }

  if (submission.status !== SubmissionStatus.PENDING) {
    throw new Error("Submission này đã được review rồi.");
  }

  if (submission.task.status !== TaskStatus.ACTIVE && submission.task.status !== TaskStatus.PAUSED) {
    throw new Error("Task này không còn active nên không thể review submission.");
  }

  return submission;
}

async function createSubmissionRecord(
  workerId: string,
  input: CreateSubmissionInput,
) {
  const prisma = getPrisma();
  const now = new Date();

  await expireStaleTaskClaims({
    taskId: input.taskId,
    workerId,
    now,
  });

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
            employerId: true,
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

    if (claim.expiresAt && claim.expiresAt <= now) {
      throw new Error("Lượt giữ slot đã hết hạn. Slot đã được trả lại cho người khác.");
    }

    await assertWorkerCanSubmitTask(tx, workerId, now);

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
      employerId: claim.task.employerId,
      taskTitle: claim.task.title,
      rewardAmount: claim.task.rewardAmount.toString(),
      autoApproveDays: claim.task.autoApproveDays,
      hadExistingSubmission: Boolean(claim.submission),
    };
  });
}

async function applySpamProofIntervalPenalty(workerId: string) {
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    await applyWorkerTaskIntervalAdjustment(
      tx,
      workerId,
      WORKER_TASK_INTERVAL_SPAM_PROOF_DELTA_SECONDS,
      "SYSTEM_BLOCKED_SPAM_PROOF",
    );
  });
}

export async function createSubmission(
  _prevState: CreateSubmissionState = initialCreateSubmissionState,
  formData: FormData,
): Promise<CreateSubmissionState> {
  const session = await auth(UserRole.WORKER);

  void _prevState;
  const profile = session.profile;

  if (!profile) {
    return {
      ok: false,
      error: "Hồ sơ người làm chưa được khởi tạo. Vui lòng đăng nhập lại.",
    };
  }

  try {
    await enforceRateLimit({
      scope: "submission:create",
      key: profile.id,
      limit: 40,
      windowSeconds: 60 * 60,
    });

    const input = parseCreateSubmissionInput(formData);
    const result = await createSubmissionRecord(profile.id, input);

    revalidateSubmissionPaths(input.taskId);
    await notifyUser({
      userId: result.employerId,
      type: NotificationType.SUBMISSION_REVIEW,
      title: "Có submission mới cần review",
      body: `Worker đã gửi bằng chứng cho việc "${result.taskTitle}". Vui lòng review để thanh toán đúng hạn.`,
      data: {
        taskId: input.taskId,
        submissionId: result.submissionId,
      },
      email: {
        subject: `TaskBee: Submission mới cho "${result.taskTitle}"`,
      },
    });
    await captureTaskFlowEvent(profile.id, "submission_created", {
      taskId: input.taskId,
      submissionId: result.submissionId,
    });

    return {
      ok: true,
      submissionId: result.submissionId,
      message: result.hadExistingSubmission
        ? `Bạn đã gửi lại bằng chứng cho task "${result.taskTitle}". Hệ thống sẽ tự động duyệt sau ${result.autoApproveDays} ngày nếu chưa được review.`
        : `Bạn đã gửi bằng chứng cho task "${result.taskTitle}". Hệ thống sẽ tự động duyệt sau ${result.autoApproveDays} ngày nếu chưa được review.`,
    };
  } catch (error) {
    if (error instanceof RateLimitError) {
      await applySpamProofIntervalPenalty(profile.id);
    }

    return {
      ok: false,
      error:
        getRateLimitErrorMessage(error) ??
        (error instanceof Error
          ? error.message
          : "Không thể gửi submission lúc này. Vui lòng thử lại sau."),
    };
  }
}

async function approveSubmission(
  submission: SubmissionReviewContext,
  feedback?: string,
) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    return approveSubmissionTransaction(tx, submission, feedback);
  });
}

async function rejectSubmission(
  submission: SubmissionReviewContext,
  feedback?: string,
) {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    return rejectSubmissionTransaction(tx, submission, feedback);
  });
}

export async function reviewSubmission(
  _prevState: ReviewSubmissionState = initialReviewSubmissionState,
  formData: FormData,
): Promise<ReviewSubmissionState> {
  const session = await auth(UserRole.EMPLOYER);

  void _prevState;
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
    await enforceRateLimit({
      scope: "submission:review",
      key: profile.id,
      limit: 120,
      windowSeconds: 60 * 60,
    });

    // Validate ownership and submission state
    const submission = await validateSubmissionOwnership(
      input.submissionId,
      profile.id,
    );

    if (input.action === "APPROVE") {
      const result = await approveSubmission(submission, input.feedback);

      revalidateSubmissionPaths(submission.taskId);
      await notifyUser({
        userId: submission.workerId,
        type: NotificationType.SUBMISSION_REVIEW,
        title: "Submission đã được duyệt",
        body: `Submission cho việc "${submission.task.title}" đã được duyệt. Bạn đã nhận ${formatVnd(result.rewardAmount)} vào ví.`,
        data: {
          taskId: submission.taskId,
          submissionId: submission.id,
          status: SubmissionStatus.APPROVED,
        },
        email: {
          subject: `TaskBee: Submission của bạn đã được duyệt`,
        },
      });
      await captureTaskFlowEvent(profile.id, "submission_reviewed", {
        taskId: submission.taskId,
        submissionId: submission.id,
        status: "APPROVED",
      });

      return {
        ok: true,
        message: `Submission đã được chấp nhận và ${formatVnd(result.rewardAmount)} đã được chuyển cho worker.${result.taskCompleted ? " Task đã hoàn thành." : ""}`,
      };
    } else if (input.action === "REJECT") {
      const result = await rejectSubmission(submission, input.feedback);

      revalidateSubmissionPaths(submission.taskId);
      await notifyUser({
        userId: submission.workerId,
        type: NotificationType.SUBMISSION_REVIEW,
        title: "Submission cần bổ sung",
        body: result.isSecondRejection
          ? `Submission cho việc "${submission.task.title}" đã bị từ chối lần hai và slot đã được trả lại.`
          : `Submission cho việc "${submission.task.title}" đã bị từ chối. Bạn có thể bổ sung bằng chứng theo phản hồi của employer.`,
        data: {
          taskId: submission.taskId,
          submissionId: submission.id,
          status: SubmissionStatus.REJECTED,
          feedback: input.feedback ?? null,
        },
        email: {
          subject: `TaskBee: Submission cần bổ sung`,
        },
      });
      await captureTaskFlowEvent(profile.id, "submission_reviewed", {
        taskId: submission.taskId,
        submissionId: submission.id,
        status: "REJECTED",
      });

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
        getRateLimitErrorMessage(error) ??
        (error instanceof Error
          ? error.message
          : "Không thể review submission lúc này. Vui lòng thử lại sau."),
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
  const session = await auth(UserRole.WORKER);

  try {
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
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Lỗi tải ảnh. Vui lòng thử lại.",
    };
  }
}
