-- ---------------------------------------------------------------------------
-- SUPERADMIN 2.0 — CONTROL CENTER (ADDITIV MIGRATSIYA)
--
-- Bu migratsiyada HECH QANDAY jadval/ustun o'chirilmaydi va mavjud yozuv
-- qayta yozilmaydi. Faqat:
--   1) User ga ikkita ustun (superadmin roli, sessiya avlodi);
--   2) AuditLog ga ikkita ustun (userAgent, sabab);
--   3) uchta yangi jadval (FeatureFlag, SupportTicket, SupportMessage);
--   4) superadmin so'rovlari uchun indekslar.
--
-- ORQAGA MOSLIK:
--   · `sessionEpoch` = 0 — mavjud sessiyalar amalda qoladi, hech kim
--     tizimdan chiqarilmaydi;
--   · `superadminRol` mavjud superadminlarga 'ROOT' qilib to'ldiriladi —
--     ya'ni bugungi (cheklovsiz) xatti-harakat aynan saqlanadi;
--   · oddiy foydalanuvchida bu ustun NULL bo'lib qoladi.
-- ---------------------------------------------------------------------------

-- 1) Foydalanuvchi: superadmin roli va sessiya avlodi -----------------------
ALTER TABLE "User" ADD COLUMN "superadminRol" TEXT;
ALTER TABLE "User" ADD COLUMN "sessionEpoch" INTEGER NOT NULL DEFAULT 0;

-- Mavjud superadminlar ROOT bo'lib qoladi (imtiyoz o'zgarmaydi).
UPDATE "User" SET "superadminRol" = 'ROOT' WHERE "rol" = 'SUPERADMIN';

-- 2) Audit: qurilma satri va xavfli amal sababi -----------------------------
ALTER TABLE "AuditLog" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "sabab" TEXT;

-- 3) Yangi jadvallar --------------------------------------------------------
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kalit" TEXT NOT NULL,
    "nomi" TEXT NOT NULL,
    "tavsif" TEXT,
    "doira" TEXT NOT NULL DEFAULT 'GLOBAL',
    "yoqilgan" BOOLEAN NOT NULL DEFAULT false,
    "tenantIdlar" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "FeatureFlag_kalit_key" ON "FeatureFlag"("kalit");
CREATE INDEX "FeatureFlag_yoqilgan_idx" ON "FeatureFlag"("yoqilgan");

CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "masulId" TEXT,
    "mavzu" TEXT NOT NULL,
    "tavsif" TEXT NOT NULL,
    "holat" TEXT NOT NULL DEFAULT 'OCHIQ',
    "muhimlik" TEXT NOT NULL DEFAULT 'ORTA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "yopilganAt" DATETIME,
    CONSTRAINT "SupportTicket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupportTicket_masulId_fkey" FOREIGN KEY ("masulId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SupportTicket_tenantId_idx" ON "SupportTicket"("tenantId");
CREATE INDEX "SupportTicket_holat_createdAt_idx" ON "SupportTicket"("holat", "createdAt");
CREATE INDEX "SupportTicket_masulId_idx" ON "SupportTicket"("masulId");

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "muallifId" TEXT,
    "muallifIsm" TEXT NOT NULL,
    "matn" TEXT NOT NULL,
    "ichki" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SupportMessage_muallifId_fkey" FOREIGN KEY ("muallifId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- 4) Superadmin so'rovlari uchun indekslar ----------------------------------
-- Har biri panelda HAQIQATDA ishlatiladigan kesim; ortiqcha indeks qo'shilmadi.
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX "Tenant_createdAt_idx" ON "Tenant"("createdAt");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
CREATE INDEX "Subscription_periodEnd_idx" ON "Subscription"("periodEnd");
CREATE INDEX "User_rol_idx" ON "User"("rol");
