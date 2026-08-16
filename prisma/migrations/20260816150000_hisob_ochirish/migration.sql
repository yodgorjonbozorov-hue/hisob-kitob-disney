-- HISOBNI O'CHIRISH (App Store 5.1.1(v)): foydalanuvchi ilova ichidan
-- kompaniya hisobini butunlay o'chirishni so'ray olishi shart.
--
-- FAQAT ikkita NULLABLE ustun qo'shiladi. Jadval qayta qurilmaydi, mavjud
-- qatorlar o'zgarmaydi, standart qiymat berilmaydi (xavf: past).
--   deletionRequestedAt — so'rov vaqti; null bo'lsa hech narsa o'zgarmaydi,
--                         ya'ni barcha mavjud kompaniyalar avvalgidek ishlaydi.
--   deletionRequestedBy — so'ragan foydalanuvchi ID'si (audit uchun, FK'siz).

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "deletionRequestedAt" DATETIME;
ALTER TABLE "Tenant" ADD COLUMN "deletionRequestedBy" TEXT;
