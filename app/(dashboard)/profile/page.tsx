import Link from "next/link";
import {
  AlertCircle,
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
      <section className="mx-auto max-w-[1090px] bg-white p-8 shadow-sm ring-1 ring-slate-100">
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
    <div className="mx-auto max-w-[1090px] space-y-6">
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
