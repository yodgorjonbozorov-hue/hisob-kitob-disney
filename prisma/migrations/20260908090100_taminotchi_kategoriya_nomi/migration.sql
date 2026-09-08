-- TA'MINOTCHI SABABINING NOMI ANIQLASHTIRILDI.
--
-- Moliya formasida ta'minotchi tanlanganda ro'yxat ikki variantga
-- qisqartirildi (lib/moliya/sabablar.ts): "Ta'minotchiga pul berish" va
-- "Ta'minotchi qarzini to'lash". Birinchisining eski nomi
-- "Ta'minotchiga to'lov" edi.
--
-- Nega UPDATE va nega xavfsiz: sabab — bu KATEGORIYA (`Category`), ya'ni
-- hisobot kesimi. Yangi nom bilan yangi kategoriya yaratilsa bir xil
-- ma'nodagi pul ikki ustunga bo'linib ketardi. Nomni o'zgartirish esa
-- `Category.id` ni saqlaydi — barcha tranzaksiyalar o'sha qatorga
-- bog'langanicha qoladi va birorta summa harakatlanmaydi.
--
-- IDEMPOTENT VA CHEKLOVGA XAVFSIZ: `@@unique([nomi, turi, businessId])`
-- buzilmasligi uchun yangi nom shu biznesda ALLAQACHON bo'lsa qator
-- tegilmaydi (u holda eski kategoriya o'z nomi bilan qolaveradi va
-- direktor ularni qo'lda birlashtira oladi).
UPDATE "Category"
SET "nomi" = 'Ta''minotchiga pul berish'
WHERE "turi" = 'chiqim'
  AND "nomi" = 'Ta''minotchiga to''lov'
  AND NOT EXISTS (
    SELECT 1 FROM "Category" c2
    WHERE c2."businessId" = "Category"."businessId"
      AND c2."turi" = 'chiqim'
      AND lower(trim(c2."nomi")) = 'ta''minotchiga pul berish'
  );
