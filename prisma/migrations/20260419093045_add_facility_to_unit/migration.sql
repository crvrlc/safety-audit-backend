-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "facilityId" INTEGER;

-- CreateIndex
CREATE INDEX "Unit_facilityId_idx" ON "Unit"("facilityId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;
