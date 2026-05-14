export const APP_NAME = "TaskBee";

export const PLATFORM_FEES = {
  employerTaskCreationRate: 0.1,
  workerWithdrawalRate: 0.1,
} as const;

export const WALLET_LIMITS = {
  minimumWithdrawalVnd: 100_000,
  minimumTaskRewardVnd: 1_000,
  maximumTaskRewardVnd: 5_000_000,
  minimumTaskSlots: 1,
  maximumTaskSlots: 10_000,
} as const;

export const TASK_LIMITS = {
  autoApproveTimeoutDaysMin: 1,
  autoApproveTimeoutDaysMax: 7,
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
