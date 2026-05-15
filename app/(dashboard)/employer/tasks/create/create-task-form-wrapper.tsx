"use client";

import { useRouter } from "next/navigation";
import { CreateTaskForm } from "@/components/tasks/create-task-form";

export function CreateTaskFormWrapper() {
  const router = useRouter();

  const handleSuccess = (taskId: string) => {
    // Redirect to task detail page or tasks list
    router.push(`/dashboard/employer/tasks`);
  };

  return <CreateTaskForm onSuccess={handleSuccess} />;
}
