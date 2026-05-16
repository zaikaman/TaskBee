import { z } from "zod";
import { SUPPORTED_BANKS, WALLET_LIMITS } from "@/config/app";
import { formatVnd, toMinorUnits, type MoneyInput } from "@/lib/utils/money";

const supportedBankCodes: ReadonlySet<string> = new Set(SUPPORTED_BANKS.map((bank) => bank.code));

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replaceAll(/\s+/g, " ") : value;
}

function normalizeBankCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function normalizeAccountNumber(value: unknown) {
  return typeof value === "string" ? value.replaceAll(/[\s.-]/g, "") : value;
}

function findSupportedBank(bankCode: string) {
  return SUPPORTED_BANKS.find((bank) => bank.code === bankCode);
}

export const bankCodeSchema = z.preprocess(
  normalizeBankCode,
  z
    .string({ message: "Vui lòng chọn ngân hàng nhận tiền." })
    .min(1, "Vui lòng chọn ngân hàng nhận tiền.")
    .refine((value) => supportedBankCodes.has(value), {
      message: "Ngân hàng nhận tiền không được hỗ trợ.",
    }),
);

export const bankAccountNumberSchema = z.preprocess(
  normalizeAccountNumber,
  z
    .string({ message: "Vui lòng nhập số tài khoản ngân hàng." })
    .min(4, "Số tài khoản ngân hàng phải có ít nhất 4 chữ số.")
    .max(32, "Số tài khoản ngân hàng không được vượt quá 32 chữ số.")
    .regex(/^\d+$/, "Số tài khoản ngân hàng chỉ được chứa chữ số."),
);

export const bankAccountNameSchema = z.preprocess(
  normalizeText,
  z
    .string({ message: "Vui lòng nhập tên chủ tài khoản." })
    .min(2, "Tên chủ tài khoản phải có ít nhất 2 ký tự.")
    .max(100, "Tên chủ tài khoản không được vượt quá 100 ký tự.")
    .regex(
      /^[\p{L}\s'.-]+$/u,
      "Tên chủ tài khoản chỉ được chứa chữ cái, khoảng trắng và ký tự phân tách hợp lệ.",
    )
    .transform((value) => value.toLocaleUpperCase("vi-VN")),
);

export const bankDetailsSchema = z
  .object({
    bankCode: bankCodeSchema,
    accountNumber: bankAccountNumberSchema,
    accountName: bankAccountNameSchema,
  })
  .transform((value) => {
    const bank = findSupportedBank(value.bankCode);

    if (!bank) {
      throw new Error("Ngân hàng nhận tiền không được hỗ trợ.");
    }

    return {
      ...value,
      bankName: bank.name,
    };
  });

export const withdrawalAmountSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().replaceAll(",", "") : value),
  z.custom<MoneyInput>((value) => {
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
      return false;
    }

    try {
      const amountMinor = toMinorUnits(value);

      return amountMinor > BigInt(0) && amountMinor % BigInt(100) === BigInt(0);
    } catch {
      return false;
    }
  }, "Số tiền rút phải là số nguyên VND hợp lệ."),
).refine((value) => toMinorUnits(value) >= toMinorUnits(WALLET_LIMITS.minimumWithdrawalVnd), {
  message: `Số tiền rút tối thiểu là ${formatVnd(WALLET_LIMITS.minimumWithdrawalVnd)}.`,
});

export const withdrawalRequestSchema = z.object({
  amount: withdrawalAmountSchema,
  bankDetails: bankDetailsSchema,
});

export type BankDetailsInput = z.input<typeof bankDetailsSchema>;
export type BankDetails = z.output<typeof bankDetailsSchema>;
export type WithdrawalRequestInput = z.input<typeof withdrawalRequestSchema>;
export type WithdrawalRequest = z.output<typeof withdrawalRequestSchema>;

export function getWalletValidationError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Thông tin ví không hợp lệ.";
  }

  return error instanceof Error ? error.message : "Thông tin ví không hợp lệ.";
}
