import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { UserRole } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { expireStaleTaskClaims } from "@/lib/services/task-claim-expiration";
import { EmployerTasksList } from "./employer-tasks-list";

export const metadata = {
  title: "Công việc của tôi | TaskBee",
  description: "Quản lý các công việc bạn đã đăng",
};

export default async function EmployerTasksPage() {
  const session = await requireRole(UserRole.EMPLOYER);
  const prisma = getPrisma();

  await expireStaleTaskClaims();

  // Fetch employer's tasks
  const rawTasks = await prisma.task.findMany({
    where: {
      employerId: session.profile?.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      title: true,
      status: true,
      taskType: true,
      totalSlots: true,
      availableSlots: true,
      claimedSlots: true,
      submittedSlots: true,
      approvedSlots: true,
      rejectedSlots: true,
      rewardAmount: true,
      escrowAmount: true,
      platformFeeAmount: true,
      holdTimeMinutes: true,
      createdAt: true,
      publishedAt: true,
    },
  });

  const tasks = rawTasks.map((task) => ({
    ...task,
    rewardAmount: task.rewardAmount.toString(),
    escrowAmount: task.escrowAmount.toString(),
    platformFeeAmount: task.platformFeeAmount.toString(),
  }));

  return (
    <div className="min-h-screen bg-white">
      {/* Warning Banner */}
      <div className="border-b border-amber-100 bg-amber-50">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  fillRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-amber-800">
                <strong>Lưu ý:</strong> Công việc cũ hơn 6 tháng sẽ không còn khả dụng. Bản nháp cũ
                hơn 30 ngày sẽ bị xóa.
              </p>
            </div>
            <button
              aria-label="Đóng thông báo"
              className="flex-shrink-0 text-amber-600 hover:text-amber-800"
              type="button"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  fillRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#203259]">Công việc của tôi</h1>
          <Link
            className="inline-flex items-center gap-2 rounded bg-[#22ab59] px-6 py-2.5 text-sm font-bold uppercase text-white hover:bg-[#005924] focus:outline-none focus:ring-2 focus:ring-[#22ab59] focus:ring-offset-2"
            href="/dashboard/employer/tasks/create"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                d="M12 4v16m8-8H4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            Tạo công việc
          </Link>
        </div>

        {/* Tasks List */}
        <EmployerTasksList tasks={tasks} />
      </div>
    </div>
  );
}
