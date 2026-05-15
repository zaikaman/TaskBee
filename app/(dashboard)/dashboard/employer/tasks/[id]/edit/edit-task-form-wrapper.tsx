"use client";

import { useRouter } from "next/navigation";
import { EditTaskForm } from "@/components/tasks/edit-task-form";
import type { SerializableTask } from "@/lib/utils/task-serialization";

type EditTaskFormWrapperProps = {
  task: SerializableTask;
};

export function EditTaskFormWrapper({ task }: EditTaskFormWrapperProps) {
  const router = useRouter();

  const handleSuccess = (taskId: string) => {
    router.push(`/dashboard/employer/tasks/${taskId}`);
  };

  const handleCancel = () => {
    router.push(`/dashboard/employer/tasks/${task.id}`);
  };

  return <EditTaskForm task={task} onSuccess={handleSuccess} onCancel={handleCancel} />;
}
