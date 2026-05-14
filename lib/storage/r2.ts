import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { PutObjectCommandInput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

export type R2BucketKey = "avatar" | "proof";

type R2Body =
  | PutObjectCommandInput["Body"]
  | ArrayBuffer
  | ArrayBufferView;

type R2ClientConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
};

const R2_REGION = "auto";

let r2Client: S3Client | null = null;

function readRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Cần cấu hình ${name} để dùng Cloudflare R2.`);
  }

  return value;
}

function getR2ClientConfig(): R2ClientConfig {
  const accountId = readRequiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = readRequiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = readRequiredEnv("R2_SECRET_ACCESS_KEY");
  const endpoint =
    process.env.R2_S3_ENDPOINT ??
    `https://${accountId}.r2.cloudflarestorage.com`;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    endpoint,
  };
}

function createR2Client() {
  const config = getR2ClientConfig();

  return new S3Client({
    region: R2_REGION,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

function getR2Client() {
  if (!r2Client) {
    r2Client = createR2Client();
  }

  return r2Client;
}

export function getR2BucketName(bucketKey: R2BucketKey) {
  if (bucketKey === "avatar") {
    return readRequiredEnv("R2_AVATAR_BUCKET");
  }

  return readRequiredEnv("R2_PROOF_BUCKET");
}

export function getR2PublicBaseUrl(bucketKey: R2BucketKey) {
  const envName =
    bucketKey === "avatar"
      ? "R2_AVATAR_PUBLIC_BASE_URL"
      : "R2_PROOF_PUBLIC_BASE_URL";

  const baseUrl = process.env[envName];

  if (!baseUrl) {
    throw new Error(
      `Cần cấu hình ${envName} để tạo URL công khai cho tệp R2.`,
    );
  }

  return baseUrl.replace(/\/+$/, "");
}

export function createR2ObjectKey(
  prefix: string,
  fileName: string,
  entropy = randomUUID(),
) {
  const safePrefix = prefix.replace(/^\/+|\/+$/g, "");
  const safeName = fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${safePrefix}/${entropy}-${safeName}`;
}

function encodeR2ObjectKey(key: string) {
  return key
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeR2Body(body: R2Body): PutObjectCommandInput["Body"] {
  if (body instanceof ArrayBuffer) {
    return new Uint8Array(body);
  }

  if (ArrayBuffer.isView(body)) {
    return new Uint8Array(body.buffer, body.byteOffset, body.byteLength);
  }

  return body;
}

export function buildR2PublicUrl(bucketKey: R2BucketKey, key: string) {
  const baseUrl = getR2PublicBaseUrl(bucketKey);
  return `${baseUrl}/${encodeR2ObjectKey(key)}`;
}

export async function uploadR2Object(params: {
  bucketKey: R2BucketKey;
  key: string;
  body: R2Body;
  contentType?: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
}) {
  const bucketName = getR2BucketName(params.bucketKey);

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: params.key.replace(/^\/+/, ""),
      Body: normalizeR2Body(params.body),
      ContentType: params.contentType,
      CacheControl: params.cacheControl,
      Metadata: params.metadata,
    }),
  );

  return {
    bucketName,
    key: params.key.replace(/^\/+/, ""),
    url: buildR2PublicUrl(params.bucketKey, params.key),
  };
}

export async function deleteR2Object(params: {
  bucketKey: R2BucketKey;
  key: string;
}) {
  const bucketName = getR2BucketName(params.bucketKey);

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: params.key.replace(/^\/+/, ""),
    }),
  );
}

export async function createR2ReadSignedUrl(params: {
  bucketKey: R2BucketKey;
  key: string;
  expiresInSeconds?: number;
}) {
  const bucketName = getR2BucketName(params.bucketKey);

  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({
      Bucket: bucketName,
      Key: params.key.replace(/^\/+/, ""),
    }),
    {
      expiresIn: params.expiresInSeconds ?? 60 * 15,
    },
  );
}

export async function createR2UploadSignedUrl(params: {
  bucketKey: R2BucketKey;
  key: string;
  expiresInSeconds?: number;
  contentType?: string;
}) {
  const bucketName = getR2BucketName(params.bucketKey);

  return getSignedUrl(
    getR2Client(),
    new PutObjectCommand({
      Bucket: bucketName,
      Key: params.key.replace(/^\/+/, ""),
      ContentType: params.contentType,
    }),
    {
      expiresIn: params.expiresInSeconds ?? 60 * 15,
    },
  );
}
