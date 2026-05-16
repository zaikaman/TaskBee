import Link from "next/link";
import { AlertTriangle, Landmark, ShieldCheck, UsersRound, WalletCards } from "lucide-react";
import { getPrisma } from "@/lib/db/prisma";
import {
  DepositIntentStatus,
  TaskStatus,
  UserStatus,
  WithdrawalStatus,
} from "@/lib/generated/prisma/client";
import { formatVnd } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

function StatTile({
  href,
  icon,
  label,
  tone = "neutral",
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger";
  value: string;
}) {
  const toneClass = {
    neutral: "bg-white text-[#001b49] ring-[#d3dae6]",
    success: "bg-white text-[#001b49] ring-[#bfead0]",
    warning: "bg-white text-[#001b49] ring-[#f4d58b]",
    danger: "bg-white text-[#001b49] ring-[#f4b8bd]",
  }[tone];
  const iconClass = {
    neutral: "bg-[#f5f7fa] text-[#203259]",
    success: "bg-[#e7faef] text-[#00a650]",
    warning: "bg-[#fff3cf] text-[#996500]",
    danger: "bg-[#fce3e5] text-[#e63e46]",
  }[tone];

  return (
    <Link className={`block rounded-lg p-5 shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] ${toneClass}`} href={href}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-bold text-[#4a5568]">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded ${iconClass}`}>{icon}</span>
      </div>
      <p className="mt-5 text-3xl font-black tracking-normal text-[#001b49]">{value}</p>
    </Link>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminDashboardPage() {
  const prisma = getPrisma();

  const [
    pendingWithdrawals,
    depositExceptions,
    activeUsers,
    restrictedUsers,
    activeTasks,
    pendingWithdrawalAmount,
    recentAudits,
  ] = await Promise.all([
    prisma.withdrawal.count({ where: { status: WithdrawalStatus.PENDING } }),
    prisma.depositIntent.count({
      where: {
        status: {
          in: [
            DepositIntentStatus.FAILED,
            DepositIntentStatus.UNDERPAID,
            DepositIntentStatus.OVERPAID,
            DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
          ],
        },
      },
    }),
    prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
    prisma.user.count({
      where: {
        status: {
          in: [UserStatus.SUSPENDED, UserStatus.BANNED],
        },
      },
    }),
    prisma.task.count({ where: { status: TaskStatus.ACTIVE } }),
    prisma.withdrawal.aggregate({
      where: { status: WithdrawalStatus.PENDING },
      _sum: { amount: true },
    }),
    prisma.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        reason: true,
        createdAt: true,
        admin: { select: { email: true } },
        targetUser: { select: { email: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-[#00a650]">Quản trị hệ thống</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#001b49]">Bảng điều khiển</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4a5568]">
            Theo dõi rủi ro vận hành, xử lý tiền đang chờ và kiểm soát tài khoản có dấu hiệu bất thường.
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center rounded bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-600"
          href="/admin/withdrawals"
        >
          Xử lý rút tiền
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatTile
          href="/admin/withdrawals"
          icon={<WalletCards className="size-5" />}
          label="Rút tiền đang chờ"
          tone={pendingWithdrawals > 0 ? "warning" : "success"}
          value={String(pendingWithdrawals)}
        />
        <StatTile
          href="/admin/deposits"
          icon={<Landmark className="size-5" />}
          label="Nạp tiền cần rà soát"
          tone={depositExceptions > 0 ? "danger" : "success"}
          value={String(depositExceptions)}
        />
        <StatTile
          href="/admin/users"
          icon={<UsersRound className="size-5" />}
          label="Người dùng active"
          value={String(activeUsers)}
        />
        <StatTile
          href="/admin/users?status=SUSPENDED"
          icon={<AlertTriangle className="size-5" />}
          label="Tài khoản hạn chế"
          tone={restrictedUsers > 0 ? "warning" : "neutral"}
          value={String(restrictedUsers)}
        />
        <StatTile
          href="/marketplace"
          icon={<ShieldCheck className="size-5" />}
          label="Task đang chạy"
          tone="success"
          value={String(activeTasks)}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg bg-white p-5 text-[#001b49] shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-[#f0f2f5]">
          <p className="text-sm font-bold uppercase text-[#686d77]">Tiền đang chờ rút</p>
          <p className="mt-4 text-3xl font-black text-[#00a650]">
            {formatVnd(pendingWithdrawalAmount._sum.amount?.toString() ?? "0")}
          </p>
          <p className="mt-3 text-sm leading-6 text-[#4a5568]">
            Con số này nằm trong pending balance của người dùng cho tới khi admin duyệt hoặc từ chối.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg bg-white text-[#001b49] shadow-[0_2px_10px_rgba(0,0,0,0.06)] ring-1 ring-[#f0f2f5]">
          <div className="border-b border-[#f0f2f5] px-5 py-4">
            <h2 className="font-semibold">Audit gần đây</h2>
          </div>
          {recentAudits.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#686d77]">Chưa có audit log nào.</p>
          ) : (
            <div className="divide-y divide-[#f0f2f5]">
              {recentAudits.map((audit) => (
                <div className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[1fr_auto]" key={audit.id}>
                  <div>
                    <p className="font-bold">{audit.action}</p>
                    <p className="mt-1 text-[#686d77]">
                      {audit.entityType}
                      {audit.targetUser?.email ? ` · ${audit.targetUser.email}` : ""}
                    </p>
                    {audit.reason ? <p className="mt-1 text-[#4a5568]">{audit.reason}</p> : null}
                  </div>
                  <p className="text-[#686d77]">{formatDate(audit.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
