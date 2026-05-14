"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";
import { UserRole } from "@/lib/generated/prisma/client";

const registrationSchema = z.object({
  firstName: z.string().trim().min(1, "Vui lòng nhập tên."),
  lastName: z.string().trim().min(1, "Vui lòng nhập họ."),
  nickname: z.string().trim().min(2, "Biệt danh phải có ít nhất 2 ký tự."),
  email: z.string().trim().email("Email không hợp lệ."),
  role: z.enum([UserRole.WORKER, UserRole.EMPLOYER]),
  agreeTerms: z.coerce.boolean(),
  sendUpdates: z.coerce.boolean().optional(),
});

const otpSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ."),
  otp: z.string().trim().regex(/^\d{6}$/, "Mã OTP phải gồm 6 chữ số."),
  role: z.enum([UserRole.WORKER, UserRole.EMPLOYER]),
  nickname: z.string().trim().min(2),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
});

export type RegisterState = {
  phase: "form" | "otp";
  message?: string;
  error?: string;
  email?: string;
  profile?: {
    firstName: string;
    lastName: string;
    nickname: string;
    role: "EMPLOYER" | "WORKER";
  };
};

const initialState: RegisterState = {
  phase: "form",
};

function parseFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function buildUsername(nickname: string, userId: string) {
  const base = nickname
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "user"}-${userId.slice(0, 8)}`;
}

function mapAuthError(error: { message: string }) {
  const message = error.message.toLowerCase();

  if (message.includes("rate")) {
    return "Bạn đang yêu cầu OTP quá nhanh. Vui lòng thử lại sau.";
  }

  if (message.includes("email")) {
    return "Không thể gửi OTP đến email này.";
  }

  return "Không thể xử lý yêu cầu đăng ký lúc này.";
}

export async function requestRegistrationOtp(
  _prevState: RegisterState = initialState,
  formData: FormData,
): Promise<RegisterState> {
  void _prevState;

  const raw = parseFormData(formData);
  const parsed = registrationSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      phase: "form",
      error: parsed.error.issues[0]?.message ?? "Dữ liệu đăng ký không hợp lệ.",
    };
  }

  if (!parsed.data.agreeTerms) {
    return {
      phase: "form",
      error: "Bạn cần đồng ý với điều khoản trước khi tiếp tục.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${appUrl()}/register`,
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        nickname: parsed.data.nickname,
        role: parsed.data.role,
        send_updates: parsed.data.sendUpdates ?? false,
      },
    },
  });

  if (error) {
    return {
      phase: "form",
      error: mapAuthError(error),
    };
  }

  return {
    phase: "otp",
    email: parsed.data.email,
    message: `Mã OTP đã được gửi đến ${parsed.data.email}.`,
    profile: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      nickname: parsed.data.nickname,
      role: parsed.data.role,
    },
  };
}

export async function confirmRegistrationOtp(
  _prevState: RegisterState = initialState,
  formData: FormData,
): Promise<RegisterState> {
  void _prevState;

  const raw = parseFormData(formData);
  const parsed = otpSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      phase: "otp",
      error: parsed.error.issues[0]?.message ?? "Mã OTP không hợp lệ.",
      email: typeof raw.email === "string" ? raw.email : undefined,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.otp,
    type: "email",
  });

  if (error || !data.user) {
    return {
      phase: "otp",
      error: error?.message ?? "Mã OTP chưa đúng hoặc đã hết hạn.",
      email: parsed.data.email,
    };
  }

  const profile = data.user.user_metadata ?? {};
  const role =
    profile.role === UserRole.EMPLOYER || profile.role === UserRole.WORKER
      ? profile.role
      : parsed.data.role;
  const nickname = (profile.nickname as string | undefined) ?? parsed.data.nickname;

  await getPrisma().user.upsert({
    where: { email: parsed.data.email },
    update: {
      username: buildUsername(nickname, data.user.id),
      role,
      emailVerified: true,
      status: "ACTIVE",
    },
    create: {
      id: data.user.id,
      email: parsed.data.email,
      username: buildUsername(nickname, data.user.id),
      role,
      emailVerified: true,
      status: "ACTIVE",
    },
  });

  redirect("/viec-lam?registered=1");
}
