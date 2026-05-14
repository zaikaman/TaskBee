"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/services/auth";

type ProfileMenuProps = {
  displayName: string;
};

const menuItems = [
  { href: "/profile", label: "Cài đặt tài khoản" },
  { href: "/referrals", label: "Chia sẻ & nhận thưởng" },
  { href: "/profile", label: "Hồ sơ của tôi" },
  { href: "/dashboard/worker/tasks", label: "Xếp hạng MicroJobs" },
  { href: "/dashboard/employer/tasks", label: "Xếp hạng Gigs" },
  { href: "/support", label: "Hỗ trợ" },
];

export function ProfileMenu({ displayName }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Mở menu tài khoản"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-slate-500">
          <User className="size-4" aria-hidden="true" />
        </span>
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-64 bg-white py-2 text-sm text-slate-600 shadow-[0_18px_45px_rgba(15,23,42,0.16)] ring-1 ring-slate-100"
        >
          <div className="border-b border-slate-100 px-5 py-3 font-medium text-slate-900">
            Xin chào, {displayName}
          </div>
          <div className="py-2">
            {menuItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                className={
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "block px-5 py-2.5 font-semibold text-emerald-600 hover:bg-slate-50"
                    : "block px-5 py-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <form action={logout}>
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-5 py-2.5 text-left text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
