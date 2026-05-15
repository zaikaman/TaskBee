"use client";

import { useState } from "react";
import { switchRole } from "@/lib/services/user";
import type { UserRole } from "@/lib/generated/prisma/browser";

type RoleSwitcherProps = {
  currentRole: UserRole;
};

export function RoleSwitcher({ currentRole }: RoleSwitcherProps) {
  const [isSwitching, setIsSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't show switcher for admins
  if (currentRole === "ADMIN") {
    return null;
  }

  const isEmployer = currentRole === "EMPLOYER";

  const handleSwitch = async () => {
    setError(null);
    setIsSwitching(true);
    
    try {
      const result = await switchRole();
      
      if (!result.ok) {
        setError(result.error ?? "Không thể chuyển đổi vai trò");
        setIsSwitching(false);
        return;
      }

      // Determine where to redirect based on new role and current path
      const newRole = result.newRole;
      let redirectPath = "/viec-lam"; // Default to marketplace

      // If switching to EMPLOYER, redirect to My Jobs
      if (newRole === "EMPLOYER") {
        redirectPath = "/dashboard/employer/tasks";
      }
      
      // If switching to WORKER, redirect to marketplace
      if (newRole === "WORKER") {
        redirectPath = "/viec-lam";
      }

      // Dùng điều hướng cứng để thoát khỏi tree hiện tại ngay lập tức.
      window.location.assign(redirectPath);
    } catch (err) {
      setError("Đã xảy ra lỗi khi chuyển đổi vai trò");
      setIsSwitching(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span className={`transition-colors ${!isEmployer ? "text-slate-500" : "font-medium text-emerald-700"}`}>
          người thuê
        </span>
        <button
          aria-label={`Chuyển sang ${isEmployer ? "người làm thuê" : "người thuê"}`}
          className="relative inline-flex h-5 w-10 rounded-full bg-slate-200 p-0.5 transition-colors hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSwitching}
          onClick={handleSwitch}
          type="button"
        >
          <span
            className={`size-4 rounded-full bg-emerald-600 shadow-sm transition-transform ${
              isEmployer ? "translate-x-0" : "translate-x-5"
            }`}
          />
        </button>
        <span className={`transition-colors ${isEmployer ? "text-slate-500" : "font-medium text-emerald-700"}`}>
          người làm thuê
        </span>
      </div>
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}
