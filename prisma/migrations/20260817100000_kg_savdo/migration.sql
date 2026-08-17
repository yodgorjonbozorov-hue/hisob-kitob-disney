-- KG SAVDOSI (mijozga xos — Fortex Selos).
--
-- Faqat USTUN QO'SHILADI, jadval qayta qurilmaydi — mavjud ma'lumotga
-- umuman tegilmaydi (xavf: past). Eski yozuvlarda `miqdorGr` va `kgNarxi`
-- NULL bo'lib qoladi: kirim/chiqim jamilari, kassa qoldig'i, qarzlar va
-- hisobot raqamlari o'zgarmaydi.
--
-- Miqdor ataylab GRAMDA (butun son): og'irlik ham pul kabi float bo'lmasin
-- (100,5 kg → 100500). Summa server tomonda qayta hisoblanadi (lib/kg.ts).

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "miqdorGr" INTEGER;
ALTER TABLE "Transaction" ADD COLUMN "kgNarxi" INTEGER;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN "kgAsosli" BOOLEAN NOT NULL DEFAULT false;

-- BOSHLANG'ICH HOLAT — FAQAT FORTEX SELOS UCHUN.
--
-- Bayroq boshqa mijozlarda `false` bo'lib qoladi, ya'ni ularning "Pul kirdi"
-- ekrani va kategoriyalari zarracha o'zgarmaydi. Shart tenant nomi/slugiga
-- bog'langan (lib/mijozXos.ts dagi ro'yxat bilan bir xil mantiq), shuning
-- uchun boshqa kompaniyadagi "Selos" nomli kategoriya tegilmaydi.
UPDATE "Category"
SET "kgAsosli" = true
WHERE "turi" = 'kirim'
  AND LOWER("nomi") LIKE '%selos%'
  AND "businessId" IN (
    SELECT "Business"."id"
    FROM "Business"
    JOIN "Tenant" ON "Tenant"."id" = "Business"."tenantId"
    WHERE LOWER("Tenant"."slug") LIKE 'fortex-selos%'
       OR LOWER("Tenant"."name") LIKE 'fortex selos%'
  );
