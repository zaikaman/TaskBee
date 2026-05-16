"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addMoney, calculateEmployerTaskCharge, formatVnd } from "@/lib/utils/money";
import type { TaskStatus, TaskType } from "@/lib/generated/prisma/browser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit, Copy, Trash2, MoreVertical } from "lucide-react";
import { duplicateTask, deleteTask } from "./actions";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  taskType: TaskType;
  rewardAmount: string;
  totalSlots: number;
  availableSlots: number;
  claimedSlots: number;
  submittedSlots: number;
  approvedSlots: number;
  rejectedSlots: number;
  escrowAmount: string;
  platformFeeAmount: string;
  createdAt: Date;
  publishedAt: Date | null;
};

type EmployerTasksListProps = {
  tasks: Task[];
};

const statusLabels: Record<TaskStatus, string> = {
  DRAFT: "Bản nháp",
  ACTIVE: "Đang hoạt động",
  PAUSED: "Tạm dừng",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

const statusColors: Record<TaskStatus, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  ACTIVE: "bg-green-100 text-green-700",
  PAUSED: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
};

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

function getTaskDisplayedCost(task: Task) {
  if (task.status === "DRAFT") {
    return calculateEmployerTaskCharge(task.rewardAmount, task.totalSlots).totalCharge;
  }

  return addMoney(task.escrowAmount, task.platformFeeAmount);
}

export function EmployerTasksList({ tasks }: EmployerTasksListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);

  const normalizedSearchQuery = normalizeSearchText(searchQuery);

  // Handle edit task
  const handleEdit = (taskId: string) => {
    router.push(`/dashboard/employer/tasks/${taskId}/edit`);
  };

  // Handle duplicate task
  const handleDuplicate = async (taskId: string) => {
    try {
      setIsDuplicating(taskId);
      const result = await duplicateTask(taskId);
      if (result.success && result.taskId) {
        router.push(`/dashboard/employer/tasks/${result.taskId}`);
        router.refresh();
      } else {
        alert(result.error || "Không thể nhân bản công việc");
      }
    } catch (error) {
      alert("Đã xảy ra lỗi khi nhân bản công việc");
    } finally {
      setIsDuplicating(null);
    }
  };

  // Handle delete task
  const handleDelete = async () => {
    if (!taskToDelete) return;
    
    try {
      setIsDeleting(true);
      const result = await deleteTask(taskToDelete);
      if (result.success) {
        setDeleteDialogOpen(false);
        setTaskToDelete(null);
        router.refresh();
      } else {
        alert(result.error || "Không thể xóa công việc");
      }
    } catch (error) {
      alert("Đã xảy ra lỗi khi xóa công việc");
    } finally {
      setIsDeleting(false);
    }
  };

  // Open delete confirmation dialog
  const confirmDelete = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };

  // Filter and sort tasks
  const filteredTasks = tasks
    .filter((task) => {
      const normalizedTitle = normalizeSearchText(task.title);
      const normalizedTaskType = normalizeSearchText(String(task.taskType));
      const matchesSearch =
        normalizedSearchQuery.length === 0 ||
        normalizedTitle.includes(normalizedSearchQuery) ||
        normalizedTaskType.includes(normalizedSearchQuery);
      const matchesStatus = statusFilter === "ALL" || task.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="w-full max-w-md flex-1">
          <input
            className="h-10 w-full rounded border border-[#d3dae6] bg-white px-4 text-sm text-[#1b1b1b] placeholder:text-[#a8b0bf] focus:border-[#22ab59] focus:outline-none focus:ring-1 focus:ring-[#22ab59]"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo tiêu đề..."
            type="text"
            value={searchQuery}
          />
        </div>

        {/* Filters */}
        <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-2">
          <select
            className="h-10 w-full rounded border border-[#d3dae6] bg-white px-3 text-sm text-[#1b1b1b] focus:border-[#22ab59] focus:outline-none focus:ring-1 focus:ring-[#22ab59]"
            onChange={(e) => setStatusFilter(e.target.value as TaskStatus | "ALL")}
            value={statusFilter}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="PAUSED">Tạm dừng</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <select
            className="h-10 w-full rounded border border-[#d3dae6] bg-white px-3 text-sm text-[#1b1b1b] focus:border-[#22ab59] focus:outline-none focus:ring-1 focus:ring-[#22ab59]"
            onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
            value={sortBy}
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-[#686d77]">
        {filteredTasks.length} kết quả
      </div>

      {filteredTasks.length === 0 && (searchQuery || statusFilter !== "ALL") ? (
        <div className="rounded border border-[#f0f2f5] bg-[#f5f7fa] p-12 text-center">
          <svg
            className="mx-auto size-12 text-[#a8b0bf]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M21 21l-4.35-4.35m1.85-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-[#203259]">
            Không tìm thấy công việc phù hợp
          </h3>
          <p className="mt-2 text-sm text-[#686d77]">
            Hãy thử đổi từ khóa tìm kiếm hoặc xóa bộ lọc trạng thái để xem thêm kết quả.
          </p>
        </div>
      ) : null}

      {/* Tasks Table */}
      {filteredTasks.length === 0 && !(searchQuery || statusFilter !== "ALL") ? (
        <div className="rounded border border-[#f0f2f5] bg-[#f5f7fa] p-12 text-center">
          <svg
            className="mx-auto size-12 text-[#a8b0bf]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-[#203259]">Chưa có công việc nào</h3>
          <p className="mt-2 text-sm text-[#686d77]">
            Bắt đầu bằng cách tạo công việc đầu tiên của bạn
          </p>
          <Link
            className="mt-6 inline-flex items-center gap-2 rounded bg-[#22ab59] px-6 py-2.5 text-sm font-bold uppercase text-white hover:bg-[#005924]"
            href="/dashboard/employer/tasks/create"
          >
            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 4v16m8-8H4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            Tạo công việc
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-[#f0f2f5]">
          <table className="w-full min-w-[780px]">
            <thead className="bg-[#f5f7fa] [&>tr>th:first-child]:rounded-tl [&>tr>th:last-child]:rounded-tr">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#686d77]">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#686d77]">
                  Tên công việc
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#686d77]">
                  Tiến độ
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#686d77]">
                  Chưa đánh giá
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#686d77]">
                  Chi phí
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#686d77]">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f5] bg-white">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-[#f5f7fa]">
                  {/* Status */}
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusColors[task.status]}`}
                    >
                      {statusLabels[task.status]}
                    </span>
                  </td>

                  {/* Title */}
                  <td className="px-6 py-4">
                    <Link
                      className="font-medium text-[#22ab59] hover:text-[#005924] hover:underline"
                      href={`/dashboard/employer/tasks/${task.id}`}
                    >
                      {task.title}
                    </Link>
                  </td>

                  {/* Progress */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-[#1b1b1b]">
                      {task.approvedSlots}/{task.totalSlots}
                      {task.totalSlots > 0 && (
                        <span className="ml-2 text-[#686d77]">
                          ({Math.round((task.approvedSlots / task.totalSlots) * 100)}%)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Not Rated (Pending Submissions) */}
                  <td className="px-6 py-4">
                    <div className="text-sm text-[#1b1b1b]">
                      {task.submittedSlots - task.approvedSlots - task.rejectedSlots}
                    </div>
                  </td>

                  {/* Cost */}
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-[#1b1b1b]">
                      {formatVnd(getTaskDisplayedCost(task))}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label="Thêm hành động"
                        className="inline-flex items-center justify-center rounded p-1 text-[#686d77] hover:bg-zinc-100 hover:text-[#1b1b1b] focus:outline-none disabled:opacity-50"
                        disabled={isDuplicating === task.id}
                      >
                        {isDuplicating === task.id ? (
                          <svg className="size-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <MoreVertical className="size-5" />
                        )}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {task.status === "DRAFT" && (
                          <DropdownMenuItem onClick={() => handleEdit(task.id)}>
                            <Edit className="size-4" />
                            <span>Chỉnh sửa</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(task.id)}
                          disabled={isDuplicating === task.id}
                        >
                          <Copy className="size-4" />
                          <span>Nhân bản</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => confirmDelete(task.id)}
                          className="text-red-500 hover:bg-red-50 hover:text-red-600 focus:bg-red-50 focus:text-red-600"
                        >
                          <Trash2 className="size-4" />
                          <span>Xóa</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa công việc</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa công việc này không? Hành động này không thể hoàn tác.
              Tất cả dữ liệu liên quan đến công việc sẽ bị xóa vĩnh viễn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting ? "Đang xóa..." : "Xóa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
