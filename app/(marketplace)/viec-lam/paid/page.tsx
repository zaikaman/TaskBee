import { redirect } from "next/navigation";

export default function PaidTasksRedirect() {
  redirect("/dashboard/worker/tasks?status=paid");
}
