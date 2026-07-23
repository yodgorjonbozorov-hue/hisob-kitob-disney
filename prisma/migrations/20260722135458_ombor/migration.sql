-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "kelganNarx" INTEGER NOT NULL DEFAULT 0,
    "sotuvNarx" INTEGER NOT NULL DEFAULT 0,
    "miqdor" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "miqdor" INTEGER NOT NULL,
    "birlikNarx" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Sale" (
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
    CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Debt" (
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
    CONSTRAINT "Debt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DebtPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debtId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomi" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "omborli" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Business" ("createdAt", "id", "isActive", "nomi") SELECT "createdAt", "id", "isActive", "nomi" FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");

-- CreateIndex
CREATE INDEX "StockEntry_businessId_idx" ON "StockEntry"("businessId");

-- CreateIndex
CREATE INDEX "StockEntry_productId_idx" ON "StockEntry"("productId");

-- CreateIndex
CREATE INDEX "Sale_businessId_idx" ON "Sale"("businessId");

-- CreateIndex
CREATE INDEX "Sale_productId_idx" ON "Sale"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Debt_saleId_key" ON "Debt"("saleId");

-- CreateIndex
CREATE INDEX "Debt_businessId_idx" ON "Debt"("businessId");

-- CreateIndex
CREATE INDEX "DebtPayment_debtId_idx" ON "DebtPayment"("debtId");

-- CreateIndex
CREATE INDEX "DebtPayment_businessId_idx" ON "DebtPayment"("businessId");
