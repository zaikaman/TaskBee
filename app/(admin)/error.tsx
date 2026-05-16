"use client";

import { useEffect } from "react";
import { RouteState } from "@/components/ui/route-state";

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteState
      title="Không thể tải trang admin"
      description="Khu vực quản trị đang gặp lỗi tải dữ liệu. Vui lòng thử lại trước khi thao tác với giao dịch hoặc người dùng."
      primaryHref="/admin/dashboard"
      primaryLabel="Về admin"
      onRetry={unstable_retry}
    />
  );
}
