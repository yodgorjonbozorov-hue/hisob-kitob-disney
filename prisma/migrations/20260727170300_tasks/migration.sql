-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "izoh" TEXT,
    "holat" TEXT NOT NULL DEFAULT 'OCHIQ',
    "masulId" TEXT NOT NULL,
    "muddat" DATETIME,
    "dealId" TEXT,
    "createdBy" TEXT NOT NULL,
    "bajarildiAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Task_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Task_businessId_holat_idx" ON "Task"("businessId", "holat");

-- CreateIndex
CREATE INDEX "Task_businessId_masulId_idx" ON "Task"("businessId", "masulId");

-- CreateIndex
CREATE INDEX "Task_businessId_muddat_idx" ON "Task"("businessId", "muddat");
