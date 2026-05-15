"use client";

import { useRouter } from "next/navigation";
import { CreateTaskForm } from "@/components/tasks/create-task-form";

export function CreateTaskFormWrapper() {
  const router = useRouter();

  const handleSuccess = (taskId: string) => {
    router.push(`/dashboard/employer/tasks/${taskId}`);
  };

  return <CreateTaskForm onSuccess={handleSuccess} />;
}
