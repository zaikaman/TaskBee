import "server-only";

import {
  buildR2PublicUrl,
  createR2ObjectKey,
  deleteR2Object,
  getR2PublicBaseUrl,
  uploadR2Object,
} from "@/lib/storage/r2";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_CACHE_CONTROL = "public, max-age=31536000, immutable";

const avatarContentTypes = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AvatarContentType = keyof typeof avatarContentTypes;

export type UploadedAvatar = {
  key: string;
  url: string;
  contentType: AvatarContentType;
  size: number;
};

function isSupportedAvatarContentType(contentType: string): contentType is AvatarContentType {
  return Object.hasOwn(avatarContentTypes, contentType);
}

async function readFileBytes(file: File) {
  return new Uint8Array(await file.arrayBuffer());
}

function hasJpegSignature(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function hasPngSignature(bytes: Uint8Array) {
  const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return pngHeader.every((byte, index) => bytes[index] === byte);
}

function hasWebpSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

function assertAvatarSignature(contentType: AvatarContentType, bytes: Uint8Array) {
  const valid =
    (contentType === "image/jpeg" && hasJpegSignature(bytes)) ||
    (contentType === "image/png" && hasPngSignature(bytes)) ||
    (contentType === "image/webp" && hasWebpSignature(bytes));

  if (!valid) {
    throw new Error("Tệp ảnh đại diện không đúng định dạng nội dung đã khai báo.");
  }
}

function buildAvatarFileName(contentType: AvatarContentType) {
  return `avatar.${avatarContentTypes[contentType]}`;
}

export function getAvatarObjectKeyFromPublicUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  const baseUrl = getR2PublicBaseUrl("avatar");

  if (!url.startsWith(`${baseUrl}/`)) {
    return null;
  }

  try {
    return new URL(url).pathname
      .replace(/^\/+/, "")
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
}

export async function uploadAvatarImage(params: {
  userId: string;
  file: File;
  previousAvatarUrl?: string | null;
}): Promise<UploadedAvatar> {
  const { file, previousAvatarUrl, userId } = params;

  if (file.size < 1) {
    throw new Error("Vui lòng chọn ảnh đại diện trước khi tải lên.");
  }

  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("Ảnh đại diện không được vượt quá 2 MB.");
  }

  if (!isSupportedAvatarContentType(file.type)) {
    throw new Error("Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP.");
  }

  const bytes = await readFileBytes(file);
  assertAvatarSignature(file.type, bytes);

  const key = createR2ObjectKey(`users/${userId}/avatar`, buildAvatarFileName(file.type));
  const upload = await uploadR2Object({
    bucketKey: "avatar",
    key,
    body: bytes,
    contentType: file.type,
    cacheControl: AVATAR_CACHE_CONTROL,
    metadata: {
      userId,
      purpose: "avatar",
    },
  });

  const previousKey = getAvatarObjectKeyFromPublicUrl(previousAvatarUrl);

  if (previousKey && previousKey !== upload.key) {
    await deleteR2Object({
      bucketKey: "avatar",
      key: previousKey,
    }).catch(() => {
      // Old avatar cleanup is best-effort; the new profile image must not fail because of it.
    });
  }

  return {
    key: upload.key,
    url: buildR2PublicUrl("avatar", upload.key),
    contentType: file.type,
    size: file.size,
  };
}

const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function uploadProofImage(params: {
  userId: string;
  taskId: string;
  file: File;
}): Promise<{ url: string; key: string }> {
  const { file, userId, taskId } = params;

  if (file.size < 1) {
    throw new Error("Vui lòng chọn ảnh bằng chứng trước khi tải lên.");
  }

  if (file.size > PROOF_MAX_BYTES) {
    throw new Error("Ảnh bằng chứng không được vượt quá 5 MB.");
  }

  if (!isSupportedAvatarContentType(file.type)) {
    throw new Error("Ảnh bằng chứng chỉ hỗ trợ JPG, PNG hoặc WebP.");
  }

  const bytes = await readFileBytes(file);
  assertAvatarSignature(file.type as AvatarContentType, bytes);

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const ext = avatarContentTypes[file.type as AvatarContentType];
  const fileName = `proof-${timestamp}-${randomStr}.${ext}`;
  const key = createR2ObjectKey(`tasks/${taskId}/proofs/${userId}`, fileName);

  const upload = await uploadR2Object({
    bucketKey: "proof",
    key,
    body: bytes,
    contentType: file.type,
    cacheControl: PROOF_CACHE_CONTROL,
    metadata: {
      userId,
      taskId,
      purpose: "proof",
    },
  });

  return {
    key: upload.key,
    url: buildR2PublicUrl("proof", upload.key),
  };
}

