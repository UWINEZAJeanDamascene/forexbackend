ALTER TABLE "Analysis" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE "Analysis" ADD COLUMN "snapshotKey" TEXT;
CREATE UNIQUE INDEX "Analysis_userId_snapshotKey_key" ON "Analysis"("userId", "snapshotKey");