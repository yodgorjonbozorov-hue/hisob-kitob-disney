-- ZAKAZ YO'QOTISH SABABI + "KIM O'CHIRDI" IZI.
--
-- 1. `Deal.yoqotishSababi` — zakaz "Yo'qotildi" ga o'tkazilganda yoziladigan
--    sabab. Direktor arxivining butun ma'nosi shunda: "qancha pul qo'ldan
--    ketdi" savolidan keyingi savol — "nega". `Deal.izoh` bu ishga yaramaydi,
--    u zakazning O'Z tavsifi (mijoz talabi, manzil va h.k.).
--    Yo'qotilgan SANA uchun yangi ustun QO'SHILMAYDI — u allaqachon
--    `yopilganAt` da; ikkinchi ustun ikkinchi haqiqat manbai bo'lardi.
--
-- 2. `Deal.deletedBy` / `Transaction.deletedBy` — soft-delete izining
--    ikkinchi yarmi. `deletedAt` "qachon" ga javob berardi, "kim" esa faqat
--    audit jurnalida edi; savat ekranida har qator uchun jurnalga borish
--    kerak bo'lardi. FK ATAYLAB qo'yilmaydi: foydalanuvchi o'chirilsa ham
--    iz qolsin (DealFeedback.userId bilan bir xil qoida).
--
-- FAQAT QO'SHUVCHI (additive) migratsiya: DROP/RENAME yo'q, jadval qayta
-- qurilmaydi, birorta mavjud yozuv o'zgarmaydi. Uchala ustun ham NULL
-- bo'lishi mumkin, shuning uchun eski qatorlar to'ldirishni talab qilmaydi
-- va eski kod ular haqida bilmasdan ishlashda davom etadi.
ALTER TABLE "Deal" ADD COLUMN "yoqotishSababi" TEXT;
ALTER TABLE "Deal" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "deletedBy" TEXT;
