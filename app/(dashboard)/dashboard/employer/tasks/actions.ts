"use server";

import { revalidatePath } from "next/cache";
import { getPrisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { UserRole, TaskStatus } from "@/lib/generated/prisma/client";

/**
 * Nhân bản một công việc
 */
export async function duplicateTask(taskId: string) {
  try {
    const session = await requireRole(UserRole.EMPLOYER);
    const prisma = getPrisma();

    if (!session.profile) {
      return { success: false, error: "Hồ sơ Employer chưa được khởi tạo" };
    }

    // Lấy thông tin task gốc
    const originalTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!originalTask) {
      return { success: false, error: "Không tìm thấy công việc" };
    }

    // Kiểm tra quyền sở hữu
    if (originalTask.employerId !== session.profile.id) {
      return { success: false, error: "Bạn không có quyền nhân bản công việc này" };
    }

    // Tạo task mới với dữ liệu từ task gốc
    const newTask = await prisma.task.create({
      data: {
        title: `${originalTask.title} (Bản sao)`,
        description: originalTask.description,
        instructions: originalTask.instructions,
        proofRequirements: originalTask.proofRequirements,
        category: originalTask.category,
        subcategory: originalTask.subcategory,
        targetListId: originalTask.targetListId,
        taskType: originalTask.taskType,
        totalSlots: originalTask.totalSlots,
        availableSlots: originalTask.totalSlots,
        rewardAmount: originalTask.rewardAmount,
        platformFeeAmount: originalTask.platformFeeAmount,
        escrowAmount: "0", // Bản nháp không có escrow
        autoApproveDays: originalTask.autoApproveDays,
        holdTimeMinutes: originalTask.holdTimeMinutes,
        expiresAt: originalTask.expiresAt,
        employerId: session.profile.id,
        status: TaskStatus.DRAFT, // Luôn tạo bản sao ở trạng thái DRAFT
      },
    });

    revalidatePath("/dashboard/employer/tasks");
    return { success: true, taskId: newTask.id };
  } catch (error) {
    console.error("Error duplicating task:", error);
    return { success: false, error: "Đã xảy ra lỗi khi nhân bản công việc" };
  }
}

/**
 * Xóa một công việc
 */
export async function deleteTask(taskId: string) {
  try {
    const session = await requireRole(UserRole.EMPLOYER);
    const prisma = getPrisma();

    if (!session.profile) {
      return { success: false, error: "Hồ sơ Employer chưa được khởi tạo" };
    }

    // Lấy thông tin task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        _count: {
          select: {
            submissions: true,
          },
        },
      },
    });

    if (!task) {
      return { success: false, error: "Không tìm thấy công việc" };
    }

    // Kiểm tra quyền sở hữu
    if (task.employerId !== session.profile.id) {
      return { success: false, error: "Bạn không có quyền xóa công việc này" };
    }

    // Kiểm tra xem có submissions không
    if (task._count.submissions > 0) {
      return {
        success: false,
        error: "Không thể xóa công việc đã có người nộp bài. Vui lòng hủy công việc thay vì xóa.",
      };
    }

    // Chỉ cho phép xóa task ở trạng thái DRAFT hoặc CANCELLED
    if (task.status !== TaskStatus.DRAFT && task.status !== TaskStatus.CANCELLED) {
      return {
        success: false,
        error: "Chỉ có thể xóa công việc ở trạng thái Bản nháp hoặc Đã hủy",
      };
    }

    // Xóa task (cascade sẽ tự động xóa requirements)
    await prisma.task.delete({
      where: { id: taskId },
    });

    revalidatePath("/dashboard/employer/tasks");
    return { success: true };
  } catch (error) {
    console.error("Error deleting task:", error);
    return { success: false, error: "Đã xảy ra lỗi khi xóa công việc" };
  }
}
