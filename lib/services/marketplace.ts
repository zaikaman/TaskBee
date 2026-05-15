import "server-only";

import { Prisma, SubmissionStatus, TaskClaimStatus, TaskStatus } from "@/lib/generated/prisma/client";
import { getPrisma } from "@/lib/db/prisma";
import { serializeTaskForClient, type SerializableTask } from "@/lib/utils/task-serialization";
import type { TaskFilterInput } from "@/lib/validators/task";

type MarketplaceEmployerSummary = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
};

export type MarketplaceTaskListItem = SerializableTask & {
  employer: MarketplaceEmployerSummary;
};

export type MarketplaceTaskClaimSummary = {
  id: string;
  status: TaskClaimStatus;
  claimedAt: Date;
  submittedAt: Date | null;
  expiresAt: Date | null;
  submission: {
    id: string;
    status: SubmissionStatus;
    reviewedAt: Date | null;
  } | null;
};

export type MarketplaceTaskDetail = SerializableTask & {
  employer: MarketplaceEmployerSummary;
  claims: MarketplaceTaskClaimSummary[];
};

export type MarketplaceTasksResult = {
  tasks: MarketplaceTaskListItem[];
  categories: string[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function buildMarketplaceTaskWhere(filters: TaskFilterInput): Prisma.TaskWhereInput {
  const conditions: Prisma.TaskWhereInput[] = [];
  const selectedStatus = filters.status ?? TaskStatus.ACTIVE;

  conditions.push({
    status: selectedStatus,
  });

  if (filters.hasAvailableSlots) {
    conditions.push({
      availableSlots: {
        gt: 0,
      },
    });
  }

  if (filters.category) {
    conditions.push({
      category: filters.category,
    });
  }

  if (filters.minReward !== undefined || filters.maxReward !== undefined) {
    conditions.push({
      rewardAmount: {
        ...(filters.minReward !== undefined ? { gte: new Prisma.Decimal(filters.minReward) } : {}),
        ...(filters.maxReward !== undefined ? { lte: new Prisma.Decimal(filters.maxReward) } : {}),
      },
    });
  }

  if (filters.search) {
    const search = filters.search.trim();

    if (search.length > 0) {
      conditions.push({
        OR: [
          {
            title: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            instructions: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            category: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            subcategory: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      });
    }
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

function buildMarketplaceTaskOrderBy(
  filters: TaskFilterInput,
): Prisma.TaskOrderByWithRelationInput[] {
  const sortOrder = filters.sortOrder ?? "desc";

  switch (filters.sortBy ?? "publishedAt") {
    case "rewardAmount":
      return [
        { rewardAmount: sortOrder },
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ];

    case "availableSlots":
      return [
        { availableSlots: sortOrder },
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ];

    case "createdAt":
      return [
        { createdAt: sortOrder },
        { publishedAt: sortOrder },
      ];

    case "publishedAt":
    default:
      return [
        { publishedAt: sortOrder },
        { createdAt: sortOrder },
      ];
  }
}

export async function loadMarketplaceTasks(
  filters: TaskFilterInput,
): Promise<MarketplaceTasksResult> {
  const prisma = getPrisma();
  const where = buildMarketplaceTaskWhere(filters);

  const [totalCount, categoryRows] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where: {
        status: {
          not: TaskStatus.DRAFT,
        },
        category: {
          not: null,
        },
      },
      distinct: ["category"],
      select: {
        category: true,
      },
      orderBy: {
        category: "asc",
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / filters.pageSize));
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const skip = (page - 1) * filters.pageSize;

  const rawTasks =
    totalCount > 0
      ? await prisma.task.findMany({
          where,
          orderBy: buildMarketplaceTaskOrderBy(filters),
          skip,
          take: filters.pageSize,
          include: {
            employer: {
              select: {
                id: true,
                username: true,
                avatarUrl: true,
              },
            },
          },
        })
      : [];

  const tasks = rawTasks.map((task) => {
    const serializedTask = serializeTaskForClient(task);

    return {
      ...serializedTask,
      employer: task.employer,
    } satisfies MarketplaceTaskListItem;
  });

  const categories = categoryRows
    .map((row) => row.category)
    .filter((category): category is string => typeof category === "string" && category.trim().length > 0)
    .sort((left, right) => left.localeCompare(right, "vi"));

  return {
    tasks,
    categories,
    totalCount,
    page,
    pageSize: filters.pageSize,
    totalPages,
  };
}

export async function loadMarketplaceTask(
  taskId: string,
  workerId?: string,
): Promise<MarketplaceTaskDetail | null> {
  const prisma = getPrisma();

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      status: {
        not: TaskStatus.DRAFT,
      },
    },
    include: {
      employer: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
      ...(workerId
        ? {
            claims: {
              where: {
                workerId,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              include: {
                submission: {
                  select: {
                    id: true,
                    status: true,
                    reviewedAt: true,
                  },
                },
              },
            },
          }
        : {}),
    },
  });

  if (!task) {
    return null;
  }

  const serializedTask = serializeTaskForClient(task);
  const claims = (task.claims ?? []) as unknown as Array<{
    id: string;
    status: TaskClaimStatus;
    claimedAt: Date;
    submittedAt: Date | null;
    expiresAt: Date | null;
    submission: {
      id: string;
      status: SubmissionStatus;
      reviewedAt: Date | null;
    } | null;
  }>;

  return {
    ...serializedTask,
    employer: task.employer,
    claims: claims.map((claim) => ({
      id: claim.id,
      status: claim.status,
      claimedAt: claim.claimedAt,
      submittedAt: claim.submittedAt,
      expiresAt: claim.expiresAt,
      submission: claim.submission
        ? {
            id: claim.submission.id,
            status: claim.submission.status,
            reviewedAt: claim.submission.reviewedAt,
          }
        : null,
    })),
  } satisfies MarketplaceTaskDetail;
}