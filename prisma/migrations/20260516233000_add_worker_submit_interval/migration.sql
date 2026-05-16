ALTER TABLE "User"
ADD COLUMN "submitTaskIntervalSeconds" INTEGER NOT NULL DEFAULT 180,
ADD COLUMN "lastTaskCompletedAt" TIMESTAMPTZ;

CREATE INDEX "User_submitTaskIntervalSeconds_idx" ON "User"("submitTaskIntervalSeconds");
