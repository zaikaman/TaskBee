import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/server";
import { getPrisma } from "@/lib/db/prisma";
import { UserRole, UserStatus, type User } from "@/lib/generated/prisma/client";

export type SessionUser = {
  authId: string;
  email: string | null;
  emailVerified: boolean;
  profile: User | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const profile = await getPrisma().user.findUnique({
    where: { id: user.id },
  });

  return {
    authId: user.id,
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
    profile,
  };
}

export async function requireAuth(redirectTo = "/login") {
  const session = await getCurrentUser();

  if (!session) {
    redirect(redirectTo);
  }

  return session;
}

export function auth(
  roles?: UserRole | UserRole[],
  options?: { required?: true; verified?: boolean; redirectTo?: string },
): Promise<SessionUser>;
export function auth(
  roles: UserRole | UserRole[] | undefined,
  options: { required: false; verified?: boolean; redirectTo?: string },
): Promise<SessionUser | null>;
export async function auth(
  roles?: UserRole | UserRole[],
  options: { required?: boolean; verified?: boolean; redirectTo?: string } = {},
) {
  const { required = true, verified = true, redirectTo = "/login" } = options;
  const session = required ? await requireAuth(redirectTo) : await getCurrentUser();

  if (!session) {
    return null;
  }

  if (verified && (!session.emailVerified || !session.profile?.emailVerified)) {
    redirect("/verify");
  }

  if (roles) {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!session.profile || !allowedRoles.includes(session.profile.role)) {
      redirect("/forbidden");
    }
  }

  if (session.profile?.status !== UserStatus.ACTIVE) {
    redirect("/account-suspended");
  }

  return session;
}

export async function requireVerifiedUser() {
  const session = await requireAuth();

  if (!session.emailVerified || !session.profile?.emailVerified) {
    redirect("/verify");
  }

  return session;
}

export async function requireRole(roles: UserRole | UserRole[]) {
  const session = await requireVerifiedUser();
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!session.profile || !allowedRoles.includes(session.profile.role)) {
    redirect("/forbidden");
  }

  if (session.profile.status !== UserStatus.ACTIVE) {
    redirect("/account-suspended");
  }

  return session;
}

export function canActAs(session: SessionUser | null, role: UserRole) {
  return (
    session?.emailVerified === true &&
    session.profile?.emailVerified === true &&
    session.profile.status === UserStatus.ACTIVE &&
    session.profile.role === role
  );
}
