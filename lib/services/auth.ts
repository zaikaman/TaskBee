"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";
import { UserRole, UserStatus } from "@/lib/generated/prisma/client";
import { checkRateLimit } from "@/lib/utils/rate-limit";

const OTP_RESEND_COOLDOWN_MS = 60_000;

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

const loginEmailSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ."),
  rememberMe: z.coerce.boolean().optional(),
  redirectTo: z.string().trim().optional(),
});

const loginOtpSchema = z.object({
  email: z.string().trim().email("Email không hợp lệ."),
  otp: z.string().trim().regex(/^\d{6}$/, "Mã OTP phải gồm 6 chữ số."),
  rememberMe: z.coerce.boolean().optional(),
  redirectTo: z.string().trim().optional(),
});

export type RegisterState = {
  phase: "form" | "otp";
  message?: string;
  error?: string;
  email?: string;
  resendAvailableAt?: number;
  profile?: {
    firstName: string;
    lastName: string;
    nickname: string;
    role: "EMPLOYER" | "WORKER";
  };
};

export type LoginState = {
  phase: "form" | "otp";
  message?: string;
  error?: string;
  email?: string;
  rememberMe?: boolean;
  redirectTo?: string;
  resendAvailableAt?: number;
};

const initialState: RegisterState = {
  phase: "form",
};

const initialLoginState: LoginState = {
  phase: "form",
};

function parseFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function buildNicknameSlug(nickname: string) {
  return (
    nickname
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "user"
  );
}

function buildUsername(nickname: string, userId: string) {
  return `${buildNicknameSlug(nickname)}-${userId.slice(0, 8)}`;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeRedirectTo(redirectTo?: string) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/marketplace";
  }

  if (redirectTo.startsWith("/login") || redirectTo.startsWith("/register")) {
    return "/marketplace";
  }

  return redirectTo;
}

function secondsUntil(date: Date, now = new Date()) {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / 1000));
}

async function ensureOtpRateLimitTable() {
  await getPrisma().$executeRaw`
    CREATE TABLE IF NOT EXISTS "RegistrationOtpRequest" (
      "email" TEXT PRIMARY KEY,
      "lastSentAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function reserveOtpEmailSlot(email: string) {
  await ensureOtpRateLimitTable();

  const now = new Date();
  const reusableBefore = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);
  const reservedRows = await getPrisma().$queryRaw<Array<{ lastSentAt: Date }>>`
    INSERT INTO "RegistrationOtpRequest" ("email", "lastSentAt", "createdAt", "updatedAt")
    VALUES (${email}, ${now}, ${now}, ${now})
    ON CONFLICT ("email") DO UPDATE
    SET "lastSentAt" = EXCLUDED."lastSentAt",
        "updatedAt" = EXCLUDED."updatedAt"
    WHERE "RegistrationOtpRequest"."lastSentAt" <= ${reusableBefore}
    RETURNING "lastSentAt"
  `;

  if (reservedRows.length > 0) {
    return { allowed: true, resendAvailableAt: now.getTime() + OTP_RESEND_COOLDOWN_MS };
  }

  const existingRows = await getPrisma().$queryRaw<Array<{ lastSentAt: Date }>>`
    SELECT "lastSentAt"
    FROM "RegistrationOtpRequest"
    WHERE "email" = ${email}
    LIMIT 1
  `;
  const resendAvailableAt =
    (existingRows[0]?.lastSentAt.getTime() ?? now.getTime()) + OTP_RESEND_COOLDOWN_MS;

  return { allowed: false, resendAvailableAt };
}

async function ensureLoginOtpRateLimitTable() {
  await getPrisma().$executeRaw`
    CREATE TABLE IF NOT EXISTS "LoginOtpRequest" (
      "email" TEXT PRIMARY KEY,
      "lastSentAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;
}

async function reserveLoginOtpEmailSlot(email: string) {
  await ensureLoginOtpRateLimitTable();

  const now = new Date();
  const reusableBefore = new Date(now.getTime() - OTP_RESEND_COOLDOWN_MS);
  const reservedRows = await getPrisma().$queryRaw<Array<{ lastSentAt: Date }>>`
    INSERT INTO "LoginOtpRequest" ("email", "lastSentAt", "createdAt", "updatedAt")
    VALUES (${email}, ${now}, ${now}, ${now})
    ON CONFLICT ("email") DO UPDATE
    SET "lastSentAt" = EXCLUDED."lastSentAt",
        "updatedAt" = EXCLUDED."updatedAt"
    WHERE "LoginOtpRequest"."lastSentAt" <= ${reusableBefore}
    RETURNING "lastSentAt"
  `;

  if (reservedRows.length > 0) {
    return { allowed: true, resendAvailableAt: now.getTime() + OTP_RESEND_COOLDOWN_MS };
  }

  const existingRows = await getPrisma().$queryRaw<Array<{ lastSentAt: Date }>>`
    SELECT "lastSentAt"
    FROM "LoginOtpRequest"
    WHERE "email" = ${email}
    LIMIT 1
  `;
  const resendAvailableAt =
    (existingRows[0]?.lastSentAt.getTime() ?? now.getTime()) + OTP_RESEND_COOLDOWN_MS;

  return { allowed: false, resendAvailableAt };
}

async function emailAlreadyRegistered(email: string) {
  const existingUser = await getPrisma().user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return true;
  }

  const existingAuthUsers = await getPrisma().$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM auth.users
    WHERE lower(email) = lower(${email})
      AND deleted_at IS NULL
    LIMIT 1
  `;

  return existingAuthUsers.length > 0;
}

async function emailCanLogin(email: string) {
  const existingUser = await getPrisma().user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    return true;
  }

  const existingAuthUsers = await getPrisma().$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM auth.users
    WHERE lower(email) = lower(${email})
      AND deleted_at IS NULL
    LIMIT 1
  `;

  return existingAuthUsers.length > 0;
}

async function nicknameAlreadyRegistered(nickname: string) {
  const nicknameSlug = buildNicknameSlug(nickname);
  const existingUser = await getPrisma().user.findFirst({
    where: {
      username: {
        startsWith: `${nicknameSlug}-`,
      },
    },
    select: { id: true },
  });

  if (existingUser) {
    return true;
  }

  const existingAuthUsers = await getPrisma().$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM auth.users
    WHERE lower(raw_user_meta_data ->> 'nickname') = lower(${nickname})
      AND deleted_at IS NULL
    LIMIT 1
  `;

  return existingAuthUsers.length > 0;
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

function mapLoginAuthError(error: { message: string }) {
  const message = error.message.toLowerCase();

  if (message.includes("rate")) {
    return "Bạn đang yêu cầu OTP quá nhanh. Vui lòng thử lại sau.";
  }

  if (message.includes("invalid") || message.includes("expired")) {
    return "Mã OTP chưa đúng hoặc đã hết hạn.";
  }

  return "Không thể xử lý đăng nhập lúc này. Vui lòng thử lại sau.";
}

function buildTooManyAttemptsMessage(retryAfterSeconds: number) {
  return `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${retryAfterSeconds} giây.`;
}

export async function requestRegistrationOtp(
  _prevState: RegisterState = initialState,
  formData: FormData,
): Promise<RegisterState> {
  const raw = parseFormData(formData);
  const parsed = registrationSchema.safeParse(raw);

  if (!parsed.success) {
    const rateLimit = await checkRateLimit({
      scope: "auth:register:invalid",
      key: null,
      limit: 20,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return {
        phase: "form",
        error: buildTooManyAttemptsMessage(rateLimit.retryAfterSeconds),
      };
    }

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

  const email = normalizeEmail(parsed.data.email);
  const rateLimit = await checkRateLimit({
    scope: "auth:register:request",
    key: email,
    limit: 5,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) {
    return {
      phase: "form",
      error: buildTooManyAttemptsMessage(rateLimit.retryAfterSeconds),
    };
  }

  const profile = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    nickname: parsed.data.nickname,
    role: parsed.data.role,
  };

  if (await emailAlreadyRegistered(email)) {
    return {
      phase: "form",
      error: "Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.",
    };
  }

  if (await nicknameAlreadyRegistered(parsed.data.nickname)) {
    return {
      phase: "form",
      error: "Biệt danh này đã được sử dụng. Vui lòng chọn biệt danh khác.",
    };
  }

  const emailSlot = await reserveOtpEmailSlot(email);

  if (!emailSlot.allowed) {
    const retryAfterSeconds = secondsUntil(new Date(emailSlot.resendAvailableAt));

    return {
      phase: "otp",
      email,
      profile,
      resendAvailableAt: emailSlot.resendAvailableAt,
      error: `Vui lòng chờ ${retryAfterSeconds} giây trước khi gửi lại mã OTP.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
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
      phase: _prevState.phase,
      email,
      profile,
      resendAvailableAt: emailSlot.resendAvailableAt,
      error: mapAuthError(error),
    };
  }

  return {
    phase: "otp",
    email,
    message: `Mã OTP đã được gửi đến ${email}.`,
    resendAvailableAt: emailSlot.resendAvailableAt,
    profile,
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

  const rateLimit = await checkRateLimit({
    scope: "auth:register:confirm",
    key: normalizeEmail(parsed.data.email),
    limit: 10,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) {
    return {
      phase: "otp",
      error: buildTooManyAttemptsMessage(rateLimit.retryAfterSeconds),
      email: parsed.data.email,
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

  // Redirect based on role
  if (role === UserRole.EMPLOYER) {
    redirect("/dashboard/employer/tasks?registered=1");
  } else {
    redirect("/marketplace?registered=1");
  }
}

export async function requestLoginOtp(
  _prevState: LoginState = initialLoginState,
  formData: FormData,
): Promise<LoginState> {
  const raw = parseFormData(formData);
  const parsed = loginEmailSchema.safeParse(raw);

  if (!parsed.success) {
    const rateLimit = await checkRateLimit({
      scope: "auth:login:invalid",
      key: null,
      limit: 20,
      windowSeconds: 60,
    });

    if (!rateLimit.allowed) {
      return {
        phase: "form",
        error: buildTooManyAttemptsMessage(rateLimit.retryAfterSeconds),
      };
    }

    return {
      phase: "form",
      error: parsed.error.issues[0]?.message ?? "Dữ liệu đăng nhập không hợp lệ.",
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const rateLimit = await checkRateLimit({
    scope: "auth:login:request",
    key: email,
    limit: 8,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) {
    return {
      phase: "form",
      email,
      error: buildTooManyAttemptsMessage(rateLimit.retryAfterSeconds),
    };
  }

  const redirectTo = normalizeRedirectTo(parsed.data.redirectTo);
  const rememberMe = parsed.data.rememberMe ?? false;
  const emailSlot = await reserveLoginOtpEmailSlot(email);

  if (!emailSlot.allowed) {
    const retryAfterSeconds = secondsUntil(new Date(emailSlot.resendAvailableAt));

    return {
      phase: "otp",
      email,
      rememberMe,
      redirectTo,
      resendAvailableAt: emailSlot.resendAvailableAt,
      error: `Vui lòng chờ ${retryAfterSeconds} giây trước khi gửi lại mã OTP.`,
    };
  }

  if (!(await emailCanLogin(email))) {
    return {
      phase: "form",
      email,
      rememberMe,
      redirectTo,
      resendAvailableAt: emailSlot.resendAvailableAt,
      message: "Nếu email đã có tài khoản TaskBee, mã OTP sẽ được gửi trong ít phút.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl()}/login`,
    },
  });

  if (error) {
    return {
      phase: _prevState.phase,
      email,
      rememberMe,
      redirectTo,
      resendAvailableAt: emailSlot.resendAvailableAt,
      error: mapLoginAuthError(error),
    };
  }

  return {
    phase: "otp",
    email,
    rememberMe,
    redirectTo,
    resendAvailableAt: emailSlot.resendAvailableAt,
    message: `Mã OTP đã được gửi đến ${email}.`,
  };
}

export async function confirmLoginOtp(
  _prevState: LoginState = initialLoginState,
  formData: FormData,
): Promise<LoginState> {
  void _prevState;

  const raw = parseFormData(formData);
  const parsed = loginOtpSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      phase: "otp",
      error: parsed.error.issues[0]?.message ?? "Mã OTP không hợp lệ.",
      email: typeof raw.email === "string" ? raw.email : undefined,
      redirectTo: typeof raw.redirectTo === "string" ? normalizeRedirectTo(raw.redirectTo) : undefined,
    };
  }

  const email = normalizeEmail(parsed.data.email);
  const rateLimit = await checkRateLimit({
    scope: "auth:login:confirm",
    key: email,
    limit: 10,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) {
    return {
      phase: "otp",
      error: buildTooManyAttemptsMessage(rateLimit.retryAfterSeconds),
      email,
      rememberMe: parsed.data.rememberMe ?? false,
      redirectTo: normalizeRedirectTo(parsed.data.redirectTo),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token: parsed.data.otp,
    type: "email",
  });

  if (error || !data.user) {
    return {
      phase: "otp",
      error: error ? mapLoginAuthError(error) : "Mã OTP chưa đúng hoặc đã hết hạn.",
      email,
      rememberMe: parsed.data.rememberMe ?? false,
      redirectTo: normalizeRedirectTo(parsed.data.redirectTo),
    };
  }

  const metadata = data.user.user_metadata ?? {};
  const fallbackNickname = email.split("@")[0] || "user";
  const nickname = (metadata.nickname as string | undefined) ?? fallbackNickname;
  const role =
    metadata.role === UserRole.ADMIN ||
    metadata.role === UserRole.EMPLOYER ||
    metadata.role === UserRole.WORKER
      ? metadata.role
      : UserRole.WORKER;

  const profile = await getPrisma().user.upsert({
    where: { email },
    update: {
      emailVerified: true,
    },
    create: {
      id: data.user.id,
      email,
      username: buildUsername(nickname, data.user.id),
      role,
      emailVerified: true,
      status: UserStatus.ACTIVE,
    },
  });

  if (profile.status !== UserStatus.ACTIVE) {
    return {
      phase: "form",
      email,
      error: "Tài khoản của bạn đang bị hạn chế. Vui lòng liên hệ bộ phận hỗ trợ.",
    };
  }

  // Redirect based on user role
  let finalRedirect = normalizeRedirectTo(parsed.data.redirectTo);
  
  // If default redirect (/marketplace), use role-specific default
  if (finalRedirect === "/marketplace") {
    if (profile.role === UserRole.EMPLOYER) {
      finalRedirect = "/dashboard/employer/tasks";
    } else if (profile.role === UserRole.ADMIN) {
      finalRedirect = "/dashboard/admin";
    }
    // WORKER stays at /marketplace
  }

  redirect(finalRedirect);
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Không thể đăng xuất lúc này. Vui lòng thử lại.");
  }

  redirect("/login");
}
