"use client";

import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/lib/generated/prisma/client";

type NotificationCenterProps = {
  notifications: Notification[];
  unreadCount: number;
};

function formatNotificationTime(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function NotificationCenter({
  notifications,
  unreadCount,
}: NotificationCenterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Thông báo" className="relative">
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] max-w-[calc(100vw-2rem)]">
        <div className="border-b border-zinc-100 px-3 py-2">
          <p className="text-sm font-bold text-zinc-950">Thông báo</p>
          <p className="text-xs text-zinc-500">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Không có thông báo mới"}
          </p>
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-zinc-500">
              Chưa có thông báo nào.
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="rounded-md px-3 py-2.5 text-left hover:bg-zinc-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-950">
                    {notification.title}
                  </p>
                  {!notification.readAt ? (
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-5 text-zinc-600">{notification.body}</p>
                <p className="mt-2 text-[11px] font-medium text-zinc-400">
                  {formatNotificationTime(notification.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
