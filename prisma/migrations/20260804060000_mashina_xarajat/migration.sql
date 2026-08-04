-- Mashina/mahsulotga bog'langan xarajatlar (avto rejimi uchun eng muhim).
-- Sof foyda = sotuv narxi − olingan narx − shu mashinaga yozilgan xarajatlar.
CREATE TABLE "ProductExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT,
    "debtId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductExpense_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductExpense_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProductExpense_businessId_idx" ON "ProductExpense"("businessId");

-- CreateIndex
CREATE INDEX "ProductExpense_productId_idx" ON "ProductExpense"("productId");
