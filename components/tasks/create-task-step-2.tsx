"use client";

import { useState } from "react";
import { TASK_LIMITS, WALLET_LIMITS } from "@/config/app";
import type { TaskFormData } from "./create-task-form";

type CreateTaskStep2Props = {
  data: TaskFormData;
  onNext: (data: Partial<TaskFormData>) => void;
  onBack: () => void;
};

export function CreateTaskStep2({ data, onNext, onBack }: CreateTaskStep2Props) {
  const [formData, setFormData] = useState({
    rewardAmount: data.rewardAmount,
    totalSlots: data.totalSlots,
    autoApproveDays: data.autoApproveDays,
    holdTimeMinutes: data.holdTimeMinutes,
    proofRequirements: data.proofRequirements,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // Reward amount validation
    const reward = Number(formData.rewardAmount.replace(/,/g, ""));
    if (!formData.rewardAmount.trim()) {
      newErrors.rewardAmount = "Phần thưởng không được để trống";
    } else if (Number.isNaN(reward) || reward <= 0) {
      newErrors.rewardAmount = "Phần thưởng phải là số dương";
    } else if (reward < WALLET_LIMITS.minimumTaskRewardVnd) {
      newErrors.rewardAmount = `Phần thưởng tối thiểu là ${WALLET_LIMITS.minimumTaskRewardVnd.toLocaleString("vi-VN")} VNĐ`;
    } else if (reward > WALLET_LIMITS.maximumTaskRewardVnd) {
      newErrors.rewardAmount = `Phần thưởng tối đa là ${WALLET_LIMITS.maximumTaskRewardVnd.toLocaleString("vi-VN")} VNĐ`;
    } else if (reward % 1000 !== 0) {
      newErrors.rewardAmount = "Phần thưởng phải là bội số của 1,000 VNĐ";
    }

    // Total slots validation
    const slots = Number(formData.totalSlots);
    if (!formData.totalSlots.trim()) {
      newErrors.totalSlots = "Số lượng slot không được để trống";
    } else if (Number.isNaN(slots) || !Number.isInteger(slots) || slots <= 0) {
      newErrors.totalSlots = "Số lượng slot phải là số nguyên dương";
    } else if (slots < WALLET_LIMITS.minimumTaskSlots) {
      newErrors.totalSlots = `Số lượng slot tối thiểu là ${WALLET_LIMITS.minimumTaskSlots}`;
    } else if (slots > WALLET_LIMITS.maximumTaskSlots) {
      newErrors.totalSlots = `Số lượng slot tối đa là ${WALLET_LIMITS.maximumTaskSlots}`;
    }

    // Auto approve days validation
    const days = Number(formData.autoApproveDays);
    if (!formData.autoApproveDays.trim()) {
      newErrors.autoApproveDays = "Thời gian tự động duyệt không được để trống";
    } else if (Number.isNaN(days) || !Number.isInteger(days) || days <= 0) {
      newErrors.autoApproveDays = "Thời gian tự động duyệt phải là số nguyên dương";
    } else if (days < TASK_LIMITS.autoApproveTimeoutDaysMin) {
      newErrors.autoApproveDays = `Thời gian tự động duyệt tối thiểu là ${TASK_LIMITS.autoApproveTimeoutDaysMin} ngày`;
    } else if (days > TASK_LIMITS.autoApproveTimeoutDaysMax) {
      newErrors.autoApproveDays = `Thời gian tự động duyệt tối đa là ${TASK_LIMITS.autoApproveTimeoutDaysMax} ngày`;
    }

    const holdTimeMinutes = Number(formData.holdTimeMinutes);
    if (!formData.holdTimeMinutes.trim()) {
      newErrors.holdTimeMinutes = "Thời gian giữ slot không được để trống";
    } else if (Number.isNaN(holdTimeMinutes) || !Number.isInteger(holdTimeMinutes)) {
      newErrors.holdTimeMinutes = "Thời gian giữ slot phải là số nguyên";
    } else if (holdTimeMinutes < TASK_LIMITS.holdTimeMinutesMin) {
      newErrors.holdTimeMinutes = `Thời gian giữ slot tối thiểu là ${TASK_LIMITS.holdTimeMinutesMin} phút`;
    } else if (holdTimeMinutes > TASK_LIMITS.holdTimeMinutesMax) {
      newErrors.holdTimeMinutes = `Thời gian giữ slot tối đa là ${TASK_LIMITS.holdTimeMinutesMax} phút`;
    }

    // Proof requirements validation
    if (formData.proofRequirements.trim() && formData.proofRequirements.trim().length < 10) {
      newErrors.proofRequirements = "Yêu cầu bằng chứng phải có ít nhất 10 ký tự";
    } else if (formData.proofRequirements.length > 2000) {
      newErrors.proofRequirements = "Yêu cầu bằng chứng không được vượt quá 2000 ký tự";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#203259] sm:text-2xl">Cài đặt công việc</h2>
        <p className="mt-2 text-sm text-[#7f8aa0]">
          Thiết lập phần thưởng, số lượng slot và yêu cầu bằng chứng
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Reward Amount */}
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[#203259]">
            Phần thưởng mỗi slot (VNĐ) <span className="text-[#e63e46]">*</span>
          </span>
          <input
            className={`h-[48px] w-full rounded-none border-0 bg-[#edf4ff] px-4 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 ${
              errors.rewardAmount ? "focus:ring-[#e63e46]" : "focus:ring-[#22ab59]"
            }`}
            inputMode="numeric"
            onChange={(e) => handleChange("rewardAmount", e.target.value)}
            placeholder="10000"
            type="text"
            value={formData.rewardAmount}
          />
          {errors.rewardAmount ? (
            <span className="mt-1 block text-xs text-[#e63e46]">{errors.rewardAmount}</span>
          ) : (
            <span className="mt-1 block text-xs text-[#7f8aa0]">
              Tối thiểu {WALLET_LIMITS.minimumTaskRewardVnd.toLocaleString("vi-VN")} VNĐ, bội số của 1,000
            </span>
          )}
        </label>

        {/* Total Slots */}
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-[#203259]">
            Số lượng slot <span className="text-[#e63e46]">*</span>
          </span>
          <input
            className={`h-[48px] w-full rounded-none border-0 bg-[#edf4ff] px-4 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 ${
              errors.totalSlots ? "focus:ring-[#e63e46]" : "focus:ring-[#22ab59]"
            }`}
            inputMode="numeric"
            onChange={(e) => handleChange("totalSlots", e.target.value)}
            placeholder="10"
            type="text"
            value={formData.totalSlots}
          />
          {errors.totalSlots ? (
            <span className="mt-1 block text-xs text-[#e63e46]">{errors.totalSlots}</span>
          ) : (
            <span className="mt-1 block text-xs text-[#7f8aa0]">
              Số lượng worker có thể nhận công việc này
            </span>
          )}
        </label>
      </div>

      {/* Auto Approve Days */}
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Tự động duyệt sau (ngày) <span className="text-[#e63e46]">*</span>
        </span>
        <div className="flex flex-wrap items-center gap-4">
          {[1, 3, 5, 7].map((day) => (
            <label key={day} className="flex items-center gap-2 cursor-pointer">
              <input
                checked={formData.autoApproveDays === String(day)}
                className="size-4 accent-[#22ab59]"
                name="autoApproveDays"
                onChange={(e) => handleChange("autoApproveDays", e.target.value)}
                type="radio"
                value={day}
              />
              <span className="text-sm text-[#203259]">{day} ngày</span>
            </label>
          ))}
        </div>
        {errors.autoApproveDays ? (
          <span className="mt-1 block text-xs text-[#e63e46]">{errors.autoApproveDays}</span>
        ) : (
          <span className="mt-1 block text-xs text-[#7f8aa0]">
            Submission sẽ tự động được duyệt nếu bạn không phản hồi trong thời gian này
          </span>
        )}
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Thời gian giữ slot (phút) <span className="text-[#e63e46]">*</span>
        </span>
        <div className="flex flex-wrap items-center gap-4">
          {[15, 30, 60, 90].map((minute) => (
            <label key={minute} className="flex cursor-pointer items-center gap-2">
              <input
                checked={formData.holdTimeMinutes === String(minute)}
                className="size-4 accent-[#22ab59]"
                name="holdTimeMinutes"
                onChange={(e) => handleChange("holdTimeMinutes", e.target.value)}
                type="radio"
                value={minute}
              />
              <span className="text-sm text-[#203259]">{minute} phút</span>
            </label>
          ))}
        </div>
        {errors.holdTimeMinutes ? (
          <span className="mt-1 block text-xs text-[#e63e46]">{errors.holdTimeMinutes}</span>
        ) : (
          <span className="mt-1 block text-xs text-[#7f8aa0]">
            Worker phải gửi bằng chứng trong thời gian này, nếu không slot sẽ tự trả lại cho người khác.
          </span>
        )}
      </label>

      {/* Proof Requirements */}
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Yêu cầu bằng chứng <span className="text-[#7f8aa0]">(Tùy chọn)</span>
        </span>
        <textarea
          className={`min-h-[120px] w-full rounded-none border-0 bg-[#edf4ff] px-4 py-3 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 ${
            errors.proofRequirements ? "focus:ring-[#e63e46]" : "focus:ring-[#22ab59]"
          }`}
          maxLength={2000}
          onChange={(e) => handleChange("proofRequirements", e.target.value)}
          placeholder="VD: Chụp màn hình trang cá nhân sau khi đã follow, đảm bảo hiển thị nút 'Following'"
          rows={5}
          value={formData.proofRequirements}
        />
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          {errors.proofRequirements ? (
            <span className="text-xs text-[#e63e46]">{errors.proofRequirements}</span>
          ) : (
            <span className="text-xs text-[#7f8aa0]">
              Mô tả cụ thể bằng chứng worker cần cung cấp (ảnh chụp màn hình, link, text...)
            </span>
          )}
          <span className="text-xs text-[#7f8aa0]">{formData.proofRequirements.length}/2000</span>
        </div>
      </label>

      {/* Actions */}
      <div className="flex flex-col-reverse justify-between gap-3 pt-4 sm:flex-row sm:gap-4">
        <button
          className="h-[46px] w-full border-2 border-[#22ab59] bg-white px-8 text-sm font-black uppercase text-[#22ab59] hover:bg-[#f0f9f4] sm:w-auto"
          onClick={onBack}
          type="button"
        >
          Quay lại
        </button>
        <button
          className="h-[46px] w-full bg-[#22ab59] px-8 text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60 sm:w-auto"
          type="submit"
        >
          Tiếp theo
        </button>
      </div>
    </form>
  );
}
