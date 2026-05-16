import Link from "next/link";
import {
  CircleHelp,
  Clock3,
  Leaf,
  Moon,
  Plus,
  Search,
  WalletCards,
} from "lucide-react";
import { APP_NAME } from "@/config/app";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { UserRole } from "@/lib/generated/prisma/client";
import { PrimaryNav } from "./primary-nav";
import { ProfileMenu } from "./profile-menu";
import { RoleSwitcher } from "./role-switcher";
import { formatCurrency } from "@/lib/utils";
import {
  getRecentNotifications,
  getUnreadNotificationCount,
} from "@/lib/services/notifications";
import { NotificationCenter } from "@/components/notifications/notification-center";

export async function AppNavbar() {
  const session = await getCurrentUser();
  const isAuthenticated = Boolean(session);
  const displayName =
    session?.profile?.username ??
    session?.email?.split("@")[0] ??
    "người dùng";
  const isEmployer = session?.profile?.role === UserRole.EMPLOYER;
  const isWorker = session?.profile?.role === UserRole.WORKER;
  const [notifications, unreadCount] = session?.profile
    ? await Promise.all([
        getRecentNotifications(session.profile.id),
        getUnreadNotificationCount(session.profile.id),
      ])
    : [[], 0];

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-[#22ab59]">
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#22ab59]">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-bold">{APP_NAME}</span>
        </Link>

        <PrimaryNav currentRole={session?.profile?.role} />

        <div className="flex items-center gap-3">
          {isAuthenticated && session?.profile?.role && (
            <div className="hidden lg:block">
              <RoleSwitcher currentRole={session.profile.role} />
            </div>
          )}

          {isAuthenticated ? (
            <div className="hidden items-center gap-1 text-zinc-500 sm:flex">
              <Button variant="ghost" size="icon" aria-label="Trợ giúp">
                <CircleHelp className="size-4" />
              </Button>
              <NotificationCenter notifications={notifications} unreadCount={unreadCount} />
              <Button variant="ghost" size="icon" aria-label="Lịch sử">
                <Clock3 className="size-4" />
              </Button>
              <ProfileMenu displayName={displayName} />
              <Button variant="ghost" size="icon" aria-label="Giao diện tối">
                <Moon className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="hidden items-center gap-3 text-sm font-medium sm:flex">
              <Link href="/login" className="text-emerald-700 hover:text-emerald-900">
                Đăng nhập
              </Link>
              <Button asChild className="rounded bg-emerald-600 text-white hover:bg-emerald-700">
                <Link href="/register">Đăng ký</Link>
              </Button>
            </div>
          )}

          <Button asChild className="hidden rounded bg-emerald-600 px-4 text-white hover:bg-emerald-700 sm:inline-flex">
            {session?.profile?.role === UserRole.EMPLOYER ? (
              <Link href="/dashboard/employer/tasks/create">
                <Plus className="size-4" />
                Tạo công việc
              </Link>
            ) : (
              <Link href="/marketplace">
                <Search className="size-4" />
                Tìm việc
              </Link>
            )}
          </Button>
          <Button asChild variant="outline" size="icon" className="sm:hidden">
            <Link href={isAuthenticated ? "/dashboard/wallet" : "/login"} aria-label="Ví tiền">
              <WalletCards className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="border-b border-amber-100 bg-amber-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-amber-700">
            <Link href="/api" className="hover:text-amber-900">
              API
            </Link>
            <span className="text-amber-300">|</span>
            <Link href="/referrals" className="hover:text-amber-900">
              Giới thiệu
            </Link>
            <span className="text-amber-300">|</span>
            {isEmployer ? (
              <Link href="/dashboard/wallet" className="font-medium text-emerald-700">
                Nạp tiền
              </Link>
            ) : (
              <Link href="/marketplace" className="font-medium text-emerald-700">
                Việc làm nhỏ
              </Link>
            )}
          </div>
          <div className="flex items-center gap-4 font-medium text-zinc-700">
            {isEmployer ? (
              <span>
                Số dư: <span className="text-emerald-700">{formatCurrency(session?.profile?.availableBalance)} VND</span>
              </span>
            ) : (
              <>
                <span>
                  Đã kiếm: <span className="text-emerald-700">{formatCurrency(session?.profile?.availableBalance)} VND</span>
                </span>
                <span>
                  Chờ duyệt: <span className="text-amber-600">{formatCurrency(session?.profile?.pendingBalance)} VND</span>
                </span>
                <span className="flex items-center gap-1 text-zinc-600">
                  <Clock3 className="size-4" /> 180s
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
