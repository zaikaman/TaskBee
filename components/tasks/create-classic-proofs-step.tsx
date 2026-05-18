"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Info, Plus } from "lucide-react";
import { TASK_LIMITS } from "@/config/app";
import { ClassicJobSummary } from "./classic-job-summary";
import type { TaskFormData } from "./create-task-form";

type CreateClassicProofsStepProps = {
  data: TaskFormData;
  onBack: () => void;
  onNext: (data: Partial<TaskFormData>) => void;
  onUpdate: (data: Partial<TaskFormData>) => void;
};

const proofTypeOptions = [
  "Văn bản",
  "Ảnh chụp màn hình",
  "Liên kết",
  "Tên người dùng",
  "Mã xác nhận",
];

const validationActions = [
  "Không tự động xác minh",
  "So khớp văn bản chính xác",
  "So khớp một phần",
  "Câu hỏi và đáp án",
];

function splitStoredLines(value: string, prefix: RegExp, fallbackCount: number) {
  const lines = value
    .split("\n")
    .map((line) => line.replace(prefix, "").trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : Array.from({ length: fallbackCount }, () => "");
}

function buildSteps(steps: string[]) {
  return steps
    .map((step, index) => `Bước ${index + 1}: ${step.trim()}`)
    .filter((step) => !step.endsWith(":"))
    .join("\n");
}

function buildProofRequirements(
  proofs: string[],
  proofTypes: string[],
  validationAction: string,
  questions: string[],
  answers: string[],
) {
  const proofLines = proofs
    .map((proof, index) => {
      const cleanProof = proof.trim();
      if (!cleanProof) {
        return "";
      }

      return `Bằng chứng ${index + 1} (${proofTypes[index] || "Văn bản"}): ${cleanProof}`;
    })
    .filter(Boolean);

  const validationLines = questions
    .map((question, index) => {
      const cleanQuestion = question.trim();
      const cleanAnswer = answers[index]?.trim();

      if (!cleanQuestion || !cleanAnswer) {
        return "";
      }

      return `Câu hỏi tự xác minh ${index + 1}: ${cleanQuestion} | Đáp án: ${cleanAnswer}`;
    })
    .filter(Boolean);

  return [
    ...proofLines,
    validationAction !== validationActions[0] ? `Kiểu tự xác minh: ${validationAction}` : "",
    ...validationLines,
  ]
    .filter(Boolean)
    .join("\n");
}

export function CreateClassicProofsStep({
  data,
  onBack,
  onNext,
  onUpdate,
}: CreateClassicProofsStepProps) {
  const [steps, setSteps] = useState<string[]>(
    splitStoredLines(data.instructions, /^Bước\s+\d+:\s*/i, 2),
  );
  const [proofs, setProofs] = useState<string[]>(
    splitStoredLines(data.proofRequirements, /^Bằng chứng\s+\d+(\s+\([^)]+\))?:\s*/i, 4).slice(
      0,
      4,
    ),
  );
  const [proofTypes, setProofTypes] = useState<string[]>(
    Array.from({ length: 4 }, () => proofTypeOptions[0]),
  );
  const [variables, setVariables] = useState("");
  const [validationAction, setValidationAction] = useState(validationActions[0]);
  const [questions, setQuestions] = useState<string[]>(["", "", ""]);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);

  const instructions = useMemo(() => buildSteps(steps), [steps]);
  const proofRequirements = useMemo(
    () => buildProofRequirements(proofs, proofTypes, validationAction, questions, answers),
    [answers, proofTypes, proofs, questions, validationAction],
  );
  const remainingNoteChars = Math.max(0, 512 - data.description.length);

  const errors: Record<string, string> = {};

  if (data.title.trim().length > 0 && data.title.trim().length < 5) {
    errors.title = "Tiêu đề phải có ít nhất 5 ký tự";
  }

  if (instructions.length > 0 && instructions.length < 20) {
    errors.instructions = "Tác vụ cần có ít nhất 20 ký tự";
  }

  if (proofRequirements.length > 0 && proofRequirements.length < 10) {
    errors.proofRequirements = "Yêu cầu bằng chứng cần có ít nhất 10 ký tự";
  }

  const canContinue =
    data.title.trim().length >= 5 &&
    instructions.length >= 20 &&
    proofRequirements.length >= 10;

  const updateStep = (index: number, value: string) => {
    const nextSteps = steps.map((step, stepIndex) => (stepIndex === index ? value : step));
    setSteps(nextSteps);
    onUpdate({ instructions: buildSteps(nextSteps) });
  };

  const addStep = () => {
    const nextSteps = [...steps, ""];
    setSteps(nextSteps);
    onUpdate({ instructions: buildSteps(nextSteps) });
  };

  const updateProof = (index: number, value: string) => {
    const nextProofs = proofs.map((proof, proofIndex) => (proofIndex === index ? value : proof));
    setProofs(nextProofs);
    onUpdate({
      proofRequirements: buildProofRequirements(
        nextProofs,
        proofTypes,
        validationAction,
        questions,
        answers,
      ),
    });
  };

  const updateProofType = (index: number, value: string) => {
    const nextTypes = proofTypes.map((type, typeIndex) => (typeIndex === index ? value : type));
    setProofTypes(nextTypes);
    onUpdate({
      proofRequirements: buildProofRequirements(
        proofs,
        nextTypes,
        validationAction,
        questions,
        answers,
      ),
    });
  };

  const updateQuestion = (index: number, value: string) => {
    const nextQuestions = questions.map((question, questionIndex) =>
      questionIndex === index ? value : question,
    );
    setQuestions(nextQuestions);
    onUpdate({
      proofRequirements: buildProofRequirements(
        proofs,
        proofTypes,
        validationAction,
        nextQuestions,
        answers,
      ),
    });
  };

  const updateAnswer = (index: number, value: string) => {
    const nextAnswers = answers.map((answer, answerIndex) =>
      answerIndex === index ? value : answer,
    );
    setAnswers(nextAnswers);
    onUpdate({
      proofRequirements: buildProofRequirements(
        proofs,
        proofTypes,
        validationAction,
        questions,
        nextAnswers,
      ),
    });
  };

  const updateValidationAction = (value: string) => {
    setValidationAction(value);
    onUpdate({
      proofRequirements: buildProofRequirements(proofs, proofTypes, value, questions, answers),
    });
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_322px]">
      <div className="space-y-14">
        <label className="block max-w-[564px]">
          <span className="mb-6 block text-base font-bold text-[#203259]">
            Viết tiêu đề công việc chính xác và cụ thể
          </span>
          <input
            className="h-[58px] w-full border-0 bg-[#f2f4f7] px-4 text-sm text-[#203259] outline-none placeholder:text-[#53627a] focus:ring-1 focus:ring-[#22ab59]"
            maxLength={TASK_LIMITS.titleMaxLength}
            onChange={(event) => onUpdate({ title: event.target.value })}
            placeholder="Nhập tiêu đề công việc"
            type="text"
            value={data.title}
          />
          {errors.title && (
            <span className="mt-1 block text-xs text-[#e63e46]">{errors.title}</span>
          )}
        </label>

        <section className="max-w-[564px]">
          <div className="mb-8 flex items-center gap-4">
            <h2 className="text-base font-bold text-[#203259]">
              Những tác vụ cụ thể cần hoàn thành
            </h2>
            <span className="flex size-8 items-center justify-center rounded bg-[#fff3cf] text-[#de9100]">
              <Info className="size-4" />
            </span>
          </div>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <textarea
                className="min-h-[59px] w-full border-0 bg-[#f2f4f7] px-3 py-3 text-sm text-[#203259] outline-none placeholder:text-[#53627a] focus:ring-1 focus:ring-[#22ab59]"
                key={index}
                onChange={(event) => updateStep(index, event.target.value)}
                placeholder={`Bước ${index + 1}`}
                value={step}
              />
            ))}

            <button
              className="flex h-[46px] w-full items-center gap-3 border border-[#d3dae6] bg-white px-4 text-sm font-black text-[#01a149] hover:border-[#22ab59] hover:bg-[#e7faef]"
              onClick={addStep}
              type="button"
            >
              <Plus className="size-5" />
              Thêm bước
            </button>
          </div>

          {errors.instructions && (
            <span className="mt-2 block text-xs text-[#e63e46]">{errors.instructions}</span>
          )}
        </section>

        <label className="block max-w-[564px]">
          <span className="mb-8 inline-flex items-center gap-4 text-base font-bold text-[#203259]">
            Giá trị biến. Tối đa 1000 dòng. (chỉ cần nếu bước làm có biến)
            <span className="flex size-8 items-center justify-center rounded bg-[#fff3cf] text-[#de9100]">
              <Info className="size-4" />
            </span>
          </span>
          <textarea
            className="min-h-[114px] w-full border-0 bg-[#f2f4f7] px-3 py-3 text-sm text-[#203259] outline-none placeholder:text-[#53627a] focus:ring-1 focus:ring-[#22ab59]"
            onChange={(event) => setVariables(event.target.value)}
            placeholder="Dán các giá trị CSV tại đây"
            value={variables}
          />
        </label>

        <label className="block max-w-[564px]">
          <span className="mb-8 block text-base font-bold text-[#203259]">
            Ghi chú bổ sung (không bắt buộc)
          </span>
          <textarea
            className="min-h-[114px] w-full border-0 bg-[#f2f4f7] px-3 py-3 text-sm text-[#203259] outline-none placeholder:text-[#53627a] focus:ring-1 focus:ring-[#22ab59]"
            maxLength={512}
            onChange={(event) => onUpdate({ description: event.target.value })}
            placeholder="Thêm bình luận, ghi chú hoặc lưu ý cho người làm"
            value={data.description}
          />
          <span className="mt-1 block text-sm text-[#1b1b1b]">
            Còn {remainingNoteChars} ký tự
          </span>
        </label>

        <section className="max-w-[564px]">
          <div className="mb-3 flex items-center gap-4">
            <h2 className="text-base font-bold text-[#203259]">
              Bằng chứng bắt buộc khi hoàn thành việc
            </h2>
            <span className="flex size-8 items-center justify-center rounded bg-[#fff3cf] text-[#de9100]">
              <Info className="size-4" />
            </span>
          </div>
          <button className="mb-6 text-sm text-[#01a149]" type="button">
            Tìm hiểu về tự động đánh giá bằng PCODE
          </button>

          <div className="space-y-14">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="space-y-2" key={index}>
                <textarea
                  className="min-h-[58px] w-full border-0 bg-[#f2f4f7] px-3 py-3 text-sm text-[#203259] outline-none placeholder:text-[#53627a] focus:ring-1 focus:ring-[#22ab59]"
                  onChange={(event) => updateProof(index, event.target.value)}
                  placeholder={`Bằng chứng ${index + 1}`}
                  value={proofs[index] ?? ""}
                />
                <div className="relative">
                  <select
                    className="h-[42px] w-full appearance-none border-0 bg-[#f2f4f7] px-3 pr-10 text-sm text-[#53627a] outline-none focus:ring-1 focus:ring-[#22ab59]"
                    onChange={(event) => updateProofType(index, event.target.value)}
                    value={proofTypes[index] ?? proofTypeOptions[0]}
                  >
                    {proofTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        Chọn loại bằng chứng {index + 1}: {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#53627a]" />
                </div>
              </div>
            ))}
          </div>

          {errors.proofRequirements && (
            <span className="mt-2 block text-xs text-[#e63e46]">
              {errors.proofRequirements}
            </span>
          )}
        </section>

        <section className="max-w-[564px]">
          <div className="mb-8 flex items-center gap-4">
            <h2 className="text-base font-bold text-[#203259]">
              Bằng chứng tự động xác minh (không bắt buộc)
            </h2>
            <span className="flex size-8 items-center justify-center rounded bg-[#fff3cf] text-[#de9100]">
              <Info className="size-4" />
            </span>
          </div>

          <div className="mb-4 bg-[#d5f2f6] px-5 py-3 text-sm leading-6 text-[#000]">
            <span className="font-bold">Gợi ý nhanh:</span> Hãy giúp người làm trả lời đúng dễ
            hơn. Ví dụ:
            <ul className="ml-8 list-disc">
              <li>Yêu cầu nhập tên người dùng thay vì u/username.</li>
              <li>Yêu cầu taskbee.vn thay vì https://taskbee.vn.</li>
            </ul>
          </div>

          <div className="relative mb-14">
            <select
              className="h-[42px] w-full appearance-none border-0 bg-[#f2f4f7] px-3 pr-10 text-sm text-[#53627a] outline-none focus:ring-1 focus:ring-[#22ab59]"
              onChange={(event) => updateValidationAction(event.target.value)}
              value={validationAction}
            >
              {validationActions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#53627a]" />
          </div>

          <div className="space-y-14">
            {questions.map((question, index) => (
              <div className="space-y-2" key={index}>
                <input
                  className="h-[58px] w-full border-0 bg-[#f2f4f7] px-3 text-sm text-[#203259] outline-none placeholder:text-[#53627a] focus:ring-1 focus:ring-[#22ab59]"
                  onChange={(event) => updateQuestion(index, event.target.value)}
                  placeholder={`Câu hỏi ${index + 1}`}
                  type="text"
                  value={question}
                />
                <input
                  className="h-[58px] w-full border-0 bg-[#f2f4f7] px-3 text-sm text-[#203259] outline-none placeholder:text-[#53627a] focus:ring-1 focus:ring-[#22ab59]"
                  onChange={(event) => updateAnswer(index, event.target.value)}
                  placeholder={`Đáp án ${index + 1}`}
                  type="text"
                  value={answers[index]}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="grid max-w-[684px] gap-10 sm:grid-cols-2">
          <button
            className="h-[46px] bg-[#22ab59] px-8 text-sm font-black uppercase text-white hover:bg-[#005924] disabled:opacity-60"
            disabled={!canContinue}
            onClick={() =>
              onNext({
                title: data.title,
                instructions,
                proofRequirements,
                description: data.description,
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
            Lưu bản nháp
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
  );
}
