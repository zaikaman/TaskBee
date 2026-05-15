"use client";

import { Task } from "@/lib/generated/prisma/browser";
import { formatVnd } from "@/lib/utils/money";

type TaskDetailCardProps = {
  task: Pick<
    Task,
    | "id"
    | "title"
    | "description"
    | "instructions"
    | "proofRequirements"
    | "category"
    | "rewardAmount"
    | "totalSlots"
    | "availableSlots"
    | "autoApproveDays"
    | "status"
  >;
};

export function TaskDetailCard({ task }: TaskDetailCardProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-[#203259]">{task.title}</h1>
        {task.category && (
          <span className="mt-2 inline-block rounded bg-[#edf4ff] px-3 py-1 text-xs font-medium text-[#203259]">
            {task.category}
          </span>
        )}
      </div>

      {/* Reward & Slots */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#edf4ff] p-4">
          <span className="text-xs font-bold text-[#7f8aa0] uppercase">Phần thưởng</span>
          <p className="mt-1 text-xl font-black text-[#22ab59]">
            {formatVnd(task.rewardAmount.toString())}
          </p>
          <span className="text-xs text-[#7f8aa0]">mỗi slot</span>
        </div>

        <div className="bg-[#edf4ff] p-4">
          <span className="text-xs font-bold text-[#7f8aa0] uppercase">Slot khả dụng</span>
          <p className="mt-1 text-xl font-black text-[#203259]">
            {task.availableSlots} / {task.totalSlots}
          </p>
          <span className="text-xs text-[#7f8aa0]">còn lại</span>
        </div>

        <div className="bg-[#edf4ff] p-4">
          <span className="text-xs font-bold text-[#7f8aa0] uppercase">Tự động duyệt</span>
          <p className="mt-1 text-xl font-black text-[#203259]">{task.autoApproveDays}</p>
          <span className="text-xs text-[#7f8aa0]">ngày</span>
        </div>
      </div>

      {/* Description */}
      <div>
        <h2 className="text-lg font-bold text-[#203259] mb-2">Mô tả công việc</h2>
        <div className="bg-[#edf4ff] p-4">
          <p className="text-sm text-[#203259] whitespace-pre-wrap">{task.description}</p>
        </div>
      </div>

      {/* Instructions */}
      <div>
        <h2 className="text-lg font-bold text-[#203259] mb-2">Hướng dẫn thực hiện</h2>
        <div className="bg-[#edf4ff] p-4">
          <p className="text-sm text-[#203259] whitespace-pre-wrap">{task.instructions}</p>
        </div>
      </div>

      {/* Proof Requirements */}
      {task.proofRequirements && (
        <div>
          <h2 className="text-lg font-bold text-[#203259] mb-2">Yêu cầu bằng chứng</h2>
          <div className="bg-[#fff6f6] border border-[#fce3e5] p-4">
            <p className="text-sm text-[#e63e46] whitespace-pre-wrap">
              <strong>Lưu ý:</strong> {task.proofRequirements}
            </p>
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-[#7f8aa0] uppercase">Trạng thái:</span>
        <span
          className={`inline-block rounded px-3 py-1 text-xs font-bold uppercase ${
            task.status === "ACTIVE"
              ? "bg-[#22ab59] text-white"
              : task.status === "DRAFT"
                ? "bg-[#7f8aa0] text-white"
                : task.status === "PAUSED"
                  ? "bg-[#fbbf24] text-white"
                  : task.status === "COMPLETED"
                    ? "bg-[#203259] text-white"
                    : "bg-[#e63e46] text-white"
          }`}
        >
          {task.status === "ACTIVE"
            ? "Đang hoạt động"
            : task.status === "DRAFT"
              ? "Nháp"
              : task.status === "PAUSED"
                ? "Tạm dừng"
                : task.status === "COMPLETED"
                  ? "Hoàn thành"
                  : "Đã hủy"}
        </span>
      </div>
    </div>
  );
}
