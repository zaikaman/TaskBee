import "server-only";

import { headers } from "next/headers";
import { Prisma } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";

export type RateLimitConfig = {
  scope: string;
  limit: number;
  windowSeconds: number;
  key?: string | null;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly result: RateLimitResult,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

const RATE_LIMIT_TABLE_SQL = Prisma.sql`
  CREATE TABLE IF NOT EXISTS "ActionRateLimit" (
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("scope", "key")
  )
`;

let rateLimitTableReady: Promise<unknown> | null = null;

function ensureRateLimitTable() {
  if (!rateLimitTableReady) {
    rateLimitTableReady = getPrisma().$executeRaw(RATE_LIMIT_TABLE_SQL);
  }

  return rateLimitTableReady;
}

async function getRequestFingerprint() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerStore.get("x-real-ip")?.trim();
  const vercelForwardedFor = headerStore.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();

  return forwardedFor || realIp || vercelForwardedFor || "anonymous";
}

function normalizeKey(key: string) {
  return key.trim().toLowerCase().slice(0, 191) || "anonymous";
}

function buildRateLimitMessage(result: RateLimitResult) {
  return `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${result.retryAfterSeconds} giây.`;
}

export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  await ensureRateLimitTable();

  const prisma = getPrisma();
  const now = new Date();
  const resetAt = new Date(now.getTime() + config.windowSeconds * 1000);
  const key = normalizeKey(config.key ?? (await getRequestFingerprint()));

  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "ActionRateLimit" ("scope", "key", "count", "resetAt", "createdAt", "updatedAt")
    VALUES (${config.scope}, ${key}, 1, ${resetAt}, ${now}, ${now})
    ON CONFLICT ("scope", "key") DO UPDATE
    SET
      "count" = CASE
        WHEN "ActionRateLimit"."resetAt" <= ${now} THEN 1
        ELSE "ActionRateLimit"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "ActionRateLimit"."resetAt" <= ${now} THEN ${resetAt}
        ELSE "ActionRateLimit"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `;

  const row = rows[0] ?? { count: 1, resetAt };
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000),
  );
  const remaining = Math.max(0, config.limit - row.count);

  return {
    allowed: row.count <= config.limit,
    remaining,
    resetAt: row.resetAt,
    retryAfterSeconds,
  };
}

export async function enforceRateLimit(config: RateLimitConfig) {
  const result = await checkRateLimit(config);

  if (!result.allowed) {
    throw new RateLimitError(buildRateLimitMessage(result), result);
  }

  return result;
}

export function getRateLimitErrorMessage(error: unknown) {
  return error instanceof RateLimitError ? error.message : null;
}

export function withRateLimit<Args extends unknown[], Result>(
  config: RateLimitConfig | ((...args: Args) => RateLimitConfig | Promise<RateLimitConfig>),
  action: (...args: Args) => Promise<Result>,
) {
  return async (...args: Args): Promise<Result> => {
    const resolvedConfig = typeof config === "function" ? await config(...args) : config;

    await enforceRateLimit(resolvedConfig);

    return action(...args);
  };
}
