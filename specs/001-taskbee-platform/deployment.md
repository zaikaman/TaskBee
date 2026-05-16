# Triển khai TaskBee trên Vercel

## Mục tiêu

TaskBee chạy production trên Vercel với Next.js App Router, Supabase PostgreSQL, Cloudflare R2, SMTP, PostHog, SePay và USDT deposit provider. Database production phải được migrate bằng Prisma, không reset dữ liệu.

## Cấu hình Vercel

- Build command: `npm run build`
- Install command: mặc định của Vercel, dùng `npm install` hoặc `npm ci` theo lockfile
- Output directory: để Vercel tự nhận diện Next.js
- Node.js version: dùng bản LTS mới nhất Vercel hỗ trợ cho Next.js 16
- Production branch: `main` hoặc branch production bạn chọn

Script `npm run build` đã chạy `prisma generate` trước `next build` để Vercel remote build luôn có Prisma client trong `lib/generated/prisma`.

## Cron production

Mặc định TaskBee dùng external cron cho job auto-approve để deploy được cả trên Vercel Hobby. Theo giới hạn hiện tại của Vercel, cron chạy mỗi 5 phút cần gói Pro; Hobby chỉ phù hợp cron mỗi ngày.

- Endpoint: `GET https://<domain>/api/cron/auto-approve`
- Schedule khuyến nghị: mỗi 5 phút
- Header khuyến nghị: `x-cron-secret: <CRON_SECRET>`
- Secret: đặt cùng một giá trị `CRON_SECRET` trên Vercel và external cron provider

Route hiện tại cũng hỗ trợ `Authorization: Bearer <CRON_SECRET>` và query `?secret=` để tiện test thủ công hoặc đổi provider.

Nếu bạn dùng Vercel Pro và muốn bỏ external cron, có thể thêm đoạn này vào `vercel.json` rồi redeploy:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-approve",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Khi có `CRON_SECRET`, Vercel Cron tự gửi `Authorization: Bearer <CRON_SECRET>` nên route hiện tại đã tương thích.

## Biến môi trường bắt buộc

### App

- `NEXT_PUBLIC_APP_URL`: URL production, ví dụ `https://taskbee.vn`
- `NODE_ENV`: Vercel tự đặt là `production`, không cần thêm thủ công nếu không có lý do riêng

### Supabase Auth / Database

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`: connection string pooled cho runtime
- `DIRECT_URL`: direct connection string cho Prisma migrate/tooling

### Cloudflare R2

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_S3_ENDPOINT`
- `R2_PROOF_BUCKET`
- `R2_AVATAR_BUCKET`
- `R2_PROOF_PUBLIC_BASE_URL`
- `R2_AVATAR_PUBLIC_BASE_URL`

### Email SMTP

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`

### Analytics

- `NEXT_PUBLIC_ANALYTICS_ENABLED`
- `NEXT_PUBLIC_POSTHOG_KEY` hoặc `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`

### Cron

- `CRON_SECRET`: chuỗi random dài, tối thiểu 16 ký tự, nên dùng 32 ký tự trở lên

### SePay

- `SEPAY_API_TOKEN`
- `SEPAY_WEBHOOK_SECRET`
- `SEPAY_MERCHANT_ID`
- `SEPAY_BANK_NAME`
- `SEPAY_BANK_SHORT_NAME`
- `SEPAY_BANK_ACCOUNT_NUMBER`
- `SEPAY_BANK_ACCOUNT_NAME`

### USDT

- `USDT_PROVIDER_API_KEY`
- `USDT_WEBHOOK_SECRET`
- `USDT_TRC20_DEPOSIT_ADDRESS`
- `USDT_BEP20_DEPOSIT_ADDRESS`
- `USDT_ERC20_DEPOSIT_ADDRESS`

Giai đoạn đầu nên chỉ bật USDT TRC20 trong UI/service. ERC20 và BEP20 giữ env sẵn để mở sau khi đã có provider webhook/reconciliation ổn định.

## Quy trình triển khai lần đầu

1. Tạo project trên Vercel và import Git repository.
2. Trong Vercel Project Settings, kiểm tra Framework Preset là Next.js.
3. Thêm toàn bộ biến môi trường ở mục trên vào môi trường Production. Với Preview và Development, chỉ thêm các key cần test.
4. Cập nhật `NEXT_PUBLIC_APP_URL` thành domain production cuối cùng.
5. Trên Supabase, thêm domain production vào cấu hình Auth Redirect URLs:
   - `https://<domain>/verify`
   - `https://<domain>/reset-password`
6. Chạy migration production bằng Prisma:
   - Pull env production về máy hoặc CI an toàn.
   - Chạy `npx prisma migrate deploy`.
   - Không chạy reset database trên production.
7. Deploy production trên Vercel.
8. Kiểm tra build logs và function logs trong dashboard Vercel.
9. Test auth, upload R2, tạo task, rút tiền, cron auto-approve và các webhook payment ở môi trường sandbox/test.

## Lệnh CLI hữu ích

```powershell
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local --yes
npm run build
npx prisma migrate deploy
vercel --prod
```

Nếu muốn link không tương tác, dùng:

```powershell
vercel link --yes --project taskbee --scope <team-or-user-slug>
```

## Checklist production

- `npm run build` pass.
- Prisma migration đã deploy vào database production.
- Không có secret thật trong Git.
- `NEXT_PUBLIC_APP_URL` trỏ đúng domain production.
- Supabase Auth Redirect URLs đã có domain production.
- R2 public base URLs mở được file ảnh avatar/proof.
- SMTP gửi được email verification/reset.
- External cron gọi `/api/cron/auto-approve` và request hợp lệ trả `200`.
- Request cron thiếu secret hoặc sai secret trả `401`.
- SePay webhook dùng HTTPS production URL.
- USDT provider webhook dùng HTTPS production URL và có signature verification trước khi cộng tiền.
- PostHog chỉ bật production khi đã có token đúng.
