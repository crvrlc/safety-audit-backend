-- migrate:noTransaction

-- Step 1: Add new AuditStatus values
ALTER TYPE "AuditStatus" ADD VALUE IF NOT EXISTS 'acknowledged';
ALTER TYPE "AuditStatus" ADD VALUE IF NOT EXISTS 'resolving';
ALTER TYPE "AuditStatus" ADD VALUE IF NOT EXISTS 'pending_review';

-- Step 2: Drop Finding FK constraints
ALTER TABLE "Evidence" DROP CONSTRAINT IF EXISTS "Evidence_findingId_fkey";
ALTER TABLE "Finding" DROP CONSTRAINT IF EXISTS "Finding_assignedTo_fkey";
ALTER TABLE "Finding" DROP CONSTRAINT IF EXISTS "Finding_auditId_fkey";
ALTER TABLE "MaintenanceTask" DROP CONSTRAINT IF EXISTS "MaintenanceTask_assignedTo_fkey";
ALTER TABLE "MaintenanceTask" DROP CONSTRAINT IF EXISTS "MaintenanceTask_findingId_fkey";

-- Step 3: Drop indexes
DROP INDEX IF EXISTS "Evidence_findingId_idx";
DROP INDEX IF EXISTS "MaintenanceTask_assignedTo_idx";
DROP INDEX IF EXISTS "MaintenanceTask_findingId_idx";

-- Step 4: Drop Finding table
DROP TABLE IF EXISTS "Finding";

-- Step 5: Replace ResolutionStatus enum (no existing column to migrate, Finding is gone)
DROP TYPE IF EXISTS "ResolutionStatus";
CREATE TYPE "ResolutionStatus" AS ENUM ('pending', 'assigned', 'resolved');

-- Step 6: Replace Severity enum (AuditResponse.severity may not exist yet either)
DROP TYPE IF EXISTS "Severity";
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high');

-- Step 7: Alter Audit table
ALTER TABLE "Audit"
  ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt"    TIMESTAMP(3);

-- Step 8: Alter AuditResponse — add all new columns fresh
ALTER TABLE "AuditResponse"
  ADD COLUMN IF NOT EXISTS "assignedTo"         TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionEvidence" TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionNote"     TEXT,
  ADD COLUMN IF NOT EXISTS "resolutionStatus"   "ResolutionStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "resolvedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "severity"           "Severity" DEFAULT 'medium';

ALTER TABLE "AuditResponse"
  ALTER COLUMN "correctiveAction" SET DEFAULT '',
  ALTER COLUMN "finding"          SET DEFAULT '';

-- Step 9: Clean up Evidence and MaintenanceTask
ALTER TABLE "Evidence" DROP COLUMN IF EXISTS "findingId";
ALTER TABLE "MaintenanceTask" DROP COLUMN IF EXISTS "findingId";
ALTER TABLE "MaintenanceTask" DROP COLUMN IF EXISTS "assignedTo";

ALTER TABLE "MaintenanceTask"
  ADD COLUMN IF NOT EXISTS "assignedUserId"  INTEGER,
  ADD COLUMN IF NOT EXISTS "auditResponseId" INTEGER,
  ADD COLUMN IF NOT EXISTS "assignedTo"      TEXT;

-- Step 10: Add indexes
CREATE INDEX IF NOT EXISTS "MaintenanceTask_auditResponseId_idx" ON "MaintenanceTask"("auditResponseId");
CREATE INDEX IF NOT EXISTS "MaintenanceTask_assignedUserId_idx"  ON "MaintenanceTask"("assignedUserId");

-- Step 11: Add foreign keys
ALTER TABLE "MaintenanceTask"
  ADD CONSTRAINT "MaintenanceTask_auditResponseId_fkey"
  FOREIGN KEY ("auditResponseId") REFERENCES "AuditResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceTask"
  ADD CONSTRAINT "MaintenanceTask_assignedUserId_fkey"
  FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;