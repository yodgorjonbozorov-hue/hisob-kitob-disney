-- QARZNI TAHRIRLASH VA O'CHIRISH (direktor huquqi).
--
-- MUAMMO. Qarzni tuzatishning yo'li yo'q edi: noto'g'ri summa kiritilsa
-- uni faqat "bekor qilish" mumkin edi (u ham to'lovsiz qarzga), keyin
-- qaytadan yozish kerak bo'lardi. O'chirish esa umuman yo'q edi.
--
-- YECHIM. Direktor qarzni tahrirlaydi va o'chiradi; har ikkala amal
-- `AuditLog` ga eski→yangi qiymat bilan yoziladi (jadval allaqachon bor,
-- yangi jadval qo'shilmaydi).
--
-- O'CHIRISH — YUMSHOQ. Yozuv bazada qoladi: unga bog'langan sotuv
-- (`Sale`), CRM zakazi (`Deal.debtId`) va audit izi uzilmasligi kerak.
-- O'chirilgan qarz AYNI paytda `status = 'CANCELLED'` ham bo'ladi —
-- shu bois pul jamlarini hisoblaydigan barcha mavjud so'rovlar (ular
-- allaqachon bekor qilinganni chiqarib tashlaydi) o'zgarishsiz to'g'ri
-- ishlaydi. `deletedAt` faqat RO'YXATLARDA "o'chirilgan"ni "bekor
-- qilingan"dan ajratish uchun.
--
-- FAQAT QO'SHUVCHI migratsiya: jadval qayta qurilmaydi, birorta yozuv
-- o'zgarmaydi, ikkala ustun ham NULL bo'lishi mumkin — eski qarzlar
-- avvalgidek ishlashda davom etadi.
ALTER TABLE "Debt" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Debt" ADD COLUMN "deletedBy" TEXT;

-- Ro'yxatlar "o'chirilmagan qarzlar" kesimini biznes bo'yicha oladi.
CREATE INDEX "Debt_businessId_deletedAt_idx" ON "Debt"("businessId", "deletedAt");
