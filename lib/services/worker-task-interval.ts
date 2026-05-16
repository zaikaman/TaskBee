import "server-only";

import { Prisma } from "@/lib/generated/prisma/client";

export const WORKER_TASK_INTERVAL_INITIAL_SECONDS = 180;
export const WORKER_TASK_INTERVAL_SATISFIED_DELTA_SECONDS = -10;
export const WORKER_TASK_INTERVAL_NOT_SATISFIED_DELTA_SECONDS = 20;
export const WORKER_TASK_INTERVAL_SPAM_PROOF_DELTA_SECONDS = 60;

export type WorkerTaskIntervalReason =
  | "SATISFIED_TASK"
  | "NOT_SATISFIED_TASK"
  | "SYSTEM_BLOCKED_SPAM_PROOF";

type WorkerTaskIntervalSnapshot = {
  submitTaskIntervalSeconds: number;
  lastTaskCompletedAt: Date | null;
};

type WorkerTaskIntervalClient = Prisma.TransactionClient;

export class WorkerTaskIntervalError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "WorkerTaskIntervalError";
  }
}

export function normalizeWorkerTaskIntervalSeconds(value: number) {
  if (!Number.isFinite(value)) {
    return WORKER_TASK_INTERVAL_INITIAL_SECONDS;
  }

  return Math.max(0, Math.floor(value));
}

export function calculateWorkerTaskIntervalSeconds(currentSeconds: number, deltaSeconds: number) {
  return normalizeWorkerTaskIntervalSeconds(currentSeconds + deltaSeconds);
}

export function getSubmitTaskCooldownRemainingSeconds(
  snapshot: WorkerTaskIntervalSnapshot,
  now = new Date(),
) {
  const intervalSeconds = normalizeWorkerTaskIntervalSeconds(snapshot.submitTaskIntervalSeconds);

  if (!snapshot.lastTaskCompletedAt || intervalSeconds <= 0) {
    return 0;
  }

  const availableAt = snapshot.lastTaskCompletedAt.getTime() + intervalSeconds * 1000;

  return Math.max(0, Math.ceil((availableAt - now.getTime()) / 1000));
}

function formatCooldownMessage(remainingSeconds: number) {
  return `Bạn cần chờ thêm ${remainingSeconds} giây trước khi gửi bằng chứng cho task tiếp theo.`;
}

export async function assertWorkerCanSubmitTask(
  tx: WorkerTaskIntervalClient,
  workerId: string,
  now = new Date(),
) {
  const worker = await tx.user.findUnique({
    where: {
      id: workerId,
    },
    select: {
      submitTaskIntervalSeconds: true,
      lastTaskCompletedAt: true,
    },
  });

  if (!worker) {
    throw new WorkerTaskIntervalError("Không tìm thấy tài khoản worker.", 0);
  }

  const remainingSeconds = getSubmitTaskCooldownRemainingSeconds(worker, now);

  if (remainingSeconds > 0) {
    throw new WorkerTaskIntervalError(formatCooldownMessage(remainingSeconds), remainingSeconds);
  }

  return {
    submitTaskIntervalSeconds: normalizeWorkerTaskIntervalSeconds(worker.submitTaskIntervalSeconds),
    remainingSeconds,
  };
}

export async function applyWorkerTaskIntervalAdjustment(
  tx: WorkerTaskIntervalClient,
  workerId: string,
  deltaSeconds: number,
  reason: WorkerTaskIntervalReason,
  now = new Date(),
) {
  await tx.$executeRaw(
    Prisma.sql`
      UPDATE "User"
      SET
        "submitTaskIntervalSeconds" = GREATEST(0, "submitTaskIntervalSeconds" + ${deltaSeconds}),
        "lastTaskCompletedAt" = CASE
          WHEN ${reason} = 'SATISFIED_TASK' THEN ${now}
          ELSE "lastTaskCompletedAt"
        END
      WHERE "id" = ${workerId}::uuid
    `,
  );

  return tx.user.findUniqueOrThrow({
    where: {
      id: workerId,
    },
    select: {
      submitTaskIntervalSeconds: true,
      lastTaskCompletedAt: true,
    },
  });
}

export function getWithdrawalIntervalRequirementMessage(intervalSeconds: number) {
  return `Bạn cần đưa bộ đếm interval về 0 giây trước khi rút tiền. Interval hiện tại còn ${normalizeWorkerTaskIntervalSeconds(intervalSeconds)} giây.`;
}
