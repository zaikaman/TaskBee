"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  AdminAuditAction,
  DepositConfirmationStatus,
  DepositIntentStatus,
  NotificationType,
  Prisma,
  TransactionType,
  UserRole,
  UserStatus,
  WithdrawalStatus,
} from "@/lib/generated/prisma/client";
import { addMoney, formatVnd, fromMinorUnits, toMinorUnits } from "@/lib/utils/money";
import { enforceRateLimit, getRateLimitErrorMessage } from "@/lib/utils/rate-limit";

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

const processDepositExceptionSchema = z.object({
  depositIntentId: z.uuid("Mã lệnh nạp tiền không hợp lệ."),
  action: z.enum(["APPROVE_CREDIT", "REJECT"], {
    error: "Thao tác xử lý nạp tiền không hợp lệ.",
  }),
  creditAmount: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value.replaceAll(",", "") : undefined)),
  reason: z
    .string()
    .trim()
    .min(10, "Vui lòng nhập lý do xử lý có ít nhất 10 ký tự.")
    .max(700, "Lý do xử lý không được vượt quá 700 ký tự."),
});

const updateUserManagementSchema = z.object({
  userId: z.uuid("Mã người dùng không hợp lệ."),
  role: z.enum([UserRole.ADMIN, UserRole.EMPLOYER, UserRole.WORKER]).optional(),
  status: z.enum([UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.BANNED]).optional(),
  reason: z
    .string()
    .trim()
    .min(10, "Vui lòng nhập lý do có ít nhất 10 ký tự.")
    .max(700, "Lý do không được vượt quá 700 ký tự."),
});

export type ProcessWithdrawalInput = z.input<typeof processWithdrawalSchema>;
export type ProcessDepositExceptionInput = z.input<typeof processDepositExceptionSchema>;
export type UpdateUserManagementInput = z.input<typeof updateUserManagementSchema>;

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

class AdminActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminActionError";
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

function normalizeProcessDepositExceptionInput(input: ProcessDepositExceptionInput | FormData) {
  if (input instanceof FormData) {
    return processDepositExceptionSchema.parse({
      depositIntentId: input.get("depositIntentId"),
      action: input.get("action"),
      creditAmount: input.get("creditAmount") ?? undefined,
      reason: input.get("reason"),
    });
  }

  return processDepositExceptionSchema.parse(input);
}

function normalizeUpdateUserManagementInput(input: UpdateUserManagementInput | FormData) {
  if (input instanceof FormData) {
    const role = input.get("role");
    const status = input.get("status");

    return updateUserManagementSchema.parse({
      userId: input.get("userId"),
      role: typeof role === "string" && role.length > 0 ? role : undefined,
      status: typeof status === "string" && status.length > 0 ? status : undefined,
      reason: input.get("reason"),
    });
  }

  return updateUserManagementSchema.parse(input);
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
  const rateLimitMessage = getRateLimitErrorMessage(error);

  if (rateLimitMessage) {
    return rateLimitMessage;
  }

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
    await enforceRateLimit({
      scope: "admin:withdrawal:process",
      key: adminId,
      limit: 120,
      windowSeconds: 60 * 60,
    });

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

export type ProcessDepositExceptionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  depositIntentId?: string;
  status?: DepositIntentStatus;
};

export type UpdateUserManagementResult = {
  ok: boolean;
  message?: string;
  error?: string;
  userId?: string;
};

const depositExceptionStatuses = new Set<DepositIntentStatus>([
  DepositIntentStatus.FAILED,
  DepositIntentStatus.UNDERPAID,
  DepositIntentStatus.OVERPAID,
  DepositIntentStatus.MANUAL_REVIEW_REQUIRED,
]);

function normalizeCreditAmount(value: string | undefined, fallbackAmount: string) {
  const amount = value ?? fallbackAmount;
  const amountMinor = toMinorUnits(amount);

  if (amountMinor <= BigInt(0)) {
    throw new AdminActionError("Số tiền ghi có phải lớn hơn 0.");
  }

  return fromMinorUnits(amountMinor);
}

export async function processDepositException(
  input: ProcessDepositExceptionInput | FormData,
): Promise<ProcessDepositExceptionResult> {
  try {
    const session = await requireRole(UserRole.ADMIN);

    if (!session.profile) {
      throw new AdminActionError("Không tìm thấy hồ sơ admin để xử lý lệnh nạp tiền.");
    }

    const adminId = session.profile.id;
    await enforceRateLimit({
      scope: "admin:deposit:process",
      key: adminId,
      limit: 120,
      windowSeconds: 60 * 60,
    });

    const normalizedInput = normalizeProcessDepositExceptionInput(input);
    const prisma = getPrisma();
    const processedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "DepositIntent" WHERE id = ${normalizedInput.depositIntentId}::uuid FOR UPDATE`,
      );

      const depositIntent = await tx.depositIntent.findUnique({
        where: { id: normalizedInput.depositIntentId },
        select: {
          id: true,
          userId: true,
          amount: true,
          currency: true,
          status: true,
          provider: true,
          providerReference: true,
          providerTransactionId: true,
          providerEventId: true,
          paymentCode: true,
          confirmationStatus: true,
          confirmedAmount: true,
          rawProviderMetadata: true,
          user: {
            select: {
              email: true,
              availableBalance: true,
              status: true,
            },
          },
        },
      });

      if (!depositIntent) {
        throw new AdminActionError("Không tìm thấy lệnh nạp tiền cần xử lý.");
      }

      if (depositIntent.status === DepositIntentStatus.PAID) {
        throw new AdminActionError("Lệnh nạp tiền đã được ghi có trước đó nên không thể xử lý lại.");
      }

      if (!depositExceptionStatuses.has(depositIntent.status)) {
        throw new AdminActionError(
          `Lệnh nạp tiền đang ở trạng thái ${depositIntent.status}; chỉ xử lý thủ công các trạng thái lỗi hoặc cần rà soát.`,
        );
      }

      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${depositIntent.userId}::uuid FOR UPDATE`,
      );

      const before = {
        id: depositIntent.id,
        userId: depositIntent.userId,
        amount: depositIntent.amount.toString(),
        status: depositIntent.status,
        provider: depositIntent.provider,
        providerReference: depositIntent.providerReference,
        providerTransactionId: depositIntent.providerTransactionId,
        providerEventId: depositIntent.providerEventId,
        paymentCode: depositIntent.paymentCode,
        confirmationStatus: depositIntent.confirmationStatus,
        confirmedAmount: depositIntent.confirmedAmount?.toString() ?? null,
        rawProviderMetadata: depositIntent.rawProviderMetadata,
      };

      if (normalizedInput.action === "REJECT") {
        const updatedIntent = await tx.depositIntent.update({
          where: { id: depositIntent.id },
          data: {
            status: DepositIntentStatus.FAILED,
            confirmationStatus: DepositConfirmationStatus.REJECTED,
            rawProviderMetadata: {
              ...(depositIntent.rawProviderMetadata &&
              typeof depositIntent.rawProviderMetadata === "object" &&
              !Array.isArray(depositIntent.rawProviderMetadata)
                ? depositIntent.rawProviderMetadata
                : {}),
              adminReview: {
                action: "REJECT",
                reason: normalizedInput.reason,
                reviewedByAdminId: adminId,
                reviewedAt: processedAt.toISOString(),
              },
            } satisfies Prisma.InputJsonValue,
          },
          select: {
            id: true,
            userId: true,
            amount: true,
            status: true,
            confirmationStatus: true,
            confirmedAmount: true,
          },
        });

        await tx.notification.create({
          data: {
            userId: depositIntent.userId,
            type: NotificationType.DEPOSIT_STATUS,
            title: "Lệnh nạp tiền bị từ chối sau rà soát",
            body: `Lệnh nạp ${formatVnd(depositIntent.amount.toString())} với mã ${depositIntent.paymentCode} đã bị từ chối. Lý do: ${normalizedInput.reason}`,
            data: {
              depositIntentId: depositIntent.id,
              paymentCode: depositIntent.paymentCode,
              status: updatedIntent.status,
              reason: normalizedInput.reason,
            } satisfies Prisma.InputJsonValue,
          },
        });

        await tx.adminAuditLog.create({
          data: {
            adminId,
            targetUserId: depositIntent.userId,
            action: AdminAuditAction.DEPOSIT_REJECTED,
            entityType: "DepositIntent",
            entityId: depositIntent.id,
            before: before as Prisma.InputJsonValue,
            after: {
              ...before,
              status: updatedIntent.status,
              confirmationStatus: updatedIntent.confirmationStatus,
              reviewedAt: processedAt.toISOString(),
            } satisfies Prisma.InputJsonValue,
            reason: normalizedInput.reason,
          },
        });

        return {
          depositIntentId: updatedIntent.id,
          status: updatedIntent.status,
          creditedAmount: "0",
        };
      }

      const creditAmount = normalizeCreditAmount(
        normalizedInput.creditAmount,
        depositIntent.confirmedAmount?.toString() ?? depositIntent.amount.toString(),
      );

      const updatedUserBalance = addMoney(depositIntent.user.availableBalance.toString(), creditAmount);

      await tx.user.update({
        where: { id: depositIntent.userId },
        data: {
          availableBalance: {
            increment: creditAmount,
          },
        },
      });

      const updatedIntent = await tx.depositIntent.update({
        where: { id: depositIntent.id },
        data: {
          status: DepositIntentStatus.PAID,
          confirmationStatus: DepositConfirmationStatus.CONFIRMED,
          confirmedAmount: creditAmount,
          confirmedAt: processedAt,
          rawProviderMetadata: {
            ...(depositIntent.rawProviderMetadata &&
            typeof depositIntent.rawProviderMetadata === "object" &&
            !Array.isArray(depositIntent.rawProviderMetadata)
              ? depositIntent.rawProviderMetadata
              : {}),
            adminReview: {
              action: "APPROVE_CREDIT",
              reason: normalizedInput.reason,
              reviewedByAdminId: adminId,
              reviewedAt: processedAt.toISOString(),
              creditedAmount: creditAmount,
            },
          } satisfies Prisma.InputJsonValue,
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          status: true,
          confirmationStatus: true,
          confirmedAmount: true,
        },
      });

      await tx.transaction.create({
        data: {
          userId: depositIntent.userId,
          type: TransactionType.DEPOSIT,
          amount: creditAmount,
          balanceAfter: updatedUserBalance,
          referenceId: depositIntent.id,
          description: `Admin ghi có ${formatVnd(creditAmount)} cho lệnh nạp ${depositIntent.paymentCode} sau rà soát ngoại lệ.`,
          metadata: {
            depositIntentId: depositIntent.id,
            paymentCode: depositIntent.paymentCode,
            provider: depositIntent.provider,
            previousStatus: depositIntent.status,
            reviewedByAdminId: adminId,
            reviewedAt: processedAt.toISOString(),
            reason: normalizedInput.reason,
          } satisfies Prisma.InputJsonValue,
        },
      });

      await tx.notification.create({
        data: {
          userId: depositIntent.userId,
          type: NotificationType.DEPOSIT_STATUS,
          title: "Lệnh nạp tiền đã được ghi có",
          body: `Admin đã rà soát và ghi có ${formatVnd(creditAmount)} cho mã nạp ${depositIntent.paymentCode}.`,
          data: {
            depositIntentId: depositIntent.id,
            paymentCode: depositIntent.paymentCode,
            status: updatedIntent.status,
            creditedAmount: creditAmount,
          } satisfies Prisma.InputJsonValue,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId,
          targetUserId: depositIntent.userId,
          action: AdminAuditAction.DEPOSIT_APPROVED,
          entityType: "DepositIntent",
          entityId: depositIntent.id,
          before: before as Prisma.InputJsonValue,
          after: {
            ...before,
            status: updatedIntent.status,
            confirmationStatus: updatedIntent.confirmationStatus,
            confirmedAmount: updatedIntent.confirmedAmount?.toString() ?? null,
            availableBalanceAfter: updatedUserBalance,
            reviewedAt: processedAt.toISOString(),
          } satisfies Prisma.InputJsonValue,
          reason: normalizedInput.reason,
        },
      });

      return {
        depositIntentId: updatedIntent.id,
        status: updatedIntent.status,
        creditedAmount: creditAmount,
      };
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/deposits");
    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/deposit");

    return {
      ok: true,
      depositIntentId: result.depositIntentId,
      status: result.status,
      message:
        result.status === DepositIntentStatus.PAID
          ? `Đã ghi có ${formatVnd(result.creditedAmount)} cho lệnh nạp tiền.`
          : "Đã từ chối lệnh nạp tiền và ghi audit log.",
    };
  } catch (error) {
    if (!(error instanceof AdminActionError) && !(error instanceof z.ZodError)) {
      console.error("Lỗi khi admin xử lý ngoại lệ nạp tiền:", error);
    }

    return {
      ok: false,
      error: getValidationErrorMessage(error),
    };
  }
}

export async function updateUserManagement(
  input: UpdateUserManagementInput | FormData,
): Promise<UpdateUserManagementResult> {
  try {
    const session = await requireRole(UserRole.ADMIN);

    if (!session.profile) {
      throw new AdminActionError("Không tìm thấy hồ sơ admin để quản lý người dùng.");
    }

    const adminId = session.profile.id;
    await enforceRateLimit({
      scope: "admin:user:update",
      key: adminId,
      limit: 120,
      windowSeconds: 60 * 60,
    });

    const normalizedInput = normalizeUpdateUserManagementInput(input);

    if (!normalizedInput.role && !normalizedInput.status) {
      throw new AdminActionError("Vui lòng chọn vai trò hoặc trạng thái cần cập nhật.");
    }

    if (normalizedInput.userId === adminId && normalizedInput.status !== UserStatus.ACTIVE) {
      throw new AdminActionError("Admin không thể tự khóa hoặc cấm chính tài khoản đang thao tác.");
    }

    const prisma = getPrisma();
    const processedAt = new Date();

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${normalizedInput.userId}::uuid FOR UPDATE`,
      );

      const user = await tx.user.findUnique({
        where: { id: normalizedInput.userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          availableBalance: true,
          pendingBalance: true,
          escrowBalance: true,
        },
      });

      if (!user) {
        throw new AdminActionError("Không tìm thấy người dùng cần cập nhật.");
      }

      const before = {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        status: user.status,
        availableBalance: user.availableBalance.toString(),
        pendingBalance: user.pendingBalance.toString(),
        escrowBalance: user.escrowBalance.toString(),
      };

      const nextRole = normalizedInput.role ?? user.role;
      const nextStatus = normalizedInput.status ?? user.status;
      const shouldCancelWithdrawals =
        user.status === UserStatus.ACTIVE &&
        (nextStatus === UserStatus.SUSPENDED || nextStatus === UserStatus.BANNED);

      const pendingWithdrawals = shouldCancelWithdrawals
        ? await tx.withdrawal.findMany({
            where: {
              userId: user.id,
              status: WithdrawalStatus.PENDING,
            },
            select: {
              id: true,
              amount: true,
            },
          })
        : [];

      const totalRefundMinor = pendingWithdrawals.reduce(
        (total, withdrawal) => total + toMinorUnits(withdrawal.amount.toString()),
        BigInt(0),
      );
      const totalRefund = fromMinorUnits(totalRefundMinor);

      if (pendingWithdrawals.length > 0) {
        await tx.withdrawal.updateMany({
          where: {
            id: {
              in: pendingWithdrawals.map((withdrawal) => withdrawal.id),
            },
            status: WithdrawalStatus.PENDING,
          },
          data: {
            status: WithdrawalStatus.CANCELLED,
            adminFeedback: `Admin hủy tự động khi tài khoản bị hạn chế. Lý do: ${normalizedInput.reason}`,
            processedAt,
          },
        });
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          role: nextRole,
          status: nextStatus,
          ...(totalRefundMinor > BigInt(0)
            ? {
                pendingBalance: {
                  decrement: totalRefund,
                },
                availableBalance: {
                  increment: totalRefund,
                },
              }
            : {}),
        },
      });

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          availableBalance: true,
          pendingBalance: true,
          escrowBalance: true,
        },
      });

      if (totalRefundMinor > BigInt(0)) {
        await tx.transaction.create({
          data: {
            userId: user.id,
            type: TransactionType.ADMIN_ADJUSTMENT,
            amount: totalRefund,
            balanceAfter: updatedUser.availableBalance,
            referenceId: null,
            description: `Hoàn ${formatVnd(totalRefund)} từ các yêu cầu rút tiền đang chờ khi admin hạn chế tài khoản.`,
            metadata: {
              cancelledWithdrawalIds: pendingWithdrawals.map((withdrawal) => withdrawal.id),
              reviewedByAdminId: adminId,
              reviewedAt: processedAt.toISOString(),
              reason: normalizedInput.reason,
              previousStatus: user.status,
              nextStatus,
            } satisfies Prisma.InputJsonValue,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: user.id,
          type: NotificationType.SYSTEM,
          title: "Trạng thái tài khoản đã được cập nhật",
          body: `Admin đã cập nhật tài khoản sang trạng thái ${nextStatus}. Lý do: ${normalizedInput.reason}`,
          data: {
            previousRole: user.role,
            nextRole,
            previousStatus: user.status,
            nextStatus,
            cancelledWithdrawalCount: pendingWithdrawals.length,
          } satisfies Prisma.InputJsonValue,
        },
      });

      if (user.role !== nextRole) {
        await tx.adminAuditLog.create({
          data: {
            adminId,
            targetUserId: user.id,
            action: AdminAuditAction.USER_ROLE_CHANGED,
            entityType: "User",
            entityId: user.id,
            before: before as Prisma.InputJsonValue,
            after: {
              ...before,
              role: nextRole,
            } satisfies Prisma.InputJsonValue,
            reason: normalizedInput.reason,
          },
        });
      }

      if (user.status !== nextStatus) {
        await tx.adminAuditLog.create({
          data: {
            adminId,
            targetUserId: user.id,
            action: AdminAuditAction.USER_STATUS_CHANGED,
            entityType: "User",
            entityId: user.id,
            before: before as Prisma.InputJsonValue,
            after: {
              id: updatedUser.id,
              email: updatedUser.email,
              username: updatedUser.username,
              role: updatedUser.role,
              status: updatedUser.status,
              availableBalance: updatedUser.availableBalance.toString(),
              pendingBalance: updatedUser.pendingBalance.toString(),
              escrowBalance: updatedUser.escrowBalance.toString(),
              cancelledWithdrawalCount: pendingWithdrawals.length,
              cancelledWithdrawalIds: pendingWithdrawals.map((withdrawal) => withdrawal.id),
            } satisfies Prisma.InputJsonValue,
            reason: normalizedInput.reason,
          },
        });
      }

      if (pendingWithdrawals.length > 0) {
        await tx.adminAuditLog.create({
          data: {
            adminId,
            targetUserId: user.id,
            action: AdminAuditAction.FUNDS_FROZEN,
            entityType: "User",
            entityId: user.id,
            before: before as Prisma.InputJsonValue,
            after: {
              availableBalance: updatedUser.availableBalance.toString(),
              pendingBalance: updatedUser.pendingBalance.toString(),
              accountStatus: updatedUser.status,
              cancelledWithdrawalCount: pendingWithdrawals.length,
              refundedAmount: totalRefund,
            } satisfies Prisma.InputJsonValue,
            reason: normalizedInput.reason,
          },
        });
      }

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        cancelledWithdrawalCount: pendingWithdrawals.length,
      };
    });

    revalidatePath("/admin/dashboard");
    revalidatePath("/admin/users");
    revalidatePath("/admin/withdrawals");

    return {
      ok: true,
      userId: result.id,
      message: `Đã cập nhật ${result.email} sang vai trò ${result.role}, trạng thái ${result.status}.${result.cancelledWithdrawalCount > 0 ? ` Đã hủy ${result.cancelledWithdrawalCount} yêu cầu rút tiền đang chờ.` : ""}`,
    };
  } catch (error) {
    if (!(error instanceof AdminActionError) && !(error instanceof z.ZodError)) {
      console.error("Lỗi khi admin cập nhật người dùng:", error);
    }

    return {
      ok: false,
      error: getValidationErrorMessage(error),
    };
  }
}
