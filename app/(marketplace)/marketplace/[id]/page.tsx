import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TaskDetailCard } from "@/components/tasks/task-detail-card";
import { SubmissionForm } from "@/components/tasks/submission-form";
import { TaskClaimButton } from "@/components/tasks/task-claim-button";
import {
  TaskNotActiveErrorState,
  InvalidClaimStatusErrorState,
  DuplicateSubmissionErrorState,
} from "@/components/tasks/error-states";
import { requireRole } from "@/lib/auth/session";
import { loadMarketplaceTask } from "@/lib/services/marketplace";
import { formatVnd } from "@/lib/utils/money";
import {
  SubmissionStatus,
  TaskClaimStatus,
  TaskStatus,
  UserRole,
} from "@/lib/generated/prisma/client";

type TaskDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatRelativeTime(date: Date) {
  const diffInMs = Date.now() - date.getTime();
  const diffInDays = Math.max(0, Math.floor(diffInMs / (24 * 60 * 60 * 1000)));

  if (diffInDays <= 0) {
    return "Hôm nay";
  }

  if (diffInDays === 1) {
    return "1 ngày trước";
  }

  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);

  if (diffInWeeks < 5) {
    return `${diffInWeeks} tuần trước`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);

  if (diffInMonths < 12) {
    return `${diffInMonths} tháng trước`;
  }

  const diffInYears = Math.floor(diffInDays / 365);

  return `${diffInYears} năm trước`;
}

function splitProofRequirements(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default async function TaskDetailPage({ params }: TaskDetailPageProps) {
  const session = await requireRole(UserRole.WORKER);

  if (!session.profile) {
    redirect("/forbidden");
  }

  const { id } = await params;

  const task = await loadMarketplaceTask(id, session.profile.id);

  if (!task) {
    notFound();
  }

  const currentClaim = task.claims[0] ?? null;
  const currentSubmissionStatus = currentClaim?.submission?.status ?? null;
  const proofRequirements = splitProofRequirements(task.proofRequirements);
  const taskAvailableForClaim =
    task.status === TaskStatus.ACTIVE && task.availableSlots > 0;
  const canSubmitProof =
    task.status === TaskStatus.ACTIVE &&
    currentClaim?.status === TaskClaimStatus.CLAIMED;
  const showSubmissionForm =
    canSubmitProof &&
    currentSubmissionStatus !== SubmissionStatus.PENDING &&
    currentSubmissionStatus !== SubmissionStatus.APPROVED;

  return (
    <div className="bg-zinc-50 min-h-screen py-8">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/marketplace"
            className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <ArrowLeft className="mr-2 size-4" />
            Trở lại
          </Link>
        </div>

        {/* Title and Reward */}
        <div className="mb-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold text-zinc-900 leading-tight">
              {task.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                Phần thưởng: {formatVnd(task.rewardAmount)}
              </span>
              {task.category && (
                <span className="text-zinc-600 bg-white border border-zinc-200 shadow-sm px-3 py-1 rounded-full text-sm font-medium">
                  {task.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Finished job alert */}
        <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-lg shadow-sm flex items-start gap-4">
          <div className="bg-emerald-100 p-2 rounded-full text-emerald-600 shrink-0 mt-0.5">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-emerald-900 font-bold mb-1">
              Đã hoàn thành công việc? Gửi bằng chứng của bạn bên dưới
            </p>
            <p className="text-sm text-emerald-700 leading-relaxed">
              Hãy chắc chắn rằng bạn đã thực hiện đúng theo các yêu cầu. Việc
              gửi bằng chứng rác hoặc giả mạo sẽ dẫn đến khóa tài khoản vĩnh
              viễn.
            </p>
          </div>
        </div>

        {/* Task Details Card */}
        <div className="bg-white border border-zinc-200 shadow-sm rounded-xl overflow-hidden mb-8">
          <div className="p-6 md:p-8">
            <TaskDetailCard task={task} />
          </div>
        </div>

        {/* Submit Proof Section */}
        <Card className="mb-8 border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-zinc-900">
              Gửi bằng chứng hoàn thành
            </h3>
          </div>
          <CardContent className="p-6 space-y-6">
            {!currentClaim ? (
              taskAvailableForClaim ? (
                <div className="flex flex-col items-center justify-center p-6 bg-zinc-50 border border-zinc-200 border-dashed rounded-lg text-center space-y-4">
                  <p className="text-zinc-600 mb-2">
                    Bạn cần giữ chỗ công việc (HOLD THIS JOB) trước khi có thể
                    nộp bằng chứng.
                  </p>
                  <TaskClaimButton
                    taskId={task.id}
                    taskStatus={task.status}
                    availableSlots={task.availableSlots}
                  />
                </div>
              ) : (
                <TaskNotActiveErrorState taskStatus={task.status} />
              )
            ) : task.status !== TaskStatus.ACTIVE ? (
              <TaskNotActiveErrorState taskStatus={task.status} />
            ) : currentClaim.status === TaskClaimStatus.CANCELLED ||
              currentClaim.status === TaskClaimStatus.EXPIRED ? (
              <InvalidClaimStatusErrorState claimStatus={currentClaim.status} />
            ) : currentSubmissionStatus === SubmissionStatus.PENDING ? (
              <DuplicateSubmissionErrorState submissionStatus="PENDING" />
            ) : currentSubmissionStatus === SubmissionStatus.APPROVED ? (
              <DuplicateSubmissionErrorState submissionStatus="APPROVED" />
            ) : showSubmissionForm ? (
              <div className="space-y-6">
                {currentSubmissionStatus === SubmissionStatus.REJECTED ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 font-medium">
                    Bằng chứng trước đó đã bị từ chối. Vui lòng kiểm tra lại yêu
                    cầu và nộp lại đúng theo hướng dẫn.
                  </div>
                ) : null}

                <SubmissionForm
                  taskId={task.id}
                  proofRequirements={task.proofRequirements}
                />
              </div>
            ) : currentClaim.status === TaskClaimStatus.CLAIMED ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-800 font-medium flex-col items-start gap-4 flex md:flex-row md:items-center justify-between">
                <div>
                  <p className="font-bold mb-1">Đã giữ chỗ thành công!</p>
                  <p>
                    Hãy quay lại đây và nộp bằng chứng sau khi hoàn thành công
                    việc.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-600 font-medium">
                Việc này không còn ở trạng thái có thể nộp bằng chứng.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
