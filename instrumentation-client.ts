import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  // Bao gồm tùy chọn defaults theo yêu cầu của PostHog
  defaults: "2026-01-30",
  // Bật tính năng theo dõi lỗi chưa được xử lý
  capture_exceptions: true,
  // Bật chế độ debug trong môi trường phát triển
  debug: process.env.NODE_ENV === "development",
});

// QUAN TRỌNG: Không kết hợp cách tiếp cận này với các cách khởi tạo PostHog phía client khác,
// đặc biệt là các component như PostHogProvider.
// instrumentation-client.ts là giải pháp đúng để khởi tạo PostHog phía client trong Next.js 15.3+.
