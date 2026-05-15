"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PLATFORM_FEES, TEST_WHITELIST_EMAILS } from "@/config/app";
import { requireRole } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
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

const initialCreateTaskState: CreateTaskState = {
  ok: false,
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
  return error.issues[0]?.message ?? "Thông tin task không hợp lệ.";
}

function assertSufficientBalance(updatedCount: number) {
  if (updatedCount !== 1) {
    throw new Error("Số dư ví không đủ để khóa tiền escrow cho task này.");
  }
}

async function createTaskRecord(employerId: string, data: CreateTaskInput) {
  const prisma = getPrisma();
  const charge = calculateEmployerTaskCharge(data.rewardAmount, data.totalSlots);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // Kiểm tra số dư trước khi thực hiện giao dịch
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
    
    // Kiểm tra số dư đủ để trừ cả escrow và phí (bypass cho whitelist users)
    if (!isWhitelisted && toMinorUnits(currentBalance) < toMinorUnits(charge.totalCharge)) {
      throw new Error(
        `Số dư không đủ. Cần ${formatVnd(charge.totalCharge)} nhưng chỉ có ${formatVnd(currentBalance)}.`
      );
    }

    // Cập nhật ví: trừ tổng số tiền từ available, cộng escrow vào escrow balance
    // Whitelist users: cho phép balance âm để test
    const walletUpdate = await tx.user.updateMany({
      where: {
        id: employerId,
        role: UserRole.EMPLOYER,
        ...(isWhitelisted ? {} : {
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

    // Tạo task record
    const task = await tx.task.create({
      data: {
        employerId,
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
        escrowAmount: charge.escrowAmount,
        platformFeeAmount: charge.platformFee,
        status: TaskStatus.ACTIVE,
        autoApproveDays: data.autoApproveDays,
        expiresAt: data.expiresAt ?? null,
        publishedAt: now,
      },
    });

    // Lấy số dư sau khi cập nhật
    const updatedEmployer = await tx.user.findUniqueOrThrow({
      where: {
        id: employerId,
      },
      select: {
        availableBalance: true,
      },
    });

    const finalAvailableBalance = updatedEmployer.availableBalance.toString();

    // Tính số dư sau mỗi bước để ghi ledger chính xác
    // Bước 1: Trừ escrow từ available balance
    const balanceAfterEscrow = subtractMoney(currentBalance, charge.escrowAmount);
    
    // Bước 2: Trừ phí từ số dư còn lại (nếu có phí)
    const hasPlatformFee = toMinorUnits(charge.platformFee) > BigInt(0);

    // Ghi ledger entries theo thứ tự thời gian
    const ledgerEntries = [];

    // Entry 1: Khóa escrow
    ledgerEntries.push({
      userId: employerId,
      type: TransactionType.TASK_ESCROW_LOCK,
      amount: `-${charge.escrowAmount}`,
      balanceAfter: balanceAfterEscrow,
      referenceId: task.id,
      description: `Khóa escrow ${formatVnd(charge.escrowAmount)} cho task "${task.title}".`,
      metadata: {
        taskId: task.id,
        taskTitle: task.title,
        rewardAmount: String(data.rewardAmount),
        totalSlots: data.totalSlots,
        escrowAmount: charge.escrowAmount,
      },
    });

    // Entry 2: Phí tạo task (10% của escrow)
    if (hasPlatformFee) {
      ledgerEntries.push({
        userId: employerId,
        type: TransactionType.TASK_CREATION_FEE,
        amount: `-${charge.platformFee}`,
        balanceAfter: finalAvailableBalance,
        referenceId: task.id,
        description: `Phí tạo task ${formatVnd(charge.platformFee)} (10% của ${formatVnd(charge.escrowAmount)}) cho task "${task.title}".`,
        metadata: {
          taskId: task.id,
          taskTitle: task.title,
          escrowAmount: charge.escrowAmount,
          platformFeeAmount: charge.platformFee,
          feeRate: PLATFORM_FEES.employerTaskCreationRate,
        },
      });
    }

    await tx.transaction.createMany({
      data: ledgerEntries,
    });

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
      error: "Hồ sơ Employer chưa được khởi tạo. Vui lòng đăng nhập lại.",
    };
  }

  const raw = parseFormData(formData);
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
    const { task, charge } = await createTaskRecord(profile.id, parsed.data);

    revalidatePath("/dashboard/employer/tasks");
    revalidatePath("/marketplace");

    return {
      ok: true,
      taskId: task.id,
      fields,
      message: `Task đã được đăng và khóa ${formatVnd(charge.escrowAmount)} trong escrow.`,
    };
  } catch (error) {
    return {
      ok: false,
      fields,
      error:
        error instanceof Error
          ? error.message
          : "Không thể tạo task lúc này. Vui lòng thử lại sau.",
    };
  }
}

/**
 * Tạm dừng task đang ACTIVE
 * Chỉ Employer sở hữu task mới có thể pause
 * Task PAUSED sẽ không hiển thị trong marketplace và không cho phép claim mới
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
        error: "Hồ sơ Employer chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    const prisma = getPrisma();

    // Kiểm tra task tồn tại và thuộc về employer này
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
        error: "Không tìm thấy task hoặc bạn không có quyền thao tác task này.",
      };
    }

    // Chỉ có thể pause task đang ACTIVE
    if (task.status !== TaskStatus.ACTIVE) {
      return {
        ok: false,
        error: `Không thể tạm dừng task đang ở trạng thái ${task.status}. Chỉ có thể tạm dừng task đang ACTIVE.`,
      };
    }

    // Cập nhật trạng thái task
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
      message: `Task "${task.title}" đã được tạm dừng thành công.`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể tạm dừng task lúc này. Vui lòng thử lại sau.",
    };
  }
}

/**
 * Tiếp tục task đang PAUSED
 * Chỉ Employer sở hữu task mới có thể resume
 * Task sẽ quay lại trạng thái ACTIVE và hiển thị trong marketplace
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
        error: "Hồ sơ Employer chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    const prisma = getPrisma();

    // Kiểm tra task tồn tại và thuộc về employer này
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
        error: "Không tìm thấy task hoặc bạn không có quyền thao tác task này.",
      };
    }

    // Chỉ có thể resume task đang PAUSED
    if (task.status !== TaskStatus.PAUSED) {
      return {
        ok: false,
        error: `Không thể tiếp tục task đang ở trạng thái ${task.status}. Chỉ có thể tiếp tục task đang PAUSED.`,
      };
    }

    // Kiểm tra task đã hết hạn chưa
    if (task.expiresAt && task.expiresAt < new Date()) {
      return {
        ok: false,
        error: "Không thể tiếp tục task đã hết hạn. Vui lòng tạo task mới.",
      };
    }

    // Cập nhật trạng thái task
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
      message: `Task "${task.title}" đã được tiếp tục và hiển thị lại trong marketplace.`,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể tiếp tục task lúc này. Vui lòng thử lại sau.",
    };
  }
}

/**
 * Đóng task thành công
 * Chỉ Employer sở hữu task mới có thể close
 * Task COMPLETED sẽ không hiển thị trong marketplace
 * Escrow còn lại (nếu có) sẽ được giải phóng về available balance
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
        error: "Hồ sơ Employer chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    const prisma = getPrisma();

    return await prisma.$transaction(async (tx) => {
      // Kiểm tra task tồn tại và thuộc về employer này
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
          error: "Không tìm thấy task hoặc bạn không có quyền thao tác task này.",
        };
      }

      // Chỉ có thể close task đang ACTIVE hoặc PAUSED
      if (task.status !== TaskStatus.ACTIVE && task.status !== TaskStatus.PAUSED) {
        return {
          ok: false,
          error: `Không thể đóng task đang ở trạng thái ${task.status}. Chỉ có thể đóng task đang ACTIVE hoặc PAUSED.`,
        };
      }

      // Tính toán số tiền escrow còn lại cần giải phóng
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

      // Cập nhật trạng thái task
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.COMPLETED,
          updatedAt: new Date(),
        },
      });

      // Nếu còn escrow, giải phóng về available balance
      if (remainingEscrowMinor > BigInt(0)) {
        const remainingEscrow = fromMinorUnits(remainingEscrowMinor);

        // Cập nhật ví: trừ escrow, cộng available
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

        // Ghi ledger entry cho việc giải phóng escrow
        await tx.transaction.create({
          data: {
            userId: profile.id,
            type: TransactionType.TASK_ESCROW_RELEASE,
            amount: remainingEscrow,
            balanceAfter: newAvailableBalance,
            referenceId: taskId,
            description: `Giải phóng escrow ${formatVnd(remainingEscrow)} từ task "${task.title}" đã hoàn thành.`,
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
          message: `Task "${task.title}" đã được đóng thành công. Escrow còn lại ${formatVnd(remainingEscrow)} đã được giải phóng về ví.`,
        };
      }

      return {
        ok: true,
        message: `Task "${task.title}" đã được đóng thành công.`,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể đóng task lúc này. Vui lòng thử lại sau.",
    };
  } finally {
    revalidatePath("/dashboard/employer/tasks");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/tasks/${taskId}`);
  }
}

/**
 * Hủy task và hoàn tiền escrow
 * Chỉ Employer sở hữu task mới có thể cancel
 * Toàn bộ escrow sẽ được hoàn lại về available balance
 * Lưu ý: Phí tạo task (10%) đã trả sẽ KHÔNG được hoàn lại
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
        error: "Hồ sơ Employer chưa được khởi tạo. Vui lòng đăng nhập lại.",
      };
    }

    const prisma = getPrisma();

    return await prisma.$transaction(async (tx) => {
      // Kiểm tra task tồn tại và thuộc về employer này
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
          error: "Không tìm thấy task hoặc bạn không có quyền thao tác task này.",
        };
      }

      // Chỉ có thể cancel task đang ACTIVE hoặc PAUSED
      if (task.status !== TaskStatus.ACTIVE && task.status !== TaskStatus.PAUSED) {
        return {
          ok: false,
          error: `Không thể hủy task đang ở trạng thái ${task.status}. Chỉ có thể hủy task đang ACTIVE hoặc PAUSED.`,
        };
      }

      // Tính toán số tiền escrow cần hoàn lại
      const escrowAmountMinor = toMinorUnits(task.escrowAmount.toString());
      const rewardAmountMinor = toMinorUnits(task.rewardAmount.toString());
      const paidOutMinor = rewardAmountMinor * BigInt(task.approvedSlots);
      const refundEscrowMinor = escrowAmountMinor - paidOutMinor;

      if (refundEscrowMinor < BigInt(0)) {
        return {
          ok: false,
          error: "Lỗi tính toán escrow. Vui lòng liên hệ admin.",
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

      // Cập nhật trạng thái task
      await tx.task.update({
        where: {
          id: taskId,
        },
        data: {
          status: TaskStatus.CANCELLED,
          updatedAt: new Date(),
        },
      });

      // Hoàn tiền escrow về available balance
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

        // Ghi ledger entry cho việc hoàn tiền escrow
        await tx.transaction.create({
          data: {
            userId: profile.id,
            type: TransactionType.TASK_ESCROW_RELEASE,
            amount: refundEscrow,
            balanceAfter: newAvailableBalance,
            referenceId: taskId,
            description: `Hoàn tiền escrow ${formatVnd(refundEscrow)} từ task "${task.title}" đã hủy.${reason ? ` Lý do: ${reason}` : ""}`,
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
        ? ` Lưu ý: Phí tạo task ${formatVnd(task.platformFeeAmount.toString())} đã trả sẽ không được hoàn lại.`
        : "";

      return {
        ok: true,
        message: refundEscrowMinor > BigInt(0)
          ? `Task "${task.title}" đã được hủy thành công. Escrow ${formatVnd(refundEscrow)} đã được hoàn lại về ví.${feeNote}`
          : `Task "${task.title}" đã được hủy thành công.${feeNote}`,
      };
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể hủy task lúc này. Vui lòng thử lại sau.",
    };
  } finally {
    revalidatePath("/dashboard/employer/tasks");
    revalidatePath("/marketplace");
    revalidatePath(`/marketplace/tasks/${taskId}`);
  }
}
