"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  AdminAuditAction,
  NotificationType,
  Prisma,
  TransactionType,
  UserRole,
  WithdrawalStatus,
} from "@/lib/generated/prisma/client";
import { formatVnd } from "@/lib/utils/money";

const processWithdrawalSchema = z.object({
  withdrawalId: z.uuid("Mã yêu cầu rút tiền không hợp lệ."),
  action: z.enum(["APPROVE", "REJECT"], {
    error: "Thao tác xử lý rút tiền không hợp lệ.",
  }),
  adminFeedback: z
    .string()
    .trim()
    .max(500, "Ghi chú xử lý không được vượt quá 500 ký tự.")
    .optional(),
});

export type ProcessWithdrawalInput = z.input<typeof processWithdrawalSchema>;

export type ProcessWithdrawalResult = {
  ok: boolean;
  message?: string;
  error?: string;
  withdrawalId?: string;
  status?: WithdrawalStatus;
};

type WithdrawalSnapshot = {
  id: string;
  userId: string;
  amount: string;
  fee: string;
  netAmount: string;
  status: WithdrawalStatus;
  adminFeedback: string | null;
  processedAt: string | null;
};

class ProcessWithdrawalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessWithdrawalError";
  }
}

function normalizeProcessWithdrawalInput(input: ProcessWithdrawalInput | FormData) {
  if (input instanceof FormData) {
    return processWithdrawalSchema.parse({
      withdrawalId: input.get("withdrawalId"),
      action: input.get("action"),
      adminFeedback: input.get("adminFeedback") ?? undefined,
    });
  }

  return processWithdrawalSchema.parse(input);
}

function serializeWithdrawalSnapshot(withdrawal: {
  id: string;
  userId: string;
  amount: Prisma.Decimal;
  fee: Prisma.Decimal;
  netAmount: Prisma.Decimal;
  status: WithdrawalStatus;
  adminFeedback: string | null;
  processedAt: Date | null;
}): WithdrawalSnapshot {
  return {
    id: withdrawal.id,
    userId: withdrawal.userId,
    amount: withdrawal.amount.toString(),
    fee: withdrawal.fee.toString(),
    netAmount: withdrawal.netAmount.toString(),
    status: withdrawal.status,
    adminFeedback: withdrawal.adminFeedback,
    processedAt: withdrawal.processedAt?.toISOString() ?? null,
  };
}

function getValidationErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Dữ liệu xử lý rút tiền không hợp lệ.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Không thể xử lý yêu cầu rút tiền lúc này. Vui lòng thử lại sau.";
}

function normalizeAdminFeedback(action: "APPROVE" | "REJECT", adminFeedback?: string) {
  const feedback = adminFeedback?.trim() ?? "";

  if (action === "REJECT" && feedback.length < 10) {
    throw new ProcessWithdrawalError("Vui lòng nhập lý do từ chối có ít nhất 10 ký tự.");
  }

  if (feedback.length > 0) {
    return feedback;
  }

  return action === "APPROVE"
    ? "Admin đã đối soát và xác nhận yêu cầu rút tiền."
    : "Yêu cầu rút tiền bị từ chối sau khi kiểm tra.";
}

/**
 * Xử lý yêu cầu rút tiền bởi admin.
 *
 * Khi người dùng tạo withdrawal, hệ thống đã chuyển tiền từ available sang pending
 * và ghi ledger âm. Vì vậy approve chỉ tất toán pending, còn reject hoàn tiền về
 * available và ghi một bút toán hoàn tiền để chuỗi ledger khớp số dư ví.
 */
export async function processWithdrawal(
  input: ProcessWithdrawalInput | FormData,
): Promise<ProcessWithdrawalResult> {
  try {
    const session = await requireRole(UserRole.ADMIN);

    if (!session.profile) {
      throw new ProcessWithdrawalError("Không tìm thấy hồ sơ admin để xử lý yêu cầu rút tiền.");
    }

    const adminId = session.profile.id;
    const normalizedInput = normalizeProcessWithdrawalInput(input);
    const adminFeedback = normalizeAdminFeedback(
      normalizedInput.action,
      normalizedInput.adminFeedback,
    );
    const prisma = getPrisma();
    const processedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "Withdrawal" WHERE id = ${normalizedInput.withdrawalId}::uuid FOR UPDATE`,
      );

      const withdrawal = await tx.withdrawal.findUnique({
        where: {
          id: normalizedInput.withdrawalId,
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          fee: true,
          netAmount: true,
          status: true,
          adminFeedback: true,
          processedAt: true,
          user: {
            select: {
              email: true,
              status: true,
              pendingBalance: true,
            },
          },
        },
      });

      if (!withdrawal) {
        throw new ProcessWithdrawalError("Không tìm thấy yêu cầu rút tiền.");
      }

      if (withdrawal.status !== WithdrawalStatus.PENDING) {
        throw new ProcessWithdrawalError(
          `Yêu cầu rút tiền này đã ở trạng thái ${withdrawal.status} nên không thể xử lý lại.`,
        );
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${withdrawal.userId}::uuid FOR UPDATE`,
      );

      const before = serializeWithdrawalSnapshot(withdrawal);
      const nextStatus =
        normalizedInput.action === "APPROVE"
          ? WithdrawalStatus.APPROVED
          : WithdrawalStatus.REJECTED;

      const walletUpdate = await tx.user.updateMany({
        where: {
          id: withdrawal.userId,
          pendingBalance: {
            gte: withdrawal.amount,
          },
        },
        data:
          nextStatus === WithdrawalStatus.APPROVED
            ? {
                pendingBalance: {
                  decrement: withdrawal.amount,
                },
              }
            : {
                pendingBalance: {
                  decrement: withdrawal.amount,
                },
                availableBalance: {
                  increment: withdrawal.amount,
                },
              },
      });

      if (walletUpdate.count !== 1) {
        throw new ProcessWithdrawalError(
          "Số dư đang chờ của người dùng không đủ để xử lý yêu cầu rút tiền này. Vui lòng đối soát ledger trước khi tiếp tục.",
        );
      }

      const updatedWithdrawal = await tx.withdrawal.update({
        where: {
          id: withdrawal.id,
        },
        data: {
          status: nextStatus,
          adminFeedback,
          processedAt,
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          fee: true,
          netAmount: true,
          status: true,
          adminFeedback: true,
          processedAt: true,
        },
      });

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: {
          id: withdrawal.userId,
        },
        select: {
          availableBalance: true,
          pendingBalance: true,
        },
      });

      if (nextStatus === WithdrawalStatus.REJECTED) {
        await tx.transaction.create({
          data: {
            userId: withdrawal.userId,
            type: TransactionType.WITHDRAWAL,
            amount: withdrawal.amount,
            balanceAfter: updatedUser.availableBalance,
            referenceId: withdrawal.id,
            description: `Hoàn lại yêu cầu rút tiền ${formatVnd(withdrawal.amount.toString())} do admin từ chối. Lý do: ${adminFeedback}`,
            metadata: {
              withdrawalId: withdrawal.id,
              rejectedByAdminId: adminId,
              rejectedAt: processedAt.toISOString(),
              refundedAmount: withdrawal.amount.toString(),
              previousStatus: withdrawal.status,
              pendingBalanceAfter: updatedUser.pendingBalance.toString(),
            } satisfies Prisma.InputJsonValue,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: withdrawal.userId,
          type: NotificationType.WITHDRAWAL_STATUS,
          title:
            nextStatus === WithdrawalStatus.APPROVED
              ? "Yêu cầu rút tiền đã được duyệt"
              : "Yêu cầu rút tiền đã bị từ chối",
          body:
            nextStatus === WithdrawalStatus.APPROVED
              ? `Yêu cầu rút ${formatVnd(withdrawal.amount.toString())} đã được duyệt. Số tiền thực nhận là ${formatVnd(withdrawal.netAmount.toString())}.`
              : `Yêu cầu rút ${formatVnd(withdrawal.amount.toString())} đã bị từ chối và tiền đã được hoàn lại vào ví khả dụng.`,
          data: {
            withdrawalId: withdrawal.id,
            status: nextStatus,
            adminFeedback,
            amount: withdrawal.amount.toString(),
            fee: withdrawal.fee.toString(),
            netAmount: withdrawal.netAmount.toString(),
            processedAt: processedAt.toISOString(),
          } satisfies Prisma.InputJsonValue,
        },
      });

      const after = serializeWithdrawalSnapshot(updatedWithdrawal);

      await tx.adminAuditLog.create({
        data: {
          adminId,
          targetUserId: withdrawal.userId,
          action:
            nextStatus === WithdrawalStatus.APPROVED
              ? AdminAuditAction.WITHDRAWAL_APPROVED
              : AdminAuditAction.WITHDRAWAL_REJECTED,
          entityType: "Withdrawal",
          entityId: withdrawal.id,
          before: {
            ...before,
            userEmail: withdrawal.user.email,
            userStatus: withdrawal.user.status,
            pendingBalanceBefore: withdrawal.user.pendingBalance.toString(),
          } satisfies Prisma.InputJsonValue,
          after: {
            ...after,
            pendingBalanceAfter: updatedUser.pendingBalance.toString(),
            availableBalanceAfter: updatedUser.availableBalance.toString(),
          } satisfies Prisma.InputJsonValue,
          reason: adminFeedback,
        },
      });

      return {
        withdrawalId: updatedWithdrawal.id,
        status: updatedWithdrawal.status,
        amount: updatedWithdrawal.amount.toString(),
        netAmount: updatedWithdrawal.netAmount.toString(),
      };
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/withdrawals");
    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/history");

    return {
      ok: true,
      withdrawalId: result.withdrawalId,
      status: result.status,
      message:
        result.status === WithdrawalStatus.APPROVED
          ? `Đã duyệt yêu cầu rút ${formatVnd(result.amount)}. Người dùng nhận ${formatVnd(result.netAmount)} sau phí.`
          : `Đã từ chối yêu cầu rút ${formatVnd(result.amount)} và hoàn tiền về ví khả dụng của người dùng.`,
    };
  } catch (error) {
    if (!(error instanceof ProcessWithdrawalError) && !(error instanceof z.ZodError)) {
      console.error("Lỗi khi admin xử lý yêu cầu rút tiền:", error);
    }

    return {
      ok: false,
      error: getValidationErrorMessage(error),
    };
  }
}
