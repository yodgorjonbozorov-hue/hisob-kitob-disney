-- CreateTable
CREATE TABLE "ShiftClose" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userIsm" TEXT,
    "sana" DATETIME NOT NULL,
    "kutilganNaqd" INTEGER NOT NULL,
    "sanalganNaqd" INTEGER NOT NULL,
    "farq" INTEGER NOT NULL,
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftClose_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "izoh" TEXT,
    "kun" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGenerated" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShiftClose_businessId_sana_idx" ON "ShiftClose"("businessId", "sana");

-- CreateIndex
CREATE INDEX "RecurringTransaction_businessId_idx" ON "RecurringTransaction"("businessId");
