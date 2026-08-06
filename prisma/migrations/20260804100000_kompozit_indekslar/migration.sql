-- KOMPOZIT INDEKSLAR (H-5, H-10).
--
-- SQLite bitta so'rovda bitta indeksni ishlatadi, shuning uchun Transaction
-- modelidagi 6 ta bitta-ustunli indeks deyarli foydasiz edi va har yozuvni
-- sekinlashtirardi. Barcha real so'rovlar businessId + (filtr) + sana
-- ko'rinishida bo'ladi — indekslar shu shaklga moslandi.
--
-- Payment.externalId endi UNIQUE: bitta provider tranzaksiyasi ikki marta
-- yozilmasin (Payme/Click webhook so'rovni qayta yuborishi mumkin).
--
-- ⚠️ DIQQAT: bazada takroriy externalId bo'lsa quyidagi UNIQUE indeks
-- "UNIQUE constraint failed" bilan yiqiladi va migratsiya to'xtaydi
-- (ma'lumot buzilmaydi). Avval tekshiring:
--
--   SELECT externalId, COUNT(*) c FROM "Payment"
--   WHERE externalId IS NOT NULL GROUP BY externalId HAVING c > 1;
--
-- Natija bo'sh bo'lsa — bemalol davom eting. Aks holda dublikatlarni
-- qo'lda ko'rib chiqing (qaysi to'lov haqiqiy ekanini aniqlab, ortiqchasining
-- externalId'sini NULL qiling), keyin migratsiyani qayta ishga tushiring.

-- IF EXISTS / IF NOT EXISTS (2026-08-06): production bazada sxema drifti bor —
-- ba'zi eski indekslar (masalan AuditLog_businessId_idx) bazada yo'q, shuning
-- uchun oddiy DROP INDEX deploy'ni yiqitardi. Indeks amallari idempotent qilindi.

-- DropIndex
DROP INDEX IF EXISTS "AuditLog_businessId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Debt_businessId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Payment_externalId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Sale_businessId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_deletedAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_businessId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_turi_idx";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_sana_idx";


-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_businessId_createdAt_idx" ON "AuditLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Debt_businessId_isYopilgan_turi_idx" ON "Debt"("businessId", "isYopilgan", "turi");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_externalId_key" ON "Payment"("externalId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Sale_businessId_createdAt_idx" ON "Sale"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_businessId_deletedAt_sana_idx" ON "Transaction"("businessId", "deletedAt", "sana");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_businessId_turi_deletedAt_sana_idx" ON "Transaction"("businessId", "turi", "deletedAt", "sana");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_businessId_categoryId_sana_idx" ON "Transaction"("businessId", "categoryId", "sana");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Transaction_businessId_userId_sana_idx" ON "Transaction"("businessId", "userId", "sana");

