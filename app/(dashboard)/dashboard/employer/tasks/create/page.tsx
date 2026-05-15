import { requireRole } from "@/lib/auth/session";
import { UserRole } from "@/lib/generated/prisma/client";
import { CreateTaskFormWrapper } from "./create-task-form-wrapper";

export const metadata = {
  title: "Đăng công việc mới | TaskBee",
  description: "Tạo và đăng công việc mới cho workers",
};

export default async function CreateTaskPage() {
  // Require Employer role
  await requireRole(UserRole.EMPLOYER);

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#203259]">Đăng công việc mới</h1>
          <p className="mt-2 text-[#7f8aa0]">
            Tạo công việc mới và bắt đầu nhận submission từ workers
          </p>
        </div>

        <CreateTaskFormWrapper />
      </div>
    </div>
  );
}
