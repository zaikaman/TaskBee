"use client";

import { useState } from "react";
import { TASK_LIMITS } from "@/config/app";
import type { TaskFormData } from "./create-task-form";

type CreateClassicDetailsStepProps = {
  data: TaskFormData;
  onBack: () => void;
  onNext: (data: Partial<TaskFormData>) => void;
};

export function CreateClassicDetailsStep({
  data,
  onBack,
  onNext,
}: CreateClassicDetailsStepProps) {
  const [formData, setFormData] = useState({
    title: data.title,
    description: data.description,
    instructions: data.instructions,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: "" }));
    }
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (formData.title.trim().length < 5) {
      nextErrors.title = "Tiêu đề phải có ít nhất 5 ký tự";
    } else if (formData.title.length > TASK_LIMITS.titleMaxLength) {
      nextErrors.title = `Tiêu đề không được vượt quá ${TASK_LIMITS.titleMaxLength} ký tự`;
    }

    if (formData.description.trim().length < 20) {
      nextErrors.description = "Mô tả phải có ít nhất 20 ký tự";
    } else if (formData.description.length > TASK_LIMITS.descriptionMaxLength) {
      nextErrors.description = `Mô tả không được vượt quá ${TASK_LIMITS.descriptionMaxLength} ký tự`;
    }

    if (formData.instructions.trim().length < 20) {
      nextErrors.instructions = "Hướng dẫn phải có ít nhất 20 ký tự";
    } else if (formData.instructions.length > TASK_LIMITS.instructionsMaxLength) {
      nextErrors.instructions = `Hướng dẫn không được vượt quá ${TASK_LIMITS.instructionsMaxLength} ký tự`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  return (
    <form
      className="space-y-7"
      onSubmit={(event) => {
        event.preventDefault();
        if (validate()) {
          onNext(formData);
        }
      }}
    >
      <div>
        <h2 className="text-xl font-semibold text-[#203259] sm:text-2xl">
          Nội dung công việc
        </h2>
        <p className="mt-2 text-sm text-[#7f8aa0]">
          Viết tiêu đề, mô tả và hướng dẫn rõ ràng cho người làm.
        </p>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Tiêu đề công việc <span className="text-[#e63e46]">*</span>
        </span>
        <input
          className="h-[48px] w-full border-0 bg-[#edf4ff] px-4 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 focus:ring-[#22ab59]"
          maxLength={TASK_LIMITS.titleMaxLength}
          onChange={(event) => updateField("title", event.target.value)}
          placeholder="VD: Theo dõi trang và gửi bằng chứng hoàn thành"
          type="text"
          value={formData.title}
        />
        {errors.title && <span className="mt-1 block text-xs text-[#e63e46]">{errors.title}</span>}
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Mô tả công việc <span className="text-[#e63e46]">*</span>
        </span>
        <textarea
          className="min-h-[120px] w-full border-0 bg-[#edf4ff] px-4 py-3 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 focus:ring-[#22ab59]"
          maxLength={TASK_LIMITS.descriptionMaxLength}
          onChange={(event) => updateField("description", event.target.value)}
          placeholder="Mô tả chi tiết về mục tiêu và yêu cầu của công việc..."
          rows={5}
          value={formData.description}
        />
        {errors.description && (
          <span className="mt-1 block text-xs text-[#e63e46]">{errors.description}</span>
        )}
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Hướng dẫn thực hiện <span className="text-[#e63e46]">*</span>
        </span>
        <textarea
          className="min-h-[160px] w-full border-0 bg-[#edf4ff] px-4 py-3 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 focus:ring-[#22ab59]"
          maxLength={TASK_LIMITS.instructionsMaxLength}
          onChange={(event) => updateField("instructions", event.target.value)}
          placeholder="Bước 1: ...&#10;Bước 2: ...&#10;Bước 3: ..."
          rows={7}
          value={formData.instructions}
        />
        {errors.instructions && (
          <span className="mt-1 block text-xs text-[#e63e46]">{errors.instructions}</span>
        )}
      </label>

      <div className="flex flex-col-reverse justify-between gap-3 pt-4 sm:flex-row">
        <button
          className="h-[46px] border-2 border-[#22ab59] bg-white px-8 text-sm font-black uppercase text-[#22ab59] hover:bg-[#f0f9f4]"
          onClick={onBack}
          type="button"
        >
          Quay lại
        </button>
        <button
          className="h-[46px] bg-[#22ab59] px-8 text-sm font-black uppercase text-white hover:bg-[#005924]"
          type="submit"
        >
          Tiếp theo
        </button>
      </div>
    </form>
  );
}
