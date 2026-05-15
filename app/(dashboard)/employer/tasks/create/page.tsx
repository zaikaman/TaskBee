import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { UserRole } from "@/lib/generated/prisma/client";
import { CreateTaskFormWrapper } from "./create-task-form-wrapper";

export const metadata = {
  title: "Tạo Task mới - TaskBee",
  description: "Tạo task mới và đăng lên marketplace",
};

export default async function CreateTaskPage() {
  const session = await requireRole(UserRole.EMPLOYER);
  const profile = session.profile;

  if (!profile) {
    redirect("/forbidden");
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-[#203259]">Tạo Task mới</h1>
        <p className="text-sm text-[#7f8aa0] mt-1">
          Điền thông tin chi tiết về công việc bạn muốn đăng
        </p>
      </div>

      <CreateTaskFormWrapper />
    </div>
  );
}
