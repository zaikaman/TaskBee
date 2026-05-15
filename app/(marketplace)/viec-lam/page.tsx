import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { TaskStatus, UserRole } from "@/lib/generated/prisma/client";
import { loadMarketplaceTasks } from "@/lib/services/marketplace";
import { validateTaskFilter, type TaskFilterInput } from "@/lib/validators/task";
import { MarketplacePageClient } from "./marketplace-page-client";

type MarketplacePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseRewardValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().replaceAll(",", "");

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function parsePageValue(value: string | undefined) {
  if (!value) {
    return 1;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.trunc(parsed);
}

function parseMarketplaceFilters(searchParams: Record<string, string | string[] | undefined>): TaskFilterInput {
  const requestedStatus = firstValue(searchParams.status);
  const allowedStatuses = new Set(Object.values(TaskStatus));
  const status = allowedStatuses.has(requestedStatus as TaskStatus)
    ? (requestedStatus as TaskStatus)
    : TaskStatus.ACTIVE;

  const minReward = parseRewardValue(firstValue(searchParams.minReward));
  const maxReward = parseRewardValue(firstValue(searchParams.maxReward));
  const [normalizedMinReward, normalizedMaxReward] =
    minReward !== undefined && maxReward !== undefined && minReward > maxReward
      ? [maxReward, minReward]
      : [minReward, maxReward];

  return validateTaskFilter({
    search: firstValue(searchParams.search)?.trim() || undefined,
    category: firstValue(searchParams.category)?.trim() || undefined,
    status,
    minReward: normalizedMinReward,
    maxReward: normalizedMaxReward,
    hasAvailableSlots: status === TaskStatus.ACTIVE,
    sortBy: "publishedAt",
    sortOrder: "desc",
    page: parsePageValue(firstValue(searchParams.page)),
    pageSize: 12,
  });
}

export default async function MarketplacePage({ searchParams }: MarketplacePageProps) {
  const [session, rawSearchParams] = await Promise.all([requireRole(UserRole.WORKER), searchParams]);

  if (!session.profile) {
    redirect("/forbidden");
  }

  const filters = parseMarketplaceFilters(rawSearchParams ?? {});
  const marketplace = await loadMarketplaceTasks(filters);

  return (
    <MarketplacePageClient
      categories={marketplace.categories}
      filters={{ ...filters, page: marketplace.page }}
      page={marketplace.page}
      pageSize={marketplace.pageSize}
      tasks={marketplace.tasks}
      totalCount={marketplace.totalCount}
      totalPages={marketplace.totalPages}
    />
  );
}
