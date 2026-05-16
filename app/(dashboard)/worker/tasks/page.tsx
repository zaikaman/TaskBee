import { AlertCircle, Check, Clock, MoreHorizontal, Search, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  SubmissionStatus,
  TaskClaimStatus,
  UserRole,
} from "@/lib/generated/prisma/client";
import { expireStaleTaskClaims } from "@/lib/services/task-claim-expiration";
import { formatVnd } from "@/lib/utils/money";

export const metadata = {
  title: "Nhiệm vụ của tôi | Worker Dashboard",
};

type WorkerTasksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type WorkerTaskStatusFilter =
  | "ALL"
  | "CLAIMED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

const statusOptions: Array<{ label: string; value: WorkerTaskStatusFilter }> = [
  { label: "Tất cả nhiệm vụ", value: "ALL" },
  { label: "Đang giữ slot", value: "CLAIMED" },
  { label: "Chờ duyệt", value: "PENDING" },
  { label: "Đã duyệt", value: "APPROVED" },
  { label: "Bị từ chối", value: "REJECTED" },
  { label: "Đã hết hạn", value: "EXPIRED" },
  { label: "Đã hủy", value: "CANCELLED" },
];

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseStatusFilter(value: string | undefined): WorkerTaskStatusFilter {
  return statusOptions.some((option) => option.value === value)
    ? (value as WorkerTaskStatusFilter)
    : "ALL";
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function getEffectiveStatus(
  claimStatus: TaskClaimStatus,
  submissionStatus: SubmissionStatus | null,
) {
  if (submissionStatus) {
    return submissionStatus;
  }

  return claimStatus;
}

function getStatusLabel(status: SubmissionStatus | TaskClaimStatus) {
  switch (status) {
    case SubmissionStatus.PENDING:
      return "Chờ duyệt";
    case SubmissionStatus.APPROVED:
      return "Đã duyệt";
    case SubmissionStatus.REJECTED:
      return "Bị từ chối";
    case TaskClaimStatus.CLAIMED:
      return "Đang giữ slot";
    case TaskClaimStatus.SUBMITTED:
      return "Đã nộp";
    case TaskClaimStatus.EXPIRED:
      return "Đã hết hạn";
    case TaskClaimStatus.CANCELLED:
      return "Đã hủy";
    default:
      return status;
  }
}

function StatusIcon({ status }: { status: SubmissionStatus | TaskClaimStatus }) {
  if (status === SubmissionStatus.APPROVED) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#e7faef] text-[#22ab59]">
        <Check className="size-3 stroke-[3]" aria-hidden="true" />
      </span>
    );
  }

  if (status === SubmissionStatus.REJECTED || status === TaskClaimStatus.CANCELLED) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#fce3e5] text-[#e63e46]">
        <XCircle className="size-3" aria-hidden="true" />
      </span>
    );
  }

  if (status === TaskClaimStatus.CLAIMED) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#edf4ff] text-[#203259]">
        <Clock className="size-3" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-[#fff3cf] text-[#de9100]">
      <MoreHorizontal className="size-3" aria-hidden="true" />
    </span>
  );
}

export default async function WorkerTasksPage({ searchParams }: WorkerTasksPageProps) {
  const [session, rawSearchParams] = await Promise.all([
    requireRole(UserRole.WORKER),
    searchParams,
  ]);

  if (!session.profile) {
    redirect("/forbidden");
  }

  await expireStaleTaskClaims({ workerId: session.profile.id });

  const status = parseStatusFilter(firstValue(rawSearchParams?.status));
  const search = firstValue(rawSearchParams?.search)?.trim() ?? "";
  const prisma = getPrisma();

  const claims = await prisma.taskClaim.findMany({
    where: {
      workerId: session.profile.id,
      ...(status === "CLAIMED" ? { status: TaskClaimStatus.CLAIMED } : {}),
      ...(status === "EXPIRED" ? { status: TaskClaimStatus.EXPIRED } : {}),
      ...(status === "CANCELLED" ? { status: TaskClaimStatus.CANCELLED } : {}),
      ...(status === "PENDING" ||
      status === "APPROVED" ||
      status === "REJECTED"
        ? {
            submission: {
              status: status as SubmissionStatus,
            },
          }
        : {}),
      ...(search
        ? {
            task: {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          rewardAmount: true,
          status: true,
          category: true,
        },
      },
      submission: {
        select: {
          id: true,
          status: true,
          employerFeedback: true,
          createdAt: true,
          reviewedAt: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { claimedAt: "desc" }],
  });

  const totalEarned = claims.reduce((total, claim) => {
    if (claim.submission?.status !== SubmissionStatus.APPROVED) {
      return total;
    }

    return total + Number(claim.task.rewardAmount.toString());
  }, 0);

  return (
    <div className="mx-auto w-full max-w-6xl py-4 sm:py-8">
      <div className="mb-6 flex items-start rounded-md border border-[#de9100] bg-[#fff3cf] px-3 py-3 text-sm text-[#8a5f00] sm:px-4">
        <AlertCircle className="mr-3 size-5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <span className="font-medium">Theo dõi nhiệm vụ thật từ hệ thống.</span>{" "}
          Những nhiệm vụ đang giữ slot, đang chờ duyệt hoặc cần nộp lại bằng chứng sẽ xuất hiện tại đây.
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#203259] sm:text-2xl">
            Nhiệm vụ của tôi
          </h1>
          <p className="mt-1 text-sm text-[#7f8aa0]">
            {claims.length} kết quả · Thu nhập đã duyệt {formatVnd(totalEarned)}
          </p>
        </div>
        <Button asChild className="bg-[#22ab59] px-6 text-white hover:bg-[#01a149]">
          <Link href="/marketplace">Tìm việc</Link>
        </Button>
      </div>

      <form className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]" method="get">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#7f8aa0]" />
          <Input
            className="border-zinc-200 bg-white pl-9"
            defaultValue={search}
            name="search"
            placeholder="Tìm theo tên công việc..."
          />
        </div>
        <select
          className="h-10 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-[#203259] outline-none focus:border-[#22ab59]"
          defaultValue={status}
          name="status"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Lọc
        </Button>
      </form>

      <div className="mb-6 overflow-hidden rounded-md border border-zinc-200 bg-white">
        <Table className="min-w-[760px]">
          <TableHeader className="bg-zinc-50">
            <TableRow className="hover:bg-zinc-50">
              <TableHead className="w-[96px] text-center font-bold text-[#203259]">
                Trạng thái
              </TableHead>
              <TableHead className="font-bold text-[#203259]">Tên công việc</TableHead>
              <TableHead className="w-[160px] font-bold text-[#203259]">Cập nhật</TableHead>
              <TableHead className="w-[160px] font-bold text-[#203259]">Thu nhập</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.length === 0 ? (
              <TableRow>
                <TableCell className="py-10 text-center text-sm text-[#7f8aa0]" colSpan={4}>
                  Chưa có nhiệm vụ phù hợp với bộ lọc hiện tại.
                </TableCell>
              </TableRow>
            ) : (
              claims.map((claim) => {
                const effectiveStatus = getEffectiveStatus(
                  claim.status,
                  claim.submission?.status ?? null,
                );
                const updatedAt =
                  claim.submission?.reviewedAt ??
                  claim.submission?.createdAt ??
                  claim.submittedAt ??
                  claim.claimedAt;

                return (
                  <TableRow key={claim.id}>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <StatusIcon status={effectiveStatus} />
                        <span className="text-xs font-medium text-[#596274]">
                          {getStatusLabel(effectiveStatus)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-[#203259]">
                      <Link
                        className="hover:text-[#22ab59] hover:underline"
                        href={`/marketplace/${claim.task.id}`}
                      >
                        {claim.task.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#7f8aa0]">
                        <span>Task: {claim.task.status}</span>
                        {claim.task.category ? <span>· {claim.task.category}</span> : null}
                        {claim.submission?.employerFeedback ? (
                          <span className="text-[#e63e46]">· Có phản hồi cần xem</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-zinc-500">
                      {formatDateTime(updatedAt)}
                    </TableCell>
                    <TableCell className="font-medium text-[#203259]">
                      {claim.submission?.status === SubmissionStatus.APPROVED
                        ? formatVnd(claim.task.rewardAmount.toString())
                        : "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
