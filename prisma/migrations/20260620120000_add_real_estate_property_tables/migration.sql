-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('OWNERSHIP', 'BARE_OWNERSHIP', 'OTHER');

-- CreateTable
CREATE TABLE "RealEstateProperty" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "addressStreet" TEXT,
    "addressZipCode" TEXT,
    "addressCity" TEXT,
    "addressProvince" TEXT,
    "addressCountry" TEXT,
    "currency" TEXT NOT NULL,
    "ownershipPercentage" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "propertyType" "PropertyType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "RealEstateProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealEstatePropertyValuation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "propertyId" TEXT NOT NULL,

    CONSTRAINT "RealEstatePropertyValuation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RealEstateProperty_id_userId_key" ON "RealEstateProperty"("id", "userId");

-- CreateIndex
CREATE INDEX "RealEstateProperty_userId_idx" ON "RealEstateProperty"("userId");

-- CreateIndex
CREATE INDEX "RealEstateProperty_createdAt_idx" ON "RealEstateProperty"("createdAt");

-- CreateIndex
CREATE INDEX "RealEstatePropertyValuation_propertyId_idx" ON "RealEstatePropertyValuation"("propertyId");

-- CreateIndex
CREATE INDEX "RealEstatePropertyValuation_date_idx" ON "RealEstatePropertyValuation"("date");

-- AddForeignKey
ALTER TABLE "RealEstateProperty" ADD CONSTRAINT "RealEstateProperty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealEstatePropertyValuation" ADD CONSTRAINT "RealEstatePropertyValuation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RealEstateProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
