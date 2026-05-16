export const APP_NAME = "TaskBee";

// Whitelist emails cho testing - bypass balance check
export const TEST_WHITELIST_EMAILS = [
  "zaikaman123@gmail.com",
] as const;

export const PLATFORM_FEES = {
  employerTaskCreationRate: 0.1,
  workerWithdrawalRate: 0.1,
} as const;

export const WALLET_LIMITS = {
  minimumWithdrawalVnd: 100_000,
  minimumSePayDepositVnd: 50_000,
  maximumSePayDepositVnd: 500_000_000,
  minimumUsdtDepositVnd: 100_000,
  maximumUsdtDepositVnd: 500_000_000,
  minimumTaskRewardVnd: 1_000,
  maximumTaskRewardVnd: 5_000_000,
  minimumTaskSlots: 1,
  maximumTaskSlots: 10_000,
} as const;

export const SUPPORTED_CURRENCIES = [
  {
    code: "VND",
    name: "Đồng Việt Nam",
    symbol: "₫",
    decimalPlaces: 0,
    databaseScale: 2,
    locale: "vi-VN",
    isFiat: true,
    isStablecoin: false,
  },
  {
    code: "USDT",
    name: "Tether USD",
    symbol: "USDT",
    decimalPlaces: 6,
    databaseScale: 6,
    locale: "en-US",
    isFiat: false,
    isStablecoin: true,
  },
] as const;

export const PAYMENT_CONFIG = {
  paymentCode: {
    prefix: "TB",
    separator: "",
    randomLength: 10,
    maxLength: 64,
    allowedPattern: "^[A-Z0-9]+$",
  },
  depositIntent: {
    expiresAfterMinutes: 30,
    statusRefreshIntervalSeconds: 10,
    maximumMetadataBytes: 32_768,
  },
  sepay: {
    provider: "SEPAY",
    paymentMethod: "BANK_TRANSFER",
    settlementCurrency: "VND",
    minimumDepositVnd: WALLET_LIMITS.minimumSePayDepositVnd,
    maximumDepositVnd: WALLET_LIMITS.maximumSePayDepositVnd,
    requiredConfirmations: 1,
    bankTransferContentPrefix: "TB",
    webhook: {
      secretEnvVar: "SEPAY_WEBHOOK_SECRET",
      apiKeyEnvVar: "SEPAY_API_TOKEN",
      signatureAlgorithm: "HMAC-SHA256",
      signatureHeader: "x-sepay-signature",
      timestampHeader: "x-sepay-timestamp",
      replayToleranceSeconds: 300,
      successResponse: { success: true },
      timeoutSeconds: 30,
    },
    env: {
      bankName: "SEPAY_BANK_NAME",
      bankShortName: "SEPAY_BANK_SHORT_NAME",
      bankAccountNumber: "SEPAY_BANK_ACCOUNT_NUMBER",
      bankAccountName: "SEPAY_BANK_ACCOUNT_NAME",
      merchantId: "SEPAY_MERCHANT_ID",
    },
  },
  usdt: {
    provider: "USDT",
    paymentMethod: "CRYPTO_TRANSFER",
    settlementCurrency: "VND",
    assetCurrency: "USDT",
    minimumDepositVnd: WALLET_LIMITS.minimumUsdtDepositVnd,
    maximumDepositVnd: WALLET_LIMITS.maximumUsdtDepositVnd,
    exchangeRateTtlSeconds: 60,
    webhook: {
      secretEnvVar: "USDT_WEBHOOK_SECRET",
      providerApiKeyEnvVar: "USDT_PROVIDER_API_KEY",
      replayToleranceSeconds: 300,
    },
    networks: [
      {
        code: "TRC20",
        name: "TRON (TRC20)",
        chain: "TRON",
        asset: "USDT",
        decimals: 6,
        requiredConfirmations: 20,
        destinationAddressEnvVar: "USDT_TRC20_DEPOSIT_ADDRESS",
        explorerTransactionUrl: "https://tronscan.org/#/transaction/{txHash}",
        memoRequired: false,
        enabled: true,
      },
      {
        code: "BEP20",
        name: "BNB Smart Chain (BEP20)",
        chain: "BNB Smart Chain",
        chainId: 56,
        asset: "USDT",
        decimals: 18,
        requiredConfirmations: 20,
        destinationAddressEnvVar: "USDT_BEP20_DEPOSIT_ADDRESS",
        explorerTransactionUrl: "https://bscscan.com/tx/{txHash}",
        memoRequired: false,
        enabled: true,
      },
      {
        code: "ERC20",
        name: "Ethereum (ERC20)",
        chain: "Ethereum",
        chainId: 1,
        asset: "USDT",
        decimals: 6,
        requiredConfirmations: 64,
        destinationAddressEnvVar: "USDT_ERC20_DEPOSIT_ADDRESS",
        explorerTransactionUrl: "https://etherscan.io/tx/{txHash}",
        memoRequired: false,
        enabled: true,
      },
    ],
  },
} as const;

export const TASK_LIMITS = {
  autoApproveTimeoutDaysMin: 1,
  autoApproveTimeoutDaysMax: 7,
  holdTimeMinutesDefault: 90,
  holdTimeMinutesMin: 5,
  holdTimeMinutesMax: 90,
  proofImageMaxCount: 5,
  proofImageMaxSizeMb: 5,
  titleMaxLength: 120,
  descriptionMaxLength: 5_000,
  instructionsMaxLength: 10_000,
} as const;

export const RATE_LIMITS = {
  authAttemptsPerMinute: 5,
  taskCreatesPerHour: 20,
  slotClaimsPerMinute: 30,
  submissionsPerMinute: 10,
  withdrawalRequestsPerDay: 3,
} as const;

export const SUPPORTED_BANKS = [
  { code: "VCB", name: "Vietcombank" },
  { code: "TCB", name: "Techcombank" },
  { code: "ACB", name: "ACB" },
  { code: "BIDV", name: "BIDV" },
  { code: "CTG", name: "VietinBank" },
  { code: "MB", name: "MB Bank" },
  { code: "VPB", name: "VPBank" },
  { code: "TPB", name: "TPBank" },
  { code: "STB", name: "Sacombank" },
  { code: "VIB", name: "VIB" },
  { code: "EIB", name: "Eximbank" },
  { code: "HDB", name: "HDBank" },
  { code: "OCB", name: "OCB" },
  { code: "MSB", name: "MSB" },
] as const;

export type SupportedBankCode = (typeof SUPPORTED_BANKS)[number]["code"];
export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];
export type SupportedUsdtNetworkCode = (typeof PAYMENT_CONFIG.usdt.networks)[number]["code"];
