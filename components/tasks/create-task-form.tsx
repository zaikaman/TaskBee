"use client";

import { useActionState, useEffect, useState } from "react";
import { TaskType } from "@/lib/generated/prisma/browser";
import { createTask } from "@/lib/services/task";
import type { CreateTaskState } from "@/lib/services/task";
import { CreateClassicCategoryStep } from "./create-classic-category-step";
import { CreateClassicLevelStep } from "./create-classic-level-step";
import { CreateClassicProofsStep } from "./create-classic-proofs-step";
import { CreateClassicSettingsStep } from "./create-classic-settings-step";
import { CreateExpressTaskForm } from "./create-express-task-form";
import { CreateTaskStepper } from "./create-task-stepper";

const initialCreateTaskState: CreateTaskState = {
  ok: false,
};

export type TaskFormData = {
  title: string;
  description: string;
  instructions: string;
  category: string;
  rewardAmount: string;
  totalSlots: string;
  autoApproveDays: string;
  holdTimeMinutes: string;
  proofRequirements: string;
  taskType: TaskType;
  subcategory: string;
  targetListId: string;
  classicLevel: string;
};

const initialFormData: TaskFormData = {
  title: "",
  description: "",
  instructions: "",
  category: "",
  rewardAmount: "",
  totalSlots: "25",
  autoApproveDays: "7",
  holdTimeMinutes: "15",
  proofRequirements: "",
  taskType: TaskType.EXPRESS,
  subcategory: "",
  targetListId: "",
  classicLevel: "starter",
};

type CreateTaskFormProps = {
  onSuccess?: (taskId: string) => void;
};

const classicStepLabels = ["Danh mục", "Cấp độ", "Bằng chứng", "Cài đặt"];

function ClassicJobTabs({
  onTaskTypeChange,
}: {
  onTaskTypeChange: (taskType: TaskType) => void;
}) {
  return (
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
  );
}

export function CreateTaskForm({ onSuccess }: CreateTaskFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [state, formAction, isPending] = useActionState(createTask, initialCreateTaskState);

  const activeFormData: TaskFormData = {
    ...formData,
    title: state.fields?.title ?? formData.title,
    description: state.fields?.description ?? formData.description,
    instructions: state.fields?.instructions ?? formData.instructions,
    category: state.fields?.category ?? formData.category,
    taskType: state.fields?.taskType ?? formData.taskType,
    subcategory: state.fields?.subcategory ?? formData.subcategory,
    targetListId: state.fields?.targetListId ?? formData.targetListId,
    rewardAmount: state.fields?.rewardAmount ?? formData.rewardAmount,
    totalSlots: state.fields?.totalSlots ?? formData.totalSlots,
    autoApproveDays: state.fields?.autoApproveDays ?? formData.autoApproveDays,
    holdTimeMinutes: state.fields?.holdTimeMinutes ?? formData.holdTimeMinutes,
    proofRequirements: state.fields?.proofRequirements ?? formData.proofRequirements,
    classicLevel: formData.classicLevel,
  };

  useEffect(() => {
    if (state.ok && state.taskId && onSuccess) {
      onSuccess(state.taskId);
    }
  }, [state.ok, state.taskId, onSuccess]);

  const handleNext = (stepData: Partial<TaskFormData>) => {
    setFormData((previous) => ({ ...previous, ...stepData }));
    setCurrentStep((previous) => Math.min(previous + 1, classicStepLabels.length));
  };

  const handleUpdate = (stepData: Partial<TaskFormData>) => {
    setFormData((previous) => ({ ...previous, ...stepData }));
  };

  const handleBack = () => {
    setCurrentStep((previous) => Math.max(previous - 1, 1));
  };

  const handleTaskTypeChange = (taskType: TaskType) => {
    setFormData((previous) => ({
      ...previous,
      taskType,
      category: "",
      subcategory: "",
      targetListId: "",
      totalSlots: taskType === TaskType.CLASSIC ? previous.totalSlots || "25" : previous.totalSlots,
      autoApproveDays: taskType === TaskType.CLASSIC ? "7" : "3",
      holdTimeMinutes: taskType === TaskType.CLASSIC ? "15" : "15",
      classicLevel: "starter",
    }));
    setCurrentStep(1);
  };

  if (activeFormData.taskType === TaskType.EXPRESS) {
    return (
      <div className="mx-auto w-full max-w-5xl">
        <CreateExpressTaskForm
          data={activeFormData}
          formAction={formAction}
          isPending={isPending}
          onChangeTaskType={handleTaskTypeChange}
          state={state}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <ClassicJobTabs onTaskTypeChange={handleTaskTypeChange} />

      {currentStep === 1 && (
        <CreateClassicCategoryStep
          data={activeFormData}
          onUpdate={handleUpdate}
          onNext={handleNext}
        />
      )}

      {currentStep === 2 && (
        <CreateClassicLevelStep
          data={activeFormData}
          onBack={handleBack}
          onUpdate={handleUpdate}
          onNext={handleNext}
        />
      )}

      {currentStep === 3 && (
        <CreateClassicProofsStep
          data={activeFormData}
          onBack={handleBack}
          onUpdate={handleUpdate}
          onNext={handleNext}
        />
      )}

      {currentStep === 4 && (
        <CreateClassicSettingsStep
          data={activeFormData}
          formAction={formAction}
          isPending={isPending}
          onBack={handleBack}
          onUpdate={handleUpdate}
          state={state}
        />
      )}

      <div className="mt-8 bg-[#f5f7fa] px-6 py-5">
        <CreateTaskStepper
          currentStep={currentStep}
          labels={classicStepLabels}
          totalSteps={classicStepLabels.length}
        />
      </div>
    </div>
  );
}
