"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { markAllNotificationsAsRead } from "@/lib/services/notifications";

export async function markCurrentUserNotificationsAsRead() {
  const session = await getCurrentUser();

  if (!session?.profile) {
    return {
      ok: false,
      updatedCount: 0,
      message: "Bạn cần đăng nhập để đánh dấu thông báo đã đọc.",
    };
  }

  const result = await markAllNotificationsAsRead(session.profile.id);

  return {
    ok: true,
    updatedCount: result.count,
    message: "Đã đánh dấu thông báo là đã đọc.",
  };
}
