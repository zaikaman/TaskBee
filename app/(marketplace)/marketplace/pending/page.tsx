import { redirect } from "next/navigation";

export default function PendingTasksRedirect() {
  redirect("/dashboard/worker/tasks?status=pending");
}
