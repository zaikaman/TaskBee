"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { TASK_LIMITS, WALLET_LIMITS } from "@/config/app";
import { TaskType } from "@/lib/generated/prisma/browser";
import type { CreateTaskState } from "@/lib/services/task";
import { calculateEmployerTaskCharge, formatVnd } from "@/lib/utils/money";
import type { TaskFormData } from "./create-task-form";

type CreateExpressTaskFormProps = {
  data: TaskFormData;
  formAction: (payload: FormData) => void;
  isPending: boolean;
  state: CreateTaskState;
  onChangeTaskType: (taskType: TaskType) => void;
};

const completionOptions = [
  { label: "Dưới 1 phút", value: "15" },
  { label: "1 - 3 phút", value: "30" },
  { label: "3 - 5 phút", value: "60" },
  { label: "5 - 10 phút", value: "90" },
];

function buildDescription(title: string, steps: string[]) {
  const cleanTitle = title.trim();
  const cleanSteps = steps.map((step) => step.trim()).filter(Boolean);

  return [
    `Việc Express: ${cleanTitle || "Công việc ngắn cần thực hiện"}.`,
    "Người làm cần hoàn thành đúng các bước được mô tả và gửi bằng chứng hợp lệ.",
    cleanSteps.length > 0 ? `Tóm tắt bước thực hiện: ${cleanSteps.join("; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function buildInstructions(steps: string[]) {
  return steps
    .map((step, index) => `Bước ${index + 1}: ${step.trim()}`)
    .filter((step) => !step.endsWith(":"))
    .join("\n");
}

function buildProofRequirements(proofs: string[]) {
  return proofs
    .map((proof, index) => `Bằng chứng ${index + 1}: ${proof.trim()}`)
    .filter((proof) => !proof.endsWith(":"))
    .join("\n");
}

export function CreateExpressTaskForm({
  data,
  formAction,
  isPending,
  state,
  onChangeTaskType,
}: CreateExpressTaskFormProps) {
  const [title, setTitle] = useState(data.title);
  const [steps, setSteps] = useState<string[]>(
    data.instructions
      ? data.instructions.split("\n").map((step) => step.replace(/^Bước\s+\d+:\s*/i, ""))
      : [""],
  );
  const [proofs, setProofs] = useState<string[]>(
    data.proofRequirements
      ? data.proofRequirements.split("\n").map((proof) => proof.replace(/^Bằng chứng\s+\d+:\s*/i, ""))
      : [""],
  );
  const [holdTimeMinutes, setHoldTimeMinutes] = useState(data.holdTimeMinutes || "15");
  const [totalSlots, setTotalSlots] = useState(data.totalSlots || "25");
  const [rewardAmount, setRewardAmount] = useState(data.rewardAmount);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const instructions = useMemo(() => buildInstructions(steps), [steps]);
  const proofRequirements = useMemo(() => buildProofRequirements(proofs), [proofs]);
  const description = useMemo(() => buildDescription(title, steps), [title, steps]);

  const costs = useMemo(() => {
    const reward = Number(rewardAmount.replaceAll(",", ""));
    const slots = Number(totalSlots);

    if (Number.isNaN(reward) || Number.isNaN(slots) || reward <= 0 || slots <= 0) {
      return null;
    }

    return calculateEmployerTaskCharge(reward, slots);
  }, [rewardAmount, totalSlots]);

  const updateStep = (index: number, value: string) => {
    setSteps((current) => current.map((step, stepIndex) => (stepIndex === index ? value : step)));
  };

  const updateProof = (index: number, value: string) => {
    setProofs((current) => current.map((proof, proofIndex) => (proofIndex === index ? value : proof)));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const reward = Number(rewardAmount.replaceAll(",", ""));
    const slots = Number(totalSlots);

    if (title.trim().length < 5) {
      newErrors.title = "Tiêu đề phải có ít nhất 5 ký tự";
    } else if (title.length > TASK_LIMITS.titleMaxLength) {
      newErrors.title = `Tiêu đề không được vượt quá ${TASK_LIMITS.titleMaxLength} ký tự`;
    }

    if (instructions.length < 20) {
      newErrors.instructions = "Vui lòng nhập hướng dẫn có ít nhất 20 ký tự";
    }

    if (proofRequirements.length < 10) {
      newErrors.proofRequirements = "Vui lòng nhập yêu cầu bằng chứng có ít nhất 10 ký tự";
    }

    if (!rewardAmount.trim()) {
      newErrors.rewardAmount = "Phần thưởng không được để trống";
    } else if (Number.isNaN(reward) || reward <= 0) {
      newErrors.rewardAmount = "Phần thưởng phải là số dương";
    } else if (reward < WALLET_LIMITS.minimumTaskRewardVnd) {
      newErrors.rewardAmount = `Phần thưởng tối thiểu là ${WALLET_LIMITS.minimumTaskRewardVnd.toLocaleString("vi-VN")} VNĐ`;
    } else if (reward > WALLET_LIMITS.maximumTaskRewardVnd) {
      newErrors.rewardAmount = `Phần thưởng tối đa là ${WALLET_LIMITS.maximumTaskRewardVnd.toLocaleString("vi-VN")} VNĐ`;
    } else if (reward % 1000 !== 0) {
      newErrors.rewardAmount = "Phần thưởng phải là bội số của 1.000 VNĐ";
    }

    if (!totalSlots.trim()) {
      newErrors.totalSlots = "Số lượng người làm không được để trống";
    } else if (Number.isNaN(slots) || !Number.isInteger(slots) || slots <= 0) {
      newErrors.totalSlots = "Số lượng người làm phải là số nguyên dương";
    } else if (slots < WALLET_LIMITS.minimumTaskSlots) {
      newErrors.totalSlots = `Số lượng người làm tối thiểu là ${WALLET_LIMITS.minimumTaskSlots}`;
    } else if (slots > WALLET_LIMITS.maximumTaskSlots) {
      newErrors.totalSlots = `Số lượng người làm tối đa là ${WALLET_LIMITS.maximumTaskSlots}`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <div className="space-y-10">
      <div>
        <div className="mb-8 border-b border-[#d3dae6]">
          <div className="flex gap-8">
            <button
              className="border-b-2 border-[#22ab59] px-0 pb-4 text-sm font-black uppercase text-[#203259]"
              type="button"
            >
              Việc Express
            </button>
            <button
              className="px-0 pb-4 text-sm font-black uppercase text-[#203259] hover:text-[#22ab59]"
              onClick={() => onChangeTaskType(TaskType.CLASSIC)}
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

        <h2 className="text-2xl font-black text-[#01a149]">
          Việc Express phù hợp nhất với các tác vụ ngắn, đơn giản.
        </h2>
      </div>

      <form
        action={(payload) => {
          if (validate()) {
            formAction(payload);
          }
        }}
        className="space-y-10"
      >
        <input name="taskType" type="hidden" value={TaskType.EXPRESS} />
        <input name="description" type="hidden" value={description} />
        <input name="instructions" type="hidden" value={instructions} />
        <input name="proofRequirements" type="hidden" value={proofRequirements} />
        <input name="category" type="hidden" value="" />
        <input name="subcategory" type="hidden" value="" />
        <input name="autoApproveDays" type="hidden" value="3" />
        <input name="holdTimeMinutes" type="hidden" value={holdTimeMinutes} />

        <label className="block max-w-sm">
          <span className="mb-4 block text-base font-bold text-[#203259]">
            Chọn thời gian cần thiết để hoàn thành việc
          </span>
          <select
            className="h-[48px] w-full border-0 bg-[#f2f4f7] px-4 text-sm text-[#203259] outline-none focus:ring-1 focus:ring-[#22ab59]"
            onChange={(event) => setHoldTimeMinutes(event.target.value)}
            value={holdTimeMinutes}
          >
            {completionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-4 block text-base font-bold text-[#203259]">
            Viết tiêu đề công việc chính xác và cụ thể
          </span>
          <input
            className="h-[58px] w-full border-0 bg-[#f2f4f7] px-4 text-sm text-[#203259] outline-none placeholder:text-[#5b6576] focus:ring-1 focus:ring-[#22ab59]"
            maxLength={TASK_LIMITS.titleMaxLength}
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="VD: Xem và bình luận một video"
            type="text"
            value={title}
          />
          {errors.title && <span className="mt-1 block text-xs text-[#e63e46]">{errors.title}</span>}
        </label>

        <div>
          <span className="mb-4 block text-base font-bold text-[#203259]">
            Người làm cần thực hiện những bước nào để hoàn thành việc?
          </span>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {steps.map((step, index) => (
                <textarea
                  className="min-h-[60px] w-full border-0 bg-[#f2f4f7] px-4 py-3 text-sm text-[#203259] outline-none placeholder:text-[#5b6576] focus:ring-1 focus:ring-[#22ab59]"
                  key={index}
                  onChange={(event) => updateStep(index, event.target.value)}
                  placeholder={index === 0 ? "VD: Mở liên kết và xem hết video" : `Bước ${index + 1}`}
                  value={step}
                />
              ))}
            </div>
            <button
              className="flex h-[46px] items-center justify-center gap-3 border border-[#d3dae6] bg-white text-sm font-black text-[#01a149] hover:border-[#22ab59] hover:bg-[#e7faef]"
              onClick={() => setSteps((current) => [...current, ""])}
              type="button"
            >
              <Plus className="size-5" />
              Thêm bước
            </button>
          </div>
          {errors.instructions && (
            <span className="mt-1 block text-xs text-[#e63e46]">{errors.instructions}</span>
          )}
        </div>

        <div>
          <span className="mb-4 block text-base font-bold text-[#203259]">
            Bằng chứng cần nộp khi hoàn thành việc
          </span>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {proofs.map((proof, index) => (
                <textarea
                  className="min-h-[60px] w-full border-0 bg-[#f2f4f7] px-4 py-3 text-sm text-[#203259] outline-none placeholder:text-[#5b6576] focus:ring-1 focus:ring-[#22ab59]"
                  key={index}
                  onChange={(event) => updateProof(index, event.target.value)}
                  placeholder={index === 0 ? "VD: Dán tên người dùng bạn đã sử dụng" : `Bằng chứng ${index + 1}`}
                  value={proof}
                />
              ))}
            </div>
            <button
              className="flex h-[46px] items-center justify-center gap-3 border border-[#d3dae6] bg-white text-sm font-black text-[#01a149] hover:border-[#22ab59] hover:bg-[#e7faef]"
              onClick={() => setProofs((current) => [...current, ""])}
              type="button"
            >
              <Plus className="size-5" />
              Thêm bằng chứng
            </button>
          </div>
          {errors.proofRequirements && (
            <span className="mt-1 block text-xs text-[#e63e46]">{errors.proofRequirements}</span>
          )}
        </div>

        <div>
          <h3 className="mb-6 text-base font-bold text-[#203259]">Thiết lập công việc</h3>
          <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-6">
              <label className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
                <span className="text-sm font-medium text-[#1b1b1b]">Số người làm cần tuyển</span>
                <input
                  className="h-[44px] border border-[#d3dae6] bg-white px-4 text-sm text-[#203259] outline-none focus:ring-1 focus:ring-[#22ab59]"
                  inputMode="numeric"
                  name="totalSlots"
                  onChange={(event) => setTotalSlots(event.target.value)}
                  type="text"
                  value={totalSlots}
                />
                {errors.totalSlots && (
                  <span className="text-xs text-[#e63e46] sm:col-start-2">{errors.totalSlots}</span>
                )}
              </label>

              <label className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
                <span className="text-sm font-medium text-[#1b1b1b]">Người làm nhận được</span>
                <input
                  className="h-[44px] border border-[#d3dae6] bg-white px-4 text-sm text-[#203259] outline-none focus:ring-1 focus:ring-[#22ab59]"
                  inputMode="numeric"
                  name="rewardAmount"
                  onChange={(event) => setRewardAmount(event.target.value)}
                  placeholder="10000"
                  type="text"
                  value={rewardAmount}
                />
                {errors.rewardAmount && (
                  <span className="text-xs text-[#e63e46] sm:col-start-2">{errors.rewardAmount}</span>
                )}
              </label>
            </div>

            <div className="bg-white p-6 shadow-[0_12px_30px_rgba(32,50,89,0.12)]">
              <h3 className="text-2xl font-black text-[#203259]">Chi phí dự kiến</h3>
              <div className="mt-5 bg-[#fce3e5] px-4 py-3 text-base text-[#203259]">
                {costs ? formatVnd(costs.totalCharge) : "Chưa đủ dữ liệu"}
              </div>
              <p className="mt-3 text-center text-sm text-[#e63e46]">
                Hệ thống sẽ kiểm tra số dư khi bạn đăng việc.
              </p>
            </div>
          </div>
        </div>

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

        <div className="grid gap-5 md:grid-cols-2">
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
      </form>
    </div>
  );
}
