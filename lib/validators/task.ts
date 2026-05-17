import { z } from "zod";
import { TaskStatus, TaskType } from "@/lib/generated/prisma/client";
import {
  TASK_LIMITS,
  WALLET_LIMITS,
} from "@/config/app";

/**
 * Schema cho việc tạo việc mới
 * Nhà tuyển việc sử dụng để tạo việc với đầy đủ thông tin
 */
export const createTaskSchema = z.object({
  // Loại việc được lưu trực tiếp vào Task để tách Express, Classic và List.
  taskType: z
    .enum([TaskType.EXPRESS, TaskType.CLASSIC, TaskType.LIST])
    .default(TaskType.EXPRESS),

  title: z
    .string()
    .min(5, "Tiêu đề phải có ít nhất 5 ký tự")
    .max(TASK_LIMITS.titleMaxLength, `Tiêu đề không được vượt quá ${TASK_LIMITS.titleMaxLength} ký tự`)
    .trim(),

  description: z
    .string()
    .min(20, "Mô tả phải có ít nhất 20 ký tự")
    .max(TASK_LIMITS.descriptionMaxLength, `Mô tả không được vượt quá ${TASK_LIMITS.descriptionMaxLength} ký tự`)
    .trim(),

  instructions: z
    .string()
    .min(20, "Hướng dẫn phải có ít nhất 20 ký tự")
    .max(TASK_LIMITS.instructionsMaxLength, `Hướng dẫn không được vượt quá ${TASK_LIMITS.instructionsMaxLength} ký tự`)
    .trim(),

  proofRequirements: z
    .string()
    .min(10, "Yêu cầu bằng chứng phải có ít nhất 10 ký tự")
    .max(2000, "Yêu cầu bằng chứng không được vượt quá 2000 ký tự")
    .trim()
    .optional()
    .nullable(),

  category: z
    .string()
    .min(2, "Danh mục phải có ít nhất 2 ký tự")
    .max(120, "Danh mục không được vượt quá 120 ký tự")
    .trim()
    .optional()
    .nullable(),

  // Danh mục con dùng cho Classic Job.
  subcategory: z
    .string()
    .min(2, "Danh mục con phải có ít nhất 2 ký tự")
    .max(160, "Danh mục con không được vượt quá 160 ký tự")
    .trim()
    .optional()
    .nullable(),

  // ID danh sách mục tiêu - dùng cho loại việc LIST (trong tương lai)
  targetListId: z
    .string()
    .uuid("ID danh sách không hợp lệ")
    .optional()
    .nullable(),

  rewardAmount: z
    .number()
    .positive("Phần thưởng phải là số dương")
    .min(WALLET_LIMITS.minimumTaskRewardVnd, `Phần thưởng tối thiểu là ${WALLET_LIMITS.minimumTaskRewardVnd.toLocaleString("vi-VN")} VNĐ`)
    .max(WALLET_LIMITS.maximumTaskRewardVnd, `Phần thưởng tối đa là ${WALLET_LIMITS.maximumTaskRewardVnd.toLocaleString("vi-VN")} VNĐ`)
    .multipleOf(1000, "Phần thưởng phải là bội số của 1.000 VNĐ"),

  totalSlots: z
    .number()
    .int("Số lượng suất phải là số nguyên")
    .positive("Số lượng suất phải là số dương")
    .min(WALLET_LIMITS.minimumTaskSlots, `Số lượng suất tối thiểu là ${WALLET_LIMITS.minimumTaskSlots}`)
    .max(WALLET_LIMITS.maximumTaskSlots, `Số lượng suất tối đa là ${WALLET_LIMITS.maximumTaskSlots}`),

  autoApproveDays: z
    .number()
    .int("Số ngày tự động duyệt phải là số nguyên")
    .min(TASK_LIMITS.autoApproveTimeoutDaysMin, `Thời gian tự động duyệt tối thiểu là ${TASK_LIMITS.autoApproveTimeoutDaysMin} ngày`)
    .max(TASK_LIMITS.autoApproveTimeoutDaysMax, `Thời gian tự động duyệt tối đa là ${TASK_LIMITS.autoApproveTimeoutDaysMax} ngày`)
    .default(3),

  holdTimeMinutes: z
    .number()
    .int("Thời gian giữ slot phải là số nguyên")
    .min(TASK_LIMITS.holdTimeMinutesMin, `Thời gian giữ slot tối thiểu là ${TASK_LIMITS.holdTimeMinutesMin} phút`)
    .max(TASK_LIMITS.holdTimeMinutesMax, `Thời gian giữ slot tối đa là ${TASK_LIMITS.holdTimeMinutesMax} phút`)
    .default(TASK_LIMITS.holdTimeMinutesDefault),

  expiresAt: z
    .date()
    .min(new Date(), "Ngày hết hạn phải là ngày trong tương lai")
    .optional()
    .nullable(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Schema cho việc cập nhật việc
 * Cho phép nhà tuyển việc chỉnh sửa một số trường của việc
 */
export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(5, "Tiêu đề phải có ít nhất 5 ký tự")
    .max(TASK_LIMITS.titleMaxLength, `Tiêu đề không được vượt quá ${TASK_LIMITS.titleMaxLength} ký tự`)
    .trim()
    .optional(),

  description: z
    .string()
    .min(20, "Mô tả phải có ít nhất 20 ký tự")
    .max(TASK_LIMITS.descriptionMaxLength, `Mô tả không được vượt quá ${TASK_LIMITS.descriptionMaxLength} ký tự`)
    .trim()
    .optional(),

  instructions: z
    .string()
    .min(20, "Hướng dẫn phải có ít nhất 20 ký tự")
    .max(TASK_LIMITS.instructionsMaxLength, `Hướng dẫn không được vượt quá ${TASK_LIMITS.instructionsMaxLength} ký tự`)
    .trim()
    .optional(),

  proofRequirements: z
    .string()
    .min(10, "Yêu cầu bằng chứng phải có ít nhất 10 ký tự")
    .max(2000, "Yêu cầu bằng chứng không được vượt quá 2000 ký tự")
    .trim()
    .optional()
    .nullable(),

  category: z
    .string()
    .min(2, "Danh mục phải có ít nhất 2 ký tự")
    .max(50, "Danh mục không được vượt quá 50 ký tự")
    .trim()
    .optional()
    .nullable(),

  expiresAt: z
    .date()
    .min(new Date(), "Ngày hết hạn phải là ngày trong tương lai")
    .optional()
    .nullable(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * Schema cho việc thay đổi trạng thái việc
 * Nhà tuyển việc có thể tạm dừng, tiếp tục, hoàn tất hoặc hủy việc
 */
export const taskStatusChangeSchema = z.object({
  taskId: z.string().uuid("ID việc không hợp lệ"),
  newStatus: z.enum([TaskStatus.ACTIVE, TaskStatus.PAUSED, TaskStatus.COMPLETED, TaskStatus.CANCELLED], {
    message: "Trạng thái không hợp lệ",
  }),
  reason: z
    .string()
    .min(10, "Lý do phải có ít nhất 10 ký tự")
    .max(500, "Lý do không được vượt quá 500 ký tự")
    .trim()
    .optional(),
});

export type TaskStatusChangeInput = z.infer<typeof taskStatusChangeSchema>;

/**
 * Schema cho việc lọc và tìm kiếm việc trong marketplace
 * Người làm sử dụng để duyệt việc
 */
export const taskFilterSchema = z.object({
  search: z
    .string()
    .max(200, "Từ khóa tìm kiếm không được vượt quá 200 ký tự")
    .trim()
    .optional(),

  category: z
    .string()
    .max(50, "Danh mục không hợp lệ")
    .trim()
    .optional(),

  status: z
    .enum([TaskStatus.DRAFT, TaskStatus.ACTIVE, TaskStatus.PAUSED, TaskStatus.COMPLETED, TaskStatus.CANCELLED])
    .optional(),

  minReward: z
    .number()
    .nonnegative("Phần thưởng tối thiểu phải là số không âm")
    .optional(),

  maxReward: z
    .number()
    .positive("Phần thưởng tối đa phải là số dương")
    .optional(),

  hasAvailableSlots: z
    .boolean()
    .optional()
    .default(true),

  sortBy: z
    .enum(["createdAt", "rewardAmount", "availableSlots", "publishedAt"])
    .optional()
    .default("createdAt"),

  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),

  page: z
    .number()
    .int("Số trang phải là số nguyên")
    .positive("Số trang phải là số dương")
    .optional()
    .default(1),

  pageSize: z
    .number()
    .int("Kích thước trang phải là số nguyên")
    .positive("Kích thước trang phải là số dương")
    .min(1, "Kích thước trang tối thiểu là 1")
    .max(100, "Kích thước trang tối đa là 100")
    .optional()
    .default(20),
}).refine(
  (data) => {
    if (data.minReward !== undefined && data.maxReward !== undefined) {
      return data.minReward <= data.maxReward;
    }
    return true;
  },
  {
    message: "Phần thưởng tối thiểu không được lớn hơn phần thưởng tối đa",
    path: ["minReward"],
  }
);

export type TaskFilterInput = z.infer<typeof taskFilterSchema>;

/**
 * Schema cho việc claim task slot
 * Worker sử dụng để claim một slot của task
 */
export const claimTaskSlotSchema = z.object({
  taskId: z.string().uuid("ID việc không hợp lệ"),
});

export type ClaimTaskSlotInput = z.infer<typeof claimTaskSlotSchema>;

/**
 * Schema cho việc đăng việc từ NHÁP sang ĐANG HOẠT ĐỘNG
 * Nhà tuyển việc sử dụng sau khi tạo việc và muốn đăng
 */
export const publishTaskSchema = z.object({
  taskId: z.string().uuid("ID việc không hợp lệ"),
});

export type PublishTaskInput = z.infer<typeof publishTaskSchema>;

/**
 * Schema cho việc lấy danh sách việc của nhà tuyển việc
 * Bảng điều khiển nhà tuyển việc sử dụng
 */
export const employerTaskListSchema = z.object({
  status: z
    .enum([TaskStatus.DRAFT, TaskStatus.ACTIVE, TaskStatus.PAUSED, TaskStatus.COMPLETED, TaskStatus.CANCELLED])
    .optional(),

  sortBy: z
    .enum(["createdAt", "updatedAt", "publishedAt", "rewardAmount"])
    .optional()
    .default("createdAt"),

  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),

  page: z
    .number()
    .int("Số trang phải là số nguyên")
    .positive("Số trang phải là số dương")
    .optional()
    .default(1),

  pageSize: z
    .number()
    .int("Kích thước trang phải là số nguyên")
    .positive("Kích thước trang phải là số dương")
    .min(1, "Kích thước trang tối thiểu là 1")
    .max(100, "Kích thước trang tối đa là 100")
    .optional()
    .default(20),
});

export type EmployerTaskListInput = z.infer<typeof employerTaskListSchema>;

/**
 * Schema cho việc lấy chi tiết task
 */
export const getTaskByIdSchema = z.object({
  taskId: z.string().uuid("ID việc không hợp lệ"),
});

export type GetTaskByIdInput = z.infer<typeof getTaskByIdSchema>;

/**
 * Helper function để validate và parse task data
 */
export function validateCreateTask(data: unknown): CreateTaskInput {
  return createTaskSchema.parse(data);
}

export function validateUpdateTask(data: unknown): UpdateTaskInput {
  return updateTaskSchema.parse(data);
}

export function validateTaskFilter(data: unknown): TaskFilterInput {
  return taskFilterSchema.parse(data);
}

export function validateClaimTaskSlot(data: unknown): ClaimTaskSlotInput {
  return claimTaskSlotSchema.parse(data);
}

export function validateTaskStatusChange(data: unknown): TaskStatusChangeInput {
  return taskStatusChangeSchema.parse(data);
}
