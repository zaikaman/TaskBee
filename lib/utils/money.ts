import { PLATFORM_FEES } from "@/config/app";

export type MoneyInput = bigint | number | string;

const VND_FRACTION_DIGITS = 0;
const MINOR_UNITS = BigInt(100);
const ZERO_MINOR_UNITS = BigInt(0);
const RATE_SCALE = BigInt(10_000);

export function toMinorUnits(value: MoneyInput): bigint {
  if (typeof value === "bigint") {
    return value;
  }

  const normalized = String(value).trim().replaceAll(",", "");

  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Giá trị tiền không hợp lệ: ${value}`);
  }

  const sign = normalized.startsWith("-") ? BigInt(-1) : BigInt(1);
  const [majorRaw, fractionRaw = ""] = normalized.replace("-", "").split(".");
  const major = BigInt(majorRaw || "0") * MINOR_UNITS;
  const fraction = BigInt(fractionRaw.padEnd(2, "0").slice(0, 2));

  return sign * (major + fraction);
}

export function fromMinorUnits(value: bigint) {
  const sign = value < ZERO_MINOR_UNITS ? "-" : "";
  const absolute = value < ZERO_MINOR_UNITS ? -value : value;
  const major = absolute / MINOR_UNITS;
  const fraction = absolute % MINOR_UNITS;

  return `${sign}${major}.${fraction.toString().padStart(2, "0")}`;
}

export function addMoney(...values: MoneyInput[]) {
  return fromMinorUnits(
    values.reduce<bigint>((total, value) => total + toMinorUnits(value), ZERO_MINOR_UNITS),
  );
}

export function subtractMoney(left: MoneyInput, right: MoneyInput) {
  return fromMinorUnits(toMinorUnits(left) - toMinorUnits(right));
}

export function multiplyMoney(value: MoneyInput, multiplier: number) {
  const scaledMultiplier = BigInt(Math.round(multiplier * 10_000));
  return fromMinorUnits((toMinorUnits(value) * scaledMultiplier) / RATE_SCALE);
}

export function calculateEscrowAmount(rewardAmount: MoneyInput, totalSlots: number) {
  if (!Number.isInteger(totalSlots) || totalSlots < 1) {
    throw new Error("Số lượng vị trí phải là số nguyên dương.");
  }

  return fromMinorUnits(toMinorUnits(rewardAmount) * BigInt(totalSlots));
}

export function calculateEmployerTaskCharge(rewardAmount: MoneyInput, totalSlots: number) {
  const escrowMinor = toMinorUnits(calculateEscrowAmount(rewardAmount, totalSlots));
  const feeMinor =
    (escrowMinor * BigInt(Math.round(PLATFORM_FEES.employerTaskCreationRate * 10_000))) /
    RATE_SCALE;

  return {
    escrowAmount: fromMinorUnits(escrowMinor),
    platformFee: fromMinorUnits(feeMinor),
    totalCharge: fromMinorUnits(escrowMinor + feeMinor),
  };
}

export function calculateWithdrawalNet(amount: MoneyInput) {
  const amountMinor = toMinorUnits(amount);
  const feeMinor =
    (amountMinor * BigInt(Math.round(PLATFORM_FEES.workerWithdrawalRate * 10_000))) /
    RATE_SCALE;

  return {
    amount: fromMinorUnits(amountMinor),
    fee: fromMinorUnits(feeMinor),
    netAmount: fromMinorUnits(amountMinor - feeMinor),
  };
}

export function assertNonNegativeBalance(value: MoneyInput) {
  if (toMinorUnits(value) < ZERO_MINOR_UNITS) {
    throw new Error("Số dư không được âm.");
  }
}

export function formatVnd(value: MoneyInput) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: VND_FRACTION_DIGITS,
  }).format(Number(fromMinorUnits(toMinorUnits(value))));
}
