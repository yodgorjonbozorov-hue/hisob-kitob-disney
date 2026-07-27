-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "plan" TEXT;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "ism" TEXT NOT NULL,
    "tel" TEXT,
    "telegram" TEXT,
    "izoh" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Contact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "turi" TEXT NOT NULL DEFAULT 'OPEN',
    CONSTRAINT "Stage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT,
    "nomi" TEXT NOT NULL,
    "summa" INTEGER NOT NULL DEFAULT 0,
    "stageId" TEXT NOT NULL,
    "masulId" TEXT NOT NULL,
    "manba" TEXT,
    "muddat" DATETIME,
    "yopilganAt" DATETIME,
    "transactionId" TEXT,
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Deal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT,
    "dealId" TEXT,
    "turi" TEXT NOT NULL,
    "matn" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Contact_businessId_idx" ON "Contact"("businessId");

-- CreateIndex
CREATE INDEX "Contact_businessId_tel_idx" ON "Contact"("businessId", "tel");

-- CreateIndex
CREATE INDEX "Stage_businessId_tartib_idx" ON "Stage"("businessId", "tartib");

-- CreateIndex
CREATE INDEX "Deal_businessId_stageId_idx" ON "Deal"("businessId", "stageId");

-- CreateIndex
CREATE INDEX "Deal_businessId_masulId_idx" ON "Deal"("businessId", "masulId");

-- CreateIndex
CREATE INDEX "Activity_businessId_dealId_idx" ON "Activity"("businessId", "dealId");

-- CreateIndex
CREATE INDEX "Activity_businessId_contactId_idx" ON "Activity"("businessId", "contactId");
