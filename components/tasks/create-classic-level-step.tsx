"use client";

import { ChevronUp } from "lucide-react";
import { ClassicJobSummary } from "./classic-job-summary";
import type { TaskFormData } from "./create-task-form";

type CreateClassicLevelStepProps = {
  data: TaskFormData;
  onBack: () => void;
  onNext: (data: Partial<TaskFormData>) => void;
  onUpdate: (data: Partial<TaskFormData>) => void;
};

const levels = [
  {
    id: "starter",
    title: "Cơ bản",
    color: "#01a149",
    mutedTitle: "text-[#7f7e7e]",
    copy:
      "Tiếp cận cộng đồng người làm rộng, sẵn sàng hỗ trợ. Phù hợp nhất với các tác vụ đơn giản, rõ ràng hoặc số lượng lớn, nơi tốc độ và tính linh hoạt quan trọng hơn.",
  },
  {
    id: "advanced",
    title: "Nâng cao",
    color: "#17a2b8",
    mutedTitle: "text-[#17a2b8]",
    copy:
      "Cân bằng tốt giữa chất lượng và chi phí. Việc của bạn sẽ tiếp cận nhóm người làm có kinh nghiệm hơn, phù hợp với nhu cầu cần kết quả chuyên nghiệp và ổn định.",
  },
  {
    id: "expert",
    title: "Chuyên gia",
    color: "#de9100",
    mutedTitle: "text-[#de9100]",
    copy:
      "Làm việc với nhóm người làm chất lượng cao nhất trên nền tảng. Phù hợp với việc phức tạp, yêu cầu độ chính xác cao, tác động lớn hoặc tiêu chuẩn hoàn thành khắt khe.",
  },
];

export function CreateClassicLevelStep({
  data,
  onBack,
  onNext,
  onUpdate,
}: CreateClassicLevelStepProps) {
  const selectedLevel = data.classicLevel || "starter";

  return (
    <div className="space-y-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_322px]">
        <div className="space-y-9">
          <section>
            <h2 className="mb-9 text-2xl font-black text-[#203259]">
              Cấp độ chuyên môn
            </h2>

            <div className="grid gap-10 text-sm leading-6 text-[#203259] md:grid-cols-2">
              <p>
                Khi đăng việc, bạn có thể chọn nhóm người làm rộng hoặc tập trung vào
                những người có chuyên môn cao hơn để tăng độ tin cậy. Mỗi lựa chọn giúp
                bạn cân bằng đúng giữa mục tiêu, ngân sách và độ phức tạp của việc.
              </p>
              <p>
                Người làm tích lũy huy hiệu bằng cách hoàn thành việc thành công và xây
                dựng kinh nghiệm trên nền tảng. Mức tối thiểu tăng dần theo từng cấp để
                phản ánh chuyên môn cao hơn.
              </p>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-3">
            {levels.map((level) => {
              const isSelected = selectedLevel === level.id;

              return (
                <button
                  className={`min-h-[318px] border px-6 py-5 text-center transition ${
                    isSelected
                      ? "border-[#d3dae6] bg-[#e7faef] shadow-[0_8px_18px_rgba(32,50,89,0.16)]"
                      : "border-[#d3dae6] bg-white shadow-[0_6px_14px_rgba(32,50,89,0.08)] hover:border-[#22ab59]"
                  }`}
                  key={level.id}
                  onClick={() => onUpdate({ classicLevel: level.id })}
                  type="button"
                >
                  <div className="mb-7 flex items-start justify-between gap-3">
                    <span
                      className={`flex-1 text-2xl font-black ${
                        isSelected ? "text-[#7f7e7e]" : level.mutedTitle
                      }`}
                    >
                      {level.title}
                    </span>
                    <span className="flex flex-col pt-1" style={{ color: level.color }}>
                      <ChevronUp className="size-5" />
                      {level.id !== "starter" && <ChevronUp className="-mt-2 size-5" />}
                      {level.id === "expert" && <ChevronUp className="-mt-2 size-5" />}
                    </span>
                  </div>
                  <p
                    className="text-sm font-black leading-[1.55]"
                    style={{ color: isSelected ? "#01a149" : "#000" }}
                  >
                    {level.copy}
                  </p>
                </button>
              );
            })}
          </section>

          <label className="flex min-h-[40px] items-center gap-2 bg-[#d5f2f6] px-5 text-sm font-black text-[#01a149]">
            <input className="size-4 accent-[#22ab59]" type="checkbox" />
            Lưu lựa chọn hiện tại làm mặc định cho các việc sau
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <button
              className="h-[46px] bg-[#22ab59] px-8 text-sm font-black uppercase text-white hover:bg-[#005924]"
              onClick={() => onNext({ classicLevel: selectedLevel })}
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

          <button
            className="text-sm font-medium text-[#203259] hover:text-[#22ab59]"
            onClick={onBack}
            type="button"
          >
            Quay lại
          </button>
        </div>

        <ClassicJobSummary data={data} />
      </div>
    </div>
  );
}
