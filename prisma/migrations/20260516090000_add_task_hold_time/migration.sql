-- Thêm thời gian giữ slot cho mỗi công việc, mặc định 90 phút như giới hạn tối đa của SproutGigs.
ALTER TABLE "Task"
ADD COLUMN IF NOT EXISTS "holdTimeMinutes" INTEGER NOT NULL DEFAULT 90;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_holdTimeMinutes_check"
CHECK ("holdTimeMinutes" BETWEEN 5 AND 90);

UPDATE "TaskClaim"
SET "expiresAt" = "TaskClaim"."claimedAt" + ("Task"."holdTimeMinutes" * INTERVAL '1 minute')
FROM "Task"
WHERE "TaskClaim"."taskId" = "Task"."id"
  AND "TaskClaim"."status" = 'CLAIMED'
  AND "TaskClaim"."expiresAt" IS NULL;

CREATE INDEX IF NOT EXISTS "TaskClaim_status_expiresAt_idx"
ON "TaskClaim"("status", "expiresAt");
