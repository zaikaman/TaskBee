"use client";

import { useActionState, useEffect, useState } from "react";
import { TaskType } from "@/lib/generated/prisma/browser";
import { createTask } from "@/lib/services/task";
import type { CreateTaskState } from "@/lib/services/task";

const initialCreateTaskState: CreateTaskState = {
  ok: false,
};
import { CreateExpressTaskForm } from "./create-express-task-form";
import { CreateClassicCategoryStep } from "./create-classic-category-step";
import { CreateClassicDetailsStep } from "./create-classic-details-step";
import { CreateTaskStep2 } from "./create-task-step-2";
import { CreateTaskStep3 } from "./create-task-step-3";
import { CreateTaskStepper } from "./create-task-stepper";

export type TaskFormData = {
  // Step 1: Thông tin cơ bản
  title: string;
  description: string;
  instructions: string;
  category: string;
  
  // Step 2: Cài đặt công việc
  rewardAmount: string;
  totalSlots: string;
  autoApproveDays: string;
  holdTimeMinutes: string;
  proofRequirements: string;
  
  // Hidden fields (MVP: hardcoded)
  taskType: TaskType;
  subcategory: string;
  targetListId: string;
};

const initialFormData: TaskFormData = {
  title: "",
  description: "",
  instructions: "",
  category: "",
  rewardAmount: "",
  totalSlots: "",
  autoApproveDays: "3",
  holdTimeMinutes: "90",
  proofRequirements: "",
  taskType: TaskType.EXPRESS,
  subcategory: "",
  targetListId: "",
};

type CreateTaskFormProps = {
  onSuccess?: (taskId: string) => void;
};

export function CreateTaskForm({ onSuccess }: CreateTaskFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [state, formAction, isPending] = useActionState(createTask, initialCreateTaskState);

  // Restore form data from server state if validation failed
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
  };

  // Handle success - use useEffect to avoid calling during render
  useEffect(() => {
    if (state.ok && state.taskId && onSuccess) {
      onSuccess(state.taskId);
    }
  }, [state.ok, state.taskId, onSuccess]);

  const handleNext = (stepData: Partial<TaskFormData>) => {
    setFormData((prev) => ({ ...prev, ...stepData }));
    setCurrentStep((prev) => prev + 1);
  };

  const handleUpdate = (stepData: Partial<TaskFormData>) => {
    setFormData((prev) => ({ ...prev, ...stepData }));
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const handleTaskTypeChange = (taskType: TaskType) => {
    setFormData((prev) => ({
      ...prev,
      taskType,
      category: "",
      subcategory: "",
      targetListId: "",
    }));
    setCurrentStep(1);
  };

  const classicStepLabels = ["Danh mục", "Nội dung", "Cài đặt", "Xác nhận"];
  const totalSteps = classicStepLabels.length;

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
    <div className="mx-auto w-full max-w-6xl">
      <div>
        {currentStep === 1 && (
          <CreateClassicCategoryStep
            data={activeFormData}
            onTaskTypeChange={handleTaskTypeChange}
            onUpdate={handleUpdate}
            onNext={handleNext}
          />
        )}

        {currentStep === 2 && (
          <CreateClassicDetailsStep
            data={activeFormData}
            onBack={handleBack}
            onNext={handleNext}
          />
        )}

        {currentStep === 3 && (
          <CreateTaskStep2
            data={activeFormData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 4 && (
          <CreateTaskStep3
            data={activeFormData}
            formAction={formAction}
            isPending={isPending}
            state={state}
            onBack={handleBack}
          />
        )}
      </div>

      <div className="mt-8 bg-[#f5f7fa] px-6 py-5">
        <CreateTaskStepper
          currentStep={currentStep}
          labels={classicStepLabels}
          totalSteps={totalSteps}
        />
      </div>
    </div>
  );
}
