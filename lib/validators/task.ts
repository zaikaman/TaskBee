import { z } from "zod";
import { TaskStatus, TaskType } from "@/lib/generated/prisma/client";
import {
  TASK_LIMITS,
  WALLET_LIMITS,
} from "@/config/app";

/**
 * Schema cho việc tạo task mới
 * Employer sử dụng để tạo task với đầy đủ thông tin
 */
export const createTaskSchema = z.object({
  // Task type - MVP chỉ support EXPRESS, sau này mở rộng CLASSIC và LIST
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
    .max(50, "Danh mục không được vượt quá 50 ký tự")
    .trim()
    .optional()
    .nullable(),

  // Subcategory - dùng cho CLASSIC job type (future)
  subcategory: z
    .string()
    .min(2, "Danh mục con phải có ít nhất 2 ký tự")
    .max(50, "Danh mục con không được vượt quá 50 ký tự")
    .trim()
    .optional()
    .nullable(),

  // Target list ID - dùng cho LIST job type (future)
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
    .multipleOf(1000, "Phần thưởng phải là bội số của 1,000 VNĐ"),

  totalSlots: z
    .number()
    .int("Số lượng slot phải là số nguyên")
    .positive("Số lượng slot phải là số dương")
    .min(WALLET_LIMITS.minimumTaskSlots, `Số lượng slot tối thiểu là ${WALLET_LIMITS.minimumTaskSlots}`)
    .max(WALLET_LIMITS.maximumTaskSlots, `Số lượng slot tối đa là ${WALLET_LIMITS.maximumTaskSlots}`),

  autoApproveDays: z
    .number()
    .int("Số ngày tự động duyệt phải là số nguyên")
    .min(TASK_LIMITS.autoApproveTimeoutDaysMin, `Thời gian tự động duyệt tối thiểu là ${TASK_LIMITS.autoApproveTimeoutDaysMin} ngày`)
    .max(TASK_LIMITS.autoApproveTimeoutDaysMax, `Thời gian tự động duyệt tối đa là ${TASK_LIMITS.autoApproveTimeoutDaysMax} ngày`)
    .default(3),

  expiresAt: z
    .date()
    .min(new Date(), "Ngày hết hạn phải là ngày trong tương lai")
    .optional()
    .nullable(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Schema cho việc cập nhật task
 * Cho phép Employer chỉnh sửa một số trường của task
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
 * Schema cho việc thay đổi trạng thái task
 * Employer có thể pause, resume, close, hoặc cancel task
 */
export const taskStatusChangeSchema = z.object({
  taskId: z.string().uuid("ID task không hợp lệ"),
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
 * Schema cho việc lọc và tìm kiếm task trong marketplace
 * Worker sử dụng để browse tasks
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
  taskId: z.string().uuid("ID task không hợp lệ"),
});

export type ClaimTaskSlotInput = z.infer<typeof claimTaskSlotSchema>;

/**
 * Schema cho việc publish task từ DRAFT sang ACTIVE
 * Employer sử dụng sau khi tạo task và muốn publish
 */
export const publishTaskSchema = z.object({
  taskId: z.string().uuid("ID task không hợp lệ"),
});

export type PublishTaskInput = z.infer<typeof publishTaskSchema>;

/**
 * Schema cho việc lấy danh sách task của Employer
 * Employer dashboard sử dụng
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
  taskId: z.string().uuid("ID task không hợp lệ"),
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
