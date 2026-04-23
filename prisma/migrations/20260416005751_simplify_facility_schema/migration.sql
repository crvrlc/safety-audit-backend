/*
  Warnings:

  - You are about to drop the column `unitId` on the `Office` table. All the data in the column will be lost.
  - You are about to drop the `FacilityUnit` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FacilityUnit" DROP CONSTRAINT "FacilityUnit_facilityId_fkey";

-- DropForeignKey
ALTER TABLE "FacilityUnit" DROP CONSTRAINT "FacilityUnit_unitId_fkey";

-- DropForeignKey
ALTER TABLE "Office" DROP CONSTRAINT "Office_unitId_fkey";

-- DropIndex
DROP INDEX "Office_unitId_idx";

-- AlterTable
ALTER TABLE "Facility" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "facilityManagerEmail" TEXT,
ADD COLUMN     "facilityManagerName" TEXT,
ADD COLUMN     "unitInCharge" TEXT;

-- AlterTable
ALTER TABLE "Office" DROP COLUMN "unitId";

-- DropTable
DROP TABLE "FacilityUnit";
