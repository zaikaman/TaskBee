import posthog from "posthog-js";

const posthogToken =
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
const analyticsEnabled =
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === "true" ||
  (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "false");

if (analyticsEnabled && posthogToken) {
  posthog.init(posthogToken, {
    api_host: "/ingest",
    ui_host: posthogHost.replace("i.posthog.com", "posthog.com"),
    defaults: "2026-01-30",
    capture_exceptions: true,
    capture_pageview: "history_change",
    advanced_disable_flags: true,
    disable_session_recording: true,
    disable_surveys: true,
    debug: false,
  });
}

// QUAN TRỌNG: Không kết hợp cách tiếp cận này với các cách khởi tạo PostHog phía client khác,
// đặc biệt là các component như PostHogProvider.
// instrumentation-client.ts là giải pháp đúng để khởi tạo PostHog phía client trong Next.js 15.3+.
