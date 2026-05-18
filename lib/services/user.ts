"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import { UserStatus } from "@/lib/generated/prisma/client";
import { uploadAvatarImage } from "@/lib/services/storage";

const usernameSchema = z
  .string()
  .trim()
  .min(2, "Tên người dùng phải có ít nhất 2 ký tự.")
  .max(40, "Tên người dùng không được vượt quá 40 ký tự.")
  .regex(
    /^[a-z0-9][a-z0-9._-]*[a-z0-9]$/,
    "Tên người dùng chỉ được dùng chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.",
  );

const profileUpdateSchema = z.object({
  username: usernameSchema,
  avatarUrl: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return undefined;
      }

      const normalized = value.trim();
      return normalized.length > 0 ? normalized : undefined;
    },
    z
      .string()
      .trim()
      .url("Đường dẫn ảnh đại diện không hợp lệ.")
      .max(2048, "Đường dẫn ảnh đại diện quá dài.")
      .optional(),
  ),
});

export type UpdateProfileState = {
  ok: boolean;
  message?: string;
  error?: string;
  fields?: {
    username?: string;
    avatarUrl?: string;
  };
};

const initialUpdateProfileState: UpdateProfileState = {
  ok: false,
};

function parseFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function mapFields(raw: Record<string, FormDataEntryValue>) {
  return {
    username: typeof raw.username === "string" ? normalizeUsername(raw.username) : undefined,
    avatarUrl: typeof raw.avatarUrl === "string" ? raw.avatarUrl.trim() : undefined,
  };
}

function getOptionalFile(raw: Record<string, FormDataEntryValue>, name: string) {
  const value = raw[name];

  if (value instanceof File && value.size > 0) {
    return value;
  }

  return null;
}

export async function updateProfile(
  _prevState: UpdateProfileState = initialUpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const session = await auth();

  void _prevState;
  const profile = session.profile;
  const raw = parseFormData(formData);
  const fields = mapFields(raw);
  const avatarFile = getOptionalFile(raw, "avatarFile");
  const parsed = profileUpdateSchema.safeParse(fields);

  if (!parsed.success) {
    return {
      ok: false,
      fields,
      error: parsed.error.issues[0]?.message ?? "Thông tin hồ sơ không hợp lệ.",
    };
  }

  if (!profile) {
    return {
      ok: false,
      fields,
      error: "Hồ sơ TaskBee chưa được khởi tạo. Vui lòng hoàn tất đăng nhập hoặc thiết lập ban đầu.",
    };
  }

  if (profile.status !== UserStatus.ACTIVE) {
    return {
      ok: false,
      fields,
      error: "Tài khoản đang bị hạn chế nên không thể cập nhật hồ sơ.",
    };
  }

  const prisma = getPrisma();
  const existingUsername = await prisma.user.findFirst({
    where: {
      username: parsed.data.username,
      NOT: {
        id: profile.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingUsername) {
    return {
      ok: false,
      fields,
      error: "Tên người dùng này đã được sử dụng. Vui lòng chọn tên khác.",
    };
  }

  let avatarUrl = parsed.data.avatarUrl ?? null;

  if (avatarFile) {
    try {
      const uploadedAvatar = await uploadAvatarImage({
        userId: profile.id,
        file: avatarFile,
        previousAvatarUrl: profile.avatarUrl,
      });
      avatarUrl = uploadedAvatar.url;
    } catch (error) {
      return {
        ok: false,
        fields,
        error: error instanceof Error ? error.message : "Không thể tải ảnh đại diện lúc này.",
      };
    }
  }

  await prisma.user.update({
    where: {
      id: profile.id,
    },
    data: {
      username: parsed.data.username,
      avatarUrl,
    },
  });

  revalidatePath("/account");

  return {
    ok: true,
    fields: {
      username: parsed.data.username,
      avatarUrl: avatarUrl ?? undefined,
    },
    message: avatarFile ? "Hồ sơ và ảnh đại diện đã được cập nhật." : "Hồ sơ đã được cập nhật.",
  };
}

/**
 * Chuyển vai trò người dùng giữa EMPLOYER và WORKER
 * Quản trị viên không thể tự chuyển vai trò
 */
export async function switchRole(): Promise<{ ok: boolean; error?: string; newRole?: string }> {
  const session = await auth();
  const profile = session.profile;

  if (!profile) {
    return {
      ok: false,
      error: "Hồ sơ TaskBee chưa được khởi tạo.",
    };
  }

  if (profile.status !== UserStatus.ACTIVE) {
    return {
      ok: false,
      error: "Tài khoản đang bị hạn chế nên không thể chuyển đổi vai trò.",
    };
  }

  if (profile.role === "ADMIN") {
    return {
      ok: false,
      error: "Quản trị viên không thể chuyển đổi vai trò.",
    };
  }

  const newRole = profile.role === "EMPLOYER" ? "WORKER" : "EMPLOYER";
  const prisma = getPrisma();

  await prisma.user.update({
    where: {
      id: profile.id,
    },
    data: {
      role: newRole,
    },
  });

  return {
    ok: true,
    newRole,
  };
}
