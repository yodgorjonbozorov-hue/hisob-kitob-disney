-- OPTOM MIJOZ KARTOCHKASI MAYDONLARI (Contact.manzil, Contact.masulShaxs).
-- FAQAT QO'SHUVCHI migratsiya: ikkala ustun nullable, mavjud yozuvlar
-- tegilmaydi, hech narsa qayta qurilmaydi. Optom sotuvda mijoz kartochkasi
-- to'liqroq bo'lishi uchun: manzil (yetkazish/hujjat) va mas'ul shaxs
-- (kompaniya mijozlarda kim bilan gaplashiladi).
ALTER TABLE "Contact" ADD COLUMN "manzil" TEXT;
ALTER TABLE "Contact" ADD COLUMN "masulShaxs" TEXT;
