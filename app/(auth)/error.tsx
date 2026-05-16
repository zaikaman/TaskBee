"use client";

import { useEffect } from "react";
import { RouteState } from "@/components/ui/route-state";

export default function AuthError({
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
      title="Không thể tải xác thực"
      description="Trang đăng nhập hoặc đăng ký chưa tải được. Vui lòng thử lại sau ít phút."
      primaryHref="/login"
      primaryLabel="Về đăng nhập"
      onRetry={unstable_retry}
    />
  );
}
