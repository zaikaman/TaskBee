import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Cần cấu hình DATABASE_URL để chạy seed dữ liệu.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@taskbee.vn" },
    update: {},
    create: {
      email: "admin@taskbee.vn",
      username: "taskbee-admin",
      role: "ADMIN",
      emailVerified: true,
      availableBalance: "0",
    },
  });

  const employer = await prisma.user.upsert({
    where: { email: "employer@taskbee.vn" },
    update: {},
    create: {
      email: "employer@taskbee.vn",
      username: "demo-employer",
      role: "EMPLOYER",
      emailVerified: true,
      availableBalance: "5000000",
    },
  });

  await prisma.user.upsert({
    where: { email: "worker@taskbee.vn" },
    update: {},
    create: {
      email: "worker@taskbee.vn",
      username: "demo-worker",
      role: "WORKER",
      emailVerified: true,
      availableBalance: "250000",
    },
  });

  const demoTasks = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      title: "Tải ứng dụng, xác minh KYC và gửi ảnh chụp màn hình",
      description: "Cài ứng dụng, hoàn thành KYC và nộp bằng chứng.",
      instructions: "Dùng số điện thoại thật, không trùng lặp thiết bị.",
      proofRequirements: "Ảnh chụp màn hình KYC thành công.",
      category: "Cài ứng dụng",
      rewardAmount: "12000",
      totalSlots: 1200,
      availableSlots: 1072,
      claimedSlots: 128,
      escrowAmount: "14400000",
      platformFeeAmount: "1440000",
      status: "ACTIVE" as const,
      publishedAt: new Date(),
    },
  ];

  for (const task of demoTasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        availableSlots: task.availableSlots,
        claimedSlots: task.claimedSlots,
        status: task.status,
      },
      create: {
        employerId: employer.id,
        ...task,
      },
    });
  }

  await prisma.adminAuditLog.create({
    data: {
      adminId: admin.id,
      action: "USER_ROLE_CHANGED",
      entityType: "seed",
      reason: "Seed dữ liệu demo ban đầu cho TaskBee",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
