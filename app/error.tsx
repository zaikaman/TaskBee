"use client";

import { useEffect } from "react";
import { RouteState } from "@/components/ui/route-state";

export default function Error({
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
      title="Có lỗi xảy ra"
      description="TaskBee chưa thể tải nội dung này. Vui lòng thử lại, nếu lỗi tiếp diễn hãy liên hệ quản trị viên với mã lỗi hiển thị trong log hệ thống."
      onRetry={unstable_retry}
    />
  );
}
