/**
 * Script kiểm tra kết nối Cloudflare R2 Storage
 * Chạy: npx tsx scripts/test-r2.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import {
  S3Client,
  PutObjectCommand,
  ListBucketsCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const endpoint = process.env.R2_S3_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;
const avatarBucket = process.env.R2_AVATAR_BUCKET ?? "avatars";

console.log("=== Kiểm tra cấu hình R2 ===");
console.log(`Account ID:     ${accountId ? accountId.slice(0, 8) + "..." : "❌ THIẾU"}`);
console.log(`Access Key ID:  ${accessKeyId ? accessKeyId.slice(0, 8) + "..." : "❌ THIẾU"}`);
console.log(`Secret Key:     ${secretAccessKey ? "***" + secretAccessKey.slice(-4) : "❌ THIẾU"}`);
console.log(`Endpoint:       ${endpoint}`);
console.log(`Avatar Bucket:  ${avatarBucket}`);
console.log("");

if (!accountId || !accessKeyId || !secretAccessKey) {
  console.error("❌ Thiếu biến môi trường R2. Kiểm tra .env.local");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

async function testListBuckets() {
  console.log("1️⃣  Thử ListBuckets...");
  try {
    const result = await client.send(new ListBucketsCommand({}));
    const names = result.Buckets?.map((b) => b.Name) ?? [];
    console.log(`   ✅ Tìm thấy ${names.length} bucket(s): ${names.join(", ") || "(rỗng)"}`);

    if (!names.includes(avatarBucket)) {
      console.log(`   ⚠️  Bucket "${avatarBucket}" KHÔNG có trong danh sách. Kiểm tra tên bucket hoặc quyền API token.`);
    }
  } catch (err: unknown) {
    const e = err as Error & { Code?: string; $metadata?: { httpStatusCode?: number } };
    console.log(`   ❌ Lỗi: ${e.message}`);
    console.log(`      Code: ${e.Code ?? "N/A"}, HTTP: ${e.$metadata?.httpStatusCode ?? "N/A"}`);
    if (e.$metadata?.httpStatusCode === 403) {
      console.log(`   → API token có thể thiếu quyền "Admin Read" hoặc "Object Read & Write".`);
    }
  }
}

async function testHeadBucket() {
  console.log(`\n2️⃣  Thử HeadBucket "${avatarBucket}"...`);
  try {
    await client.send(new HeadBucketCommand({ Bucket: avatarBucket }));
    console.log(`   ✅ Bucket "${avatarBucket}" tồn tại và có quyền truy cập.`);
  } catch (err: unknown) {
    const e = err as Error & { Code?: string; $metadata?: { httpStatusCode?: number } };
    console.log(`   ❌ Lỗi: ${e.message}`);
    console.log(`      Code: ${e.Code ?? "N/A"}, HTTP: ${e.$metadata?.httpStatusCode ?? "N/A"}`);
    if (e.$metadata?.httpStatusCode === 404) {
      console.log(`   → Bucket "${avatarBucket}" không tồn tại. Tạo bucket mới trên Cloudflare Dashboard.`);
    } else if (e.$metadata?.httpStatusCode === 403) {
      console.log(`   → API token không có quyền truy cập bucket này.`);
    }
  }
}

async function testPutObject() {
  console.log(`\n3️⃣  Thử PutObject (upload test file) vào "${avatarBucket}"...`);
  const testKey = `_test/health-check-${Date.now()}.txt`;
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: avatarBucket,
        Key: testKey,
        Body: Buffer.from("TaskBee R2 health check"),
        ContentType: "text/plain",
      }),
    );
    console.log(`   ✅ Upload thành công! Key: ${testKey}`);
    console.log(`   → R2 đang hoạt động bình thường, quyền đọc/ghi OK.`);
  } catch (err: unknown) {
    const e = err as Error & { Code?: string; $metadata?: { httpStatusCode?: number } };
    console.log(`   ❌ Lỗi upload: ${e.message}`);
    console.log(`      Code: ${e.Code ?? "N/A"}, HTTP: ${e.$metadata?.httpStatusCode ?? "N/A"}`);
    if (e.$metadata?.httpStatusCode === 403) {
      console.log(`   → API token thiếu quyền WRITE cho bucket "${avatarBucket}".`);
      console.log(`   → Vào Cloudflare Dashboard → R2 → API Tokens → kiểm tra quyền "Object Read & Write" cho bucket.`);
    }
  }
}

async function main() {
  await testListBuckets();
  await testHeadBucket();
  await testPutObject();
  console.log("\n=== Kiểm tra hoàn tất ===");
}

main().catch(console.error);
