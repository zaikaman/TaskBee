"use client";

import { useMemo } from "react";
import { calculateEmployerTaskCharge, formatVnd } from "@/lib/utils/money";
import type { CreateTaskState } from "@/lib/services/task";
import type { TaskFormData } from "./create-task-form";

type CreateTaskStep3Props = {
  data: TaskFormData;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  state: CreateTaskState;
  onBack: () => void;
  taskId?: string;
  isEdit?: boolean;
};

export function CreateTaskStep3({
  data,
  formAction,
  isPending,
  state,
  onBack,
  taskId,
  isEdit = false,
}: CreateTaskStep3Props) {
  // Calculate costs
  const costs = useMemo(() => {
    try {
      const reward = Number(data.rewardAmount.replace(/,/g, ""));
      const slots = Number(data.totalSlots);

      if (Number.isNaN(reward) || Number.isNaN(slots) || reward <= 0 || slots <= 0) {
        return null;
      }

      return calculateEmployerTaskCharge(reward, slots);
    } catch {
      return null;
    }
  }, [data.rewardAmount, data.totalSlots]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#203259]">
          {isEdit ? "Xác nhận thao tác" : "Xác nhận và chọn hành động"}
        </h2>
        <p className="mt-2 text-sm text-[#7f8aa0]">
          {isEdit
            ? "Chọn lưu bản nháp hoặc đăng việc để kích hoạt công việc"
            : "Kiểm tra lại thông tin trước khi lưu bản nháp hoặc đăng việc"}
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-[#edf4ff] p-6 space-y-4">
        <h3 className="text-lg font-semibold text-[#203259]">Tóm tắt công việc</h3>

        <div className="space-y-3">
          <div>
            <span className="text-xs font-bold text-[#7f8aa0] uppercase">Tiêu đề</span>
            <p className="mt-1 text-sm text-[#203259] font-medium">{data.title}</p>
          </div>

          <div>
            <span className="text-xs font-bold text-[#7f8aa0] uppercase">Danh mục</span>
            <p className="mt-1 text-sm text-[#203259]">{data.category || "Chưa chọn"}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs font-bold text-[#7f8aa0] uppercase">Phần thưởng/suất</span>
              <p className="mt-1 text-sm text-[#203259] font-medium">
                {Number(data.rewardAmount.replace(/,/g, "")).toLocaleString("vi-VN")} VNĐ
              </p>
            </div>
            <div>
              <span className="text-xs font-bold text-[#7f8aa0] uppercase">Số lượng suất</span>
              <p className="mt-1 text-sm text-[#203259] font-medium">{data.totalSlots}</p>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-[#7f8aa0] uppercase">Tự động duyệt</span>
            <p className="mt-1 text-sm text-[#203259]">Sau {data.autoApproveDays} ngày</p>
          </div>

          <div>
            <span className="text-xs font-bold text-[#7f8aa0] uppercase">Giữ slot</span>
            <p className="mt-1 text-sm text-[#203259]">{data.holdTimeMinutes} phút</p>
          </div>
        </div>
      </div>

      {/* Cost Breakdown - Only show for new tasks */}
      {!isEdit && costs && (
        <div className="bg-white border-2 border-[#22ab59] p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#203259]">Chi phí khi đăng việc</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#7f8aa0]">Tổng thưởng cho người làm</span>
              <span className="text-sm font-medium text-[#203259]">
                {formatVnd(costs.escrowAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[#7f8aa0]">Phí nền tảng (10%)</span>
              <span className="text-sm font-medium text-[#203259]">
                {formatVnd(costs.platformFee)}
              </span>
            </div>

            <div className="h-px bg-[#d1d5db]" />

            <div className="flex items-center justify-between">
              <span className="text-base font-bold text-[#203259]">Tổng cộng</span>
              <span className="text-xl font-black text-[#22ab59]">
                {formatVnd(costs.totalCharge)}
              </span>
            </div>
          </div>

          <div className="bg-[#fff6f6] border border-[#fce3e5] p-4 mt-4">
            <p className="text-xs text-[#e63e46]">
              <strong>Lưu ý:</strong> Số tiền này sẽ được khóa trong ví ký quỹ của bạn. Tiền sẽ
              được giải phóng khi bạn duyệt bài nộp hoặc tự động duyệt sau {" "}
              {data.autoApproveDays} ngày.
            </p>
          </div>
        </div>
      )}

      <div className="border border-[#d7f4e2] bg-[#f0fdf4] p-4">
        <p className="text-sm text-[#005924]">
          {isEdit
            ? "Bạn đang chỉnh sửa một bản nháp. Lưu bản nháp sẽ giữ việc ở trạng thái nháp, còn Đăng việc sẽ kích hoạt việc và khóa ví ký quỹ."
            : "Bạn có thể lưu bản nháp miễn phí để hoàn thiện sau, hoặc bấm Đăng việc để khóa ví ký quỹ và kích hoạt việc."}
        </p>
      </div>

      {/* Error/Success Messages */}
      {state.error && (
        <div className="border border-[#fce3e5] bg-[#fff6f6] px-4 py-3 text-sm text-[#e63e46]">
          {state.error}
        </div>
      )}

      {state.message && (
        <div className="border border-[#d7f4e2] bg-[#f3fff8] px-4 py-3 text-sm text-[#005924]">
          {state.message}
        </div>
      )}

      {/* Form with hidden fields */}
      <form action={formAction} className="space-y-4">
        {/* Hidden fields for all form data */}
        {isEdit && taskId && <input name="taskId" type="hidden" value={taskId} />}
        <input name="taskType" type="hidden" value={data.taskType} />
        <input name="title" type="hidden" value={data.title} />
        <input name="description" type="hidden" value={data.description} />
        <input name="instructions" type="hidden" value={data.instructions} />
        <input name="category" type="hidden" value={data.category} />
        <input name="rewardAmount" type="hidden" value={data.rewardAmount} />
        <input name="totalSlots" type="hidden" value={data.totalSlots} />
        <input name="autoApproveDays" type="hidden" value={data.autoApproveDays} />
        <input name="holdTimeMinutes" type="hidden" value={data.holdTimeMinutes} />
        {data.proofRequirements && (
          <input name="proofRequirements" type="hidden" value={data.proofRequirements} />
        )}

        {/* Actions */}
        <div className="flex justify-between gap-4 pt-4">
          <button
            className="h-[46px] px-8 border-2 border-[#22ab59] bg-white text-sm font-black uppercase text-[#22ab59] hover:bg-[#f0f9f4] disabled:opacity-60"
            disabled={isPending}
            onClick={onBack}
            type="button"
          >
            Quay lại
          </button>
          <div className="flex gap-3">
            <button
              className="h-[46px] px-8 border-2 border-[#22ab59] bg-white text-sm font-black uppercase text-[#22ab59] hover:bg-[#f0f9f4] disabled:opacity-60"
              disabled={isPending}
              name="taskAction"
              type="submit"
              value="draft"
            >
              {isPending ? "Đang lưu..." : "Lưu bản nháp"}
            </button>
            <button
              className="h-[46px] px-8 bg-[#22ab59] text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60"
              disabled={isPending || !costs}
              name="taskAction"
              type="submit"
              value="publish"
            >
              {isPending ? "Đang đăng..." : "Đăng việc"}
            </button>
          </div>
        </div>
      </form>

      {/* Terms */}
      <p className="text-xs text-center text-[#7f8aa0]">
        Bằng việc đăng công việc, bạn đồng ý với{" "}
        <a className="text-[#22ab59] underline" href="/terms">
          Điều khoản dịch vụ
        </a>{" "}
        của TaskBee
      </p>
    </div>
  );
}
