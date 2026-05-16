"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PLATFORM_FEES, TASK_LIMITS, TEST_WHITELIST_EMAILS } from "@/config/app";
import { auth } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  Prisma,
  NotificationType,
  SubmissionStatus,
  TaskClaimStatus,
  TaskStatus,
  TaskType,
  TransactionType,
  UserRole,
} from "@/lib/generated/prisma/client";
import {
  expireStaleTaskClaims,
  getTaskClaimExpiresAt,
} from "@/lib/services/task-claim-expiration";
import { getWorkerAvailableBalanceMinor } from "@/lib/services/wallet";
import { captureTaskFlowEvent } from "@/lib/services/analytics";
import { notifyUser } from "@/lib/services/notifications";
import {
  addMoney,
  calculateEmployerTaskCharge,
  formatVnd,
  fromMinorUnits,
  subtractMoney,
  toMinorUnits,
} from "@/lib/utils/money";
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/utils/rate-limit";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validators/task";

export type CreateTaskState = {
  ok: boolean;
  message?: string;
  error?: string;
  taskId?: string;
  fields?: Partial<{
    title: string;
    description: string;
    instructions: string;
    proofRequirements: string;
    category: string;
    rewardAmount: string;
    totalSlots: string;
    autoApproveDays: string;
    holdTimeMinutes: string;
    expiresAt: string;
  }>;
};

export type UpdateTaskState = CreateTaskState;

const initialCreateTaskState: CreateTaskState = {
  ok: false,
};

type TaskSubmissionMode = "draft" | "publish";

type EmployerTaskCharge = ReturnType<typeof calculateEmployerTaskCharge>;

type ChargeableTask = {
  id: string;
  title: string;
};

function parseFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeRequiredText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return Number.NaN;
  }

  const normalized = value.trim().replaceAll(",", "");
  return normalized.length > 0 ? Number(normalized) : Number.NaN;
}

function normalizeOptionalDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsedDate = new Date(normalized);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function mapCreateTaskFields(raw: Record<string, unknown>) {
  return {
    title: normalizeRequiredText(raw.title),
    description: normalizeRequiredText(raw.description),
    instructions: normalizeRequiredText(raw.instructions),
    proofRequirements: normalizeOptionalText(raw.proofRequirements),
    category: normalizeOptionalText(raw.category),
    rewardAmount: normalizeNumber(raw.rewardAmount),
    totalSlots: normalizeNumber(raw.totalSlots),
    autoApproveDays:
      raw.autoApproveDays === undefined || raw.autoApproveDays === ""
        ? undefined
        : normalizeNumber(raw.autoApproveDays),
    holdTimeMinutes:
      raw.holdTimeMinutes === undefined || raw.holdTimeMinutes === ""
        ? TASK_LIMITS.holdTimeMinutesDefault
        : normalizeNumber(raw.holdTimeMinutes),
    expiresAt: normalizeOptionalDate(raw.expiresAt),
  };
}

function snapshotFields(raw: Record<string, unknown>): CreateTaskState["fields"] {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    instructions: typeof raw.instructions === "string" ? raw.instructions : undefined,
    proofRequirements:
      typeof raw.proofRequirements === "string" ? raw.proofRequirements : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
    rewardAmount: typeof raw.rewardAmount === "string" ? raw.rewardAmount : undefined,
    totalSlots: typeof raw.totalSlots === "string" ? raw.totalSlots : undefined,
    autoApproveDays:
      typeof raw.autoApproveDays === "string" ? raw.autoApproveDays : undefined,
    holdTimeMinutes:
      typeof raw.holdTimeMinutes === "string" ? raw.holdTimeMinutes : undefined,
    expiresAt: typeof raw.expiresAt === "string" ? raw.expiresAt : undefined,
  };
}

function getValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Thông tin việc không hợp lệ.";
}

function assertSufficientBalance(updatedCount: number) {
  if (updatedCount !== 1) {
    throw new Error("Số dư ví không đủ để khóa tiền ký quỹ cho việc này.");
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

type TaskWorkBlockerClient = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

async function lockTaskRow(tx: Prisma.TransactionClient, taskId: string) {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "Task" WHERE id = ${taskId}::uuid FOR UPDATE`,
  );
}

async function countTaskWorkBlockers(db: TaskWorkBlockerClient, taskId: string) {
  const [heldClaims, pendingSubmissions] = await Promise.all([
    db.taskClaim.count({
      where: {
        taskId,
        status: TaskClaimStatus.CLAIMED,
      },
    }),
    db.submission.count({
      where: {
        taskId,
        status: SubmissionStatus.PENDING,
      },
    }),
  ]);

  return {
    heldClaims,
    pendingSubmissions,
    hasBlockingWork: heldClaims > 0 || pendingSubmissions > 0,
  };
}

function getBlockingWorkMessage(action: "pause" | "close" | "cancel", blockers: Awaited<ReturnType<typeof countTaskWorkBlockers>>) {
  const actionLabel =
    action === "pause" ? "tạm dừng" : action === "close" ? "đóng" : "hủy";

  return `Không thể ${actionLabel} việc khi còn ${blockers.heldClaims} lượt giữ slot chưa nộp và ${blockers.pendingSubmissions} submission đang chờ duyệt. Vui lòng xử lý các lượt này trước.`;
}

function getDuplicateClaimMessage(existingClaimStatus?: string, submissionStatus?: string) {
  if (existingClaimStatus === "CLAIMED") {
    return "Bạn đã nhận việc này rồi. Hãy hoàn thành hoặc gửi bằng chứng với claim hiện tại trước khi nhận lại.";
  }

  if (existingClaimStatus === "SUBMITTED") {
    if (submissionStatus === SubmissionStatus.PENDING) {
      return "Bạn đã gửi bằng chứng cho việc này rồi. Vui lòng chờ employer duyệt.";
    }

    if (submissionStatus === SubmissionStatus.APPROVED) {
      return "Submission của bạn cho việc này đã được duyệt rồi.";
    }

    if (submissionStatus === SubmissionStatus.REJECTED) {
      return "Bạn đang có claim cho việc này rồi. Hãy tiếp tục với claim hiện tại.";
    }

    return "Bạn đã có claim cho việc này rồi.";
  }

  if (existingClaimStatus === "CANCELLED" || existingClaimStatus === "EXPIRED") {
    return "Bạn đã có lịch sử claim cho việc này rồi và không thể nhận lại task này.";
  }

  return "Bạn đã nhận việc này rồi.";
}

function getTaskSubmissionMode(raw: Record<string, unknown>): TaskSubmissionMode {
  return raw.taskAction === "publish" ? "publish" : "draft";
}

function buildDraftTaskCreateData(data: CreateTaskInput) {
  return {
    taskType: data.taskType ?? TaskType.EXPRESS,
    title: data.title,
    description: data.description,
    instructions: data.instructions,
    proofRequirements: data.proofRequirements ?? null,
    category: data.category ?? null,
    subcategory: data.subcategory ?? null,
    targetListId: data.targetListId ?? null,
    rewardAmount: String(data.rewardAmount),
    totalSlots: data.totalSlots,
    availableSlots: data.totalSlots,
    escrowAmount: "0",
    platformFeeAmount: "0",
    status: TaskStatus.DRAFT,
    autoApproveDays: data.autoApproveDays,
    holdTimeMinutes: data.holdTimeMinutes,
    expiresAt: data.expiresAt ?? null,
    publishedAt: null,
  };
}

function buildPublishedTaskData(
  data: CreateTaskInput,
  charge: EmployerTaskCharge,
  publishedAt: Date,
) {
  return {
    ...buildDraftTaskCreateData(data),
    escrowAmount: charge.escrowAmount,
    platformFeeAmount: charge.platformFee,
    status: TaskStatus.ACTIVE,
    publishedAt,
  };
}

async function lockEmployerTaskCharge(
  tx: Prisma.TransactionClient,
  employerId: string,
  task: ChargeableTask,
  charge: EmployerTaskCharge,
  taskDetails: Pick<CreateTaskInput, "rewardAmount" | "totalSlots">,
) {
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM "User" WHERE id = ${employerId}::uuid FOR UPDATE`,
  );

  const currentUser = await tx.user.findUniqueOrThrow({
    where: {
      id: employerId,
      role: UserRole.EMPLOYER,
    },
    select: {
      availableBalance: true,
      email: true,
    },
  });

  const currentBalance = currentUser.availableBalance.toString();
  const workerAvailableMinor = await getWorkerAvailableBalanceMinor(tx, employerId);
  const employerSpendableMinor = toMinorUnits(currentBalance) - workerAvailableMinor;
  const employerSpendable = fromMinorUnits(
    employerSpendableMinor > BigInt(0) ? employerSpendableMinor : BigInt(0),
  );
  const isWhitelisted = TEST_WHITELIST_EMAILS.some((email) => email === currentUser.email);

  if (!isWhitelisted && employerSpendableMinor < toMinorUnits(charge.totalCharge)) {
    throw new Error(
      `Ngân sách employer không đủ. Cần ${formatVnd(charge.totalCharge)} nhưng chỉ có ${formatVnd(employerSpendable)}. Nếu muốn dùng thu nhập freelancer, hãy chuyển thu nhập sang ngân sách employer trước.`,
    );
  }

  const walletUpdate = await tx.user.updateMany({
    where: {
      id: employerId,
      role: UserRole.EMPLOYER,
      ...(isWhitelisted
        ? {}
        : {
            availableBalance: {
              gte: charge.totalCharge,
            },
          }),
    },
    data: {
      availableBalance: {
        decrement: charge.totalCharge,
      },
      escrowBalance: {
        increment: charge.escrowAmount,
      },
    },
  });

  if (!isWhitelisted) {
    assertSufficientBalance(walletUpdate.count);
  }

  const updatedEmployer = await tx.user.findUniqueOrThrow({
    where: {
      id: employerId,
    },
    select: {
      availableBalance: true,
    },
  });

  const finalAvailableBalance = updatedEmployer.availableBalance.toString();
  const balanceAfterEscrow = subtractMoney(currentBalance, charge.escrowAmount);
  const hasPlatformFee = toMinorUnits(charge.platformFee) > BigInt(0);
  const ledgerEntries: Prisma.TransactionCreateManyInput[] = [];

  ledgerEntries.push({
    userId: employerId,
    type: TransactionType.TASK_ESCROW_LOCK,
    amount: `-${charge.escrowAmount}`,
    balanceAfter: balanceAfterEscrow,
    referenceId: task.id,
    description: `Khóa tiền ký quỹ ${formatVnd(charge.escrowAmount)} cho việc "${task.title}".`,
    metadata: {
      taskId: task.id,
      taskTitle: task.title,
      rewardAmount: String(taskDetails.rewardAmount),
      totalSlots: taskDetails.totalSlots,
      escrowAmount: charge.escrowAmount,
    } as Prisma.InputJsonValue,
  });

  if (hasPlatformFee) {
    ledgerEntries.push({
      userId: employerId,
      type: TransactionType.TASK_CREATION_FEE,
      amount: `-${charge.platformFee}`,
      balanceAfter: finalAvailableBalance,
      referenceId: task.id,
      description: `Phí tạo việc ${formatVnd(charge.platformFee)} (10% của ${formatVnd(charge.escrowAmount)}) cho việc "${task.title}".`,
      metadata: {
        taskId: task.id,
        taskTitle: task.title,
        escrowAmount: charge.escrowAmount,
        platformFeeAmount: charge.platformFee,
        feeRate: PLATFORM_FEES.employerTaskCreationRate,
      } as Prisma.InputJsonValue,
    });
  }

  await tx.transaction.createMany({
    data: ledgerEntries,
  });
}

async function createTaskRecord(
  employerId: string,
  data: CreateTaskInput,
  publish: boolean,
) {
  const prisma = getPrisma();
  const now = new Date();

  if (!publish) {
    const task = await prisma.task.create({
      data: {
        employerId,
        ...buildDraftTaskCreateData(data),
      },
    });

    return {
      task,
      charge: null,
    };
  }

  const charge = calculateEmployerTaskCharge(data.rewardAmount, data.totalSlots);

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        employerId,
        ...buildPublishedTaskData(data, charge, now),
      },
    });

    await lockEmployerTaskCharge(tx, employerId, task, charge, data);

    return {
      task,
      charge,
    };
  });
}

export async function createTask(
  _prevState: CreateTaskState = initialCreateTaskState,
  formData: FormData,
): Promise<CreateTaskState> {
  const session = await auth(UserRole.EMPLOYER);

  void _prevState;
  const profile = session.profile;

  if (!profile) {
    return {
      ok: false,
      error: "Hồ sơ nhà tuyển việc chưa được khởi tạo. Vui lòng đăng nhập lại.",
    };
  }

  try {
    await enforceRateLimit({
      scope: "task:create",
      key: profile.id,
      limit: 20,
      windowSeconds: 60 * 60,
    });
  } catch (error) {
    return {
      ok: false,
      error: getRateLimitErrorMessage(error) ?? "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
    };
  }

  const raw = parseFormData(formData);
  const fields = snapshotFields(raw);
  const submissionMode = getTaskSubmissionMode(raw);
  const parsed = createTaskSchema.safeParse(mapCreateTaskFields(raw));

  if (!parsed.success) {
    return {
      ok: false,
      fields,
      error: getValidationMessage(parsed.error),
    };
  }

  try {
    const result = await createTaskRecord(
      profile.id,
      parsed.data,
      submissionMode === "publish",
    );

    revalidatePath("/dashboard/employer/tasks");
    revalidatePath(`/dashboard/employer/tasks/${result.task.id}`);

    if (submissionMode === "publish") {
      revalidatePath("/marketplace");
      revalidatePath(`/marketplace/${result.task.id}`);
    }
    await captureTaskFlowEvent(profile.id, "task_created", {
      taskId: result.task.id,
      status: result.task.status,
      published: submissionMode === "publish",
    });
    await notifyUser({
      userId: profile.id,
      type: NotificationType.TASK_STATUS,
      title:
        submissionMode === "publish"
          ? "Việc đã được đăng"
          : "Việc đã được lưu nháp",
      body:
        submissionMode === "publish"
          ? `Việc "${result.task.title}" đã được đăng và bắt đầu nhận worker.`
          : `Việc "${result.task.title}" đã được lưu nháp. Bạn có thể đăng khi sẵn sàng.`,
      data: {
        taskId: result.task.id,
        status: result.task.status,
      },
      email: {
        subject:
          submissionMode === "publish"
            ? "TaskBee: Việc đã được đăng"
            : "TaskBee: Việc đã được lưu nháp",
      },
    });

    return {
      ok: true,
      taskId: result.task.id,
      fields,
      message:
        submissionMode === "publish"
          ? `Việc đã được đăng và khóa ${formatVnd(result.charge?.escrowAmount ?? "0")} trong ví ký quỹ.`
          : "Việc đã được lưu bản nháp thành công.",
    };
  } catch (error) {
    return {
      ok: false,
      fields,
      error:
        error instanceof Error
          ? error.message
          : "Không thể tạo việc lúc này. Vui lòng thử lại sau.",
    };
  }
}

async function publishDraftTaskRecord(
  employerId: string,
  existingTask: ChargeableTask & { status: TaskStatus },
  data: CreateTaskInput,
) {
  if (existingTask.status !== TaskStatus.DRAFT) {
    throw new Error("Chỉ có thể đăng việc ở trạng thái bản nháp.");
  }

  const prisma = getPrisma();
  const charge = calculateEmployerTaskCharge(data.rewardAmount, data.totalSlots);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const updatedTask = await tx.task.update({
      where: {
        id: existingTask.id,
      },
      data: {
        ...buildPublishedTaskData(data, charge, now),
        updatedAt: now,
      },
    });

    await lockEmployerTaskCharge(tx, employerId, updatedTask, charge, data);

    return {
      task: updatedTask,
      charge,
    };
  });
}

/**
 * Tạm dừng việc đang ACTIVE
 * Chỉ nhà tuyển việc sở hữu việc mới có thể tạm dừng
 * Việc ở trạng thái PAUSED sẽ không hiển thị trong marketplace và không cho phép nhận mới
 */
export async function pauseTask(taskId: string): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const session = await auth(UserRole.EMPLOYER);

  try {
    const profile = session.profile;

    if (!profile) {
      return {
        ok: false,
        error: "Hồ sơ nhà tuyển việc chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    const prisma = getPrisma();

    // Kiểm tra việc tồn tại và thuộc về nhà tuyển việc này
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
        employerId: profile.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        employerId: true,
      },
    });

    if (!task) {
      return {
        ok: false,
        error: "Không tìm thấy việc hoặc bạn không có quyền thao tác việc này.",
      };
    }

    // Chỉ có thể tạm dừng việc đang ACTIVE
    if (task.status !== TaskStatus.ACTIVE) {
      return {
        ok: false,
        error: `Không thể tạm dừng việc đang ở trạng thái ${task.status}. Chỉ có thể tạm dừng việc đang ACTIVE.`,
      };
    }

    const blockers = await countTaskWorkBlockers(prisma, taskId);

    if (blockers.hasBlockingWork) {
      return {
        ok: false,
        error: getBlockingWorkMessage("pause", blockers),
      };
    }

    // Cập nhật trạng thái việc
    await prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        status: TaskStatus.PAUSED,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/employer/tasks");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/${taskId}`);

    return {
      ok: true,
      message: `Việc "${task.title}" đã được tạm dừng thành công.`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể tạm dừng việc lúc này. Vui lòng thử lại sau.",
    };
  }
}

/**
 * Tiếp tục việc đang PAUSED
 * Chỉ nhà tuyển việc sở hữu việc mới có thể tiếp tục
 * Việc sẽ quay lại trạng thái ACTIVE và hiển thị trong marketplace
 */
export async function resumeTask(taskId: string): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const session = await auth(UserRole.EMPLOYER);

  try {
    const profile = session.profile;

    if (!profile) {
      return {
        ok: false,
        error: "Hồ sơ nhà tuyển việc chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    const prisma = getPrisma();

    // Kiểm tra việc tồn tại và thuộc về nhà tuyển việc này
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
        employerId: profile.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        employerId: true,
        expiresAt: true,
      },
    });

    if (!task) {
      return {
        ok: false,
        error: "Không tìm thấy việc hoặc bạn không có quyền thao tác việc này.",
      };
    }

    // Chỉ có thể tiếp tục việc đang PAUSED
    if (task.status !== TaskStatus.PAUSED) {
      return {
        ok: false,
        error: `Không thể tiếp tục việc đang ở trạng thái ${task.status}. Chỉ có thể tiếp tục việc đang PAUSED.`,
      };
    }

    // Kiểm tra việc đã hết hạn chưa
    if (task.expiresAt && task.expiresAt < new Date()) {
      return {
        ok: false,
        error: "Không thể tiếp tục việc đã hết hạn. Vui lòng tạo việc mới.",
      };
    }

    // Cập nhật trạng thái việc
    await prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        status: TaskStatus.ACTIVE,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/employer/tasks");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/${taskId}`);

    return {
      ok: true,
      message: `Việc "${task.title}" đã được tiếp tục và hiển thị lại trong marketplace.`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể tiếp tục việc lúc này. Vui lòng thử lại sau.",
    };
  }
}

/**
 * Đóng việc thành công
 * Chỉ nhà tuyển việc sở hữu việc mới có thể đóng
 * Việc COMPLETED sẽ không hiển thị trong marketplace
 * Số tiền ký quỹ còn lại (nếu có) sẽ được giải phóng về số dư khả dụng
 */
export async function closeTask(taskId: string): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const session = await auth(UserRole.EMPLOYER);

  try {
    const profile = session.profile;

    if (!profile) {
      return {
        ok: false,
        error: "Hồ sơ nhà tuyển việc chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    const prisma = getPrisma();

    return await prisma.$transaction(async (tx) => {
      // Kiểm tra việc tồn tại và thuộc về nhà tuyển việc này
      await lockTaskRow(tx, taskId);

      const task = await tx.task.findUnique({
        where: {
          id: taskId,
          employerId: profile.id,
        },
        select: {
          id: true,
          title: true,
          status: true,
          employerId: true,
          escrowAmount: true,
          rewardAmount: true,
          approvedSlots: true,
          totalSlots: true,
        },
      });

      if (!task) {
        return {
          ok: false,
          error: "Không tìm thấy việc hoặc bạn không có quyền thao tác việc này.",
        };
      }

      // Chỉ có thể đóng việc đang ACTIVE hoặc PAUSED
      if (task.status !== TaskStatus.ACTIVE && task.status !== TaskStatus.PAUSED) {
        return {
          ok: false,
          error: `Không thể đóng việc đang ở trạng thái ${task.status}. Chỉ có thể đóng việc đang ACTIVE hoặc PAUSED.`,
        };
      }

      const blockers = await countTaskWorkBlockers(tx, taskId);

      if (blockers.hasBlockingWork) {
        return {
          ok: false,
          error: getBlockingWorkMessage("close", blockers),
        };
      }

      // Tính toán số tiền ký quỹ còn lại cần giải phóng
      const escrowAmountMinor = toMinorUnits(task.escrowAmount.toString());
      const rewardAmountMinor = toMinorUnits(task.rewardAmount.toString());
      const paidOutMinor = rewardAmountMinor * BigInt(task.approvedSlots);
      const remainingEscrowMinor = escrowAmountMinor - paidOutMinor;

      // Lấy số dư hiện tại
      const currentUser = await tx.user.findUniqueOrThrow({
        where: {
          id: profile.id,
        },
        select: {
          availableBalance: true,
        },
      });

      const currentAvailable = currentUser.availableBalance.toString();

      // Cập nhật trạng thái việc
      const taskUpdate = await tx.task.updateMany({
        where: {
          id: taskId,
          employerId: profile.id,
          status: {
            in: [TaskStatus.ACTIVE, TaskStatus.PAUSED],
          },
        },
        data: {
          status: TaskStatus.COMPLETED,
          updatedAt: new Date(),
        },
      });

      if (taskUpdate.count !== 1) {
        return {
          ok: false,
          error: "Trạng thái việc đã thay đổi bởi tiến trình khác. Vui lòng tải lại trang trước khi thao tác tiếp.",
        };
      }

      // Nếu còn tiền ký quỹ, giải phóng về số dư khả dụng
      if (remainingEscrowMinor > BigInt(0)) {
        const remainingEscrow = fromMinorUnits(remainingEscrowMinor);

        // Cập nhật ví: trừ tiền ký quỹ, cộng số dư khả dụng
        await tx.user.update({
          where: {
            id: profile.id,
          },
          data: {
            escrowBalance: {
              decrement: remainingEscrow,
            },
            availableBalance: {
              increment: remainingEscrow,
            },
          },
        });

        const newAvailableBalance = addMoney(currentAvailable, remainingEscrow);

        // Ghi bút toán cho việc giải phóng tiền ký quỹ
        await tx.transaction.create({
          data: {
            userId: profile.id,
            type: TransactionType.TASK_ESCROW_RELEASE,
            amount: remainingEscrow,
            balanceAfter: newAvailableBalance,
            referenceId: taskId,
            description: `Giải phóng tiền ký quỹ ${formatVnd(remainingEscrow)} từ việc "${task.title}" đã hoàn thành.`,
            metadata: {
              taskId: task.id,
              taskTitle: task.title,
              totalEscrow: task.escrowAmount.toString(),
              approvedSlots: task.approvedSlots,
              totalSlots: task.totalSlots,
              paidOut: fromMinorUnits(paidOutMinor),
              released: remainingEscrow,
            },
          },
        });

        return {
          ok: true,
          message: `Việc "${task.title}" đã được đóng thành công. Tiền ký quỹ còn lại ${formatVnd(remainingEscrow)} đã được giải phóng về ví.`,
        };
      }

      return {
        ok: true,
        message: `Việc "${task.title}" đã được đóng thành công.`,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể đóng việc lúc này. Vui lòng thử lại sau.",
    };
  } finally {
    revalidatePath("/dashboard/employer/tasks");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/${taskId}`);
  }
}

/**
 * Hủy việc và hoàn tiền ký quỹ
 * Chỉ nhà tuyển việc sở hữu việc mới có thể hủy
 * Toàn bộ tiền ký quỹ sẽ được hoàn lại về số dư khả dụng
 * Lưu ý: Phí tạo việc (10%) đã trả sẽ KHÔNG được hoàn lại
 */
export async function cancelTask(taskId: string, reason?: string): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  const session = await auth(UserRole.EMPLOYER);

  try {
    const profile = session.profile;

    if (!profile) {
      return {
        ok: false,
        error: "Hồ sơ nhà tuyển việc chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    const prisma = getPrisma();

    return await prisma.$transaction(async (tx) => {
      await lockTaskRow(tx, taskId);

      // Kiểm tra việc tồn tại và thuộc về nhà tuyển việc này
      const task = await tx.task.findUnique({
        where: {
          id: taskId,
          employerId: profile.id,
        },
        select: {
          id: true,
          title: true,
          status: true,
          employerId: true,
          escrowAmount: true,
          rewardAmount: true,
          approvedSlots: true,
          totalSlots: true,
          platformFeeAmount: true,
        },
      });

      if (!task) {
        return {
          ok: false,
          error: "Không tìm thấy việc hoặc bạn không có quyền thao tác việc này.",
        };
      }

      // Chỉ có thể hủy việc đang ACTIVE hoặc PAUSED
      if (task.status !== TaskStatus.ACTIVE && task.status !== TaskStatus.PAUSED) {
        return {
          ok: false,
          error: `Không thể hủy việc đang ở trạng thái ${task.status}. Chỉ có thể hủy việc đang ACTIVE hoặc PAUSED.`,
        };
      }

      const blockers = await countTaskWorkBlockers(tx, taskId);

      if (blockers.hasBlockingWork) {
        return {
          ok: false,
          error: getBlockingWorkMessage("cancel", blockers),
        };
      }

      // Tính toán số tiền ký quỹ cần hoàn lại
      const escrowAmountMinor = toMinorUnits(task.escrowAmount.toString());
      const rewardAmountMinor = toMinorUnits(task.rewardAmount.toString());
      const paidOutMinor = rewardAmountMinor * BigInt(task.approvedSlots);
      const refundEscrowMinor = escrowAmountMinor - paidOutMinor;

      if (refundEscrowMinor < BigInt(0)) {
        return {
          ok: false,
          error: "Lỗi tính toán tiền ký quỹ. Vui lòng liên hệ quản trị viên.",
        };
      }

      // Lấy số dư hiện tại
      const currentUser = await tx.user.findUniqueOrThrow({
        where: {
          id: profile.id,
        },
        select: {
          availableBalance: true,
        },
      });

      const currentAvailable = currentUser.availableBalance.toString();
      const refundEscrow = fromMinorUnits(refundEscrowMinor);

      // Cập nhật trạng thái việc
      const taskUpdate = await tx.task.updateMany({
        where: {
          id: taskId,
          employerId: profile.id,
          status: {
            in: [TaskStatus.ACTIVE, TaskStatus.PAUSED],
          },
        },
        data: {
          status: TaskStatus.CANCELLED,
          updatedAt: new Date(),
        },
      });

      if (taskUpdate.count !== 1) {
        return {
          ok: false,
          error: "Trạng thái việc đã thay đổi bởi tiến trình khác. Vui lòng tải lại trang trước khi thao tác tiếp.",
        };
      }

      // Hoàn tiền ký quỹ về số dư khả dụng
      if (refundEscrowMinor > BigInt(0)) {
        await tx.user.update({
          where: {
            id: profile.id,
          },
          data: {
            escrowBalance: {
              decrement: refundEscrow,
            },
            availableBalance: {
              increment: refundEscrow,
            },
          },
        });

        const newAvailableBalance = addMoney(currentAvailable, refundEscrow);

        // Ghi bút toán cho việc hoàn tiền ký quỹ
        await tx.transaction.create({
          data: {
            userId: profile.id,
            type: TransactionType.TASK_ESCROW_RELEASE,
            amount: refundEscrow,
            balanceAfter: newAvailableBalance,
            referenceId: taskId,
            description: `Hoàn tiền ký quỹ ${formatVnd(refundEscrow)} từ việc "${task.title}" đã hủy.${reason ? ` Lý do: ${reason}` : ""}`,
            metadata: {
              taskId: task.id,
              taskTitle: task.title,
              totalEscrow: task.escrowAmount.toString(),
              approvedSlots: task.approvedSlots,
              totalSlots: task.totalSlots,
              paidOut: fromMinorUnits(paidOutMinor),
              refunded: refundEscrow,
              platformFeeNotRefunded: task.platformFeeAmount.toString(),
              reason: reason ?? null,
            },
          },
        });
      }

      const feeNote = toMinorUnits(task.platformFeeAmount.toString()) > BigInt(0)
        ? ` Lưu ý: Phí tạo việc ${formatVnd(task.platformFeeAmount.toString())} đã trả sẽ không được hoàn lại.`
        : "";

      return {
        ok: true,
        message: refundEscrowMinor > BigInt(0)
          ? `Việc "${task.title}" đã được hủy thành công. Tiền ký quỹ ${formatVnd(refundEscrow)} đã được hoàn lại về ví.${feeNote}`
          : `Việc "${task.title}" đã được hủy thành công.${feeNote}`,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể hủy việc lúc này. Vui lòng thử lại sau.",
    };
  } finally {
    revalidatePath("/dashboard/employer/tasks");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/${taskId}`);
  }
}

/**
 * Cập nhật thông tin việc nháp hoặc đăng việc nháp sang ACTIVE
 */
export async function updateTask(
  _prevState: UpdateTaskState = initialCreateTaskState,
  formData: FormData,
): Promise<UpdateTaskState> {
  const session = await auth(UserRole.EMPLOYER);

  void _prevState;
  const profile = session.profile;

  if (!profile) {
    return {
      ok: false,
      error: "Hồ sơ nhà tuyển việc chưa được khởi tạo. Vui lòng đăng nhập lại.",
    };
  }

  try {
    await enforceRateLimit({
      scope: "task:update",
      key: profile.id,
      limit: 30,
      windowSeconds: 60 * 60,
    });
  } catch (error) {
    return {
      ok: false,
      error: getRateLimitErrorMessage(error) ?? "Bạn thao tác quá nhanh. Vui lòng thử lại sau.",
    };
  }

  const raw = parseFormData(formData);
  const taskId = raw.taskId as string;
  const submissionMode = getTaskSubmissionMode(raw);

  if (!taskId) {
    return {
      ok: false,
      error: "Không tìm thấy ID của việc cần cập nhật.",
    };
  }

  const fields = snapshotFields(raw);
  const parsed = createTaskSchema.safeParse(mapCreateTaskFields(raw));

  if (!parsed.success) {
    return {
      ok: false,
      fields,
      error: getValidationMessage(parsed.error),
    };
  }

  try {
    const prisma = getPrisma();

    // Kiểm tra task tồn tại và thuộc về employer này
    const existingTask = await prisma.task.findUnique({
      where: {
        id: taskId,
        employerId: profile.id,
      },
      select: {
        id: true,
        status: true,
        title: true,
      },
    });

    if (!existingTask) {
      return {
        ok: false,
        fields,
        error: "Không tìm thấy việc hoặc bạn không có quyền chỉnh sửa việc này.",
      };
    }

    if (submissionMode === "publish") {
      if (existingTask.status !== TaskStatus.DRAFT) {
        return {
          ok: false,
          fields,
          error: "Chỉ có thể đăng việc ở trạng thái bản nháp.",
        };
      }

      const { task: publishedTask, charge } = await publishDraftTaskRecord(
        profile.id,
        existingTask,
        parsed.data,
      );

      revalidatePath("/dashboard/employer/tasks");
      revalidatePath(`/dashboard/employer/tasks/${taskId}`);
      revalidatePath("/marketplace");
      revalidatePath(`/marketplace/${taskId}`);

      return {
        ok: true,
        taskId: publishedTask.id,
        fields,
        message: `Việc "${publishedTask.title}" đã được đăng và khóa ${formatVnd(charge.escrowAmount)} trong ví ký quỹ.`,
      };
    }

    if (existingTask.status !== TaskStatus.DRAFT) {
      return {
        ok: false,
        fields,
        error: "Chỉ có thể lưu bản nháp với việc ở trạng thái bản nháp.",
      };
    }

    const updatedTask = await prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        instructions: parsed.data.instructions,
        proofRequirements: parsed.data.proofRequirements ?? null,
        category: parsed.data.category ?? null,
        rewardAmount: String(parsed.data.rewardAmount),
        totalSlots: parsed.data.totalSlots,
        availableSlots: parsed.data.totalSlots,
        autoApproveDays: parsed.data.autoApproveDays,
        holdTimeMinutes: parsed.data.holdTimeMinutes,
        expiresAt: parsed.data.expiresAt ?? null,
        updatedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/employer/tasks");
    revalidatePath(`/dashboard/employer/tasks/${taskId}`);

    return {
      ok: true,
      taskId: updatedTask.id,
      fields,
      message: "Việc đã được cập nhật thành công.",
    };
  } catch (error) {
    return {
      ok: false,
      fields,
      error:
        error instanceof Error
          ? error.message
          : "Không thể cập nhật việc lúc này. Vui lòng thử lại sau.",
    };
  }
}

/**
 * Claim một slot của task cho worker
 * Sử dụng optimistic locking để đảm bảo không có race condition
 * 
 * Business Rules:
 * - Chỉ worker mới có thể claim slot
 * - Task phải ở trạng thái ACTIVE
 * - Task phải còn slot khả dụng (availableSlots > 0)
 * - Worker không thể claim cùng một task nhiều lần nếu đã có claim active
 * - Sử dụng atomic decrement với WHERE condition để đảm bảo concurrency safety
 * 
 * @param taskId - ID của task cần claim
 * @returns Promise với kết quả claim
 */
export async function claimTaskSlot(taskId: string): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
  claimId?: string;
}> {
  const session = await auth(UserRole.WORKER);

  try {
    // Yêu cầu user phải là WORKER
    const profile = session.profile;

    if (!profile) {
      return {
        ok: false,
        error: "Hồ sơ người làm chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    await enforceRateLimit({
      scope: "task:claim",
      key: profile.id,
      limit: 60,
      windowSeconds: 60 * 60,
    });

    const prisma = getPrisma();
    const now = new Date();

    await expireStaleTaskClaims({ taskId, now });

    // Sử dụng transaction để đảm bảo atomicity
    const claimResult = await prisma.$transaction(async (tx) => {
      // 1. Kiểm tra task tồn tại và ở trạng thái ACTIVE
      const task = await tx.task.findUnique({
        where: {
          id: taskId,
        },
        select: {
          id: true,
          title: true,
          status: true,
          availableSlots: true,
          expiresAt: true,
          holdTimeMinutes: true,
          rewardAmount: true,
        },
      });

      if (!task) {
        return {
          ok: false,
          error: "Không tìm thấy việc này.",
        };
      }

      // 2. Validate task status
      if (task.status !== TaskStatus.ACTIVE) {
        return {
          ok: false,
          error: `Việc này đang ở trạng thái ${task.status} và không thể nhận. Chỉ có thể nhận việc đang ACTIVE.`,
        };
      }

      // 3. Kiểm tra task đã hết hạn chưa
      if (task.expiresAt && task.expiresAt < new Date()) {
        return {
          ok: false,
          error: "Việc này đã hết hạn và không thể nhận.",
        };
      }

      // 4. Kiểm tra worker đã có claim cho task này chưa để tránh tạo trùng claim
      const existingClaim = await tx.taskClaim.findUnique({
        where: {
          taskId_workerId: {
            taskId,
            workerId: profile.id,
          },
        },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          submission: {
            select: {
              status: true,
            },
          },
        },
      });

      if (existingClaim) {
        if (
          existingClaim.status === TaskClaimStatus.EXPIRED ||
          (existingClaim.status === TaskClaimStatus.CLAIMED &&
            existingClaim.expiresAt &&
            existingClaim.expiresAt <= now)
        ) {
          return {
            ok: false,
            error: "Lượt giữ slot trước đó của bạn đã hết hạn. Vui lòng chọn việc khác.",
          };
        }

        return {
          ok: false,
          error: getDuplicateClaimMessage(
            existingClaim.status,
            existingClaim.submission?.status,
          ),
        };
      }

      // 5. Sử dụng optimistic locking: atomic decrement với WHERE condition
      // Chỉ update nếu availableSlots > 0
      const updateResult = await tx.task.updateMany({
        where: {
          id: taskId,
          status: TaskStatus.ACTIVE,
          availableSlots: {
            gt: 0,
          },
        },
        data: {
          availableSlots: {
            decrement: 1,
          },
          claimedSlots: {
            increment: 1,
          },
        },
      });

      // 6. Kiểm tra xem có update được không (nếu không thì slot đã hết)
      if (updateResult.count === 0) {
        // Double check lại availableSlots để đưa ra message chính xác
        const taskCheck = await tx.task.findUnique({
          where: { id: taskId },
          select: { availableSlots: true, status: true },
        });

        if (taskCheck?.availableSlots === 0) {
          return {
            ok: false,
            error: "Việc này đã hết slot. Vui lòng chọn việc khác.",
          };
        }

        return {
          ok: false,
          error: "Không thể nhận việc lúc này. Vui lòng thử lại.",
        };
      }

      // 7. Tạo TaskClaim record để track việc claim
      const claim = await tx.taskClaim.create({
        data: {
          taskId: taskId,
          workerId: profile.id,
          claimedAt: now,
          expiresAt: getTaskClaimExpiresAt(task.holdTimeMinutes, now),
        },
        select: {
          id: true,
        },
      });

      return {
        ok: true,
        claimId: claim.id,
        message: `Bạn đã nhận việc "${task.title}" thành công. Phần thưởng: ${formatVnd(task.rewardAmount.toString())}. Bạn có ${task.holdTimeMinutes} phút để gửi bằng chứng trước khi slot tự trả lại.`,
      };
    });

    if (claimResult.ok && claimResult.claimId) {
      await captureTaskFlowEvent(profile.id, "task_claimed", {
        taskId,
        claimId: claimResult.claimId,
      });
    }

    return claimResult;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        error: "Bạn đã nhận việc này rồi. Hãy hoàn thành hoặc xử lý claim hiện tại trước khi nhận lại.",
      };
    }

    return {
      ok: false,
      error:
        getRateLimitErrorMessage(error) ??
        (error instanceof Error
          ? error.message
          : "Không thể nhận việc lúc này. Vui lòng thử lại sau."),
    };
  } finally {
    // Revalidate các path liên quan
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/${taskId}`);
    revalidatePath("/dashboard/employer/tasks");
    revalidatePath(`/dashboard/employer/tasks/${taskId}`);
    revalidatePath("/dashboard/worker/tasks");
  }
}
