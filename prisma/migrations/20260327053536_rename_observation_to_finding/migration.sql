/*
  Warnings:

  - You are about to drop the column `observationId` on the `Evidence` table. All the data in the column will be lost.
  - You are about to drop the column `observationId` on the `MaintenanceTask` table. All the data in the column will be lost.
  - You are about to drop the `Observation` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `findingId` to the `MaintenanceTask` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Evidence" DROP CONSTRAINT "Evidence_observationId_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceTask" DROP CONSTRAINT "MaintenanceTask_observationId_fkey";

-- DropForeignKey
ALTER TABLE "Observation" DROP CONSTRAINT "Observation_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "Observation" DROP CONSTRAINT "Observation_auditId_fkey";

-- DropIndex
DROP INDEX "Evidence_observationId_idx";

-- DropIndex
DROP INDEX "MaintenanceTask_observationId_idx";

-- AlterTable
ALTER TABLE "Evidence" DROP COLUMN "observationId",
ADD COLUMN     "findingId" INTEGER;

-- AlterTable
ALTER TABLE "MaintenanceTask" DROP COLUMN "observationId",
ADD COLUMN     "findingId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Observation";

-- CreateTable
CREATE TABLE "Finding" (
    "id" SERIAL NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "Severity",
    "correctiveAction" TEXT,
    "resolutionStatus" "ResolutionStatus" NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "auditId" INTEGER NOT NULL,
    "assignedTo" INTEGER,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Finding_auditId_idx" ON "Finding"("auditId");

-- CreateIndex
CREATE INDEX "Finding_assignedTo_idx" ON "Finding"("assignedTo");

-- CreateIndex
CREATE INDEX "Evidence_findingId_idx" ON "Evidence"("findingId");

-- CreateIndex
CREATE INDEX "MaintenanceTask_findingId_idx" ON "MaintenanceTask"("findingId");

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTask" ADD CONSTRAINT "MaintenanceTask_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "Finding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
