-- AUDIT JURNALI: tenant ustuni (H-2).
--
-- Ilgari AuditLog'da faqat `businessId` (nullable) bor edi. Biznesga
-- bog'lanmagan yozuvlar (foydalanuvchi yaratish, modul yoqish, biznes
-- o'chirish) `businessId: null` bilan tushardi va tenant filtri ularni
-- KO'RSATMASDI — ya'ni mijoz o'z kompaniyasidagi ba'zi amallarni jurnalda
-- umuman ko'ra olmasdi.
--
-- Endi har yozuvda `tenantId` bor. SUPERADMIN (platforma darajasidagi)
-- amallarda u null bo'lib qoladi.
--
-- Eski yozuvlar: businessId orqali tenant tiklanadi; businessId'siz eski
-- yozuvlar null bo'lib qoladi (ular tenantga tegishliligi noma'lum).

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "tenantId" TEXT;

-- Eski yozuvlarni to'ldirish (businessId bor bo'lganlari uchun).
UPDATE "AuditLog"
SET "tenantId" = (SELECT "tenantId" FROM "Business" WHERE "Business"."id" = "AuditLog"."businessId")
WHERE "businessId" IS NOT NULL AND "tenantId" IS NULL;

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
