-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT,
    "userId" TEXT,
    "userIsm" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditLog" ("action", "after", "before", "businessId", "createdAt", "entity", "entityId", "id", "ip", "userId", "userIsm") SELECT "action", "after", "before", "businessId", "createdAt", "entity", "entityId", "id", "ip", "userId", "userIsm" FROM "AuditLog";
DROP TABLE "AuditLog";
ALTER TABLE "new_AuditLog" RENAME TO "AuditLog";
CREATE INDEX "AuditLog_businessId_idx" ON "AuditLog"("businessId");
CREATE INDEX "AuditLog_entity_idx" ON "AuditLog"("entity");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE TABLE "new_Debt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT,
    "mijozNomi" TEXT NOT NULL,
    "mijozTel" TEXT,
    "jamiSumma" INTEGER NOT NULL,
    "tolangan" INTEGER NOT NULL DEFAULT 0,
    "isYopilgan" BOOLEAN NOT NULL DEFAULT false,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Debt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Debt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Debt" ("businessId", "createdAt", "id", "isYopilgan", "izoh", "jamiSumma", "mijozNomi", "mijozTel", "saleId", "tolangan", "userId") SELECT "businessId", "createdAt", "id", "isYopilgan", "izoh", "jamiSumma", "mijozNomi", "mijozTel", "saleId", "tolangan", "userId" FROM "Debt";
DROP TABLE "Debt";
ALTER TABLE "new_Debt" RENAME TO "Debt";
CREATE UNIQUE INDEX "Debt_saleId_key" ON "Debt"("saleId");
CREATE INDEX "Debt_businessId_idx" ON "Debt"("businessId");
CREATE TABLE "new_DebtPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debtId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DebtPayment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_DebtPayment" ("businessId", "createdAt", "debtId", "id", "summa", "transactionId", "userId") SELECT "businessId", "createdAt", "debtId", "id", "summa", "transactionId", "userId" FROM "DebtPayment";
DROP TABLE "DebtPayment";
ALTER TABLE "new_DebtPayment" RENAME TO "DebtPayment";
CREATE INDEX "DebtPayment_debtId_idx" ON "DebtPayment"("debtId");
CREATE INDEX "DebtPayment_businessId_idx" ON "DebtPayment"("businessId");
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "miqdor" INTEGER NOT NULL,
    "birlikNarx" INTEGER NOT NULL,
    "tannarx" INTEGER NOT NULL,
    "jamiSumma" INTEGER NOT NULL,
    "tolovTuri" TEXT NOT NULL,
    "mijozNomi" TEXT,
    "mijozTel" TEXT,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("birlikNarx", "businessId", "createdAt", "id", "jamiSumma", "mijozNomi", "mijozTel", "miqdor", "productId", "tannarx", "tolovTuri", "transactionId", "userId") SELECT "birlikNarx", "businessId", "createdAt", "id", "jamiSumma", "mijozNomi", "mijozTel", "miqdor", "productId", "tannarx", "tolovTuri", "transactionId", "userId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_businessId_idx" ON "Sale"("businessId");
CREATE INDEX "Sale_productId_idx" ON "Sale"("productId");
CREATE TABLE "new_StockEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "miqdor" INTEGER NOT NULL,
    "birlikNarx" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StockEntry" ("birlikNarx", "businessId", "createdAt", "id", "izoh", "miqdor", "productId", "userId") SELECT "birlikNarx", "businessId", "createdAt", "id", "izoh", "miqdor", "productId", "userId" FROM "StockEntry";
DROP TABLE "StockEntry";
ALTER TABLE "new_StockEntry" RENAME TO "StockEntry";
CREATE INDEX "StockEntry_businessId_idx" ON "StockEntry"("businessId");
CREATE INDEX "StockEntry_productId_idx" ON "StockEntry"("productId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
