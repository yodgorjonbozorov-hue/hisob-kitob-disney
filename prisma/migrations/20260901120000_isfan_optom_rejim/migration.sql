-- BIR MARTALIK MA'LUMOT MIGRATSIYASI: "ISFAN OPTIM" biznesi OPTOM rejimga
-- o'tkaziladi (loyiha egasining 2026-09-01 dagi so'rovi).
--
-- Nega migratsiya orqali: agent muhitida production bazaga ulanish yo'q;
-- migratsiya zanjiri esa deploy paytida ZAXIRADAN KEYIN (deploy-zaxira.mjs)
-- bir marta qo'llanadi va _applied_migrations'da belgilanadi.
--
-- Himoya shartlari:
--   - nom aniq mos kelishi kerak (katta-kichik harf va chet bo'shliqqa befarq);
--   - faqat hali standart ("umumiy") rejimda turgan biznes o'zgaradi — keyin
--     sozlamalardan qo'lda o'zgartirilgan qiymat USTIDAN YOZILMAYDI.
-- Effekt istalgan payt Admin -> Bizneslar -> Ishlash rejimi'dan qaytariladi.
UPDATE "Business"
SET "turi" = 'optom'
WHERE UPPER(TRIM("nomi")) = 'ISFAN OPTIM'
  AND "turi" = 'umumiy';
