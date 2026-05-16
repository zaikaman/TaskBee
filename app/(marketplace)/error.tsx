"use client";

import { useEffect } from "react";
import { RouteState } from "@/components/ui/route-state";

export default function MarketplaceError({
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
      title="Không thể tải marketplace"
      description="Danh sách việc chưa tải được. Vui lòng thử lại để xem các việc đang mở."
      primaryHref="/marketplace"
      primaryLabel="Về marketplace"
      onRetry={unstable_retry}
    />
  );
}
