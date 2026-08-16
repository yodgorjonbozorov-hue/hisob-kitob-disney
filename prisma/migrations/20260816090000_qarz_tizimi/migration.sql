-- QARZ TIZIMI — buxgalteriya mantig'iga moslash.
--
-- XAVF: PAST. Jadval QAYTA QURILMAYDI (CREATE/INSERT/DROP/RENAME yo'q):
-- faqat `ADD COLUMN` va mavjud qatorlarni to'ldiruvchi `UPDATE`. Shuning
-- uchun `Debt` va `DebtPayment` ID'lari, FK bog'lanishlari va mavjud
-- ustunlar tegilmagan holda qoladi.
--
-- Nima uchun kerak: qarz "yopiq/ochiq" degan ikki holatdan iborat edi —
-- qisman to'langan qarzni ajratib bo'lmasdi, bekor qilib bo'lmasdi,
-- to'lov sanasi va to'lov turi saqlanmasdi (kirim har doim "bugun" bilan
-- va standart kassaga yozilardi), takror to'lovdan himoya yo'q edi.

-- ==== Debt: holat, sana, kategoriya, mas'ul va audit ustunlari ====

ALTER TABLE "Debt" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE "Debt" ADD COLUMN "sana" DATETIME;
-- SQLite'da REFERENCES bilan ustun qo'shish mumkin (standart NULL bo'lsa) —
-- jadvalni qayta qurmasdan tashqi kalit o'rnatiladi.
ALTER TABLE "Debt" ADD COLUMN "categoryId" TEXT REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Debt" ADD COLUMN "masulId" TEXT;
ALTER TABLE "Debt" ADD COLUMN "masulIsm" TEXT;
ALTER TABLE "Debt" ADD COLUMN "manbaTransactionId" TEXT;
ALTER TABLE "Debt" ADD COLUMN "updatedAt" DATETIME;
ALTER TABLE "Debt" ADD COLUMN "updatedBy" TEXT;
ALTER TABLE "Debt" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Debt" ADD COLUMN "cancelledBy" TEXT;
ALTER TABLE "Debt" ADD COLUMN "cancelReason" TEXT;

-- Mavjud qarzlarga sana: qachon yaratilgan bo'lsa — o'sha kun.
UPDATE "Debt" SET "sana" = "createdAt" WHERE "sana" IS NULL;

-- Mavjud qarzlarning holati `isYopilgan` + `tolangan` dan chiqariladi.
-- Invariant: remaining = jamiSumma - tolangan; remaining = 0 → PAID.
UPDATE "Debt" SET "status" = CASE
  WHEN "isYopilgan" = 1 THEN 'PAID'
  WHEN "tolangan" > 0 THEN 'PARTIALLY_PAID'
  ELSE 'OPEN'
END;

CREATE UNIQUE INDEX "Debt_manbaTransactionId_key" ON "Debt"("manbaTransactionId");
CREATE INDEX "Debt_businessId_status_turi_idx" ON "Debt"("businessId", "status", "turi");
CREATE INDEX "Debt_businessId_sana_idx" ON "Debt"("businessId", "sana");
CREATE INDEX "Debt_categoryId_idx" ON "Debt"("categoryId");

-- ==== DebtPayment: to'lov sanasi, to'lov turi, kassa va idempotentlik ====

ALTER TABLE "DebtPayment" ADD COLUMN "sana" DATETIME;
ALTER TABLE "DebtPayment" ADD COLUMN "tolovTuri" TEXT;
ALTER TABLE "DebtPayment" ADD COLUMN "accountId" TEXT;
ALTER TABLE "DebtPayment" ADD COLUMN "izoh" TEXT;
ALTER TABLE "DebtPayment" ADD COLUMN "idempotencyKey" TEXT;

-- Eski to'lovlar qachon yozilgan bo'lsa — o'sha kun to'lov sanasi.
UPDATE "DebtPayment" SET "sana" = "createdAt" WHERE "sana" IS NULL;

-- Takror to'lovdan himoya. NULL kalitlar bir-biriga ZID KELMAYDI (SQLite va
-- PostgreSQL ikkalasida ham), shuning uchun eski to'lovlar to'siq bo'lmaydi.
CREATE UNIQUE INDEX "DebtPayment_debtId_idempotencyKey_key" ON "DebtPayment"("debtId", "idempotencyKey");
CREATE INDEX "DebtPayment_businessId_sana_idx" ON "DebtPayment"("businessId", "sana");
