import { requireRole } from "@/lib/auth/session";
import { TaskStatus, UserRole } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { notFound, redirect } from "next/navigation";
import { EditTaskFormWrapper } from "./edit-task-form-wrapper";
import { serializeTaskForClient } from "@/lib/utils/task-serialization";

export const metadata = {
  title: "Chỉnh sửa công việc | TaskBee",
  description: "Chỉnh sửa thông tin công việc",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTaskPage({ params }: PageProps) {
  const session = await requireRole(UserRole.EMPLOYER);
  const { id } = await params;
  const prisma = getPrisma();

  if (!session.profile) {
    redirect("/forbidden");
  }

  // Lấy thông tin task
  const task = await prisma.task.findUnique({
    where: { id },
  });

  if (!task) {
    notFound();
  }

  const taskForClient = serializeTaskForClient(task);

  // Kiểm tra quyền sở hữu
  if (task.employerId !== session.profile.id) {
    redirect("/forbidden");
  }

  // Chỉ cho phép chỉnh sửa task ở trạng thái DRAFT
  if (task.status !== TaskStatus.DRAFT) {
    redirect(`/dashboard/employer/tasks/${id}`);
  }

  return (
    <div className="min-h-screen bg-white py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#203259]">Chỉnh sửa công việc</h1>
          <p className="mt-2 text-[#7f8aa0]">
            Cập nhật bản nháp, lưu lại hoặc đăng việc để kích hoạt công việc
          </p>
        </div>

        <EditTaskFormWrapper task={taskForClient} />
      </div>
    </div>
  );
}
