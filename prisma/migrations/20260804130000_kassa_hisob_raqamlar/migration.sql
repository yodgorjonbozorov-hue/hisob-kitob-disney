-- KASSA VA HISOB-RAQAMLAR (Faza 4.1).
--
-- Ilgari hamma pul bitta "qop"da edi: naqd sotuv, plastik to'lov va bankdagi
-- pul bir joyda ko'rinardi — direktor "kassada qancha naqd bor?" degan eng
-- oddiy savolga javob ololmasdi.
--
-- Yangi:
--   Account          — kassa/hisob-raqam (naqd, plastik, bank);
--   AccountTransfer  — kassalar aro pul ko'chirish (Transaction YOZMAYDI,
--                      chunki bu kirim ham, chiqim ham emas);
--   Transaction.accountId — qaysi kassaga tushgani (nullable, eski yozuvlar uchun).
--
-- ⚠️ MIGRATSIYADAN KEYIN: `npm run kassa:migratsiya` ishga tushiring —
-- u har biznesga default "Naqd kassa" yaratadi va accountId'siz eski
-- tranzaksiyalarni o'shanga bog'laydi. Skriptsiz eski yozuvlar hech qaysi
-- kassaga tegishli bo'lmay qoladi va kassa qoldig'i noto'g'ri ko'rinadi.


-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'naqd',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccountTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "sana" DATETIME NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountTransfer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccountTransfer_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AccountTransfer_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "turi" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "accountId" TEXT,
    "summa" INTEGER NOT NULL,
    "sana" DATETIME NOT NULL,
    "izoh" TEXT,
    "userId" TEXT NOT NULL,
    "filial" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("businessId", "categoryId", "createdAt", "deletedAt", "filial", "id", "izoh", "sana", "summa", "turi", "userId") SELECT "businessId", "categoryId", "createdAt", "deletedAt", "filial", "id", "izoh", "sana", "summa", "turi", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_businessId_deletedAt_sana_idx" ON "Transaction"("businessId", "deletedAt", "sana");
CREATE INDEX "Transaction_businessId_turi_deletedAt_sana_idx" ON "Transaction"("businessId", "turi", "deletedAt", "sana");
CREATE INDEX "Transaction_businessId_categoryId_sana_idx" ON "Transaction"("businessId", "categoryId", "sana");
CREATE INDEX "Transaction_businessId_userId_sana_idx" ON "Transaction"("businessId", "userId", "sana");
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "Transaction_businessId_accountId_sana_idx" ON "Transaction"("businessId", "accountId", "sana");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Account_businessId_isActive_tartib_idx" ON "Account"("businessId", "isActive", "tartib");

-- CreateIndex
CREATE UNIQUE INDEX "Account_businessId_nomi_key" ON "Account"("businessId", "nomi");

-- CreateIndex
CREATE INDEX "AccountTransfer_businessId_sana_idx" ON "AccountTransfer"("businessId", "sana");

