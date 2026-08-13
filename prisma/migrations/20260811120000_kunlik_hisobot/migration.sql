-- KUNLIK HISOBOT moduli: DailyReport, DailyTransaction, DailyReportSetting.
-- Faqat CREATE TABLE — mavjud jadvallarga tegilmaydi (xavf: past).

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "sana" DATETIME NOT NULL,
    "holat" TEXT NOT NULL DEFAULT 'OPEN',
    "naqdSumma" INTEGER NOT NULL DEFAULT 0,
    "clickSumma" INTEGER NOT NULL DEFAULT 0,
    "qarzSumma" INTEGER NOT NULL DEFAULT 0,
    "jamiSumma" INTEGER NOT NULL DEFAULT 0,
    "confirmedBy" TEXT,
    "confirmedByIsm" TEXT,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyReport_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "tolovTuri" TEXT NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "userIsm" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "DailyTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DailyTransaction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyReportSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "direktorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyReportSetting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DailyReport_businessId_holat_sana_idx" ON "DailyReport"("businessId", "holat", "sana");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_businessId_sana_key" ON "DailyReport"("businessId", "sana");

-- CreateIndex
CREATE INDEX "DailyTransaction_reportId_deletedAt_idx" ON "DailyTransaction"("reportId", "deletedAt");

-- CreateIndex
CREATE INDEX "DailyTransaction_businessId_deletedAt_createdAt_idx" ON "DailyTransaction"("businessId", "deletedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportSetting_businessId_key" ON "DailyReportSetting"("businessId");
