import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  BriefcaseBusiness,
  Clock3,
  FileCheck2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  SubmissionStatus,
  TaskStatus,
  UserRole,
  UserStatus,
  type User,
} from "@/lib/generated/prisma/client";
import { formatVnd } from "@/lib/utils/money";
import { ProfileUpdateForm } from "./profile-update-form";

const tabs = [
  "Tổng quan",
  "Bảo mật",
  "Danh tính/KYC",
  "Thống kê người làm",
  "Danh sách",
  "Người thuê đã chặn",
  "Ưu đãi",
];

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Quản trị viên",
  EMPLOYER: "Người thuê",
  WORKER: "Người làm",
};

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "Đang hoạt động",
  SUSPENDED: "Tạm khóa",
  BANNED: "Bị cấm",
};

type ProfileStats = {
  workerClaimedTasks: number;
  workerPendingSubmissions: number;
  workerApprovedSubmissions: number;
  workerRejectedSubmissions: number;
  employerTotalTasks: number;
  employerActiveTasks: number;
  employerPendingReviews: number;
  adminTotalUsers: number;
  adminActiveUsers: number;
  adminPendingReviews: number;
};

export default async function ProfilePage() {
  const session = await requireAuth();
  const profile = session.profile;

  if (!profile) {
    return (
      <section className="mx-auto max-w-5xl bg-white p-8 shadow-sm ring-1 ring-slate-100">
        <div className="flex items-start gap-4">
          <span className="flex size-12 items-center justify-center rounded bg-amber-50 text-amber-700">
            <AlertCircle className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-slate-950">Hồ sơ chưa sẵn sàng</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Tài khoản xác thực đã tồn tại nhưng hồ sơ TaskBee chưa được tạo. Vui lòng hoàn tất
              bước khởi tạo hồ sơ trước khi sử dụng marketplace.
            </p>
            <Button asChild className="rounded bg-emerald-600 text-white hover:bg-emerald-700">
              <Link href="/onboarding">Hoàn tất hồ sơ</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const stats = await getProfileStats(profile);
  const displayEmail = profile.email || session.email || "Chưa có email";
  const displayName = profile.username || displayEmail.split("@")[0] || "Người dùng TaskBee";
  const joinedDate = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(profile.createdAt);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="border-b border-slate-200 bg-white">
        <div className="flex flex-wrap gap-8 overflow-x-auto px-1">
          {tabs.map((tab, index) => (
            <span
              key={tab}
              className={
                index === 0
                  ? "border-b-2 border-emerald-600 py-4 text-sm font-semibold uppercase text-slate-950"
                  : "py-4 text-sm font-semibold uppercase text-slate-950 hover:text-emerald-700"
              }
            >
              {tab}
            </span>
          ))}
        </div>
      </section>

      {!profile.emailVerified || !session.emailVerified ? (
        <div className="border border-amber-100 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-800">
          Bạn cần xác minh email trước khi nhận việc, đăng việc hoặc thực hiện giao dịch.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col items-center text-center">
            <AvatarPreview user={profile} name={displayName} />
            <h1 className="mt-4 text-2xl font-semibold text-slate-950">{displayName}</h1>
            <p className="mt-1 text-sm text-slate-500">{displayEmail}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <StatusPill tone="success">{roleLabels[profile.role]}</StatusPill>
              <StatusPill tone={profile.status === UserStatus.ACTIVE ? "success" : "danger"}>
                {statusLabels[profile.status]}
              </StatusPill>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-6 text-center">
            <MiniMetric label="Khả dụng" value={formatVnd(profile.availableBalance.toString())} />
            <MiniMetric label="Chờ duyệt" value={formatVnd(profile.pendingBalance.toString())} />
            <MiniMetric label="Ký quỹ" value={formatVnd(profile.escrowBalance.toString())} />
          </div>

          <div className="mt-6 space-y-3">
            <ProfileAction role={profile.role} />
            <Button asChild variant="outline" className="w-full rounded border-slate-200">
              <Link href="/dashboard/wallet">Xem ví tiền</Link>
            </Button>
          </div>
        </aside>

        <main className="space-y-6">
          <ProfileUpdateForm
            profileId={profile.id}
            username={displayName}
            avatarUrl={profile.avatarUrl}
            email={displayEmail}
            roleLabel={roleLabels[profile.role]}
            joinedDate={joinedDate}
            emailVerificationLabel={
              profile.emailVerified && session.emailVerified ? "Đã xác minh" : "Chưa xác minh"
            }
            accountStatusLabel={statusLabels[profile.status]}
            canEdit={profile.status === UserStatus.ACTIVE}
          />

          <section className="bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-950">Thống kê theo vai trò</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Dữ liệu được tính từ task, lượt nhận việc và bài nộp hiện có.
                </p>
              </div>
              <ShieldCheck className="size-5 text-emerald-600" aria-hidden="true" />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {getRoleMetrics(profile.role, stats).map((metric) => {
                const Icon = metric.icon;

                return (
                  <div key={metric.label} className="border border-slate-100 bg-slate-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-slate-500">{metric.label}</span>
                      <Icon className="size-5 text-emerald-600" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold text-slate-950">{metric.value}</p>
                    <p className="mt-1 text-sm text-slate-500">{metric.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </section>
    </div>
  );
}

async function getProfileStats(user: User): Promise<ProfileStats> {
  const prisma = getPrisma();

  const [
    workerClaimedTasks,
    workerPendingSubmissions,
    workerApprovedSubmissions,
    workerRejectedSubmissions,
    employerTotalTasks,
    employerActiveTasks,
    employerPendingReviews,
    adminTotalUsers,
    adminActiveUsers,
    adminPendingReviews,
  ] = await Promise.all([
    prisma.taskClaim.count({ where: { workerId: user.id } }),
    prisma.submission.count({ where: { workerId: user.id, status: SubmissionStatus.PENDING } }),
    prisma.submission.count({ where: { workerId: user.id, status: SubmissionStatus.APPROVED } }),
    prisma.submission.count({ where: { workerId: user.id, status: SubmissionStatus.REJECTED } }),
    prisma.task.count({ where: { employerId: user.id } }),
    prisma.task.count({ where: { employerId: user.id, status: TaskStatus.ACTIVE } }),
    prisma.submission.count({
      where: {
        status: SubmissionStatus.PENDING,
        task: { employerId: user.id },
      },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
    prisma.submission.count({ where: { status: SubmissionStatus.PENDING } }),
  ]);

  return {
    workerClaimedTasks,
    workerPendingSubmissions,
    workerApprovedSubmissions,
    workerRejectedSubmissions,
    employerTotalTasks,
    employerActiveTasks,
    employerPendingReviews,
    adminTotalUsers,
    adminActiveUsers,
    adminPendingReviews,
  };
}

function AvatarPreview({ user, name }: { user: User; name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "T";

  return (
    <div
      className="flex size-32 items-center justify-center border border-slate-200 bg-slate-100 text-4xl font-semibold text-slate-400"
      style={
        user.avatarUrl
          ? {
              backgroundImage: `url(${user.avatarUrl})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
            }
          : undefined
      }
      aria-label="Ảnh đại diện"
    >
      {user.avatarUrl ? <span className="sr-only">{name}</span> : initial}
    </div>
  );
}

function StatusPill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "danger";
}) {
  return (
    <span
      className={
        tone === "success"
          ? "inline-flex items-center gap-1 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase text-emerald-700"
          : "inline-flex items-center gap-1 bg-red-50 px-3 py-1 text-xs font-semibold uppercase text-red-700"
      }
    >
      <BadgeCheck className="size-3" aria-hidden="true" />
      {children}
    </span>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-semibold uppercase text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ProfileAction({ role }: { role: UserRole }) {
  if (role === UserRole.EMPLOYER) {
    return (
      <Button asChild className="w-full rounded bg-emerald-600 text-white hover:bg-emerald-700">
        <Link href="/dashboard/employer/tasks">Quản lý việc đã đăng</Link>
      </Button>
    );
  }

  if (role === UserRole.ADMIN) {
    return (
      <Button asChild className="w-full rounded bg-emerald-600 text-white hover:bg-emerald-700">
        <Link href="/admin/dashboard">Mở bảng quản trị</Link>
      </Button>
    );
  }

  return (
    <Button asChild className="w-full rounded bg-emerald-600 text-white hover:bg-emerald-700">
      <Link href="/viec-lam">Tìm việc phù hợp</Link>
    </Button>
  );
}

function getRoleMetrics(role: UserRole, stats: ProfileStats) {
  if (role === UserRole.EMPLOYER) {
    return [
      {
        label: "Tổng việc đã đăng",
        value: stats.employerTotalTasks,
        description: "Bao gồm nháp, đang chạy và đã đóng.",
        icon: BriefcaseBusiness,
      },
      {
        label: "Việc đang hoạt động",
        value: stats.employerActiveTasks,
        description: "Đang nhận lượt làm từ marketplace.",
        icon: Clock3,
      },
      {
        label: "Bài nộp chờ duyệt",
        value: stats.employerPendingReviews,
        description: "Cần xem xét để trả thưởng đúng hạn.",
        icon: FileCheck2,
      },
    ];
  }

  if (role === UserRole.ADMIN) {
    return [
      {
        label: "Tổng người dùng",
        value: stats.adminTotalUsers,
        description: "Tất cả tài khoản đã có hồ sơ TaskBee.",
        icon: ShieldCheck,
      },
      {
        label: "Người dùng hoạt động",
        value: stats.adminActiveUsers,
        description: "Tài khoản đang được phép sử dụng nền tảng.",
        icon: UserRound,
      },
      {
        label: "Bài nộp chờ duyệt",
        value: stats.adminPendingReviews,
        description: "Tổng bài nộp đang chờ người thuê xử lý.",
        icon: FileCheck2,
      },
    ];
  }

  return [
    {
      label: "Việc đã nhận",
      value: stats.workerClaimedTasks,
      description: "Tổng lượt nhận việc của tài khoản.",
      icon: BriefcaseBusiness,
    },
    {
      label: "Bài nộp chờ duyệt",
      value: stats.workerPendingSubmissions,
      description: "Đang chờ người thuê xác nhận.",
      icon: Clock3,
    },
    {
      label: "Bài nộp đạt",
      value: stats.workerApprovedSubmissions,
      description: `${stats.workerRejectedSubmissions} bài nộp bị từ chối.`,
      icon: FileCheck2,
    },
  ];
}
