-- Tạo hạ tầng lệnh nạp tiền production cho SePay và USDT.
-- Migration này dùng IF NOT EXISTS/DO block để deploy an toàn trên database đã có dữ liệu.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  CREATE TYPE "DepositProvider" AS ENUM ('SEPAY', 'USDT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DepositPaymentMethod" AS ENUM ('BANK_TRANSFER', 'CRYPTO_TRANSFER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DepositNetwork" AS ENUM ('TRC20', 'BEP20', 'ERC20');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DepositIntentStatus" AS ENUM (
    'PENDING',
    'CONFIRMING',
    'PAID',
    'EXPIRED',
    'CANCELLED',
    'FAILED',
    'UNDERPAID',
    'OVERPAID',
    'MANUAL_REVIEW_REQUIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DepositConfirmationStatus" AS ENUM (
    'UNCONFIRMED',
    'PARTIALLY_CONFIRMED',
    'CONFIRMED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DepositIntent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" VARCHAR(12) NOT NULL,
  "status" "DepositIntentStatus" NOT NULL DEFAULT 'PENDING',
  "provider" "DepositProvider" NOT NULL,
  "providerReference" VARCHAR(191),
  "providerTransactionId" VARCHAR(191),
  "providerEventId" VARCHAR(191),
  "idempotencyKey" VARCHAR(191) NOT NULL,
  "paymentCode" VARCHAR(64) NOT NULL,
  "paymentMethod" "DepositPaymentMethod" NOT NULL,
  "network" "DepositNetwork",
  "destinationAddress" VARCHAR(191),
  "exchangeRateSnapshot" JSONB,
  "confirmationStatus" "DepositConfirmationStatus" NOT NULL DEFAULT 'UNCONFIRMED',
  "confirmations" INTEGER NOT NULL DEFAULT 0,
  "requiredConfirmations" INTEGER NOT NULL DEFAULT 1,
  "rawProviderMetadata" JSONB,
  "confirmedAmount" DECIMAL(14,2),
  "confirmedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DepositIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DepositIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DepositIntent_idempotencyKey_key"
ON "DepositIntent"("idempotencyKey");

CREATE UNIQUE INDEX IF NOT EXISTS "DepositIntent_paymentCode_key"
ON "DepositIntent"("paymentCode");

CREATE UNIQUE INDEX IF NOT EXISTS "DepositIntent_provider_providerReference_key"
ON "DepositIntent"("provider", "providerReference");

CREATE UNIQUE INDEX IF NOT EXISTS "DepositIntent_provider_providerTransactionId_key"
ON "DepositIntent"("provider", "providerTransactionId");

CREATE UNIQUE INDEX IF NOT EXISTS "DepositIntent_provider_providerEventId_key"
ON "DepositIntent"("provider", "providerEventId");

CREATE INDEX IF NOT EXISTS "DepositIntent_userId_status_createdAt_idx"
ON "DepositIntent"("userId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "DepositIntent_status_expiresAt_idx"
ON "DepositIntent"("status", "expiresAt");

CREATE INDEX IF NOT EXISTS "DepositIntent_provider_status_createdAt_idx"
ON "DepositIntent"("provider", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "DepositIntent_paymentMethod_network_status_idx"
ON "DepositIntent"("paymentMethod", "network", "status");
