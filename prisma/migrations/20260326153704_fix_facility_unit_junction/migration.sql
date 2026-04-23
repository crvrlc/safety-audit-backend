/*
  Warnings:

  - You are about to drop the column `facilityId` on the `Unit` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Unit" DROP CONSTRAINT "Unit_facilityId_fkey";

-- DropIndex
DROP INDEX "Unit_facilityId_idx";

-- AlterTable
ALTER TABLE "Unit" DROP COLUMN "facilityId";

-- CreateTable
CREATE TABLE "FacilityUnit" (
    "id" SERIAL NOT NULL,
    "facilityId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,

    CONSTRAINT "FacilityUnit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FacilityUnit_facilityId_idx" ON "FacilityUnit"("facilityId");

-- CreateIndex
CREATE INDEX "FacilityUnit_unitId_idx" ON "FacilityUnit"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityUnit_facilityId_unitId_key" ON "FacilityUnit"("facilityId", "unitId");

-- AddForeignKey
ALTER TABLE "FacilityUnit" ADD CONSTRAINT "FacilityUnit_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityUnit" ADD CONSTRAINT "FacilityUnit_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
