-- ZAKAZNI KIM KIRITDI (createdBy) — SOTUVCHIDAN ALOHIDA.
--
-- MUAMMO. Disney Navoiy ishxonasida bitta kompyuter bor va Balansa bitta
-- hisobda (Fayruza) ochiq turadi. Tizim esa "kirgan foydalanuvchi = sotuvchi"
-- deb hisoblardi: zakaz sotuvchisi tanlanmasa avtomatik Fayruzaga yozilardi.
-- Sotuvchi endi FAQAT qo'lda tanlanadi (`DealEmployee`, turi="sotuvchi"),
-- kiritgan odam esa shu ustunda — ikkalasi bir-birini ALMASHTIRMAYDI.
--
-- `masulId` bu vazifani bajara olmaydi: sotuvchi tanlanganda/almashtirilganda
-- u sotuvchining tizim hisobiga sinxronlanadi (statistika uchun), ya'ni
-- "kim kiritdi" javobi yo'qoladi.
--
-- FAQAT QO'SHUVCHI migratsiya: jadval qayta qurilmaydi, birorta yozuv
-- o'chmaydi. SQLite'da mavjud jadvalga NOT NULL ustun qo'shib bo'lmaydi,
-- shuning uchun nullable (`Deal.updatedAt` bilan bir xil yo'l).
ALTER TABLE "Deal" ADD COLUMN "createdBy" TEXT;

-- BACKFILL — FAQAT DALILDAN. Zakaz yaratilganda faoliyat lentasiga
-- "Buyurtma yaratildi" yozuvi tushadi va uning `userId` si aynan kiritgan
-- odam. Shu yozuv bo'lmagan zakazlarda ustun NULL bo'lib qoladi: `masulId`
-- dan TAXMIN QILINMAYDI, chunki u sotuvchiga sinxronlangan bo'lishi mumkin
-- va yolg'on "kim kiritdi" javobini yozib qo'yardi.
UPDATE "Deal" SET "createdBy" = (
    SELECT a."userId" FROM "Activity" a
    WHERE a."dealId" = "Deal"."id" AND a."matn" = 'Buyurtma yaratildi'
    ORDER BY a."createdAt" ASC LIMIT 1
) WHERE "createdBy" IS NULL;
