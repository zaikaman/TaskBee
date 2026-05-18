import Link from "next/link";
import {
  AlertCircle,
  BriefcaseBusiness,
  Clock3,
  FileCheck2,
  Info,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireVerifiedUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  SubmissionStatus,
  TaskType,
  TaskStatus,
  TransactionType,
  UserRole,
  UserStatus,
  type User,
} from "@/lib/generated/prisma/client";
import { formatVnd, toMinorUnits, type MoneyInput } from "@/lib/utils/money";
import { ProfileUpdateForm } from "../profile/profile-update-form";

const FREELANCER_STATS_TAB = "freelancer-stats";

const tabs = [
  { label: "Tổng quan", href: "/account", key: "overview" },
  { label: "Bảo mật", href: "/account#security", key: "security" },
  { label: "Danh tính/KYC", href: "/account#identity-kyc", key: "identity-kyc" },
  { label: "Thống kê người làm", href: `/account?tab=${FREELANCER_STATS_TAB}`, key: FREELANCER_STATS_TAB },
  { label: "Danh sách", href: "/account#lists", key: "lists" },
  { label: "Người thuê đã chặn", href: "/account#blocked-buyers", key: "blocked-buyers" },
  { label: "Chương trình & ưu đãi", href: "/account#programs", key: "programs" },
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

const EARNING_POINT_THRESHOLD_VND = 26_000;
const EARNING_POINT_THRESHOLD_MINOR_UNITS = BigInt(EARNING_POINT_THRESHOLD_VND * 100);
const EARNING_POINTS_PER_THRESHOLD = 40;

const freelancerPointRules = [
  { rule: "Người làm starter hoàn thành việc starter", points: "30" },
  { rule: "Người làm advanced hoàn thành việc starter", points: "20" },
  { rule: "Người làm advanced hoàn thành việc advanced", points: "30" },
  { rule: "Người làm expert hoàn thành việc starter", points: "10" },
  { rule: "Người làm expert hoàn thành việc advanced", points: "20" },
  { rule: "Người làm expert hoàn thành việc expert", points: "30" },
  { rule: "Task được đánh giá xuất sắc", points: "+ 50% điểm" },
  { rule: `Mỗi ${formatVnd(EARNING_POINT_THRESHOLD_VND)} kiếm được`, points: "40" },
  { rule: "Task bị đánh giá không hài lòng", points: "-50 * cấp người làm" },
  { rule: "Task bị đánh dấu spam/trùng lặp", points: "-200 * cấp người làm" },
  { rule: "1 tuần không hoạt động", points: "-100 * cấp người làm" },
];

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

type FreelancerStats = {
  tasksDone: number;
  satisfied: number;
  notSatisfied: number;
  pending: number;
  earned: number;
  earnedPerTask: number;
  submitTaskIntervalSeconds: number;
  lastTaskSubmittedLabel: string;
  allTimeSuccessRate: number;
  temporarySuccessRate: number;
  canSubmitTasks: boolean;
  level: number;
  levelName: "starter" | "advanced" | "expert";
  points: number;
  transactions: Array<{
    id: string;
    description: string;
    points: number;
    createdAt: string;
  }>;
};

type AccountPageProps = {
  searchParams?: Promise<{
    tab?: string;
  }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const session = await requireVerifiedUser();
  const profile = session.profile;
  const resolvedSearchParams = await searchParams;
  const activeTab = resolvedSearchParams?.tab === FREELANCER_STATS_TAB ? FREELANCER_STATS_TAB : "overview";

  if (!profile) {
    return (
      <section className="mx-auto max-w-[1090px] bg-white p-8 shadow-sm ring-1 ring-zinc-100">
        <div className="flex items-start gap-4">
          <span className="flex size-12 items-center justify-center rounded bg-amber-50 text-amber-700">
            <AlertCircle className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-zinc-950">Hồ sơ chưa sẵn sàng</h1>
            <p className="max-w-2xl text-sm leading-6 text-zinc-600">
              Tài khoản xác thực đã tồn tại nhưng hồ sơ TaskBee chưa được tạo. Vui lòng hoàn tất bước khởi tạo hồ sơ trước khi sử dụng marketplace.
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
  const freelancerStats =
    activeTab === FREELANCER_STATS_TAB ? await getFreelancerStats(profile) : null;
  const displayEmail = profile.email || session.email || "Chưa có email";
  const displayName = profile.username || displayEmail.split("@")[0] || "Người dùng TaskBee";
  const joinedDate = new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(profile.createdAt);

  return (
    <div className="mx-auto max-w-[1090px] space-y-6 font-sans text-[#001f52]">
      <ProfileTabs activeTab={activeTab} />

      {!profile.emailVerified || !session.emailVerified ? (
        <div className="border border-amber-100 bg-amber-50 px-5 py-3 text-sm font-medium text-amber-800">
          Bạn cần xác minh email trước khi nhận việc, đăng việc hoặc thực hiện giao dịch.
        </div>
      ) : null}

      {activeTab === FREELANCER_STATS_TAB && freelancerStats ? (
        <FreelancerStatsPanel stats={freelancerStats} />
      ) : (
        <>
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

          <section className="bg-white p-6 shadow-sm ring-1 ring-zinc-100">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-950">Thống kê theo vai trò</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Dữ liệu được tính từ task, lượt nhận việc và bài nộp hiện có.
                </p>
              </div>
              <ShieldCheck className="size-5 text-emerald-600" aria-hidden="true" />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {getRoleMetrics(profile.role, stats).map((metric) => {
                const Icon = metric.icon;

                return (
                  <div key={metric.label} className="border border-zinc-100 bg-zinc-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-zinc-500">{metric.label}</span>
                      <Icon className="size-5 text-emerald-600" aria-hidden="true" />
                    </div>
                    <p className="mt-4 text-3xl font-semibold text-zinc-950">{metric.value}</p>
                    <p className="mt-1 text-sm text-zinc-500">{metric.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ProfileTabs({ activeTab }: { activeTab: string }) {
  return (
    <section className="border-b border-[#d3dae6] bg-white">
      <div className="flex w-full overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = (tab.key ?? "overview") === activeTab;

          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={
                isActive
                  ? "flex flex-1 items-center justify-center whitespace-nowrap border-b-2 border-[#22ab59] px-4 py-4 text-center text-sm font-semibold uppercase text-[#001f52]"
                  : "flex flex-1 items-center justify-center whitespace-nowrap px-4 py-4 text-center text-sm font-semibold uppercase text-[#001f52] hover:text-[#22ab59]"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function FreelancerStatsPanel({ stats }: { stats: FreelancerStats }) {
  return (
    <section className="grid items-start gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="space-y-5">
        <FreelancerPerformanceCard stats={stats} />
        <SuccessRateCard
          title="Tỷ lệ thành công mọi thời điểm"
          value={stats.allTimeSuccessRate}
          muted
          tooltip="Tỷ lệ thành công mọi thời điểm là phần trăm task được đánh giá hài lòng trên tổng số task đã hoàn tất."
        />
        <SuccessRateCard
          title="Tỷ lệ thành công tạm thời"
          value={stats.temporarySuccessRate}
          tooltip="Người làm cần giữ tỷ lệ thành công tạm thời từ 75% trở lên trong 50 ngày gần nhất. Quá nhiều task không hài lòng sẽ làm giảm tỷ lệ và có thể chặn quyền nhận việc tạm thời."
          footer={stats.canSubmitTasks ? "Có thể gửi task" : "Tạm thời chưa thể gửi task"}
        />
      </div>

      <div className="space-y-5">
        <FreelancerLevelCard stats={stats} />
        <LevelTransactionsCard stats={stats} />
      </div>
    </section>
  );
}

function FreelancerPerformanceCard({ stats }: { stats: FreelancerStats }) {
  return (
    <article className="bg-white p-8 shadow-[0_1px_8px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100">
      <h2 className="text-base font-semibold text-[#001f52]">Hiệu suất người làm</h2>
      <div className="mt-6 grid gap-x-12 gap-y-4 text-sm sm:grid-cols-2">
        <StatRow label="Task đã làm" value={stats.tasksDone.toLocaleString("vi-VN")} />
        <StatRow label="Đã kiếm" value={formatVnd(stats.earned)} />
        <StatRow label="Hài lòng" value={stats.satisfied.toLocaleString("vi-VN")} />
        <StatRow label="Đã kiếm/Task" value={formatVnd(stats.earnedPerTask)} />
        <StatRow label="Không hài lòng" value={stats.notSatisfied.toLocaleString("vi-VN")} />
        <StatRow label="Khoảng cách gửi task" value={`${stats.submitTaskIntervalSeconds}s`} />
        <StatRow label="Task gửi gần nhất" value={stats.lastTaskSubmittedLabel} />
      </div>
    </article>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-semibold text-black">{label}</span>
      <span className="font-bold text-[#00a651]">{value}</span>
    </div>
  );
}

function SuccessRateCard({
  title,
  value,
  tooltip,
  footer,
  muted = false,
}: {
  title: string;
  value: number;
  tooltip: string;
  footer?: string;
  muted?: boolean;
}) {
  const color = muted ? "#d6deeb" : "#22ab59";

  return (
    <article className="min-h-[266px] bg-white p-8 shadow-[0_1px_8px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-[#001f52]">{title}</h2>
        <span className="group relative inline-flex">
          <Info className="size-4 text-[#001f52]" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-6 left-1/2 z-10 w-64 -translate-x-1/2 bg-[#1b1b1b] px-3 py-2 text-center text-xs font-semibold leading-5 text-white opacity-0 shadow-lg transition group-hover:opacity-100">
            {tooltip}
          </span>
        </span>
      </div>

      <div className="mt-7 flex flex-col items-center">
        <div
          className="flex size-[114px] items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(${color} ${value * 3.6}deg, #d6deeb 0deg)`,
          }}
        >
          <div className="flex size-[92px] flex-col items-center justify-center rounded-full bg-white text-center">
            <span className="text-base font-bold text-[#001f52]">{value}%</span>
            <span className="mt-1 text-xs text-[#001f52]">Tỷ lệ</span>
          </div>
        </div>
        {footer ? <p className="mt-7 text-sm font-semibold text-[#001f52]">{footer}</p> : null}
      </div>
    </article>
  );
}

function FreelancerLevelCard({ stats }: { stats: FreelancerStats }) {
  return (
    <article className="bg-white p-8 shadow-[0_1px_8px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold text-[#001f52]">Cấp người làm</h2>
        <span className="bg-[#d8f0df] px-2 py-1 text-xs font-bold uppercase text-[#107b35]">
          LEVEL {stats.level} &lt; {stats.levelName} &gt;
        </span>
      </div>

      <div className="mt-6 space-y-5 text-sm leading-6 text-black">
        <p>
          Cấp người làm quyết định cấp độ công việc bạn có thể nhận trên TaskBee. Cấp càng cao, bạn càng có thể truy cập các công việc có mức thưởng tốt hơn.
        </p>
        <p>
          Cấp độ được xác định dựa trên tổng điểm tích lũy. Bạn nhận điểm cho mỗi task được đánh giá hài lòng và cho doanh thu kiếm được từ task.
        </p>
        <p>
          Cấp độ có thể giảm nếu không hoạt động trong thời gian dài hoặc có task bị đánh giá không hài lòng.
        </p>
        <p>Tiếp tục hoàn thành tốt task để lên cấp và mở khóa nhiều công việc hơn.</p>
      </div>

      <div className="mt-6 overflow-hidden text-sm">
        <div className="grid grid-cols-[1fr_96px] bg-[#f0f3f7] font-bold text-[#001f52]">
          <div className="p-3">Quy tắc</div>
          <div className="p-3 text-center">Điểm</div>
        </div>
        {freelancerPointRules.map((item) => (
          <div key={item.rule} className="mt-1 grid grid-cols-[1fr_96px] bg-[#f0f3f7] text-black">
            <div className="p-3">{item.rule}</div>
            <div className="p-3 text-center">{item.points}</div>
          </div>
        ))}
      </div>
    </article>
  );
}

function LevelTransactionsCard({ stats }: { stats: FreelancerStats }) {
  return (
    <article className="bg-white p-8 shadow-[0_1px_8px_rgba(0,0,0,0.08)] ring-1 ring-zinc-100">
      <div className="flex items-start justify-between gap-4">
        <h2 className="mt-4 text-base font-semibold text-[#001f52]">Giao dịch điểm cấp</h2>
        <div className="text-right text-[#001f52]">
          <p className="text-xs">Số dư</p>
          <p className="mt-1 text-lg font-semibold">{stats.points.toLocaleString("vi-VN")} điểm</p>
        </div>
      </div>

      {stats.transactions.length > 0 ? (
        <div className="mt-6 space-y-2 text-sm">
          {stats.transactions.map((transaction) => (
            <div key={transaction.id} className="grid gap-2 bg-[#f0f3f7] p-3 sm:grid-cols-[1fr_90px_110px]">
              <span className="font-medium text-[#001f52]">{transaction.description}</span>
              <span className="font-semibold text-[#00a651]">+{transaction.points}</span>
              <span className="text-zinc-500">{transaction.createdAt}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-sm font-bold text-[#001f52]">Chưa có giao dịch nào</p>
      )}
    </article>
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

async function getFreelancerStats(user: User): Promise<FreelancerStats> {
  const prisma = getPrisma();
  const temporaryWindowStart = new Date();
  temporaryWindowStart.setDate(temporaryWindowStart.getDate() - 50);

  const [
    satisfied,
    notSatisfied,
    pending,
    earnedAggregate,
    lastSubmission,
    recentSatisfied,
    recentNotSatisfied,
    approvedSubmissions,
    rewardTransactions,
  ] = await Promise.all([
    prisma.submission.count({ where: { workerId: user.id, status: SubmissionStatus.APPROVED } }),
    prisma.submission.count({ where: { workerId: user.id, status: SubmissionStatus.REJECTED } }),
    prisma.submission.count({ where: { workerId: user.id, status: SubmissionStatus.PENDING } }),
    prisma.transaction.aggregate({
      where: { userId: user.id, type: TransactionType.TASK_REWARD },
      _sum: { amount: true },
    }),
    prisma.submission.findFirst({
      where: { workerId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.submission.count({
      where: {
        workerId: user.id,
        status: SubmissionStatus.APPROVED,
        reviewedAt: { gte: temporaryWindowStart },
      },
    }),
    prisma.submission.count({
      where: {
        workerId: user.id,
        status: SubmissionStatus.REJECTED,
        reviewedAt: { gte: temporaryWindowStart },
      },
    }),
    prisma.submission.findMany({
      where: { workerId: user.id, status: SubmissionStatus.APPROVED },
      select: {
        id: true,
        reviewedAt: true,
        task: {
          select: {
            taskType: true,
            rewardAmount: true,
            title: true,
          },
        },
      },
      orderBy: { reviewedAt: "desc" },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: TransactionType.TASK_REWARD },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        description: true,
        amount: true,
        createdAt: true,
      },
    }),
  ]);

  const earned = Number(earnedAggregate._sum.amount?.toString() ?? "0");
  const earningPoints = calculateEarningPoints(earned);
  const allTimeReviewed = satisfied + notSatisfied;
  const recentReviewed = recentSatisfied + recentNotSatisfied;
  const allTimeSuccessRate = allTimeReviewed > 0 ? Math.round((satisfied / allTimeReviewed) * 100) : 0;
  const temporarySuccessRate =
    recentReviewed > 0 ? Math.round((recentSatisfied / recentReviewed) * 100) : 100;
  const taskPoints = approvedSubmissions.reduce((total, submission) => {
    return total + getTaskCompletionPoints(submission.task.taskType);
  }, 0);
  const points = Math.max(0, taskPoints + earningPoints - notSatisfied * 50);
  const level = getFreelancerLevel(points);

  return {
    tasksDone: satisfied,
    satisfied,
    notSatisfied,
    pending,
    earned,
    earnedPerTask: satisfied > 0 ? earned / satisfied : 0,
    submitTaskIntervalSeconds: user.submitTaskIntervalSeconds,
    lastTaskSubmittedLabel: lastSubmission
      ? new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(lastSubmission.createdAt)
      : "-",
    allTimeSuccessRate,
    temporarySuccessRate,
    canSubmitTasks: temporarySuccessRate >= 75,
    level,
    levelName: getFreelancerLevelName(level),
    points,
    transactions: rewardTransactions.map((transaction) => ({
      id: transaction.id,
      description: transaction.description,
      points: calculateEarningPoints(transaction.amount.toString()),
      createdAt: new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(transaction.createdAt),
    })),
  };
}

function getTaskCompletionPoints(taskType: TaskType) {
  if (taskType === TaskType.EXPRESS) return 30;
  if (taskType === TaskType.CLASSIC) return 30;
  return 30;
}

function getFreelancerLevel(points: number) {
  if (points >= 22627) return 8;
  if (points >= 8000) return 4;
  if (points >= 2828) return 2;
  return 0;
}

function getFreelancerLevelName(level: number): "starter" | "advanced" | "expert" {
  if (level >= 8) return "expert";
  if (level >= 4) return "advanced";
  return "starter";
}

function calculateEarningPoints(amount: MoneyInput) {
  const amountMinorUnits = toMinorUnits(amount);
  return Number(amountMinorUnits / EARNING_POINT_THRESHOLD_MINOR_UNITS) * EARNING_POINTS_PER_THRESHOLD;
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