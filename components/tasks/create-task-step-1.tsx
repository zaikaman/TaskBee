"use client";

import { useState } from "react";
import { TASK_LIMITS } from "@/config/app";
import type { TaskFormData } from "./create-task-form";

type CreateTaskStep1Props = {
  data: TaskFormData;
  onNext: (data: Partial<TaskFormData>) => void;
};

const CATEGORIES = [
  "Mạng xã hội",
  "Khảo sát & Đánh giá",
  "Nhập liệu",
  "Tìm kiếm & Thu thập",
  "Xem & Tương tác",
  "Đăng ký & Tải ứng dụng",
  "Khác",
];

export function CreateTaskStep1({ data, onNext }: CreateTaskStep1Props) {
  const [formData, setFormData] = useState({
    title: data.title,
    description: data.description,
    instructions: data.instructions,
    category: data.category,
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

    if (!formData.title.trim()) {
      newErrors.title = "Tiêu đề không được để trống";
    } else if (formData.title.trim().length < 5) {
      newErrors.title = "Tiêu đề phải có ít nhất 5 ký tự";
    } else if (formData.title.length > TASK_LIMITS.titleMaxLength) {
      newErrors.title = `Tiêu đề không được vượt quá ${TASK_LIMITS.titleMaxLength} ký tự`;
    }

    if (!formData.description.trim()) {
      newErrors.description = "Mô tả không được để trống";
    } else if (formData.description.trim().length < 20) {
      newErrors.description = "Mô tả phải có ít nhất 20 ký tự";
    } else if (formData.description.length > TASK_LIMITS.descriptionMaxLength) {
      newErrors.description = `Mô tả không được vượt quá ${TASK_LIMITS.descriptionMaxLength} ký tự`;
    }

    if (!formData.instructions.trim()) {
      newErrors.instructions = "Hướng dẫn không được để trống";
    } else if (formData.instructions.trim().length < 20) {
      newErrors.instructions = "Hướng dẫn phải có ít nhất 20 ký tự";
    } else if (formData.instructions.length > TASK_LIMITS.instructionsMaxLength) {
      newErrors.instructions = `Hướng dẫn không được vượt quá ${TASK_LIMITS.instructionsMaxLength} ký tự`;
    }

    if (!formData.category) {
      newErrors.category = "Vui lòng chọn danh mục";
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
        <h2 className="text-2xl font-bold text-[#203259]">Thông tin cơ bản</h2>
        <p className="mt-2 text-sm text-[#7f8aa0]">
          Cung cấp thông tin chi tiết về công việc bạn muốn đăng
        </p>
      </div>

      {/* Title */}
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Tiêu đề công việc <span className="text-[#e63e46]">*</span>
        </span>
        <input
          className={`h-[48px] w-full rounded-none border-0 bg-[#edf4ff] px-4 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 ${
            errors.title ? "focus:ring-[#e63e46]" : "focus:ring-[#22ab59]"
          }`}
          maxLength={TASK_LIMITS.titleMaxLength}
          onChange={(e) => handleChange("title", e.target.value)}
          placeholder="VD: Theo dõi trang Facebook và like 5 bài viết"
          type="text"
          value={formData.title}
        />
        <div className="mt-1 flex items-center justify-between">
          {errors.title ? (
            <span className="text-xs text-[#e63e46]">{errors.title}</span>
          ) : (
            <span className="text-xs text-[#7f8aa0]">Tiêu đề ngắn gọn, dễ hiểu</span>
          )}
          <span className="text-xs text-[#7f8aa0]">
            {formData.title.length}/{TASK_LIMITS.titleMaxLength}
          </span>
        </div>
      </label>

      {/* Category */}
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Danh mục <span className="text-[#e63e46]">*</span>
        </span>
        <select
          className={`h-[48px] w-full rounded-none border-0 bg-[#edf4ff] px-4 text-sm text-[#203259] outline-none focus:bg-[#f2f4f7] focus:ring-1 ${
            errors.category ? "focus:ring-[#e63e46]" : "focus:ring-[#22ab59]"
          }`}
          onChange={(e) => handleChange("category", e.target.value)}
          value={formData.category}
        >
          <option value="">-- Chọn danh mục --</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {errors.category && (
          <span className="mt-1 block text-xs text-[#e63e46]">{errors.category}</span>
        )}
      </label>

      {/* Description */}
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Mô tả công việc <span className="text-[#e63e46]">*</span>
        </span>
        <textarea
          className={`min-h-[120px] w-full rounded-none border-0 bg-[#edf4ff] px-4 py-3 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 ${
            errors.description ? "focus:ring-[#e63e46]" : "focus:ring-[#22ab59]"
          }`}
          maxLength={TASK_LIMITS.descriptionMaxLength}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="Mô tả chi tiết về công việc này..."
          rows={5}
          value={formData.description}
        />
        <div className="mt-1 flex items-center justify-between">
          {errors.description ? (
            <span className="text-xs text-[#e63e46]">{errors.description}</span>
          ) : (
            <span className="text-xs text-[#7f8aa0]">Mô tả rõ ràng để người làm hiểu công việc</span>
          )}
          <span className="text-xs text-[#7f8aa0]">
            {formData.description.length}/{TASK_LIMITS.descriptionMaxLength}
          </span>
        </div>
      </label>

      {/* Instructions */}
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-[#203259]">
          Hướng dẫn thực hiện <span className="text-[#e63e46]">*</span>
        </span>
        <textarea
          className={`min-h-[160px] w-full rounded-none border-0 bg-[#edf4ff] px-4 py-3 text-sm text-[#203259] outline-none placeholder:text-[#7f8aa0] focus:bg-[#f2f4f7] focus:ring-1 ${
            errors.instructions ? "focus:ring-[#e63e46]" : "focus:ring-[#22ab59]"
          }`}
          maxLength={TASK_LIMITS.instructionsMaxLength}
          onChange={(e) => handleChange("instructions", e.target.value)}
          placeholder="Bước 1: ...&#10;Bước 2: ...&#10;Bước 3: ..."
          rows={7}
          value={formData.instructions}
        />
        <div className="mt-1 flex items-center justify-between">
          {errors.instructions ? (
            <span className="text-xs text-[#e63e46]">{errors.instructions}</span>
          ) : (
            <span className="text-xs text-[#7f8aa0]">
              Hướng dẫn từng bước để người làm hoàn thành công việc
            </span>
          )}
          <span className="text-xs text-[#7f8aa0]">
            {formData.instructions.length}/{TASK_LIMITS.instructionsMaxLength}
          </span>
        </div>
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <button
          className="h-[46px] px-8 bg-[#22ab59] text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60"
          type="submit"
        >
          Tiếp theo
        </button>
      </div>
    </form>
  );
}
