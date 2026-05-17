"use client";

import { useMemo } from "react";
import { TaskType } from "@/lib/generated/prisma/browser";
import { classicJobCategories } from "@/lib/tasks/classic-job-catalog";
import { calculateEmployerTaskCharge, formatVnd } from "@/lib/utils/money";
import type { TaskFormData } from "./create-task-form";

type CreateClassicCategoryStepProps = {
  data: TaskFormData;
  onNext: (data: Partial<TaskFormData>) => void;
  onUpdate: (data: Partial<TaskFormData>) => void;
  onTaskTypeChange: (taskType: TaskType) => void;
};

function SummaryDivider() {
  return <div className="h-px bg-[#bfc7d4]" />;
}

function SummaryLine({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="text-sm leading-6 text-[#000]">
      <span className="font-bold">{label}:</span>{" "}
      <span>{value ?? ""}</span>
    </div>
  );
}

export function CreateClassicCategoryStep({
  data,
  onNext,
  onUpdate,
  onTaskTypeChange,
}: CreateClassicCategoryStepProps) {
  const selectedCategory =
    classicJobCategories.find((category) => category.name === data.category) ??
    classicJobCategories[0];
  const selectedSubcategory =
    data.subcategory || selectedCategory?.subcategories[0] || "";
  const visibleCategories = classicJobCategories.filter(
    (category) => category.id !== "xac-minh-nang-luc",
  );

  const estimatedCost = useMemo(() => {
    const reward = Number(data.rewardAmount.replaceAll(",", ""));
    const slots = Number(data.totalSlots || 25);

    if (Number.isNaN(reward) || Number.isNaN(slots) || reward <= 0 || slots <= 0) {
      return "";
    }

    return formatVnd(calculateEmployerTaskCharge(reward, slots).totalCharge);
  }, [data.rewardAmount, data.totalSlots]);

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
      <div className="border-b border-[#d3dae6]">
        <div className="flex gap-8">
          <button
            className="px-0 pb-4 text-sm font-black uppercase text-[#203259] hover:text-[#22ab59]"
            onClick={() => onTaskTypeChange(TaskType.EXPRESS)}
            type="button"
          >
            Việc Express
          </button>
          <button
            className="border-b-2 border-[#22ab59] px-0 pb-4 text-sm font-black uppercase text-[#203259]"
            type="button"
          >
            Việc Classic
          </button>
          <button
            className="px-0 pb-4 text-sm font-black uppercase text-[#203259] opacity-60"
            type="button"
          >
            Việc danh sách
          </button>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_322px]">
        <div className="space-y-9">
          <section>
            <h2 className="mb-6 text-base font-bold text-[#203259]">
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
            <h2 className="mb-6 text-base font-bold text-[#203259]">
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

        <aside className="h-fit bg-white shadow-[0_14px_30px_rgba(32,50,89,0.14)]">
          <div className="relative h-[102px] overflow-hidden bg-[#eef4ff]">
            <div className="absolute left-0 top-0 h-[102px] w-[68px] bg-[#cfddff]" />
            <div className="absolute left-[68px] top-0 h-[102px] w-[42px] bg-[#e7efff]" />
            <div className="absolute left-[110px] top-[38px] h-[64px] w-[58px] rounded-t-full bg-[#dce7ff]" />
            <div className="absolute left-[168px] top-0 h-[102px] w-[44px] bg-[#c9d9ff]" />
            <div className="absolute right-[38px] top-0 h-[102px] w-[58px] rounded-bl-[48px] bg-[#d2e0ff]" />
            <div className="absolute right-0 top-0 h-full w-[42px] bg-[repeating-linear-gradient(0deg,#d7e4ff_0,#d7e4ff_2px,#eef4ff_2px,#eef4ff_5px)]" />
          </div>

          <div className="max-h-[414px] overflow-y-auto px-8 py-6">
            <div className="space-y-4">
              <h3 className="text-xl font-black uppercase text-[#203259]">Tóm tắt</h3>
              <SummaryLine label="Chi phí dự kiến" value={estimatedCost} />
              <SummaryDivider />

              <SummaryLine label="Khu vực" value="Quốc tế" />
              <SummaryLine label="Loại trừ" />
              <SummaryDivider />

              <SummaryLine label="Danh mục" value={selectedCategory?.name || "Chưa chọn"} />
              <SummaryLine label="Danh mục con" value={selectedSubcategory || "Chưa chọn"} />
              <SummaryDivider />

              <SummaryLine label="Cấp độ" value="Cơ bản" />
              <SummaryLine label="Tốc độ" value="1000" />
              <SummaryLine label="Số người làm cần tuyển" value={data.totalSlots || 25} />
              <SummaryLine label="Thông báo người theo dõi" />
              <SummaryLine label="Người làm sẽ nhận" value={data.rewardAmount ? formatVnd(data.rewardAmount) : ""} />
              <SummaryLine label="Ảnh chụp màn hình bắt buộc" value="0" />
              <SummaryLine label="Thời gian giữ việc" value={data.holdTimeMinutes || 15} />
              <SummaryLine label="Tạm dừng sau khi duyệt" value="Không" />
              <SummaryDivider />

              <SummaryLine label="Thời gian để đánh giá" value="7" />
              <SummaryLine label="Giờ bắt đầu" value="00:00" />
              <SummaryLine label="Giờ kết thúc" value="24:00" />
              <SummaryLine
                label="Tự động đánh giá"
                value="Hệ thống xác minh và đánh giá việc là 'Hài lòng'"
              />
              <SummaryDivider />

              <SummaryLine label="Tiêu đề việc" value={data.title} />
              <SummaryLine label="Tác vụ cần hoàn thành" value={data.instructions} />
              <SummaryLine label="Ghi chú bổ sung" value={data.description} />
              <SummaryLine label="Bằng chứng bắt buộc" value={data.proofRequirements} />
            </div>
          </div>

          <button
            className="h-[50px] w-full bg-[#f2f4f7] text-sm font-black uppercase text-[#01a149] hover:bg-[#e7faef]"
            onClick={clearSelection}
            type="button"
          >
            Xóa tất cả
          </button>
        </aside>
      </div>
    </div>
  );
}
