"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

const primaryLinks = [
  { href: "/viec-lam", label: "Việc làm nhỏ", hasMenu: true },
  { href: "/dashboard", label: "Bảng điều khiển" },
  { href: "/dashboard/wallet", label: "Ví tiền" },
  { href: "/admin/dashboard", label: "Quản trị" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/profile" || pathname.startsWith("/dashboard/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-2 md:flex">
      {primaryLinks.map((link) => {
        const isActive = isActivePath(pathname, link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              isActive
                ? "flex h-16 items-center gap-1 border-b-2 border-emerald-600 px-3 text-sm font-semibold text-emerald-700"
                : "flex h-16 items-center gap-1 px-3 text-sm font-medium text-slate-600 hover:text-emerald-700"
            }
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
            {link.hasMenu ? <ChevronDown className="size-3" aria-hidden="true" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
