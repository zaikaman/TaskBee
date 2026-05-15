import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { UserRole, TaskStatus } from "@/lib/generated/prisma/client";
import { formatVnd } from "@/lib/utils/money";
import { Button } from "@/components/ui/button";

async function getEmployerTasks(employerId: string) {
  const prisma = getPrisma();

  const tasks = await prisma.task.findMany({
    where: {
      employerId,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          submissions: true,
        },
      },
    },
  });

  return tasks;
}

export default async function EmployerTasksPage() {
  const session = await requireRole(UserRole.EMPLOYER);
  const profile = session.profile;

  if (!profile) {
    redirect("/forbidden");
  }

  const tasks = await getEmployerTasks(profile.id);

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-[#203259]">Tasks của tôi</h1>
          <p className="text-sm text-[#7f8aa0] mt-1">
            Quản lý các tasks bạn đã tạo và xem xét submissions
          </p>
        </div>
        <Link href="/dashboard/employer/tasks/create">
          <Button className="bg-[#22ab59] hover:bg-[#1a8a47] text-white">
            Tạo Task mới
          </Button>
        </Link>
      </div>

      {/* Tasks List */}
      {tasks.length > 0 ? (
        <div className="space-y-4">
          {tasks.map((task) => {
            const isActive = task.status === TaskStatus.ACTIVE;
            const isPaused = task.status === TaskStatus.PAUSED;
            const isCompleted = task.status === TaskStatus.COMPLETED;
            const isCancelled = task.status === TaskStatus.CANCELLED;
            const isDraft = task.status === TaskStatus.DRAFT;

            return (
              <Link
                key={task.id}
                href={`/dashboard/employer/tasks/${task.id}`}
                className="block"
              >
                <div className="bg-white border border-[#203259]/10 rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-[#203259] mb-1">
                        {task.title}
                      </h3>
                      {task.category && (
                        <span className="inline-block rounded bg-[#edf4ff] px-2 py-1 text-xs font-medium text-[#203259]">
                          {task.category}
                        </span>
                      )}
                    </div>
                    <span
                      className={`inline-block rounded px-3 py-1 text-xs font-bold uppercase whitespace-nowrap ml-4 ${
                        isActive
                          ? "bg-[#22ab59] text-white"
                          : isPaused
                            ? "bg-[#fbbf24] text-white"
                            : isCompleted
                              ? "bg-[#203259] text-white"
                              : isCancelled
                                ? "bg-[#e63e46] text-white"
                                : "bg-[#7f8aa0] text-white"
                      }`}
                    >
                      {isActive
                        ? "Đang hoạt động"
                        : isPaused
                          ? "Tạm dừng"
                          : isCompleted
                            ? "Hoàn thành"
                            : isCancelled
                              ? "Đã hủy"
                              : "Nháp"}
                    </span>
                  </div>

                  <p className="text-sm text-[#7f8aa0] mb-4 line-clamp-2">
                    {task.description}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs font-bold text-[#7f8aa0] uppercase block">
                        Phần thưởng
                      </span>
                      <p className="text-lg font-black text-[#22ab59]">
                        {formatVnd(task.rewardAmount.toString())}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#7f8aa0] uppercase block">
                        Slots
                      </span>
                      <p className="text-lg font-black text-[#203259]">
                        {task.availableSlots} / {task.totalSlots}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#7f8aa0] uppercase block">
                        Đã duyệt
                      </span>
                      <p className="text-lg font-black text-[#22ab59]">
                        {task.approvedSlots}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#7f8aa0] uppercase block">
                        Submissions
                      </span>
                      <p className="text-lg font-black text-[#203259]">
                        {task._count.submissions}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-[#7f8aa0]">
                    Tạo lúc: {new Date(task.createdAt).toLocaleString("vi-VN")}
                    {task.publishedAt && (
                      <> • Đăng lúc: {new Date(task.publishedAt).toLocaleString("vi-VN")}</>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#edf4ff] border border-[#203259]/10 rounded-lg p-12 text-center">
          <h3 className="text-xl font-bold text-[#203259] mb-2">
            Chưa có task nào
          </h3>
          <p className="text-sm text-[#7f8aa0] mb-6">
            Bắt đầu bằng cách tạo task đầu tiên của bạn
          </p>
          <Link href="/dashboard/employer/tasks/create">
            <Button className="bg-[#22ab59] hover:bg-[#1a8a47] text-white">
              Tạo Task mới
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
