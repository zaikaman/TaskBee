"use client";

import { useState } from "react";
import Link from "next/link";
import { addMoney, formatVnd } from "@/lib/utils/money";
import type { TaskStatus, TaskType } from "@/lib/generated/prisma/browser";

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  taskType: TaskType;
  totalSlots: number;
  availableSlots: number;
  claimedSlots: number;
  submittedSlots: number;
  approvedSlots: number;
  rejectedSlots: number;
  rewardAmount: string;
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
  DRAFT: "bg-gray-100 text-gray-700",
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

export function EmployerTasksList({ tasks }: EmployerTasksListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const normalizedSearchQuery = normalizeSearchText(searchQuery);

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
        <div className="flex-1 max-w-md">
          <input
            className="h-10 w-full rounded border border-[#d3dae6] bg-white px-4 text-sm text-[#1b1b1b] placeholder:text-[#a8b0bf] focus:border-[#22ab59] focus:outline-none focus:ring-1 focus:ring-[#22ab59]"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo tiêu đề..."
            type="text"
            value={searchQuery}
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            className="h-10 rounded border border-[#d3dae6] bg-white px-3 text-sm text-[#1b1b1b] focus:border-[#22ab59] focus:outline-none focus:ring-1 focus:ring-[#22ab59]"
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
            className="h-10 rounded border border-[#d3dae6] bg-white px-3 text-sm text-[#1b1b1b] focus:border-[#22ab59] focus:outline-none focus:ring-1 focus:ring-[#22ab59]"
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
            className="mx-auto h-12 w-12 text-[#a8b0bf]"
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
            className="mx-auto h-12 w-12 text-[#a8b0bf]"
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
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="overflow-hidden rounded border border-[#f0f2f5]">
          <table className="w-full">
            <thead className="bg-[#f5f7fa]">
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
                      {formatVnd(addMoney(task.escrowAmount, task.platformFeeAmount))}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4">
                    <button
                      aria-label="Thêm hành động"
                      className="text-[#686d77] hover:text-[#1b1b1b]"
                      type="button"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
