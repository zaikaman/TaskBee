import { z } from "zod";
import {
  PAYMENT_CONFIG,
  SUPPORTED_BANKS,
  SUPPORTED_CURRENCIES,
  WALLET_LIMITS,
} from "@/config/app";
import { formatVnd, fromMinorUnits, toMinorUnits, type MoneyInput } from "@/lib/utils/money";

const supportedBankCodes: ReadonlySet<string> = new Set(SUPPORTED_BANKS.map((bank) => bank.code));
const supportedCurrencyCodes: ReadonlySet<string> = new Set(
  SUPPORTED_CURRENCIES.map((currency) => currency.code),
);
const supportedDepositProviders: ReadonlySet<string> = new Set([
  PAYMENT_CONFIG.sepay.provider,
  PAYMENT_CONFIG.usdt.provider,
]);
const enabledUsdtNetworkCodes: ReadonlySet<string> = new Set(
  PAYMENT_CONFIG.usdt.networks.filter((network) => network.enabled).map((network) => network.code),
);

const VND_MINOR_UNIT = BigInt(100);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().replaceAll(/\s+/g, " ") : value;
}

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : value;
}

function normalizeOptionalCode(value: unknown) {
  const normalized = normalizeCode(value);

  return normalized === "" ? undefined : normalized;
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value);

  return normalized === "" ? undefined : normalized;
}

function normalizeBankCode(value: unknown) {
  return normalizeCode(value);
}

function normalizeAccountNumber(value: unknown) {
  return typeof value === "string" ? value.replaceAll(/[\s.-]/g, "") : value;
}

function findSupportedBank(bankCode: string) {
  return SUPPORTED_BANKS.find((bank) => bank.code === bankCode);
}

function findUsdtNetwork(networkCode: string) {
  return PAYMENT_CONFIG.usdt.networks.find((network) => network.code === networkCode);
}

function isWholePositiveVndAmount(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    return false;
  }

  try {
    const amountMinor = toMinorUnits(value);

    return amountMinor > BigInt(0) && amountMinor % VND_MINOR_UNIT === BigInt(0);
  } catch {
    return false;
  }
}

function addDepositAmountIssue(
  ctx: z.RefinementCtx,
  amount: MoneyInput,
  minimumDepositVnd: number,
  maximumDepositVnd: number,
) {
  const amountMinor = toMinorUnits(amount);
  const minimumMinor = toMinorUnits(minimumDepositVnd);
  const maximumMinor = toMinorUnits(maximumDepositVnd);

  if (amountMinor < minimumMinor) {
    ctx.addIssue({
      code: "custom",
      message: `Số tiền nạp tối thiểu là ${formatVnd(minimumDepositVnd)}.`,
      path: ["amount"],
    });
  }

  if (amountMinor > maximumMinor) {
    ctx.addIssue({
      code: "custom",
      message: `Số tiền nạp tối đa là ${formatVnd(maximumDepositVnd)}.`,
      path: ["amount"],
    });
  }
}

function isValidDestinationWalletAddress(networkCode: string, address: string) {
  if (networkCode === "TRC20") {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  }

  if (networkCode === "BEP20" || networkCode === "ERC20") {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  return false;
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

export const depositProviderSchema = z.preprocess(
  normalizeCode,
  z
    .string({ message: "Vui lòng chọn nhà cung cấp nạp tiền." })
    .min(1, "Vui lòng chọn nhà cung cấp nạp tiền.")
    .refine((value) => supportedDepositProviders.has(value), {
      message: "Nhà cung cấp nạp tiền không được hỗ trợ.",
    }),
);

export const depositCurrencySchema = z.preprocess(
  normalizeCode,
  z
    .string({ message: "Vui lòng chọn đơn vị tiền tệ nạp." })
    .min(1, "Vui lòng chọn đơn vị tiền tệ nạp.")
    .refine((value) => supportedCurrencyCodes.has(value), {
      message: "Đơn vị tiền tệ nạp không được hỗ trợ.",
    }),
);

export const depositAmountSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().replaceAll(",", "") : value),
  z.custom<MoneyInput>(isWholePositiveVndAmount, "Số tiền nạp phải là số nguyên VND hợp lệ."),
);

export const usdtNetworkSchema = z.preprocess(
  normalizeCode,
  z
    .string({ message: "Vui lòng chọn mạng USDT." })
    .min(1, "Vui lòng chọn mạng USDT.")
    .refine((value) => enabledUsdtNetworkCodes.has(value), {
      message: "Mạng USDT không được hỗ trợ hoặc đang tạm dừng.",
    }),
);

const optionalUsdtNetworkSchema = z.preprocess(normalizeOptionalCode, usdtNetworkSchema.optional());

export const destinationWalletAddressSchema = z.preprocess(
  normalizeText,
  z
    .string({ message: "Vui lòng cấu hình địa chỉ ví nhận tiền." })
    .min(26, "Địa chỉ ví nhận tiền quá ngắn.")
    .max(128, "Địa chỉ ví nhận tiền quá dài."),
);

const optionalDestinationWalletAddressSchema = z.preprocess(
  normalizeOptionalText,
  destinationWalletAddressSchema.optional(),
);

export const usdtDestinationWalletSchema = z
  .object({
    network: usdtNetworkSchema,
    destinationWalletAddress: destinationWalletAddressSchema,
  })
  .superRefine((value, ctx) => {
    if (!isValidDestinationWalletAddress(value.network, value.destinationWalletAddress)) {
      ctx.addIssue({
        code: "custom",
        message: "Địa chỉ ví nhận USDT không khớp định dạng của mạng đã chọn.",
        path: ["destinationWalletAddress"],
      });
    }
  });

export const depositRequestSchema = z
  .object({
    amount: depositAmountSchema,
    provider: depositProviderSchema,
    currency: depositCurrencySchema,
    usdtNetwork: optionalUsdtNetworkSchema,
    destinationWalletAddress: optionalDestinationWalletAddressSchema,
  })
  .superRefine((value, ctx) => {
    if (value.provider === PAYMENT_CONFIG.sepay.provider) {
      if (value.currency !== PAYMENT_CONFIG.sepay.settlementCurrency) {
        ctx.addIssue({
          code: "custom",
          message: "SePay chỉ hỗ trợ nạp bằng VND.",
          path: ["currency"],
        });
      }

      if (value.usdtNetwork) {
        ctx.addIssue({
          code: "custom",
          message: "Nạp SePay không được chọn mạng USDT.",
          path: ["usdtNetwork"],
        });
      }

      if (value.destinationWalletAddress) {
        ctx.addIssue({
          code: "custom",
          message: "Nạp SePay không dùng địa chỉ ví crypto.",
          path: ["destinationWalletAddress"],
        });
      }

      addDepositAmountIssue(
        ctx,
        value.amount,
        PAYMENT_CONFIG.sepay.minimumDepositVnd,
        PAYMENT_CONFIG.sepay.maximumDepositVnd,
      );

      return;
    }

    if (value.currency !== PAYMENT_CONFIG.usdt.settlementCurrency) {
      ctx.addIssue({
        code: "custom",
        message: "Khoản nạp USDT phải được khai báo theo giá trị VND để đối soát tỷ giá.",
        path: ["currency"],
      });
    }

    if (!value.usdtNetwork) {
      ctx.addIssue({
        code: "custom",
        message: "Vui lòng chọn mạng USDT.",
        path: ["usdtNetwork"],
      });
    }

    if (
      value.usdtNetwork &&
      value.destinationWalletAddress &&
      !isValidDestinationWalletAddress(value.usdtNetwork, value.destinationWalletAddress)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Địa chỉ ví nhận USDT không khớp định dạng của mạng đã chọn.",
        path: ["destinationWalletAddress"],
      });
    }

    addDepositAmountIssue(
      ctx,
      value.amount,
      PAYMENT_CONFIG.usdt.minimumDepositVnd,
      PAYMENT_CONFIG.usdt.maximumDepositVnd,
    );
  })
  .transform((value) => {
    const amount = fromMinorUnits(toMinorUnits(value.amount));
    const usdtNetwork = value.usdtNetwork ? findUsdtNetwork(value.usdtNetwork) : null;

    return {
      amount,
      amountMinor: toMinorUnits(amount),
      provider: value.provider,
      currency: value.currency,
      paymentMethod:
        value.provider === PAYMENT_CONFIG.sepay.provider
          ? PAYMENT_CONFIG.sepay.paymentMethod
          : PAYMENT_CONFIG.usdt.paymentMethod,
      usdtNetwork: value.usdtNetwork ?? null,
      destinationWalletAddress: value.destinationWalletAddress ?? null,
      requiredConfirmations:
        value.provider === PAYMENT_CONFIG.sepay.provider
          ? PAYMENT_CONFIG.sepay.requiredConfirmations
          : (usdtNetwork?.requiredConfirmations ??
            PAYMENT_CONFIG.usdt.networks[0].requiredConfirmations),
    };
  });

export type BankDetailsInput = z.input<typeof bankDetailsSchema>;
export type BankDetails = z.output<typeof bankDetailsSchema>;
export type WithdrawalRequestInput = z.input<typeof withdrawalRequestSchema>;
export type WithdrawalRequest = z.output<typeof withdrawalRequestSchema>;
export type DepositRequestInput = z.input<typeof depositRequestSchema>;
export type DepositRequest = z.output<typeof depositRequestSchema>;
export type UsdtDestinationWalletInput = z.input<typeof usdtDestinationWalletSchema>;
export type UsdtDestinationWallet = z.output<typeof usdtDestinationWalletSchema>;

export function getWalletValidationError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Thông tin ví không hợp lệ.";
  }

  return error instanceof Error ? error.message : "Thông tin ví không hợp lệ.";
}
