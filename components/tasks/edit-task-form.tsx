"use client";

import { useActionState, useEffect, useState } from "react";
import { updateTask } from "@/lib/services/task";
import type { UpdateTaskState } from "@/lib/services/task";
import { CreateTaskStep1 } from "./create-task-step-1";
import { CreateTaskStep2 } from "./create-task-step-2";
import { CreateTaskStep3 } from "./create-task-step-3";
import { CreateTaskStepper } from "./create-task-stepper";
import type { TaskFormData } from "./create-task-form";
import type { SerializableTask } from "@/lib/utils/task-serialization";

const initialUpdateTaskState: UpdateTaskState = {
  ok: false,
};

type EditTaskFormProps = {
  task: SerializableTask;
  onSuccess?: (taskId: string) => void;
  onCancel?: () => void;
};

export function EditTaskForm({ task, onSuccess, onCancel }: EditTaskFormProps) {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Khởi tạo form data từ task hiện có
  const initialFormData: TaskFormData = {
    title: task.title,
    description: task.description || "",
    instructions: task.instructions || "",
    category: task.category || "",
    rewardAmount: task.rewardAmount,
    totalSlots: String(task.totalSlots),
    autoApproveDays: String(task.autoApproveDays),
    proofRequirements: task.proofRequirements || "",
    taskType: task.taskType,
    subcategory: task.subcategory || "",
    targetListId: task.targetListId || "",
  };

  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [state, formAction, isPending] = useActionState(updateTask, initialUpdateTaskState);

  // Restore form data from server state if validation failed
  const activeFormData: TaskFormData = {
    ...formData,
    title: state.fields?.title ?? formData.title,
    description: state.fields?.description ?? formData.description,
    instructions: state.fields?.instructions ?? formData.instructions,
    category: state.fields?.category ?? formData.category,
    rewardAmount: state.fields?.rewardAmount ?? formData.rewardAmount,
    totalSlots: state.fields?.totalSlots ?? formData.totalSlots,
    autoApproveDays: state.fields?.autoApproveDays ?? formData.autoApproveDays,
    proofRequirements: state.fields?.proofRequirements ?? formData.proofRequirements,
  };

  // Handle success
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
    <div className="w-full max-w-4xl mx-auto">
      {/* Stepper */}
      <CreateTaskStepper currentStep={currentStep} totalSteps={totalSteps} />

      {/* Step Content */}
      <div className="mt-8">
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
            taskId={task.id}
            isEdit={true}
          />
        )}
      </div>
    </div>
  );
}
