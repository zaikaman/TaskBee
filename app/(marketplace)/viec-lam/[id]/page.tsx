import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TaskDetailCard } from "@/components/tasks/task-detail-card";
import { SubmissionForm } from "@/components/tasks/submission-form";
import { TaskClaimButton } from "@/components/tasks/task-claim-button";
import { requireRole } from "@/lib/auth/session";
import { loadMarketplaceTask } from "@/lib/services/marketplace";
import { formatVnd } from "@/lib/utils/money";
import { SubmissionStatus, TaskClaimStatus, TaskStatus, UserRole } from "@/lib/generated/prisma/client";

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
  const taskAvailableForClaim = task.status === TaskStatus.ACTIVE && task.availableSlots > 0;
  const canSubmitProof = task.status === TaskStatus.ACTIVE && currentClaim?.status === TaskClaimStatus.CLAIMED;
  const showSubmissionForm =
    canSubmitProof &&
    currentSubmissionStatus !== SubmissionStatus.PENDING &&
    currentSubmissionStatus !== SubmissionStatus.APPROVED;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <Info className="mr-3 inline-block size-5 align-[-0.2rem]" />
        <span>Cải thiện bảo mật tài khoản của bạn. Thêm email khôi phục ngay để đảm bảo quyền truy cập liên tục.</span>
      </div>

      <Link href="/viec-lam" className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="mr-2 size-4" />
        Quay lại danh sách việc
      </Link>

      <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {task.category ? <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100">{task.category}</Badge> : null}
            {task.subcategory ? <Badge variant="outline" className="border-slate-200 text-slate-600">{task.subcategory}</Badge> : null}
          </div>

          <h1 className="text-3xl font-black tracking-tight text-slate-900">{task.title}</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Công việc này được lấy trực tiếp từ cơ sở dữ liệu, giữ nguyên dữ liệu thật của employer, số slot và quy tắc xét duyệt.
          </p>

          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span>{formatRelativeTime(task.createdAt)}</span>
            <span>{task.autoApproveDays} ngày xét duyệt</span>
            <span>Nhà tuyển việc: {task.employer.username ?? "đã ẩn danh"}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 px-5 py-4 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phần thưởng / suất</p>
          <p className="mt-1 text-4xl font-black text-emerald-600">{formatVnd(task.rewardAmount)}</p>
          <p className="mt-1 text-sm text-slate-500">
            {task.availableSlots.toLocaleString("vi-VN")}/{task.totalSlots.toLocaleString("vi-VN")} suất còn lại
          </p>
        </div>
      </div>

      <div className="mb-8">
        <TaskDetailCard task={task} />
      </div>

      <Card className="mb-8 border-slate-200 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">Giữ chỗ và nộp bằng chứng</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Bạn cần giữ chỗ trước khi nộp bằng chứng. Hệ thống chỉ cho phép submission khi claim còn ở trạng thái hợp lệ.
              </p>
            </div>
          </div>

          {!currentClaim ? (
            taskAvailableForClaim ? (
              <TaskClaimButton taskId={task.id} taskStatus={task.status} availableSlots={task.availableSlots} />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                Việc này hiện chưa thể giữ chỗ vì đang không ở trạng thái mở hoặc đã hết slot.
              </div>
            )
          ) : task.status !== TaskStatus.ACTIVE ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              Việc này hiện không ở trạng thái ACTIVE nên bạn không thể nộp thêm bằng chứng lúc này.
            </div>
          ) : currentClaim.status === TaskClaimStatus.CANCELLED || currentClaim.status === TaskClaimStatus.EXPIRED ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Bạn đã có lịch sử nhận việc này và không thể nhận lại task này.
            </div>
          ) : currentSubmissionStatus === SubmissionStatus.PENDING ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              Bạn đã gửi bằng chứng và đang chờ employer duyệt. Hệ thống sẽ tự động duyệt sau {task.autoApproveDays} ngày nếu chưa có phản hồi.
            </div>
          ) : currentSubmissionStatus === SubmissionStatus.APPROVED ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              Submission của bạn đã được duyệt. Phần thưởng sẽ được ghi nhận vào ví của bạn theo luồng xử lý chuẩn.
            </div>
          ) : showSubmissionForm ? (
            <div className="space-y-4">
              {currentSubmissionStatus === SubmissionStatus.REJECTED ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  Submission trước đó đã bị từ chối. Bạn có thể nộp lại bằng chứng mới ngay bây giờ.
                </div>
              ) : null}

              <SubmissionForm taskId={task.id} proofRequirements={task.proofRequirements} />
            </div>
          ) : currentClaim.status === TaskClaimStatus.CLAIMED ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Bạn đã giữ chỗ công việc này. Hãy quay lại để nộp bằng chứng khi hoàn thành.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              Việc này không còn ở trạng thái có thể nộp bằng chứng.
            </div>
          )}

          {proofRequirements.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
              <h3 className="text-sm font-semibold text-slate-900">Yêu cầu bằng chứng từ employer</h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                {proofRequirements.map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600">
            ?
          </div>
          <h2 className="text-base font-semibold text-slate-900">Lưu ý vận hành</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          TaskBee ghi nhận mọi thay đổi từ database thật, bao gồm slot đã giữ, submission đang chờ duyệt và trạng thái duyệt tự động của employer.
        </p>
      </div>
    </div>
  );
}
