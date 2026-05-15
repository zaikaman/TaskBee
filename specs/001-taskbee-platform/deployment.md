# Triển khai và Cron Bên Ngoài

## Mục tiêu

TaskBee có thể chạy trên Vercel hoặc bất kỳ nền tảng nào hỗ trợ Next.js App Router. Riêng job auto-approve phải được gọi bởi một external cron service, không dùng Vercel Cron.

## Cấu hình external cron

- Endpoint: `GET` hoặc `POST` `https://<domain>/api/cron/auto-approve`
- Tần suất khuyến nghị: mỗi `5 phút`
- Header bắt buộc: `x-cron-secret: <CRON_SECRET>`
- Route cũng chấp nhận `Authorization: Bearer <CRON_SECRET>` hoặc query `?secret=<CRON_SECRET>` để tiện tích hợp với nhiều nhà cung cấp cron.

## Biến môi trường bắt buộc

- `NEXT_PUBLIC_APP_URL`: URL công khai của ứng dụng.
- `NEXT_PUBLIC_SUPABASE_URL`: URL dự án Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: public anon key cho client.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key cho luồng server.
- `DATABASE_URL`: connection string Prisma dùng để truy cập PostgreSQL.
- `DIRECT_URL`: direct connection string cho migrations và tooling.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_S3_ENDPOINT`: cấu hình Cloudflare R2.
- `R2_PROOF_BUCKET`, `R2_AVATAR_BUCKET`, `R2_PROOF_PUBLIC_BASE_URL`, `R2_AVATAR_PUBLIC_BASE_URL`: bucket và public base URL.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`: cấu hình email.
- `NEXT_PUBLIC_ANALYTICS_ENABLED`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`: cấu hình analytics.
- `CRON_SECRET`: secret dùng chung giữa ứng dụng và external cron service.

## `vercel.json`

File `vercel.json` chỉ dùng cho cấu hình triển khai, không khai báo cron schedule. External cron đã đảm nhận lịch chạy, còn ứng dụng chỉ cần endpoint được bảo vệ bằng secret.

## Checklist production

- Chạy `npm run build` thành công trên môi trường CI hoặc máy build.
- Áp dụng migrations Prisma trên database production.
- Thiết lập đầy đủ các biến môi trường ở trên, đặc biệt là `CRON_SECRET`.
- Cấu hình external cron service gọi đúng endpoint và đúng header secret.
- Kiểm tra endpoint trả `401` khi thiếu hoặc sai secret, và `200` khi hợp lệ.
- Xác minh R2 upload/download, SMTP, và Supabase auth hoạt động trên môi trường production.
- Đảm bảo job cron chạy với tần suất phù hợp, không cần Vercel Cron.
- Xác nhận dashboard và route bảo vệ vẫn hoạt động sau khi deploy.
