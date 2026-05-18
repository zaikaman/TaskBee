"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ChevronDown, Coins, Info, Settings } from "lucide-react";
import { TASK_LIMITS, WALLET_LIMITS } from "@/config/app";
import { TaskType } from "@/lib/generated/prisma/browser";
import type { CreateTaskState } from "@/lib/services/task";
import { calculateEmployerTaskCharge, formatVnd } from "@/lib/utils/money";
import { ClassicJobSummary } from "./classic-job-summary";
import type { TaskFormData } from "./create-task-form";

type CreateClassicSettingsStepProps = {
  data: TaskFormData;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  state: CreateTaskState;
  onBack: () => void;
  onUpdate: (data: Partial<TaskFormData>) => void;
};

const levelLabels: Record<string, string> = {
  starter: "Cơ bản",
  advanced: "Nâng cao",
  expert: "Chuyên gia",
};

function buildClassicDescription(
  data: TaskFormData,
  speed: string,
  targetSex: string,
  maxPerWorker: string,
  dailyLimit: string,
  requiredScreenshots: string,
  pauseAfterApproval: boolean,
  startTime: string,
  endTime: string,
  scheduledStart: string,
  autorateMode: string,
) {
  const notes = data.description.trim();

  return [
    `Việc Classic thuộc danh mục ${data.category || "chưa chọn"} và danh mục con ${
      data.subcategory || "chưa chọn"
    }.`,
    `Cấp độ yêu cầu: ${levelLabels[data.classicLevel] ?? "Cơ bản"}.`,
    `Cài đặt: tốc độ ${speed}, giới tính mục tiêu ${targetSex}, tối đa ${maxPerWorker} việc mỗi người làm, giới hạn mỗi ngày ${dailyLimit || "0"}, ảnh chụp bắt buộc ${requiredScreenshots}.`,
    `Khung giờ UTC: ${startTime} - ${endTime}. ${
      scheduledStart ? `Bắt đầu theo lịch: ${scheduledStart}.` : "Không đặt lịch bắt đầu."
    }`,
    `Tạm dừng sau khi duyệt: ${pauseAfterApproval ? "Có" : "Không"}. Tự đánh giá: ${autorateMode}.`,
    notes ? `Ghi chú bổ sung: ${notes}` : "Người làm cần hoàn thành đúng tác vụ và gửi bằng chứng hợp lệ.",
  ].join(" ");
}

function FieldInfo() {
  return <Info className="inline size-4 text-[#203259]" />;
}

function SettingRow({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="grid gap-3 sm:grid-cols-[158px_112px] sm:items-start">
      <span className="pt-2 text-sm font-medium leading-5 text-[#000]">
        {label} <FieldInfo />
      </span>
      <div>
        {children}
        {error && <span className="mt-1 block text-xs text-[#e63e46]">{error}</span>}
      </div>
    </label>
  );
}

function TextInput({
  value,
  name,
  onChange,
  disabled,
  type = "text",
  placeholder,
}: {
  value: string;
  name?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      className="h-[42px] w-[106px] border border-[#d9d9d9] bg-white px-3 text-sm text-[#203259] outline-none focus:ring-1 focus:ring-[#22ab59] disabled:bg-[#f2f4f7] disabled:text-[#a8b0bf]"
      disabled={disabled}
      inputMode={type === "text" ? "numeric" : undefined}
      name={name}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      type={type}
      value={value}
    />
  );
}

export function CreateClassicSettingsStep({
  data,
  formAction,
  isPending,
  state,
  onBack,
  onUpdate,
}: CreateClassicSettingsStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [speed, setSpeed] = useState("1000");
  const [targetSex, setTargetSex] = useState("Tất cả");
  const [maxPerWorker, setMaxPerWorker] = useState("1");
  const [dailyLimit, setDailyLimit] = useState("0");
  const [requiredScreenshots, setRequiredScreenshots] = useState("0");
  const [pauseAfterApproval, setPauseAfterApproval] = useState(false);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("24:00");
  const [scheduledStart, setScheduledStart] = useState("");
  const [autorateMode, setAutorateMode] = useState("Xác minh và đánh giá thủ công");

  const costs = useMemo(() => {
    const reward = Number(data.rewardAmount.replaceAll(",", ""));
    const slots = Number(data.totalSlots);

    if (Number.isNaN(reward) || Number.isNaN(slots) || reward <= 0 || slots <= 0) {
      return null;
    }

    return calculateEmployerTaskCharge(reward, slots);
  }, [data.rewardAmount, data.totalSlots]);

  const description = useMemo(
    () =>
      buildClassicDescription(
        data,
        speed,
        targetSex,
        maxPerWorker,
        dailyLimit,
        requiredScreenshots,
        pauseAfterApproval,
        startTime,
        endTime,
        scheduledStart,
        autorateMode,
      ),
    [
      autorateMode,
      dailyLimit,
      data,
      endTime,
      maxPerWorker,
      pauseAfterApproval,
      requiredScreenshots,
      scheduledStart,
      speed,
      startTime,
      targetSex,
    ],
  );

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const reward = Number(data.rewardAmount.replaceAll(",", ""));
    const slots = Number(data.totalSlots);
    const autoApproveDays = Number(data.autoApproveDays);
    const holdTimeMinutes = Number(data.holdTimeMinutes);

    if (!data.rewardAmount.trim()) {
      nextErrors.rewardAmount = "Không được để trống";
    } else if (Number.isNaN(reward) || reward <= 0) {
      nextErrors.rewardAmount = "Phải là số dương";
    } else if (reward < WALLET_LIMITS.minimumTaskRewardVnd) {
      nextErrors.rewardAmount = `Tối thiểu ${WALLET_LIMITS.minimumTaskRewardVnd.toLocaleString("vi-VN")} VNĐ`;
    } else if (reward > WALLET_LIMITS.maximumTaskRewardVnd) {
      nextErrors.rewardAmount = `Tối đa ${WALLET_LIMITS.maximumTaskRewardVnd.toLocaleString("vi-VN")} VNĐ`;
    } else if (reward % 1000 !== 0) {
      nextErrors.rewardAmount = "Phải là bội số của 1.000 VNĐ";
    }

    if (!data.totalSlots.trim()) {
      nextErrors.totalSlots = "Không được để trống";
    } else if (Number.isNaN(slots) || !Number.isInteger(slots) || slots <= 0) {
      nextErrors.totalSlots = "Phải là số nguyên dương";
    } else if (slots < WALLET_LIMITS.minimumTaskSlots) {
      nextErrors.totalSlots = `Tối thiểu ${WALLET_LIMITS.minimumTaskSlots}`;
    } else if (slots > WALLET_LIMITS.maximumTaskSlots) {
      nextErrors.totalSlots = `Tối đa ${WALLET_LIMITS.maximumTaskSlots}`;
    }

    if (
      Number.isNaN(autoApproveDays) ||
      autoApproveDays < TASK_LIMITS.autoApproveTimeoutDaysMin ||
      autoApproveDays > TASK_LIMITS.autoApproveTimeoutDaysMax
    ) {
      nextErrors.autoApproveDays = `Từ ${TASK_LIMITS.autoApproveTimeoutDaysMin} đến ${TASK_LIMITS.autoApproveTimeoutDaysMax} ngày`;
    }

    if (
      Number.isNaN(holdTimeMinutes) ||
      holdTimeMinutes < TASK_LIMITS.holdTimeMinutesMin ||
      holdTimeMinutes > TASK_LIMITS.holdTimeMinutesMax
    ) {
      nextErrors.holdTimeMinutes = `Từ ${TASK_LIMITS.holdTimeMinutesMin} đến ${TASK_LIMITS.holdTimeMinutesMax} phút`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  return (
    <form
      action={(payload) => {
        if (validate()) {
          formAction(payload);
        }
      }}
      className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_322px]"
    >
      <input name="taskType" type="hidden" value={TaskType.CLASSIC} />
      <input name="title" type="hidden" value={data.title} />
      <input name="description" type="hidden" value={description} />
      <input name="instructions" type="hidden" value={data.instructions} />
      <input name="proofRequirements" type="hidden" value={data.proofRequirements} />
      <input name="category" type="hidden" value={data.category} />
      <input name="subcategory" type="hidden" value={data.subcategory} />
      <input name="targetListId" type="hidden" value={data.targetListId} />

      <div className="space-y-10">
        <section>
          <h2 className="mb-8 text-base font-bold text-[#203259]">Cài đặt việc</h2>

          <div className="grid gap-7 lg:grid-cols-[290px_1px_348px] lg:items-start">
            <div className="space-y-7">
              <SettingRow label="Tốc độ">
                <TextInput onChange={setSpeed} value={speed} />
              </SettingRow>

              <SettingRow error={errors.totalSlots} label="Số người làm">
                <TextInput
                  name="totalSlots"
                  onChange={(value) => onUpdate({ totalSlots: value })}
                  value={data.totalSlots}
                />
              </SettingRow>

              <SettingRow label="Giới tính mục tiêu">
                <div className="relative">
                  <select
                    className="h-[42px] w-[106px] appearance-none border-0 bg-[#f2f4f7] px-3 pr-8 text-sm text-[#53627a] outline-none focus:ring-1 focus:ring-[#22ab59]"
                    onChange={(event) => setTargetSex(event.target.value)}
                    value={targetSex}
                  >
                    <option>Tất cả</option>
                    <option>Nam</option>
                    <option>Nữ</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[#53627a]" />
                </div>
              </SettingRow>

              <SettingRow label="Tối đa mỗi người làm">
                <TextInput onChange={setMaxPerWorker} value={maxPerWorker} />
              </SettingRow>

              <SettingRow label="Giới hạn việc mỗi ngày">
                <TextInput onChange={setDailyLimit} value={dailyLimit} />
              </SettingRow>

              <SettingRow error={errors.rewardAmount} label="Người làm sẽ nhận">
                <TextInput
                  name="rewardAmount"
                  onChange={(value) => onUpdate({ rewardAmount: value })}
                  value={data.rewardAmount}
                />
              </SettingRow>

              <SettingRow label="Ảnh chụp bắt buộc">
                <TextInput
                  disabled
                  onChange={setRequiredScreenshots}
                  value={requiredScreenshots}
                />
              </SettingRow>

              <SettingRow error={errors.holdTimeMinutes} label="Thời gian giữ việc">
                <TextInput
                  name="holdTimeMinutes"
                  onChange={(value) => onUpdate({ holdTimeMinutes: value })}
                  value={data.holdTimeMinutes}
                />
              </SettingRow>

              <label className="grid gap-3 sm:grid-cols-[158px_112px] sm:items-start">
                <span className="text-sm font-medium leading-5 text-[#000]">
                  Tạm dừng chiến dịch sau duyệt <FieldInfo />
                </span>
                <span className="flex items-center gap-2 pt-1 text-sm text-[#203259]">
                  <input
                    checked={pauseAfterApproval}
                    className="size-4 accent-[#22ab59]"
                    onChange={(event) => setPauseAfterApproval(event.target.checked)}
                    type="checkbox"
                  />
                  Có
                </span>
              </label>
            </div>

            <div className="hidden h-[236px] bg-[#d3dae6] lg:block" />

            <div className="mt-[174px] bg-white px-7 py-8 shadow-[0_12px_30px_rgba(32,50,89,0.12)]">
              <h3 className="mb-5 flex items-center gap-3 text-2xl font-black text-[#203259]">
                <Coins className="size-5 text-[#a8b0bf]" />
                Chi phí dự kiến
              </h3>
              <div className="bg-[#fce3e5] px-4 py-3 text-base text-[#203259]">
                {costs ? formatVnd(costs.totalCharge) : "Chưa đủ dữ liệu"}
              </div>
              <p className="mt-3 text-center text-sm text-[#e63e46]">
                Không đủ số dư để chạy việc này.
              </p>
              <button
                className="mt-1 h-[32px] w-full bg-[#f2f4f7] text-sm font-black uppercase text-[#01a149]"
                type="button"
              >
                Nạp tiền
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-7">
          <h2 className="flex items-center gap-3 text-base font-bold text-[#203259]">
            Cài đặt nâng cao
            <span className="flex size-8 items-center justify-center rounded bg-[#e7faef] text-[#01a149]">
              <Settings className="size-5" />
            </span>
          </h2>

          <div className="space-y-7">
            <SettingRow error={errors.autoApproveDays} label="Thời gian đánh giá">
              <div className="flex items-center gap-2">
                <TextInput
                  name="autoApproveDays"
                  onChange={(value) => onUpdate({ autoApproveDays: value })}
                  value={data.autoApproveDays}
                />
                <AlertCircle className="size-4 text-[#e63e46]" />
              </div>
            </SettingRow>

            <SettingRow label="Giờ bắt đầu (UTC)">
              <TextInput onChange={setStartTime} value={startTime} />
            </SettingRow>

            <SettingRow label="Giờ kết thúc (UTC)">
              <TextInput onChange={setEndTime} value={endTime} />
            </SettingRow>

            <label className="grid gap-3 sm:grid-cols-[158px_220px] sm:items-start">
              <span className="pt-2 text-sm font-medium leading-5 text-[#000]">
                Bắt đầu theo lịch (UTC) <FieldInfo />
              </span>
              <input
                className="h-[44px] w-[216px] border border-[#d9d9d9] bg-white px-3 text-sm text-[#203259] outline-none focus:ring-1 focus:ring-[#22ab59]"
                onChange={(event) => setScheduledStart(event.target.value)}
                type="datetime-local"
                value={scheduledStart}
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-[#203259]">Tự động đánh giá</h2>
          <button className="text-sm text-[#01a149]" type="button">
            Tìm hiểu về tự động đánh giá bằng PCODE
          </button>

          <div className="space-y-5 pt-2">
            {[
              "Xác minh và đánh giá thủ công",
              "Hệ thống xác minh, đánh giá thủ công",
              "Hệ thống xác minh và đánh giá việc 'Hài lòng'",
            ].map((option) => (
              <label
                className={`flex items-center gap-3 text-sm font-black ${
                  autorateMode === option ? "text-[#01a149]" : "text-[#000]"
                }`}
                key={option}
              >
                <input
                  checked={autorateMode === option}
                  className="size-4 accent-[#22ab59]"
                  onChange={() => setAutorateMode(option)}
                  type="checkbox"
                />
                {option}
              </label>
            ))}
          </div>
        </section>

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

        <div className="grid max-w-[684px] gap-10 sm:grid-cols-2">
          <button
            className="h-[46px] bg-[#22ab59] px-8 text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60"
            disabled={isPending}
            name="taskAction"
            type="submit"
            value="publish"
          >
            {isPending ? "Đang đăng..." : "Đăng việc"}
          </button>
          <button
            className="h-[46px] bg-[#17a2b8] px-8 text-sm font-black uppercase text-white hover:bg-[#117a8b] disabled:opacity-60"
            disabled={isPending}
            name="taskAction"
            type="submit"
            value="draft"
          >
            {isPending ? "Đang lưu..." : "Lưu bản nháp"}
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
    </form>
  );
}
