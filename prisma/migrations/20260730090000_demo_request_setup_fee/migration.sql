-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "setupFeeAmountUsd" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN "setupFeePaidAt" DATETIME;

-- CreateTable
CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ism" TEXT NOT NULL,
    "telefon" TEXT NOT NULL,
    "biznesTuri" TEXT NOT NULL,
    "izoh" TEXT,
    "status" TEXT NOT NULL DEFAULT 'YANGI',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "DemoRequest_status_idx" ON "DemoRequest"("status");

-- CreateIndex
CREATE INDEX "DemoRequest_createdAt_idx" ON "DemoRequest"("createdAt");

