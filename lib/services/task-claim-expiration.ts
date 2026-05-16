import { getPrisma } from "@/lib/db/prisma";
import {
  Prisma,
  TaskClaimStatus,
  TaskStatus,
} from "@/lib/generated/prisma/client";

type ExpireTaskClaimsOptions = {
  now?: Date;
  taskId?: string;
  workerId?: string;
  limit?: number;
};

export type ExpireTaskClaimsResult = {
  expiredCount: number;
  affectedTaskIds: string[];
};

const DEFAULT_EXPIRE_BATCH_SIZE = 500;

export function getTaskClaimExpiresAt(holdTimeMinutes: number, now = new Date()) {
  return new Date(now.getTime() + holdTimeMinutes * 60 * 1000);
}

export async function expireStaleTaskClaims(
  options: ExpireTaskClaimsOptions = {},
): Promise<ExpireTaskClaimsResult> {
  const prisma = getPrisma();
  const now = options.now ?? new Date();
  const limit = options.limit ?? DEFAULT_EXPIRE_BATCH_SIZE;

  return prisma.$transaction(async (tx) =>
    expireStaleTaskClaimsTransaction(tx, {
      ...options,
      now,
      limit,
    }),
  );
}

export async function expireStaleTaskClaimsTransaction(
  tx: Prisma.TransactionClient,
  options: Required<Pick<ExpireTaskClaimsOptions, "now" | "limit">> &
    Pick<ExpireTaskClaimsOptions, "taskId" | "workerId">,
): Promise<ExpireTaskClaimsResult> {
  const expiredClaims = await tx.taskClaim.findMany({
    where: {
      status: TaskClaimStatus.CLAIMED,
      expiresAt: {
        lte: options.now,
      },
      ...(options.taskId ? { taskId: options.taskId } : {}),
      ...(options.workerId ? { workerId: options.workerId } : {}),
      submission: null,
      task: {
        status: {
          in: [TaskStatus.ACTIVE, TaskStatus.PAUSED],
        },
      },
    },
    orderBy: {
      expiresAt: "asc",
    },
    take: options.limit,
    select: {
      id: true,
      taskId: true,
    },
  });

  const affectedTaskIds = new Set<string>();
  let expiredCount = 0;

  for (const claim of expiredClaims) {
    const updateResult = await tx.taskClaim.updateMany({
      where: {
        id: claim.id,
        status: TaskClaimStatus.CLAIMED,
        expiresAt: {
          lte: options.now,
        },
        submission: null,
      },
      data: {
        status: TaskClaimStatus.EXPIRED,
      },
    });

    if (updateResult.count !== 1) {
      continue;
    }

    await tx.task.update({
      where: {
        id: claim.taskId,
      },
      data: {
        claimedSlots: {
          decrement: 1,
        },
        availableSlots: {
          increment: 1,
        },
      },
    });

    expiredCount += 1;
    affectedTaskIds.add(claim.taskId);
  }

  return {
    expiredCount,
    affectedTaskIds: [...affectedTaskIds],
  };
}
