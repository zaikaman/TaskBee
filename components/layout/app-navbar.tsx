import Link from "next/link";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  Clock3,
  Leaf,
  Moon,
  Search,
  User,
  WalletCards,
} from "lucide-react";
import { APP_NAME } from "@/config/app";
import { Button } from "@/components/ui/button";

const primaryLinks = [
  { href: "/viec-lam", label: "Việc làm nhỏ", active: true },
  { href: "/dashboard", label: "Bảng điều khiển" },
  { href: "/dashboard/wallet", label: "Ví tiền" },
  { href: "/admin/dashboard", label: "Quản trị" },
];

export function AppNavbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-[#22ab59]">
          <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#22ab59]">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-bold">{APP_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                link.active
                  ? "flex h-16 items-center gap-1 border-b-2 border-slate-900 px-3 text-sm font-medium text-slate-900"
                  : "flex h-16 items-center gap-1 px-3 text-sm font-medium text-slate-600 hover:text-emerald-700"
              }
            >
              {link.label}
              {link.href === "/viec-lam" ? (
                <ChevronDown className="size-3" aria-hidden="true" />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-sm lg:flex">
            <span className="text-slate-500">người thuê</span>
            <span className="relative inline-flex h-5 w-10 rounded-full bg-slate-200 p-0.5">
              <span className="size-4 translate-x-5 rounded-full bg-emerald-600 shadow-sm" />
            </span>
            <span className="font-medium text-emerald-700">người làm thuê</span>
          </div>

          <div className="hidden items-center gap-1 text-slate-500 sm:flex">
            <Button variant="ghost" size="icon" aria-label="Trợ giúp">
              <CircleHelp className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Thông báo" className="relative">
              <Bell className="size-4" />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Lịch sử">
              <Clock3 className="size-4" />
            </Button>
            <Button asChild variant="ghost" size="icon">
              <Link href="/dashboard/profile" aria-label="Tài khoản">
                <User className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Giao diện tối">
              <Moon className="size-4" />
            </Button>
          </div>

          <Button asChild className="hidden rounded bg-emerald-600 px-4 text-white hover:bg-emerald-700 sm:inline-flex">
            <Link href="/viec-lam">
              <Search className="size-4" />
              Tìm việc
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" className="sm:hidden">
            <Link href="/dashboard/wallet" aria-label="Ví tiền">
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
            <Link href="/viec-lam" className="font-medium text-emerald-700">
              Khảo sát trả phí (20)
            </Link>
          </div>
          <div className="flex items-center gap-4 font-medium text-slate-700">
            <span>
              Đã thu: <span className="text-emerald-700">0 VND</span>
            </span>
            <span>
              Chờ duyệt: <span className="text-amber-600">0 VND</span>
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <Clock3 className="size-4" /> 180s
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
