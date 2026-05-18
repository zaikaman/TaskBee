"use client";

import { TaskType } from "@/lib/generated/prisma/browser";
import { classicJobCategories } from "@/lib/tasks/classic-job-catalog";
import { ClassicJobSummary } from "./classic-job-summary";
import type { TaskFormData } from "./create-task-form";

type CreateClassicCategoryStepProps = {
  data: TaskFormData;
  onNext: (data: Partial<TaskFormData>) => void;
  onUpdate: (data: Partial<TaskFormData>) => void;
};

export function CreateClassicCategoryStep({
  data,
  onNext,
  onUpdate,
}: CreateClassicCategoryStepProps) {
  const selectedCategory =
    classicJobCategories.find((category) => category.name === data.category) ??
    classicJobCategories[0];
  const selectedSubcategory =
    data.subcategory || selectedCategory?.subcategories[0] || "";
  const visibleCategories = classicJobCategories.filter(
    (category) => category.id !== "xac-minh-nang-luc",
  );

  const updateCategory = (categoryName: string) => {
    const nextCategory = classicJobCategories.find((category) => category.name === categoryName);
    onUpdate({
      taskType: TaskType.CLASSIC,
      category: categoryName,
      subcategory: nextCategory?.subcategories[0] ?? "",
    });
  };

  const updateSubcategory = (subcategory: string) => {
    onUpdate({
      taskType: TaskType.CLASSIC,
      category: selectedCategory?.name ?? "",
      subcategory,
    });
  };

  const clearSelection = () => {
    const firstCategory = visibleCategories[0];
    onUpdate({
      taskType: TaskType.CLASSIC,
      category: firstCategory?.name ?? "",
      subcategory: firstCategory?.subcategories[0] ?? "",
    });
  };

  const canContinue = Boolean(selectedCategory?.name && selectedSubcategory);

  return (
    <div className="space-y-7">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_322px]">
        <div className="space-y-9">
          <section>
            <h2 className="mb-6 text-base font-semibold text-[#203259]">
              Chọn danh mục công việc
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {visibleCategories.map((category) => (
                <button
                  className={`min-h-[52px] border px-3 py-3 text-center text-sm font-black leading-5 transition ${
                    selectedCategory?.name === category.name
                      ? "border-[#d3dae6] bg-[#e7faef] text-[#01a149] shadow-[0_6px_14px_rgba(32,50,89,0.12)]"
                      : "border-[#d3dae6] bg-white text-[#000] hover:border-[#22ab59] hover:text-[#005924]"
                  }`}
                  key={category.id}
                  onClick={() => updateCategory(category.name)}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-6 text-base font-semibold text-[#203259]">
              Chọn danh mục con
            </h2>
            {selectedCategory && selectedCategory.subcategories.length > 0 ? (
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {selectedCategory.subcategories.map((subcategory) => (
                  <button
                    className={`min-h-[42px] bg-[#f2f3f5] px-3 py-2 text-center text-sm font-black leading-5 transition ${
                      selectedSubcategory === subcategory
                        ? "bg-[#e7faef] text-[#01a149] shadow-[0_5px_12px_rgba(32,50,89,0.12)]"
                        : "text-[#000] hover:bg-[#e7faef] hover:text-[#005924]"
                    }`}
                    key={subcategory}
                    onClick={() => updateSubcategory(subcategory)}
                    type="button"
                  >
                    {subcategory}
                  </button>
                ))}
              </div>
            ) : (
              <div className="border border-[#fff3cf] bg-[#fff3cf] px-4 py-3 text-sm text-[#8a5a00]">
                Danh mục này chưa có danh mục con. Vui lòng chọn danh mục khác.
              </div>
            )}
          </section>

          <div className="grid gap-5 sm:grid-cols-2">
            <button
              className="h-[46px] bg-[#22ab59] px-8 text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60"
              disabled={!canContinue}
              onClick={() =>
                onNext({
                  taskType: TaskType.CLASSIC,
                  category: selectedCategory?.name ?? "",
                  subcategory: selectedSubcategory,
                })
              }
              type="button"
            >
              Áp dụng và tiếp tục
            </button>
            <button
              className="h-[46px] bg-[#17a2b8] px-8 text-sm font-black uppercase text-white opacity-60"
              disabled
              type="button"
            >
              Lưu bản nháp ở bước sau
            </button>
          </div>
        </div>

        <ClassicJobSummary data={data} onClear={clearSelection} />
      </div>
    </div>
  );
}
