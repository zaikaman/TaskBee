"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PLATFORM_FEES, TEST_WHITELIST_EMAILS } from "@/config/app";
import { requireRole } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  Prisma,
  TaskStatus,
  TaskType,
  TransactionType,
  UserRole,
} from "@/lib/generated/prisma/client";
import {
  addMoney,
  calculateEmployerTaskCharge,
  formatVnd,
  fromMinorUnits,
  subtractMoney,
  toMinorUnits,
} from "@/lib/utils/money";
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
  const isWhitelisted = TEST_WHITELIST_EMAILS.includes(currentUser.email as any);

  if (!isWhitelisted && toMinorUnits(currentBalance) < toMinorUnits(charge.totalCharge)) {
    throw new Error(
      `Số dư không đủ. Cần ${formatVnd(charge.totalCharge)} nhưng chỉ có ${formatVnd(currentBalance)}.`,
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
  void _prevState;

  const session = await requireRole(UserRole.EMPLOYER);
  const profile = session.profile;

  if (!profile) {
    return {
      ok: false,
      error: "Hồ sơ nhà tuyển việc chưa được khởi tạo. Vui lòng đăng nhập lại.",
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
      revalidatePath(`/marketplace/tasks/${result.task.id}`);
    }

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
  try {
    const session = await requireRole(UserRole.EMPLOYER);
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
    revalidatePath(`/marketplace/tasks/${taskId}`);

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
  try {
    const session = await requireRole(UserRole.EMPLOYER);
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
    revalidatePath(`/marketplace/tasks/${taskId}`);

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
  try {
    const session = await requireRole(UserRole.EMPLOYER);
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
          escrowBalance: true,
        },
      });

      const currentAvailable = currentUser.availableBalance.toString();
      const currentEscrow = currentUser.escrowBalance.toString();

      // Cập nhật trạng thái việc
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.COMPLETED,
          updatedAt: new Date(),
        },
      });

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

        // Tính số dư sau khi giải phóng
        const newEscrowBalance = subtractMoney(currentEscrow, remainingEscrow);
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
    revalidatePath(`/marketplace/tasks/${taskId}`);
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
  try {
    const session = await requireRole(UserRole.EMPLOYER);
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
          escrowBalance: true,
        },
      });

      const currentAvailable = currentUser.availableBalance.toString();
      const currentEscrow = currentUser.escrowBalance.toString();
      const refundEscrow = fromMinorUnits(refundEscrowMinor);

      // Cập nhật trạng thái việc
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.CANCELLED,
          updatedAt: new Date(),
        },
      });

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

        // Tính số dư sau khi hoàn tiền
        const newEscrowBalance = subtractMoney(currentEscrow, refundEscrow);
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
    revalidatePath(`/marketplace/tasks/${taskId}`);
  }
}

/**
 * Cập nhật thông tin việc nháp hoặc đăng việc nháp sang ACTIVE
 */
export async function updateTask(
  _prevState: UpdateTaskState = initialCreateTaskState,
  formData: FormData,
): Promise<UpdateTaskState> {
  void _prevState;

  const session = await requireRole(UserRole.EMPLOYER);
  const profile = session.profile;

  if (!profile) {
    return {
      ok: false,
      error: "Hồ sơ nhà tuyển việc chưa được khởi tạo. Vui lòng đăng nhập lại.",
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
      revalidatePath(`/marketplace/tasks/${taskId}`);

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
  try {
    // Yêu cầu user phải là WORKER
    const session = await requireRole(UserRole.WORKER);
    const profile = session.profile;

    if (!profile) {
      return {
        ok: false,
        error: "Hồ sơ người làm chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    const prisma = getPrisma();

    // Sử dụng transaction để đảm bảo atomicity
    return await prisma.$transaction(async (tx) => {
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

      // 4. Kiểm tra worker đã claim task này chưa (chỉ cho phép 1 claim active per worker per task)
      const existingClaim = await tx.taskClaim.findFirst({
        where: {
          taskId: taskId,
          workerId: profile.id,
          // Chỉ kiểm tra các claim chưa có submission hoặc submission chưa được approve/reject
          OR: [
            {
              submission: null,
            },
            {
              submission: {
                status: {
                  notIn: ["APPROVED", "REJECTED"],
                },
              },
            },
          ],
        },
        select: {
          id: true,
          claimedAt: true,
        },
      });

      if (existingClaim) {
        return {
          ok: false,
          error: "Bạn đã nhận việc này rồi. Vui lòng hoàn thành việc hiện tại trước khi nhận lại.",
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
          claimedAt: new Date(),
        },
        select: {
          id: true,
        },
      });

      return {
        ok: true,
        claimId: claim.id,
        message: `Bạn đã nhận việc "${task.title}" thành công. Phần thưởng: ${formatVnd(task.rewardAmount.toString())}.`,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể nhận việc lúc này. Vui lòng thử lại sau.",
    };
  } finally {
    // Revalidate các path liên quan
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/tasks/${taskId}`);
    revalidatePath("/dashboard/worker/tasks");
  }
}
