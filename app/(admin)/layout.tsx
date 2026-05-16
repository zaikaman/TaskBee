import Link from "next/link";
import { BadgeCheck, Landmark, UsersRound, WalletCards } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { UserRole } from "@/lib/generated/prisma/client";

const adminLinks = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: BadgeCheck },
  { href: "/admin/withdrawals", label: "Rút tiền", icon: WalletCards },
  { href: "/admin/deposits", label: "Nạp tiền", icon: Landmark },
  { href: "/admin/users", label: "Người dùng", icon: UsersRound },
];

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole(UserRole.ADMIN);

  return (
    <main className="flex min-h-screen flex-col bg-[#f5f7fa] text-[#001b49] lg:flex-row">
      <aside className="hidden w-64 shrink-0 border-r border-[#d3dae6] bg-white lg:block">
        <div className="border-b border-[#f0f2f5] px-6 py-5">
          <Link className="flex items-center gap-3" href="/admin/dashboard">
            <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#22ab59] text-[#22ab59]">
              <BadgeCheck className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-lg font-black text-[#00a650]">TaskBee</span>
              <span className="block text-xs font-bold uppercase text-[#686d77]">Admin</span>
            </span>
          </Link>
        </div>
        <div className="p-4">
          <nav className="space-y-1.5">
            {adminLinks.map((link) => {
              const Icon = link.icon;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded bg-transparent px-3 py-2.5 text-sm font-bold text-[#203259] hover:bg-[#e7faef] hover:text-[#005924]"
                >
                  <Icon className="size-4 text-[#686d77]" aria-hidden="true" />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <header className="border-b border-[#d3dae6] bg-white lg:hidden">
        <div className="p-4">
          <Link className="flex items-center gap-3" href="/admin/dashboard">
            <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#22ab59] text-[#22ab59]">
              <BadgeCheck className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-lg font-black text-[#00a650]">TaskBee</span>
              <span className="block text-xs font-bold uppercase text-[#686d77]">Admin</span>
            </span>
          </Link>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 text-sm font-bold text-[#203259]">
          {adminLinks.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex shrink-0 items-center gap-2 rounded border border-[#d3dae6] bg-white px-3 py-2 hover:bg-[#e7faef] hover:text-[#005924]"
              >
                <Icon className="size-4 text-[#686d77]" aria-hidden="true" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <section className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</section>
    </main>
  );
}
