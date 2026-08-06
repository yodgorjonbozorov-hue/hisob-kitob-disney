-- REFERENSIAL YAXLITLIK: har relatsiyaga aniq onDelete siyosati (C-8).
--
-- Ilgari sxemada birorta onDelete yo'q edi — o'chirishda xatti-harakat
-- aniqlanmagan edi (yetim yozuvlar yoki foydalanuvchiga 500 xato).
--
-- Siyosat:
--   Restrict — moliyaviy va tarixiy yozuvlar (Transaction, Sale, Debt,
--              DebtPayment, StockEntry, ProductExpense, Payment, Subscription,
--              Product, ShiftClose, Tenant -> Business/User/TenantModule).
--              Ular turgan ota yozuvni o'chirib bo'lmaydi — bu ataylab.
--   Cascade  — biznesga xos sozlama/CRM yozuvlari (Category, Budget,
--              RecurringTransaction, Contact, Stage, Deal, Task, Activity).
--   SetNull  — ixtiyoriy bog'lanishlar (Deal.contactId, Task.dealId,
--              Debt.productId, Activity.contactId/dealId, User.businessId,
--              AuditLog.businessId — audit izi biznes o'chsa ham qoladi).
--
-- SQLite'da FK o'zgartirish jadvalni qayta qurishni talab qiladi. Quyidagi
-- SQL har jadvalni INSERT ... SELECT bilan to'liq ko'chiradi — ma'lumot
-- yo'qolmaydi. Qayta qurish davomida FK tekshiruvi vaqtincha o'chiriladi va
-- oxirida qayta yoqiladi.


-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT,
    "dealId" TEXT,
    "turi" TEXT NOT NULL,
    "matn" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Activity" ("businessId", "contactId", "createdAt", "dealId", "id", "matn", "turi", "userId") SELECT "businessId", "contactId", "createdAt", "dealId", "id", "matn", "turi", "userId" FROM "Activity";
DROP TABLE "Activity";
ALTER TABLE "new_Activity" RENAME TO "Activity";
CREATE INDEX "Activity_businessId_dealId_idx" ON "Activity"("businessId", "dealId");
CREATE INDEX "Activity_businessId_contactId_idx" ON "Activity"("businessId", "contactId");
CREATE TABLE "new_Budget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "oy" TEXT NOT NULL,
    "limitSumma" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Budget_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Budget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Budget" ("businessId", "categoryId", "createdAt", "id", "limitSumma", "oy") SELECT "businessId", "categoryId", "createdAt", "id", "limitSumma", "oy" FROM "Budget";
DROP TABLE "Budget";
ALTER TABLE "new_Budget" RENAME TO "Budget";
CREATE INDEX "Budget_businessId_oy_idx" ON "Budget"("businessId", "oy");
CREATE UNIQUE INDEX "Budget_categoryId_oy_key" ON "Budget"("categoryId", "oy");
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomi" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "businessId" TEXT NOT NULL,
    CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("businessId", "createdAt", "id", "isActive", "nomi", "tartib", "turi") SELECT "businessId", "createdAt", "id", "isActive", "nomi", "tartib", "turi" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE INDEX "Category_turi_isActive_idx" ON "Category"("turi", "isActive");
CREATE INDEX "Category_businessId_idx" ON "Category"("businessId");
CREATE UNIQUE INDEX "Category_nomi_turi_businessId_key" ON "Category"("nomi", "turi", "businessId");
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "ism" TEXT NOT NULL,
    "tel" TEXT,
    "telegram" TEXT,
    "izoh" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Contact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("businessId", "createdAt", "createdBy", "deletedAt", "id", "ism", "izoh", "tel", "telegram") SELECT "businessId", "createdAt", "createdBy", "deletedAt", "id", "ism", "izoh", "tel", "telegram" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE INDEX "Contact_businessId_idx" ON "Contact"("businessId");
CREATE INDEX "Contact_businessId_tel_idx" ON "Contact"("businessId", "tel");
CREATE TABLE "new_Deal" (
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
    CONSTRAINT "Deal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Deal" ("businessId", "contactId", "createdAt", "deletedAt", "id", "izoh", "manba", "masulId", "muddat", "nomi", "stageId", "summa", "transactionId", "yopilganAt") SELECT "businessId", "contactId", "createdAt", "deletedAt", "id", "izoh", "manba", "masulId", "muddat", "nomi", "stageId", "summa", "transactionId", "yopilganAt" FROM "Deal";
DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";
CREATE INDEX "Deal_businessId_stageId_idx" ON "Deal"("businessId", "stageId");
CREATE INDEX "Deal_businessId_masulId_idx" ON "Deal"("businessId", "masulId");
CREATE TABLE "new_Debt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'olinadigan',
    "saleId" TEXT,
    "productId" TEXT,
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
    CONSTRAINT "Debt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Debt" ("businessId", "createdAt", "id", "isYopilgan", "izoh", "jamiSumma", "mijozNomi", "mijozTel", "muddat", "productId", "saleId", "tolangan", "turi", "userId") SELECT "businessId", "createdAt", "id", "isYopilgan", "izoh", "jamiSumma", "mijozNomi", "mijozTel", "muddat", "productId", "saleId", "tolangan", "turi", "userId" FROM "Debt";
DROP TABLE "Debt";
ALTER TABLE "new_Debt" RENAME TO "Debt";
CREATE UNIQUE INDEX "Debt_saleId_key" ON "Debt"("saleId");
CREATE INDEX "Debt_businessId_idx" ON "Debt"("businessId");
CREATE INDEX "Debt_businessId_turi_idx" ON "Debt"("businessId", "turi");
CREATE INDEX "Debt_productId_idx" ON "Debt"("productId");
CREATE TABLE "new_RecurringTransaction" (
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
    CONSTRAINT "RecurringTransaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RecurringTransaction" ("businessId", "categoryId", "createdAt", "id", "isActive", "izoh", "kun", "lastGenerated", "summa", "turi") SELECT "businessId", "categoryId", "createdAt", "id", "isActive", "izoh", "kun", "lastGenerated", "summa", "turi" FROM "RecurringTransaction";
DROP TABLE "RecurringTransaction";
ALTER TABLE "new_RecurringTransaction" RENAME TO "RecurringTransaction";
CREATE INDEX "RecurringTransaction_businessId_idx" ON "RecurringTransaction"("businessId");
CREATE TABLE "new_Stage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "tartib" INTEGER NOT NULL DEFAULT 0,
    "turi" TEXT NOT NULL DEFAULT 'OPEN',
    CONSTRAINT "Stage_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Stage" ("businessId", "id", "nomi", "tartib", "turi") SELECT "businessId", "id", "nomi", "tartib", "turi" FROM "Stage";
DROP TABLE "Stage";
ALTER TABLE "new_Stage" RENAME TO "Stage";
CREATE INDEX "Stage_businessId_tartib_idx" ON "Stage"("businessId", "tartib");
CREATE TABLE "new_Task" (
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
    CONSTRAINT "Task_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("bajarildiAt", "businessId", "createdAt", "createdBy", "dealId", "deletedAt", "holat", "id", "izoh", "masulId", "muddat", "nomi") SELECT "bajarildiAt", "businessId", "createdAt", "createdBy", "dealId", "deletedAt", "holat", "id", "izoh", "masulId", "muddat", "nomi" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_businessId_holat_idx" ON "Task"("businessId", "holat");
CREATE INDEX "Task_businessId_masulId_idx" ON "Task"("businessId", "masulId");
CREATE INDEX "Task_businessId_muddat_idx" ON "Task"("businessId", "muddat");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ism" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "parolHash" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "tenantId" TEXT,
    "businessId" TEXT,
    "telegramChatId" TEXT,
    "linkCode" TEXT,
    "linkCodeExpiresAt" DATETIME,
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("businessId", "createdAt", "id", "isActive", "ism", "lastLoginAt", "linkCode", "linkCodeExpiresAt", "login", "mustChangePassword", "parolHash", "rol", "telegramChatId", "tenantId") SELECT "businessId", "createdAt", "id", "isActive", "ism", "lastLoginAt", "linkCode", "linkCodeExpiresAt", "login", "mustChangePassword", "parolHash", "rol", "telegramChatId", "tenantId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");
CREATE INDEX "User_businessId_idx" ON "User"("businessId");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

