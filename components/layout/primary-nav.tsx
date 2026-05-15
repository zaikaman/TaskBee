"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const primaryLinks = [
  { href: "/viec-lam", label: "Việc làm nhỏ", hasMenu: true },
  { href: "/dashboard/wallet", label: "Ví tiền" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/profile" || pathname.startsWith("/dashboard/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PrimaryNav({ currentRole }: { currentRole?: string }) {
  const pathname = usePathname();
  const [isJobsMenuOpen, setIsJobsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsJobsMenuOpen(false);
      }
    }

    if (isJobsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isJobsMenuOpen]);

  return (
    <nav className="hidden items-center gap-2 md:flex">
      {primaryLinks.map((link) => {
        const isActive = isActivePath(pathname, link.href);

        // Nếu là link có menu (Việc làm nhỏ), luôn hiển thị dropdown
        if (link.hasMenu) {
          return (
            <div key={link.href} className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsJobsMenuOpen(!isJobsMenuOpen);
                }}
                className={
                  isActive
                    ? "flex h-16 items-center gap-1 border-b-2 border-emerald-600 px-3 text-sm font-semibold text-emerald-700"
                    : "flex h-16 items-center gap-1 px-3 text-sm font-medium text-slate-600 hover:text-emerald-700"
                }
                aria-current={isActive ? "page" : undefined}
              >
                {link.label}
                <ChevronDown
                  className={`size-3 transition-transform ${isJobsMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {isJobsMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-0 w-64 rounded-b border border-slate-200 bg-white shadow-lg">
                  <div className="py-2">
                    {currentRole === "EMPLOYER" ? (
                      <>
                        <Link
                          href="/dashboard/employer/tasks/create"
                          className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => setIsJobsMenuOpen(false)}
                        >
                          <div className="font-medium text-slate-900">Đăng việc</div>
                        </Link>
                        
                        <div className="my-1 h-px bg-slate-100" />
                        
                        <Link
                          href="/dashboard/employer/tasks"
                          className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => setIsJobsMenuOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">Công việc của tôi</span>
                            <span className="text-slate-500">0</span>
                          </div>
                        </Link>

                        <Link
                          href="/dashboard/employer/tasks/review"
                          className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => setIsJobsMenuOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-500">Cần đánh giá</span>
                            <span className="text-slate-500">0</span>
                          </div>
                        </Link>

                        <Link
                          href="/dashboard/employer/tasks/pending"
                          className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => setIsJobsMenuOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-500">Đang chờ admin duyệt</span>
                            <span className="text-slate-500">0</span>
                          </div>
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/viec-lam"
                          className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => setIsJobsMenuOpen(false)}
                        >
                          <div className="font-medium text-slate-900">Tìm việc làm</div>
                        </Link>

                        <Link
                          href="/viec-lam/finished"
                          className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => setIsJobsMenuOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">Nhiệm vụ đã hoàn thành</span>
                            <span className="text-slate-500">0</span>
                          </div>
                        </Link>

                        <Link
                          href="/viec-lam/paid"
                          className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => setIsJobsMenuOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">Đã xác nhận + thanh toán</span>
                            <span className="text-slate-500">0</span>
                          </div>
                        </Link>

                        <Link
                          href="/viec-lam/pending"
                          className="block w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                          onClick={() => setIsJobsMenuOpen(false)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">Đang chờ xét duyệt</span>
                            <span className="text-slate-500">0</span>
                          </div>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }

        // Các link khác vẫn là Link bình thường
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
