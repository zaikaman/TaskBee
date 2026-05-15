"use client";

import { useMemo } from "react";
import { calculateEmployerTaskCharge, formatVnd } from "@/lib/utils/money";
import { TaskType } from "@/lib/generated/prisma/client";
import type { CreateTaskState } from "@/lib/services/task";
import type { TaskFormData } from "./create-task-form";

type CreateTaskStep3Props = {
  data: TaskFormData;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  state: CreateTaskState;
  onBack: () => void;
};

export function CreateTaskStep3({
  data,
  formAction,
  isPending,
  state,
  onBack,
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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formAction(formData);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[#203259]">Xác nhận & Thanh toán</h2>
        <p className="mt-2 text-sm text-[#7f8aa0]">
          Kiểm tra lại thông tin và xác nhận đăng công việc
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-[#edf4ff] p-6 space-y-4">
        <h3 className="text-lg font-bold text-[#203259]">Tóm tắt công việc</h3>

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
              <span className="text-xs font-bold text-[#7f8aa0] uppercase">Phần thưởng/slot</span>
              <p className="mt-1 text-sm text-[#203259] font-medium">
                {Number(data.rewardAmount.replace(/,/g, "")).toLocaleString("vi-VN")} VNĐ
              </p>
            </div>
            <div>
              <span className="text-xs font-bold text-[#7f8aa0] uppercase">Số lượng slot</span>
              <p className="mt-1 text-sm text-[#203259] font-medium">{data.totalSlots}</p>
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-[#7f8aa0] uppercase">Tự động duyệt</span>
            <p className="mt-1 text-sm text-[#203259]">Sau {data.autoApproveDays} ngày</p>
          </div>
        </div>
      </div>

      {/* Cost Breakdown */}
      {costs && (
        <div className="bg-white border-2 border-[#22ab59] p-6 space-y-4">
          <h3 className="text-lg font-bold text-[#203259]">Chi phí</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#7f8aa0]">Tổng thưởng cho workers</span>
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
              <strong>Lưu ý:</strong> Số tiền này sẽ được khóa trong ví escrow của bạn. Tiền sẽ
              được giải phóng khi bạn duyệt submission hoặc tự động duyệt sau{" "}
              {data.autoApproveDays} ngày.
            </p>
          </div>
        </div>
      )}

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
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hidden fields for all form data */}
        <input name="taskType" type="hidden" value={TaskType.EXPRESS} />
        <input name="title" type="hidden" value={data.title} />
        <input name="description" type="hidden" value={data.description} />
        <input name="instructions" type="hidden" value={data.instructions} />
        <input name="category" type="hidden" value={data.category} />
        <input name="rewardAmount" type="hidden" value={data.rewardAmount} />
        <input name="totalSlots" type="hidden" value={data.totalSlots} />
        <input name="autoApproveDays" type="hidden" value={data.autoApproveDays} />
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
          <button
            className="h-[46px] px-8 bg-[#22ab59] text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60"
            disabled={isPending || !costs}
            type="submit"
          >
            {isPending ? "Đang đăng..." : "Đăng công việc"}
          </button>
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
