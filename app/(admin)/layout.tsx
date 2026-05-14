import Link from "next/link";
import { BadgeCheck, Landmark, UsersRound, WalletCards } from "lucide-react";

const adminLinks = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: BadgeCheck },
  { href: "/admin/withdrawals", label: "Rút tiền", icon: WalletCards },
  { href: "/admin/deposits", label: "Nạp tiền", icon: Landmark },
  { href: "/admin/users", label: "Người dùng", icon: UsersRound },
];

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex flex-1 bg-slate-950 text-slate-100">
      <aside className="hidden w-64 border-r border-white/10 bg-slate-900 p-4 lg:block">
        <nav className="space-y-1">
          {adminLinks.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
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
