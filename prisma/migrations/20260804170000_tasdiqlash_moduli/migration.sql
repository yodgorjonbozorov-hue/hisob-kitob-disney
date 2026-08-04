-- CreateTable
CREATE TABLE "ApprovalRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "chegara" INTEGER NOT NULL,
    "tasdiqlovchiRol" TEXT NOT NULL DEFAULT 'OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "ApprovalRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "ruleId" TEXT,
    "categoryId" TEXT NOT NULL,
    "accountId" TEXT,
    "summa" INTEGER NOT NULL,
    "sana" DATETIME NOT NULL,
    "izoh" TEXT,
    "filial" TEXT,
    "holat" TEXT NOT NULL DEFAULT 'kutilmoqda',
    "userId" TEXT NOT NULL,
    "tasdiqlovchiId" TEXT,
    "qarorSana" DATETIME,
    "radSabab" TEXT,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ApprovalRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_tasdiqlovchiId_fkey" FOREIGN KEY ("tasdiqlovchiId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRequest_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ApprovalRule_businessId_isActive_deletedAt_idx" ON "ApprovalRule"("businessId", "isActive", "deletedAt");

-- CreateIndex
CREATE INDEX "ApprovalRule_categoryId_idx" ON "ApprovalRule"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_transactionId_key" ON "ApprovalRequest"("transactionId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_businessId_holat_createdAt_idx" ON "ApprovalRequest"("businessId", "holat", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_businessId_userId_idx" ON "ApprovalRequest"("businessId", "userId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_categoryId_idx" ON "ApprovalRequest"("categoryId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_accountId_idx" ON "ApprovalRequest"("accountId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_userId_idx" ON "ApprovalRequest"("userId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_tasdiqlovchiId_idx" ON "ApprovalRequest"("tasdiqlovchiId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_ruleId_idx" ON "ApprovalRequest"("ruleId");

