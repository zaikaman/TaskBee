"use server";

import { revalidatePath } from "next/cache";
import { PLATFORM_FEES } from "@/config/app";
import { requireAuth, requireVerifiedUser } from "@/lib/auth/session";
import { getPrisma } from "@/lib/db/prisma";
import {
  Prisma,
  TransactionType,
  UserStatus,
  WithdrawalStatus,
} from "@/lib/generated/prisma/client";
import {
  calculateWithdrawalNet,
  formatVnd,
  fromMinorUnits,
  toMinorUnits,
} from "@/lib/utils/money";
import {
  bankDetailsSchema,
  getWalletValidationError,
  withdrawalAmountSchema,
  type BankDetails,
} from "@/lib/validators/wallet";

/**
 * Thông tin số dư ví của người dùng
 */
export type WalletBalance = {
  availableBalance: string;
  pendingBalance: string;
  escrowBalance: string;
  totalBalance: string;
};

/**
 * Thông tin giao dịch trong lịch sử
 */
export type TransactionHistoryItem = {
  id: string;
  type: TransactionType;
  amount: string;
  balanceAfter: string;
  description: string;
  referenceId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

/**
 * Kết quả phân trang lịch sử giao dịch
 */
export type TransactionHistory = {
  transactions: TransactionHistoryItem[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

/**
 * Kết quả yêu cầu rút tiền
 */
export type RequestWithdrawalResult = {
  ok: boolean;
  message?: string;
  error?: string;
  withdrawalId?: string;
  fee?: string;
  netAmount?: string;
};

type NormalizedWithdrawalInput = {
  amount: string;
  amountMinor: bigint;
  bankDetails: BankDetails;
};

function normalizeWithdrawalAmount(amount: string | number) {
  const normalizedAmount = withdrawalAmountSchema.parse(amount);
  const amountMinor = toMinorUnits(normalizedAmount);

  return {
    amount: fromMinorUnits(amountMinor),
    amountMinor,
  };
}

function normalizeWithdrawalInput(
  amount: string | number,
  bankDetails: BankDetails,
): NormalizedWithdrawalInput {
  const normalizedAmount = normalizeWithdrawalAmount(amount);

  return {
    ...normalizedAmount,
    bankDetails: bankDetailsSchema.parse(bankDetails),
  };
}

/**
 * Lấy thông tin số dư ví của người dùng hiện tại
 * 
 * @returns Thông tin số dư ví hoặc null nếu chưa đăng nhập
 */
export async function getWalletBalance(): Promise<WalletBalance | null> {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return null;
    }

    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: {
        id: session.profile.id,
      },
      select: {
        availableBalance: true,
        pendingBalance: true,
        escrowBalance: true,
      },
    });

    if (!user) {
      return null;
    }

    const availableBalance = user.availableBalance.toString();
    const pendingBalance = user.pendingBalance.toString();
    const escrowBalance = user.escrowBalance.toString();

    // Tính tổng số dư
    const totalBalanceMinor =
      toMinorUnits(availableBalance) +
      toMinorUnits(pendingBalance) +
      toMinorUnits(escrowBalance);

    return {
      availableBalance,
      pendingBalance,
      escrowBalance,
      totalBalance: fromMinorUnits(totalBalanceMinor),
    };
  } catch (error) {
    console.error("Lỗi khi lấy thông tin số dư ví:", error);
    return null;
  }
}

/**
 * Lấy lịch sử giao dịch của người dùng hiện tại với phân trang
 * 
 * @param page - Trang hiện tại (bắt đầu từ 1)
 * @param pageSize - Số lượng giao dịch mỗi trang (mặc định 20)
 * @param type - Lọc theo loại giao dịch (tùy chọn)
 * @returns Lịch sử giao dịch với thông tin phân trang
 */
export async function getTransactionHistory(
  page = 1,
  pageSize = 20,
  type?: TransactionType,
): Promise<TransactionHistory> {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return {
        transactions: [],
        pagination: {
          page: 1,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    const prisma = getPrisma();

    // Validate và normalize page
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.max(1, Math.min(100, Math.floor(pageSize)));
    const skip = (normalizedPage - 1) * normalizedPageSize;

    // Build where clause
    const where: Prisma.TransactionWhereInput = {
      userId: session.profile.id,
      ...(type && { type }),
    };

    // Lấy tổng số giao dịch
    const totalCount = await prisma.transaction.count({
      where,
    });

    // Lấy danh sách giao dịch
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: normalizedPageSize,
      select: {
        id: true,
        type: true,
        amount: true,
        balanceAfter: true,
        description: true,
        referenceId: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Tính toán thông tin phân trang
    const totalPages = Math.ceil(totalCount / normalizedPageSize);
    const hasNextPage = normalizedPage < totalPages;
    const hasPreviousPage = normalizedPage > 1;

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.toString(),
        balanceAfter: tx.balanceAfter.toString(),
        description: tx.description,
        referenceId: tx.referenceId,
        metadata: tx.metadata,
        createdAt: tx.createdAt,
      })),
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  } catch (error) {
    console.error("Lỗi khi lấy lịch sử giao dịch:", error);
    return {
      transactions: [],
      pagination: {
        page: 1,
        pageSize,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }
}

/**
 * Tạo yêu cầu rút tiền với phí 10%
 * 
 * Quy trình:
 * 1. Kiểm tra số dư khả dụng
 * 2. Kiểm tra ngưỡng rút tiền tối thiểu
 * 3. Tính phí rút tiền (10%)
 * 4. Trừ số dư khả dụng, cộng số dư đang chờ
 * 5. Tạo bản ghi withdrawal với trạng thái PENDING
 * 6. Ghi bút toán vào ledger
 * 
 * @param amount - Số tiền muốn rút (trước khi trừ phí)
 * @param bankDetails - Thông tin tài khoản ngân hàng
 * @returns Kết quả yêu cầu rút tiền
 */
export async function requestWithdrawal(
  amount: string | number,
  bankDetails: BankDetails,
): Promise<RequestWithdrawalResult> {
  try {
    const session = await requireVerifiedUser();

    if (!session.profile) {
      return {
        ok: false,
        error: "Vui lòng hoàn tất hồ sơ trước khi thực hiện rút tiền.",
      };
    }

    const userId = session.profile.id;
    const input = normalizeWithdrawalInput(amount, bankDetails);
    const { fee, netAmount } = calculateWithdrawalNet(input.amount);
    const feeMinor = toMinorUnits(fee);
    const netAmountMinor = toMinorUnits(netAmount);

    const prisma = getPrisma();

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`,
      );

      const currentUser = await tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          availableBalance: true,
          status: true,
        },
      });

      if (currentUser.status !== UserStatus.ACTIVE) {
        throw new Error("Tài khoản không ở trạng thái hoạt động nên không thể rút tiền.");
      }

      const currentAvailableMinor = toMinorUnits(currentUser.availableBalance.toString());

      if (currentAvailableMinor < input.amountMinor) {
        throw new Error(
          `Số dư không đủ. Bạn có ${formatVnd(currentUser.availableBalance.toString())} nhưng cần ${formatVnd(input.amount)} để rút tiền.`,
        );
      }

      const walletUpdate = await tx.user.updateMany({
        where: {
          id: userId,
          status: UserStatus.ACTIVE,
          availableBalance: {
            gte: input.amount,
          },
        },
        data: {
          availableBalance: {
            decrement: input.amount,
          },
          pendingBalance: {
            increment: input.amount,
          },
        },
      });

      if (walletUpdate.count !== 1) {
        throw new Error("Số dư ví không đủ để tạo yêu cầu rút tiền.");
      }

      const updatedUser = await tx.user.findUniqueOrThrow({
        where: {
          id: userId,
        },
        select: {
          availableBalance: true,
          pendingBalance: true,
        },
      });

      const newAvailableBalance = updatedUser.availableBalance.toString();
      const newPendingBalance = updatedUser.pendingBalance.toString();

      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          amount: input.amount,
          fee: fee,
          netAmount: netAmount,
          status: WithdrawalStatus.PENDING,
          bankDetails: input.bankDetails as Prisma.InputJsonValue,
        },
      });

      const ledgerEntries: Prisma.TransactionCreateManyInput[] = [
        {
          userId,
          type: TransactionType.WITHDRAWAL,
          amount: `-${netAmount}`,
          balanceAfter: fromMinorUnits(currentAvailableMinor - netAmountMinor),
          referenceId: withdrawal.id,
          description: `Tạo yêu cầu rút tiền ${formatVnd(input.amount)} về tài khoản ${input.bankDetails.bankName} - ${input.bankDetails.accountNumber}. Số tiền thực nhận dự kiến là ${formatVnd(netAmount)}.`,
          metadata: {
            withdrawalId: withdrawal.id,
            requestedAmount: input.amount,
            fee,
            netAmount,
            feeRate: PLATFORM_FEES.workerWithdrawalRate,
            bankDetails: input.bankDetails,
            pendingBalanceAfter: newPendingBalance,
          } as Prisma.InputJsonValue,
        },
      ];

      if (feeMinor > BigInt(0)) {
        ledgerEntries.push({
          userId,
          type: TransactionType.WITHDRAWAL_FEE,
          amount: `-${fee}`,
          balanceAfter: newAvailableBalance,
          referenceId: withdrawal.id,
          description: `Phí rút tiền ${formatVnd(fee)} (10% của ${formatVnd(input.amount)}).`,
          metadata: {
            withdrawalId: withdrawal.id,
            requestedAmount: input.amount,
            fee,
            netAmount,
            feeRate: PLATFORM_FEES.workerWithdrawalRate,
            pendingBalanceAfter: newPendingBalance,
          } as Prisma.InputJsonValue,
        });
      }

      await tx.transaction.createMany({
        data: ledgerEntries,
      });

      return {
        withdrawalId: withdrawal.id,
        fee,
        netAmount,
        requestedAmount: input.amount,
      };
    });

    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/history");

    return {
      ok: true,
      message: `Yêu cầu rút tiền ${formatVnd(result.requestedAmount)} đã được tạo thành công. Bạn sẽ nhận ${formatVnd(result.netAmount)} sau khi admin duyệt (phí ${formatVnd(result.fee)}).`,
      withdrawalId: result.withdrawalId,
      fee: result.fee,
      netAmount: result.netAmount,
    };
  } catch (error) {
    console.error("Lỗi khi tạo yêu cầu rút tiền:", error);
    return {
      ok: false,
      error: getWalletValidationError(error),
    };
  }
}

/**
 * Lấy danh sách yêu cầu rút tiền của người dùng hiện tại
 * 
 * @param status - Lọc theo trạng thái (tùy chọn)
 * @param page - Trang hiện tại (bắt đầu từ 1)
 * @param pageSize - Số lượng mỗi trang (mặc định 10)
 * @returns Danh sách yêu cầu rút tiền với phân trang
 */
export async function getWithdrawalRequests(
  status?: WithdrawalStatus,
  page = 1,
  pageSize = 10,
) {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return {
        withdrawals: [],
        pagination: {
          page: 1,
          pageSize,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };
    }

    const prisma = getPrisma();

    // Validate và normalize page
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedPageSize = Math.max(1, Math.min(50, Math.floor(pageSize)));
    const skip = (normalizedPage - 1) * normalizedPageSize;

    // Build where clause
    const where: Prisma.WithdrawalWhereInput = {
      userId: session.profile.id,
      ...(status && { status }),
    };

    // Lấy tổng số withdrawal
    const totalCount = await prisma.withdrawal.count({
      where,
    });

    // Lấy danh sách withdrawal
    const withdrawals = await prisma.withdrawal.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: normalizedPageSize,
      select: {
        id: true,
        amount: true,
        fee: true,
        netAmount: true,
        status: true,
        bankDetails: true,
        adminFeedback: true,
        processedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Tính toán thông tin phân trang
    const totalPages = Math.ceil(totalCount / normalizedPageSize);
    const hasNextPage = normalizedPage < totalPages;
    const hasPreviousPage = normalizedPage > 1;

    return {
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: w.amount.toString(),
        fee: w.fee.toString(),
        netAmount: w.netAmount.toString(),
        status: w.status,
        bankDetails: w.bankDetails as BankDetails,
        adminFeedback: w.adminFeedback,
        processedAt: w.processedAt,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        totalCount,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
    };
  } catch (error) {
    console.error("Lỗi khi lấy danh sách yêu cầu rút tiền:", error);
    return {
      withdrawals: [],
      pagination: {
        page: 1,
        pageSize,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }
}

/**
 * Hủy yêu cầu rút tiền đang PENDING
 * Hoàn lại số tiền từ pending về available
 * 
 * @param withdrawalId - ID của yêu cầu rút tiền
 * @returns Kết quả hủy yêu cầu
 */
export async function cancelWithdrawal(withdrawalId: string): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await requireAuth();

    if (!session.profile) {
      return {
        ok: false,
        error: "Vui lòng đăng nhập để thực hiện thao tác này.",
      };
    }

    const prisma = getPrisma();

    return await prisma.$transaction(async (tx) => {
      // Lấy thông tin withdrawal
      const withdrawal = await tx.withdrawal.findUnique({
        where: {
          id: withdrawalId,
          userId: session.profile!.id,
        },
        select: {
          id: true,
          amount: true,
          status: true,
          userId: true,
        },
      });

      if (!withdrawal) {
        return {
          ok: false,
          error: "Không tìm thấy yêu cầu rút tiền hoặc bạn không có quyền hủy yêu cầu này.",
        };
      }

      // Chỉ có thể hủy withdrawal đang PENDING
      if (withdrawal.status !== WithdrawalStatus.PENDING) {
        return {
          ok: false,
          error: `Không thể hủy yêu cầu rút tiền đang ở trạng thái ${withdrawal.status}. Chỉ có thể hủy yêu cầu đang chờ xử lý.`,
        };
      }

      const amount = withdrawal.amount.toString();

      // Cập nhật trạng thái withdrawal
      await tx.withdrawal.update({
        where: {
          id: withdrawalId,
        },
        data: {
          status: WithdrawalStatus.CANCELLED,
          updatedAt: new Date(),
        },
      });

      // Hoàn lại số dư: trừ pending, cộng available
      const updatedUser = await tx.user.update({
        where: {
          id: session.profile!.id,
        },
        data: {
          pendingBalance: {
            decrement: amount,
          },
          availableBalance: {
            increment: amount,
          },
        },
        select: {
          availableBalance: true,
        },
      });

      const newAvailableBalance = updatedUser.availableBalance.toString();

      // Ghi bút toán hoàn tiền
      await tx.transaction.create({
        data: {
          userId: session.profile!.id,
          type: TransactionType.WITHDRAWAL,
          amount: amount,
          balanceAfter: newAvailableBalance,
          referenceId: withdrawalId,
          description: `Hủy yêu cầu rút tiền ${formatVnd(amount)}. Số tiền đã được hoàn lại vào ví.`,
          metadata: {
            withdrawalId: withdrawalId,
            cancelledAmount: amount,
            reason: "Người dùng hủy yêu cầu",
          } as Prisma.InputJsonValue,
        },
      });

      return {
        ok: true,
        message: `Yêu cầu rút tiền ${formatVnd(amount)} đã được hủy thành công. Số tiền đã được hoàn lại vào ví.`,
      };
    });
  } catch (error) {
    console.error("Lỗi khi hủy yêu cầu rút tiền:", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Không thể hủy yêu cầu rút tiền lúc này. Vui lòng thử lại sau.",
    };
  } finally {
    revalidatePath("/dashboard/wallet");
    revalidatePath("/dashboard/wallet/history");
  }
}
