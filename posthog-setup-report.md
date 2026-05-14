<wizard-report>
# PostHog post-wizard report

Wizard đã hoàn tất tích hợp PostHog sâu vào dự án TaskBee — nền tảng nhiệm vụ nhỏ cho Việt Nam. Dưới đây là tóm tắt các thay đổi đã thực hiện:

- **`instrumentation-client.ts`** (mới): Khởi tạo PostHog phía client theo chuẩn Next.js 15.3+ sử dụng `instrumentation-client.ts`. Bật tính năng theo dõi lỗi (`capture_exceptions`) và reverse proxy qua `/ingest`.
- **`lib/posthog-server.ts`** (mới): Client PostHog phía server sử dụng `posthog-node`, dùng cho các Server Actions và API routes trong tương lai.
- **`next.config.ts`** (cập nhật): Thêm rewrites để định tuyến `/ingest/*` và `/ingest/static/*` qua reverse proxy của PostHog, giúp tránh bị chặn bởi ad-blocker.
- **`app/page.tsx`** (cập nhật): Chuyển thành client component (`"use client"`) và thêm `posthog.capture()` cho các nút CTA trang chủ (Đăng ký, Đăng nhập, Duyệt việc, Danh mục).
- **`app/(marketplace)/viec-lam/page.tsx`** (cập nhật): Chuyển thành client component và thêm tracking cho các hành động marketplace (xem danh sách, mở chi tiết, ẩn việc, tìm kiếm).
- **`.env.local`** (cập nhật): Đã thiết lập `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` và `NEXT_PUBLIC_POSTHOG_HOST`.

## Sự kiện đã tích hợp

| Tên sự kiện | Mô tả | File |
|---|---|---|
| `landing_register_clicked` | Người dùng nhấn nút Đăng ký hoặc Đăng việc nhỏ trên trang chủ | `app/page.tsx` |
| `landing_login_clicked` | Người dùng nhấn nút Đăng nhập trên trang chủ | `app/page.tsx` |
| `landing_browse_tasks_clicked` | Người dùng nhấn liên kết "hoặc duyệt việc" hoặc nút "Bắt đầu" | `app/page.tsx` |
| `landing_category_clicked` | Người dùng nhấn vào danh mục việc làm trên trang chủ (kèm thuộc tính `category`) | `app/page.tsx` |
| `task_listing_viewed` | Người dùng mở trang danh sách việc làm — đỉnh phễu tìm kiếm việc | `app/(marketplace)/viec-lam/page.tsx` |
| `task_detail_opened` | Người dùng nhấn nút mở chi tiết nhiệm vụ (kèm `task_title`) | `app/(marketplace)/viec-lam/page.tsx` |
| `task_hidden` | Người dùng ẩn một nhiệm vụ trong danh sách (kèm `task_title`) | `app/(marketplace)/viec-lam/page.tsx` |
| `marketplace_searched` | Người dùng tìm kiếm việc làm trong marketplace (kèm `query`) | `app/(marketplace)/viec-lam/page.tsx` |

## Bước tiếp theo

Đã xây dựng dashboard và các insights để theo dõi hành vi người dùng dựa trên các sự kiện vừa tích hợp:

- [Dashboard: Analytics basics](/dashboard/1582662)
- [Xu hướng CTA trang chủ](/insights/dR7wbzuK) — Biểu đồ xu hướng clicks Đăng ký / Đăng nhập / Duyệt việc theo thời gian
- [Phễu chuyển đổi trang chủ → Marketplace](/insights/bmvW9w9T) — Phễu từ click CTA đến xem danh sách việc đến mở chi tiết nhiệm vụ
- [Danh mục được nhấn nhiều nhất](/insights/hS3tDfQq) — Phân tích danh mục nào thu hút người dùng nhất từ trang chủ
- [Tương tác Marketplace](/insights/II9hqwXR) — Theo dõi tất cả hành vi trong trang danh sách việc làm
- [Tổng lượt đăng ký từ trang chủ (30 ngày)](/insights/0UDRvbr3) — Chỉ số chuyển đổi chính của trang chủ

### Agent skill

Thư mục skill của agent đã được lưu trong dự án tại `.claude/skills/integration-nextjs-app-router/`. Bạn có thể sử dụng ngữ cảnh này cho việc phát triển agent tiếp theo khi dùng Claude Code, giúp đảm bảo model cung cấp các cách tiếp cận PostHog mới nhất và chuẩn xác nhất.

</wizard-report>
