import "server-only";

import nodemailer from "nodemailer";
import { APP_NAME } from "@/config/app";
import { getPrisma } from "@/lib/db/prisma";
import { NotificationType, Prisma } from "@/lib/generated/prisma/client";

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type NotifyUserInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
  email?: {
    subject?: string;
    html?: string;
  };
};

let transporter: nodemailer.Transporter | null = null;

function isEmailEnabled() {
  return (
    process.env.SMTP_HOST?.trim() &&
    process.env.SMTP_PORT?.trim() &&
    process.env.SMTP_USER?.trim() &&
    process.env.SMTP_PASSWORD?.trim() &&
    process.env.SMTP_FROM_EMAIL?.trim()
  );
}

function getTransporter() {
  if (!isEmailEnabled()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  return transporter;
}

function getFromAddress() {
  const fromEmail = process.env.SMTP_FROM_EMAIL?.trim();

  if (!fromEmail) {
    return null;
  }

  return `"${APP_NAME}" <${fromEmail}>`;
}

export async function sendTaskBeeEmail(payload: EmailPayload) {
  const mailer = getTransporter();
  const from = getFromAddress();

  if (!mailer || !from) {
    return {
      ok: false,
      skipped: true,
      reason: "SMTP chưa được cấu hình đầy đủ.",
    };
  }

  await mailer.sendMail({
    from,
    sender: from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    headers: {
      "X-TaskBee-Sender": APP_NAME,
    },
  });

  return {
    ok: true,
    skipped: false,
  };
}

export async function createInAppNotification(input: NotifyUserInput) {
  const prisma = getPrisma();

  return prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? Prisma.DbNull,
    },
  });
}

export async function notifyUser(input: NotifyUserInput) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: {
      id: input.userId,
    },
    select: {
      email: true,
    },
  });

  const notification = await createInAppNotification(input);

  if (user?.email && input.email !== null) {
    try {
      await sendTaskBeeEmail({
        to: user.email,
        subject: input.email?.subject ?? input.title,
        text: input.body,
        html: input.email?.html,
      });
    } catch (error) {
      console.error("Không thể gửi email thông báo TaskBee:", error);
    }
  }

  return notification;
}

export async function getUnreadNotificationCount(userId: string) {
  const prisma = getPrisma();

  return prisma.notification.count({
    where: {
      userId,
      readAt: null,
    },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  const prisma = getPrisma();

  return prisma.notification.updateMany({
    where: {
      userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

export async function getRecentNotifications(userId: string, take = 8) {
  const prisma = getPrisma();

  return prisma.notification.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: Math.max(1, Math.min(20, take)),
  });
}
