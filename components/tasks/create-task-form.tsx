"use client";

import { useActionState, useEffect, useState } from "react";
import { TaskType } from "@/lib/generated/prisma/browser";
import { createTask } from "@/lib/services/task";
import type { CreateTaskState } from "@/lib/services/task";

const initialCreateTaskState: CreateTaskState = {
  ok: false,
};
import { CreateTaskStep1 } from "./create-task-step-1";
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

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  const totalSteps = 3;

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Stepper */}
      <CreateTaskStepper currentStep={currentStep} totalSteps={totalSteps} />

      {/* Step Content */}
      <div className="mt-6 sm:mt-8">
        {currentStep === 1 && (
          <CreateTaskStep1
            data={activeFormData}
            onNext={handleNext}
          />
        )}

        {currentStep === 2 && (
          <CreateTaskStep2
            data={activeFormData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 3 && (
          <CreateTaskStep3
            data={activeFormData}
            formAction={formAction}
            isPending={isPending}
            state={state}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}
