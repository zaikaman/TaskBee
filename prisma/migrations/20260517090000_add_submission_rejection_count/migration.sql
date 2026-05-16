ALTER TABLE "Submission"
ADD COLUMN "rejectionCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Submission"
SET "rejectionCount" = 1
WHERE "status" = 'REJECTED' AND "rejectionCount" = 0;
