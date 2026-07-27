-- Tenant qatlami + backfill.
-- Mavjud barcha Business/User yozuvlari bitta default tenantga ("Disney Navoiy")
-- bog'lanadi, rollar yangi nomlarga map qilinadi:
--   admin -> OWNER, kassir -> CASHIER, sotuvchi -> SELLER.
-- Idempotent: INSERT OR IGNORE; bo'sh (yangi) bazada default tenant yaratilmaydi.

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" DATETIME,
    "currentPeriodEnd" DATETIME,
    "plan" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Backfill 1/3: default tenant — faqat bazada mavjud ma'lumot bo'lsa yaratiladi
-- (yangi bo'sh o'rnatishlarda signup/seed o'z tenantini yaratadi).
INSERT OR IGNORE INTO "Tenant" ("id", "name", "slug", "status", "plan", "createdAt", "updatedAt")
SELECT 'tenant_disney_navoiy', 'Disney Navoiy', 'disney-navoiy', 'ACTIVE', 'STANDARD', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "Business") OR EXISTS (SELECT 1 FROM "User");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Business" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomi" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "omborli" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL,
    CONSTRAINT "Business_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Backfill 2/3: mavjud bizneslar default tenantga bog'lanadi.
INSERT INTO "new_Business" ("createdAt", "id", "isActive", "nomi", "omborli", "tenantId")
SELECT "createdAt", "id", "isActive", "nomi", "omborli", 'tenant_disney_navoiy' FROM "Business";
DROP TABLE "Business";
ALTER TABLE "new_Business" RENAME TO "Business";
CREATE INDEX "Business_tenantId_idx" ON "Business"("tenantId");
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
    CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Backfill 3/3: mavjud foydalanuvchilar default tenantga bog'lanadi, rollar map qilinadi.
INSERT INTO "new_User" ("businessId", "createdAt", "id", "isActive", "ism", "lastLoginAt", "linkCode", "linkCodeExpiresAt", "login", "mustChangePassword", "parolHash", "rol", "telegramChatId", "tenantId")
SELECT "businessId", "createdAt", "id", "isActive", "ism", "lastLoginAt", "linkCode", "linkCodeExpiresAt", "login", "mustChangePassword", "parolHash",
    CASE "rol"
        WHEN 'admin' THEN 'OWNER'
        WHEN 'kassir' THEN 'CASHIER'
        WHEN 'sotuvchi' THEN 'SELLER'
        ELSE "rol"
    END,
    "telegramChatId", 'tenant_disney_navoiy'
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_login_key" ON "User"("login");
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");
CREATE INDEX "User_businessId_idx" ON "User"("businessId");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
