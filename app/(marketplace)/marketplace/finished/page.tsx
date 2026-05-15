import { redirect } from "next/navigation";

export default function FinishedTasksRedirect() {
  redirect("/dashboard/worker/tasks");
}
