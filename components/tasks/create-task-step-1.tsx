"use client";

import { useState } from "react";
import { TASK_LIMITS } from "@/config/app";
import { TaskType } from "@/lib/generated/prisma/browser";
import {
  classicJobCategories,
} from "@/lib/tasks/classic-job-catalog";
import type { TaskFormData } from "./create-task-form";

type CreateTaskStep1Props = {
  data: TaskFormData;
  onNext: (data: Partial<TaskFormData>) => void;
  isEdit?: boolean;
};

export function CreateTaskStep1({ data, onNext, isEdit = false }: CreateTaskStep1Props) {
  const [formData, setFormData] = useState({
    taskType: data.taskType,
    title: data.title,
    description: data.description,
    instructions: data.instructions,
    category: data.taskType === TaskType.CLASSIC ? data.category : "",
    subcategory: data.taskType === TaskType.CLASSIC ? data.subcategory : "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const isClassicJob = formData.taskType === TaskType.CLASSIC;
  const visibleClassicJobCategories = isEdit
    ? classicJobCategories
    : classicJobCategories.filter((category) => category.id !== "xac-minh-nang-luc");
  const selectedClassicCategory = visibleClassicJobCategories.find(
    (category) => category.name === formData.category,
  );

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => {
      if (field === "taskType") {
        return {
          ...prev,
          taskType: value as TaskType,
          category: "",
          subcategory: "",
        };
      }

      if (field === "category") {
        return {
          ...prev,
          category: value,
          subcategory: "",
        };
      }

      return { ...prev, [field]: value };
    });

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

    if (isClassicJob) {
      if (!selectedClassicCategory) {
        newErrors.category = "Danh mục Classic không hợp lệ";
      } else if (selectedClassicCategory.subcategories.length === 0) {
        newErrors.subcategory = "Danh mục này chưa có danh mục con. Vui lòng chọn danh mục đã được cấu hình.";
      } else if (!formData.subcategory) {
        newErrors.subcategory = "Vui lòng chọn danh mục con";
      } else if (!selectedClassicCategory.subcategories.includes(formData.subcategory)) {
        newErrors.subcategory = "Danh mục con không thuộc danh mục đã chọn";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext(
        isClassicJob
          ? formData
          : {
              ...formData,
              category: "",
              subcategory: "",
            },
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#203259] sm:text-2xl">Thông tin cơ bản</h2>
        <p className="mt-2 text-sm text-[#7f8aa0]">
          Chọn loại việc phù hợp rồi nhập nội dung cần người làm thực hiện
        </p>
      </div>

      <div>
        <span className="mb-3 block text-sm font-bold text-[#203259]">
          Loại việc <span className="text-[#e63e46]">*</span>
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              value: TaskType.EXPRESS,
              label: "Việc Express",
              description: "Tạo việc nhanh, không cần chọn danh mục",
            },
            {
              value: TaskType.CLASSIC,
              label: "Việc Classic",
              description: "Chọn danh mục và danh mục con trước khi đăng việc",
            },
          ].map((option) => (
            <button
              className={`border px-4 py-3 text-left transition ${
                formData.taskType === option.value
                  ? "border-[#22ab59] bg-[#e7faef] text-[#005924] shadow-sm"
                  : "border-[#d3dae6] bg-white text-[#203259] hover:border-[#22ab59]"
              }`}
              key={option.value}
              onClick={() => handleChange("taskType", option.value)}
              type="button"
            >
              <span className="block text-sm font-black">{option.label}</span>
              <span className="mt-1 block text-xs text-[#686d77]">{option.description}</span>
            </button>
          ))}
        </div>
      </div>

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
          placeholder="VD: Theo dõi trang Facebook và thích 5 bài viết"
          type="text"
          value={formData.title}
        />
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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

      {isClassicJob ? (
        <div className="space-y-6">
          <div>
            <span className="mb-3 block text-sm font-bold text-[#203259]">
              Chọn danh mục công việc <span className="text-[#e63e46]">*</span>
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {visibleClassicJobCategories.map((category) => (
                <button
                  className={`min-h-[52px] border px-3 py-3 text-center text-sm font-black leading-5 transition ${
                    formData.category === category.name
                      ? "border-[#22ab59] bg-[#e7faef] text-[#01a149] shadow-sm"
                      : "border-[#d3dae6] bg-white text-[#000] hover:border-[#22ab59] hover:text-[#005924]"
                  }`}
                  key={category.id}
                  onClick={() => handleChange("category", category.name)}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </div>
            {errors.category && (
              <span className="mt-2 block text-xs text-[#e63e46]">{errors.category}</span>
            )}
          </div>

          {formData.category && (
            <div>
              <span className="mb-3 block text-sm font-bold text-[#203259]">
                Chọn danh mục con <span className="text-[#e63e46]">*</span>
              </span>
              {selectedClassicCategory && selectedClassicCategory.subcategories.length > 0 ? (
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedClassicCategory.subcategories.map((subcategory) => (
                    <button
                      className={`min-h-[42px] bg-[#f2f3f5] px-3 py-2 text-center text-sm font-black leading-5 transition ${
                        formData.subcategory === subcategory
                          ? "bg-[#e7faef] text-[#01a149] shadow-sm"
                          : "text-[#000] hover:bg-[#e7faef] hover:text-[#005924]"
                      }`}
                      key={subcategory}
                      onClick={() => handleChange("subcategory", subcategory)}
                      type="button"
                    >
                      {subcategory}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="border border-[#fff3cf] bg-[#fff3cf] px-4 py-3 text-sm text-[#8a5a00]">
                  Danh mục này đã có trong Việc Classic nhưng chưa được cấu hình danh mục con. Vui lòng chọn danh mục khác trong lúc chờ bổ sung.
                </div>
              )}
              {errors.subcategory && (
                <span className="mt-2 block text-xs text-[#e63e46]">{errors.subcategory}</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="border border-dashed border-[#d3dae6] bg-[#f8fafc] px-4 py-3 text-sm text-[#5b6576]">
          Việc Express không cần chọn danh mục hay danh mục con. Hệ thống sẽ đăng việc theo luồng
          nhanh để bạn đi tiếp sang phần cài đặt.
        </div>
      )}

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
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="flex justify-end gap-4 pt-4">
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
