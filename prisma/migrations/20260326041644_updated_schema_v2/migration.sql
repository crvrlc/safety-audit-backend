/*
  Warnings:

  - You are about to drop the column `facilityId` on the `Audit` table. All the data in the column will be lost.
  - The `status` column on the `Audit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `question` on the `ChecklistItem` table. All the data in the column will be lost.
  - You are about to drop the column `section` on the `ChecklistItem` table. All the data in the column will be lost.
  - You are about to drop the column `templateId` on the `ChecklistItem` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Facility` table. All the data in the column will be lost.
  - The `status` column on the `MaintenanceTask` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `checklistItemId` on the `Observation` table. All the data in the column will be lost.
  - The `severity` column on the `Observation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `resolutionStatus` column on the `Observation` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[inspectionCode]` on the table `Audit` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `inspectionCode` to the `Audit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `inspectionType` to the `Audit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `officeId` to the `Audit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order` to the `ChecklistItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sectionId` to the `ChecklistItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `statement` to the `ChecklistItem` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `role` on the `User` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'safety_officer', 'facility_manager');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('draft', 'scheduled', 'ongoing', 'submitted', 'completed');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('routine', 'follow_up');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('pending', 'ongoing', 'resolved');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('waiting_for_repairs', 'overdue_repairs', 'completed_repairs');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- DropForeignKey
ALTER TABLE "Audit" DROP CONSTRAINT "Audit_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "ChecklistItem" DROP CONSTRAINT "ChecklistItem_templateId_fkey";

-- DropForeignKey
ALTER TABLE "Observation" DROP CONSTRAINT "Observation_checklistItemId_fkey";

-- AlterTable
ALTER TABLE "Audit" DROP COLUMN "facilityId",
ADD COLUMN     "inspectionCode" TEXT NOT NULL,
ADD COLUMN     "inspectionType" "InspectionType" NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "officeId" INTEGER NOT NULL,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
DROP COLUMN "status",
ADD COLUMN     "status" "AuditStatus" NOT NULL DEFAULT 'draft';

-- AlterTable
ALTER TABLE "AuditResponse" ADD COLUMN     "isNASection" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ChecklistItem" DROP COLUMN "question",
DROP COLUMN "section",
DROP COLUMN "templateId",
ADD COLUMN     "order" INTEGER NOT NULL,
ADD COLUMN     "sectionId" INTEGER NOT NULL,
ADD COLUMN     "statement" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "fileType" TEXT;

-- AlterTable
ALTER TABLE "Facility" DROP COLUMN "type";

-- AlterTable
ALTER TABLE "MaintenanceTask" DROP COLUMN "status",
ADD COLUMN     "status" "MaintenanceStatus" NOT NULL DEFAULT 'waiting_for_repairs';

-- AlterTable
ALTER TABLE "Observation" DROP COLUMN "checklistItemId",
DROP COLUMN "severity",
ADD COLUMN     "severity" "Severity",
DROP COLUMN "resolutionStatus",
ADD COLUMN     "resolutionStatus" "ResolutionStatus" NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL;

-- CreateTable
CREATE TABLE "Unit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "facilityId" INTEGER NOT NULL,
    "managerId" INTEGER,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "facilityId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistSection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,

    CONSTRAINT "ChecklistSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditReport" (
    "id" SERIAL NOT NULL,
    "reportUrl" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "auditId" INTEGER NOT NULL,

    CONSTRAINT "AuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Unit_facilityId_idx" ON "Unit"("facilityId");

-- CreateIndex
CREATE INDEX "Unit_managerId_idx" ON "Unit"("managerId");

-- CreateIndex
CREATE INDEX "Office_facilityId_idx" ON "Office"("facilityId");

-- CreateIndex
CREATE INDEX "Office_unitId_idx" ON "Office"("unitId");

-- CreateIndex
CREATE INDEX "ChecklistSection_templateId_idx" ON "ChecklistSection"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditReport_auditId_key" ON "AuditReport"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "Audit_inspectionCode_key" ON "Audit"("inspectionCode");

-- CreateIndex
CREATE INDEX "Audit_officeId_idx" ON "Audit"("officeId");

-- CreateIndex
CREATE INDEX "Audit_inspectorId_idx" ON "Audit"("inspectorId");

-- CreateIndex
CREATE INDEX "Audit_templateId_idx" ON "Audit"("templateId");

-- CreateIndex
CREATE INDEX "Audit_status_idx" ON "Audit"("status");

-- CreateIndex
CREATE INDEX "AuditResponse_auditId_idx" ON "AuditResponse"("auditId");

-- CreateIndex
CREATE INDEX "AuditResponse_checklistItemId_idx" ON "AuditResponse"("checklistItemId");

-- CreateIndex
CREATE INDEX "ChecklistItem_sectionId_idx" ON "ChecklistItem"("sectionId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_createdBy_idx" ON "ChecklistTemplate"("createdBy");

-- CreateIndex
CREATE INDEX "Evidence_observationId_idx" ON "Evidence"("observationId");

-- CreateIndex
CREATE INDEX "Evidence_auditResponseId_idx" ON "Evidence"("auditResponseId");

-- CreateIndex
CREATE INDEX "Evidence_uploadedBy_idx" ON "Evidence"("uploadedBy");

-- CreateIndex
CREATE INDEX "MaintenanceTask_observationId_idx" ON "MaintenanceTask"("observationId");

-- CreateIndex
CREATE INDEX "MaintenanceTask_assignedTo_idx" ON "MaintenanceTask"("assignedTo");

-- CreateIndex
CREATE INDEX "Observation_auditId_idx" ON "Observation"("auditId");

-- CreateIndex
CREATE INDEX "Observation_assignedTo_idx" ON "Observation"("assignedTo");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistSection" ADD CONSTRAINT "ChecklistSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ChecklistSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditReport" ADD CONSTRAINT "AuditReport_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
