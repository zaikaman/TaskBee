import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { UserRole, TaskStatus, SubmissionStatus } from "@/lib/generated/prisma/client";
import { TaskDetailCard } from "@/components/tasks/task-detail-card";
import { SubmissionReviewList } from "@/components/tasks/submission-review-list";
import { TaskActionButtons } from "@/components/tasks/task-action-buttons";
import { serializeTaskForClient } from "@/lib/utils/task-serialization";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Chi tiết Task | TaskBee",
  description: "Xem chi tiết task và các submissions liên quan",
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function getTaskWithSubmissions(taskId: string, employerId: string) {
  const prisma = getPrisma();

  const task = await prisma.task.findUnique({
    where: {
      id: taskId,
      employerId,
    },
    include: {
      submissions: {
        include: {
          worker: {
            select: {
              id: true,
              email: true,
              username: true,
              avatarUrl: true,
            },
          },
          claim: {
            select: {
              id: true,
              status: true,
              claimedAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  return task;
}

export default async function EmployerTaskDetailPage({ params }: PageProps) {
  const session = await requireRole(UserRole.EMPLOYER);
  const profile = session.profile;

  if (!profile) {
    redirect("/forbidden");
  }

  const { id } = await params;

  const task = await getTaskWithSubmissions(id, profile.id);

  if (!task) {
    notFound();
  }

  const taskForClient = serializeTaskForClient(task);

  // Tính toán thống kê submissions
  const submissionStats = {
    total: task.submissions.length,
    pending: task.submissions.filter((s) => s.status === SubmissionStatus.PENDING).length,
    approved: task.submissions.filter((s) => s.status === SubmissionStatus.APPROVED).length,
    rejected: task.submissions.filter((s) => s.status === SubmissionStatus.REJECTED).length,
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      {/* Back Button */}
      <div className="mb-4">
        <Link
          href="/dashboard/employer/tasks"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#203259] hover:text-[#22ab59] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay về danh sách task
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-[#203259]">Chi tiết Task</h1>
        <p className="text-sm text-[#7f8aa0] mt-1">
          Quản lý công việc và xem xét các bài nộp từ worker
        </p>
      </div>

      {/* Task Detail Card */}
      <div className="mb-8">
        <TaskDetailCard task={taskForClient} />
      </div>

      {/* Task Action Buttons */}
      <div className="mb-8">
        <TaskActionButtons taskId={task.id} status={task.status} />
      </div>

      {/* Submission Statistics */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#203259] mb-4">Submissions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#edf4ff] p-4 rounded">
            <span className="text-xs font-bold text-[#7f8aa0] uppercase">Tổng số</span>
            <p className="mt-1 text-2xl font-black text-[#203259]">{submissionStats.total}</p>
          </div>
          <div className="bg-[#fff6f6] p-4 rounded">
            <span className="text-xs font-bold text-[#7f8aa0] uppercase">Chờ duyệt</span>
            <p className="mt-1 text-2xl font-black text-[#fbbf24]">{submissionStats.pending}</p>
          </div>
          <div className="bg-[#f0fdf4] p-4 rounded">
            <span className="text-xs font-bold text-[#7f8aa0] uppercase">Đã duyệt</span>
            <p className="mt-1 text-2xl font-black text-[#22ab59]">{submissionStats.approved}</p>
          </div>
          <div className="bg-[#fef2f2] p-4 rounded">
            <span className="text-xs font-bold text-[#7f8aa0] uppercase">Từ chối</span>
            <p className="mt-1 text-2xl font-black text-[#e63e46]">{submissionStats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      {task.submissions.length > 0 ? (
        <SubmissionReviewList submissions={task.submissions} taskStatus={task.status} />
      ) : (
        <div className="bg-[#edf4ff] border border-[#203259]/10 rounded-lg p-8 text-center">
          <p className="text-[#7f8aa0] text-sm">
            Chưa có submission nào cho task này. Người làm thuê sẽ nộp bằng chứng hoàn thành công việc tại đây.
          </p>
        </div>
      )}
    </div>
  );
}