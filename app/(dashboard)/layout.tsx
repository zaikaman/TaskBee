import Link from "next/link";
import { Briefcase, CircleDollarSign, UserRound } from "lucide-react";

const dashboardLinks = [
  { href: "/dashboard/profile", label: "Hồ sơ", icon: UserRound },
  { href: "/dashboard/employer/tasks", label: "Việc đã đăng", icon: Briefcase },
  { href: "/dashboard/worker/tasks", label: "Việc của tôi", icon: Briefcase },
  { href: "/dashboard/wallet", label: "Ví tiền", icon: CircleDollarSign },
];

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex flex-1 bg-slate-50">
      <aside className="hidden w-64 border-r border-slate-200 bg-white p-4 lg:block">
        <nav className="space-y-1">
          {dashboardLinks.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-emerald-700"
              >
                <Icon className="size-4" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</section>
    </main>
  );
}
