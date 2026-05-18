import { getPrisma } from "@/lib/db/prisma";
import {
  SubmissionStatus,
  TaskType,
  TransactionType,
  type User,
} from "@/lib/generated/prisma/client";
import { formatVnd, toMinorUnits, type MoneyInput } from "@/lib/utils/money";

const EARNING_POINT_THRESHOLD_VND = 26_000;
const EARNING_POINT_THRESHOLD_MINOR_UNITS = BigInt(EARNING_POINT_THRESHOLD_VND * 100);
const EARNING_POINTS_PER_THRESHOLD = 40;

export const freelancerPointRules = [
  { rule: "Người làm starter hoàn thành việc starter", points: "30" },
  { rule: "Người làm advanced hoàn thành việc starter", points: "20" },
  { rule: "Người làm advanced hoàn thành việc advanced", points: "30" },
  { rule: "Người làm expert hoàn thành việc starter", points: "10" },
  { rule: "Người làm expert hoàn thành việc advanced", points: "20" },
  { rule: "Người làm expert hoàn thành việc expert", points: "30" },
  { rule: "Task được đánh giá xuất sắc", points: "+ 50% điểm" },
  { rule: `Mỗi ${formatVnd(EARNING_POINT_THRESHOLD_VND)} kiếm được`, points: "40" },
  { rule: "Task bị đánh giá không hài lòng", points: "-50 * cấp người làm" },
  { rule: "Task bị đánh dấu spam/trùng lặp", points: "-200 * cấp người làm" },
  { rule: "1 tuần không hoạt động", points: "-100 * cấp người làm" },
];

export type PublicFreelancerStats = {
  tasksDone: number;
  satisfied: number;
  notSatisfied: number;
  pending: number;
  earned: number;
  earnedPerTask: number;
  submitTaskIntervalSeconds: number;
  lastTaskSubmittedLabel: string;
  allTimeSuccessRate: number;
  temporarySuccessRate: number;
  canSubmitTasks: boolean;
  level: number;
  levelName: "starter" | "advanced" | "expert";
  points: number;
};

export async function getPublicProfileByNickname(nickname: string) {
  const normalizedNickname = decodeURIComponent(nickname).trim();

  if (!normalizedNickname) {
    return null;
  }

  return getPrisma().user.findFirst({
    where: {
      username: {
        equals: normalizedNickname,
        mode: "insensitive",
      },
    },
  });
}

export async function getPublicFreelancerStats(user: User): Promise<PublicFreelancerStats> {
  const prisma = getPrisma();
  const temporaryWindowStart = new Date();
  temporaryWindowStart.setDate(temporaryWindowStart.getDate() - 50);

  const [
    satisfied,
    notSatisfied,
    pending,
    earnedAggregate,
    lastSubmission,
    recentSatisfied,
    recentNotSatisfied,
    approvedSubmissions,
  ] = await Promise.all([
    prisma.submission.count({ where: { workerId: user.id, status: SubmissionStatus.APPROVED } }),
    prisma.submission.count({ where: { workerId: user.id, status: SubmissionStatus.REJECTED } }),
    prisma.submission.count({ where: { workerId: user.id, status: SubmissionStatus.PENDING } }),
    prisma.transaction.aggregate({
      where: { userId: user.id, type: TransactionType.TASK_REWARD },
      _sum: { amount: true },
    }),
    prisma.submission.findFirst({
      where: { workerId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.submission.count({
      where: {
        workerId: user.id,
        status: SubmissionStatus.APPROVED,
        reviewedAt: { gte: temporaryWindowStart },
      },
    }),
    prisma.submission.count({
      where: {
        workerId: user.id,
        status: SubmissionStatus.REJECTED,
        reviewedAt: { gte: temporaryWindowStart },
      },
    }),
    prisma.submission.findMany({
      where: { workerId: user.id, status: SubmissionStatus.APPROVED },
      select: {
        task: {
          select: {
            taskType: true,
          },
        },
      },
    }),
  ]);

  const earned = Number(earnedAggregate._sum.amount?.toString() ?? "0");
  const earningPoints = calculateEarningPoints(earned);
  const allTimeReviewed = satisfied + notSatisfied;
  const recentReviewed = recentSatisfied + recentNotSatisfied;
  const allTimeSuccessRate = allTimeReviewed > 0 ? Math.round((satisfied / allTimeReviewed) * 100) : 0;
  const temporarySuccessRate =
    recentReviewed > 0 ? Math.round((recentSatisfied / recentReviewed) * 100) : 100;
  const taskPoints = approvedSubmissions.reduce((total, submission) => {
    return total + getTaskCompletionPoints(submission.task.taskType);
  }, 0);
  const points = Math.max(0, taskPoints + earningPoints - notSatisfied * 50);
  const level = getFreelancerLevel(points);

  return {
    tasksDone: satisfied,
    satisfied,
    notSatisfied,
    pending,
    earned,
    earnedPerTask: satisfied > 0 ? earned / satisfied : 0,
    submitTaskIntervalSeconds: user.submitTaskIntervalSeconds,
    lastTaskSubmittedLabel: lastSubmission
      ? new Intl.DateTimeFormat("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }).format(lastSubmission.createdAt)
      : "-",
    allTimeSuccessRate,
    temporarySuccessRate,
    canSubmitTasks: temporarySuccessRate >= 75,
    level,
    levelName: getFreelancerLevelName(level),
    points,
  };
}

function getTaskCompletionPoints(taskType: TaskType) {
  if (taskType === TaskType.EXPRESS) return 30;
  if (taskType === TaskType.CLASSIC) return 30;
  return 30;
}

function getFreelancerLevel(points: number) {
  if (points >= 22627) return 8;
  if (points >= 8000) return 4;
  if (points >= 2828) return 2;
  return 0;
}

function getFreelancerLevelName(level: number): "starter" | "advanced" | "expert" {
  if (level >= 8) return "expert";
  if (level >= 4) return "advanced";
  return "starter";
}

function calculateEarningPoints(amount: MoneyInput) {
  const amountMinorUnits = toMinorUnits(amount);
  return Number(amountMinorUnits / EARNING_POINT_THRESHOLD_MINOR_UNITS) * EARNING_POINTS_PER_THRESHOLD;
}
