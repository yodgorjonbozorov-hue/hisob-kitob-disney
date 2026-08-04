-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "qarzLimit" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Debt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'olinadigan',
    "saleId" TEXT,
    "productId" TEXT,
    "contactId" TEXT,
    "mijozNomi" TEXT NOT NULL,
    "mijozTel" TEXT,
    "jamiSumma" INTEGER NOT NULL,
    "tolangan" INTEGER NOT NULL DEFAULT 0,
    "isYopilgan" BOOLEAN NOT NULL DEFAULT false,
    "muddat" DATETIME,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Debt_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Debt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Debt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Debt_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Debt" ("businessId", "createdAt", "id", "isYopilgan", "izoh", "jamiSumma", "mijozNomi", "mijozTel", "muddat", "productId", "saleId", "tolangan", "turi", "userId") SELECT "businessId", "createdAt", "id", "isYopilgan", "izoh", "jamiSumma", "mijozNomi", "mijozTel", "muddat", "productId", "saleId", "tolangan", "turi", "userId" FROM "Debt";
DROP TABLE "Debt";
ALTER TABLE "new_Debt" RENAME TO "Debt";
CREATE UNIQUE INDEX "Debt_saleId_key" ON "Debt"("saleId");
CREATE INDEX "Debt_businessId_isYopilgan_turi_idx" ON "Debt"("businessId", "isYopilgan", "turi");
CREATE INDEX "Debt_businessId_turi_idx" ON "Debt"("businessId", "turi");
CREATE INDEX "Debt_businessId_contactId_isYopilgan_idx" ON "Debt"("businessId", "contactId", "isYopilgan");
CREATE INDEX "Debt_productId_idx" ON "Debt"("productId");
CREATE INDEX "Debt_contactId_idx" ON "Debt"("contactId");
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "miqdor" INTEGER NOT NULL,
    "birlikNarx" INTEGER NOT NULL,
    "tannarx" INTEGER NOT NULL,
    "jamiSumma" INTEGER NOT NULL,
    "tolovTuri" TEXT NOT NULL,
    "contactId" TEXT,
    "mijozNomi" TEXT,
    "mijozTel" TEXT,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "sana" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("birlikNarx", "businessId", "cancelReason", "cancelledBy", "createdAt", "deletedAt", "id", "jamiSumma", "mijozNomi", "mijozTel", "miqdor", "productId", "sana", "tannarx", "tolovTuri", "transactionId", "userId") SELECT "birlikNarx", "businessId", "cancelReason", "cancelledBy", "createdAt", "deletedAt", "id", "jamiSumma", "mijozNomi", "mijozTel", "miqdor", "productId", "sana", "tannarx", "tolovTuri", "transactionId", "userId" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_businessId_sana_idx" ON "Sale"("businessId", "sana");
CREATE INDEX "Sale_businessId_deletedAt_sana_idx" ON "Sale"("businessId", "deletedAt", "sana");
CREATE INDEX "Sale_productId_idx" ON "Sale"("productId");
CREATE INDEX "Sale_contactId_idx" ON "Sale"("contactId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

