"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PLATFORM_FEES } from "@/config/app";
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
      },
    });

    const currentBalance = currentUser.availableBalance.toString();
    
    // Kiểm tra số dư đủ để trừ cả escrow và phí
    if (toMinorUnits(currentBalance) < toMinorUnits(charge.totalCharge)) {
      throw new Error(
        `Số dư không đủ. Cần ${formatVnd(charge.totalCharge)} nhưng chỉ có ${formatVnd(currentBalance)}.`
      );
    }

    // Cập nhật ví: trừ tổng số tiền từ available, cộng escrow vào escrow balance
    const walletUpdate = await tx.user.updateMany({
      where: {
        id: employerId,
        role: UserRole.EMPLOYER,
        availableBalance: {
          gte: charge.totalCharge,
        },
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

    assertSufficientBalance(walletUpdate.count);

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
