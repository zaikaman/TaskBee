"use client";

import { useMemo } from "react";
import { calculateEmployerTaskCharge, formatVnd } from "@/lib/utils/money";
import type { TaskFormData } from "./create-task-form";

type ClassicJobSummaryProps = {
  data: TaskFormData;
  onClear?: () => void;
};

const levelLabels: Record<string, string> = {
  starter: "Cơ bản",
  advanced: "Nâng cao",
  expert: "Chuyên gia",
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

function SummaryPattern() {
  return (
    <div className="relative h-[102px] overflow-hidden bg-[#eef4ff]">
      <div className="absolute left-0 top-0 h-[102px] w-[68px] bg-[#cfddff]" />
      <div className="absolute left-[68px] top-0 h-[102px] w-[42px] bg-[#e7efff]" />
      <div className="absolute left-[110px] top-[38px] h-[64px] w-[58px] rounded-t-full bg-[#dce7ff]" />
      <div className="absolute left-[168px] top-0 h-[102px] w-[44px] bg-[#c9d9ff]" />
      <div className="absolute right-[38px] top-0 h-[102px] w-[58px] rounded-bl-[48px] bg-[#d2e0ff]" />
      <div className="absolute right-0 top-0 h-full w-[42px] bg-[repeating-linear-gradient(0deg,#d7e4ff_0,#d7e4ff_2px,#eef4ff_2px,#eef4ff_5px)]" />
    </div>
  );
}

export function ClassicJobSummary({ data, onClear }: ClassicJobSummaryProps) {
  const estimatedCost = useMemo(() => {
    const reward = Number(data.rewardAmount.replaceAll(",", ""));
    const slots = Number(data.totalSlots || 25);

    if (Number.isNaN(reward) || Number.isNaN(slots) || reward <= 0 || slots <= 0) {
      return "";
    }

    return formatVnd(calculateEmployerTaskCharge(reward, slots).totalCharge);
  }, [data.rewardAmount, data.totalSlots]);

  const workerReward = useMemo(() => {
    if (!data.rewardAmount.trim()) {
      return "";
    }

    try {
      return formatVnd(data.rewardAmount);
    } catch {
      return "";
    }
  }, [data.rewardAmount]);

  return (
    <aside className="h-fit bg-white shadow-[0_14px_30px_rgba(32,50,89,0.14)]">
      <SummaryPattern />

      <div className="max-h-[414px] overflow-y-auto px-8 py-6">
        <div className="space-y-4">
          <h3 className="text-xl font-black uppercase text-[#203259]">Tóm tắt</h3>
          <SummaryLine label="Chi phí dự kiến" value={estimatedCost} />
          <SummaryDivider />

          <SummaryLine label="Khu vực" value="Quốc tế" />
          <SummaryLine label="Loại trừ" />
          <SummaryDivider />

          <SummaryLine label="Danh mục" value={data.category || "Chưa chọn"} />
          <SummaryLine label="Danh mục con" value={data.subcategory || "Chưa chọn"} />
          <SummaryDivider />

          <SummaryLine label="Cấp độ" value={levelLabels[data.classicLevel] ?? "Cơ bản"} />
          <SummaryLine label="Tốc độ" value="1000" />
          <SummaryLine label="Số người làm cần tuyển" value={data.totalSlots || 25} />
          <SummaryLine label="Thông báo người theo dõi" />
          <SummaryLine label="Người làm sẽ nhận" value={workerReward} />
          <SummaryLine label="Ảnh chụp màn hình bắt buộc" value="0" />
          <SummaryLine label="Thời gian giữ việc" value={data.holdTimeMinutes || 15} />
          <SummaryLine label="Tạm dừng sau khi duyệt" value="Không" />
          <SummaryDivider />

          <SummaryLine label="Thời gian để đánh giá" value={data.autoApproveDays || 7} />
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
        onClick={onClear}
        type="button"
      >
        Xóa tất cả
      </button>
    </aside>
  );
}
