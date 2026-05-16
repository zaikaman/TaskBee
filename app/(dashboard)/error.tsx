"use client";

import { useEffect } from "react";
import { RouteState } from "@/components/ui/route-state";

export default function DashboardError({
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
      title="Không thể tải dashboard"
      description="Dữ liệu tài khoản hoặc ví chưa tải được. Vui lòng thử lại để tiếp tục làm việc."
      primaryHref="/dashboard/profile"
      primaryLabel="Về hồ sơ"
      onRetry={unstable_retry}
    />
  );
}
