-- ---------------------------------------------------------------------------
-- KO'P-BIZNESLIK: FOYDALANUVCHI ↔ BIZNES BIRIKTIRUVI.
--
-- Muammo: xodim FAQAT bitta biznesga biriktirilardi (`User.businessId`). Bir
-- jamoa ikki biznesni yuritganda (masalan "Disney Flowers" va "Disney
-- Giftbox" — sotuvchilar bir xil, bizneslar hisob-kitob uchun alohida) har
-- bir biznesga alohida login ochishga to'g'ri kelardi.
--
-- Yechim: yangi `UserBusiness` jadvali — bir xodim 1, 2 yoki undan ortiq
-- biznesga biriktiriladi.
--
-- XAVFSIZLIK KAFOLATI: bu migratsiya faqat BITTA YANGI JADVAL yaratadi va
-- unga mavjud `User.businessId` qiymatlarini KO'CHIRADI. Bironta jadval
-- qayta qurilmaydi, bironta ustun o'chirilmaydi, bironta mavjud qiymat
-- o'zgartirilmaydi. `User.businessId` joyida qoladi va o'sha qiymati bilan
-- ishlashda davom etadi.
--
-- ORQAGA MOSLIK: biriktirilgan har xodim uchun AYNAN BITTA qator yoziladi,
-- ya'ni uning ruxsati zarracha kengaymaydi — avvalgidek o'sha bitta biznes.
-- Biriktirilmagan xodimda (businessId NULL) qator umuman bo'lmaydi —
-- "cheklov yo'q" ma'nosi ham o'zgarmaydi.
-- ---------------------------------------------------------------------------

CREATE TABLE "UserBusiness" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBusiness_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBusiness_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Bir xodim bir biznesga ikki marta biriktirilmaydi.
CREATE UNIQUE INDEX "UserBusiness_userId_businessId_key" ON "UserBusiness"("userId", "businessId");
-- "Shu xodim qaysi bizneslarga kiradi" — har so'rovda o'qiladigan kesim.
CREATE INDEX "UserBusiness_userId_idx" ON "UserBusiness"("userId");
-- "Shu bizneste kim ishlaydi" — admin paneli va superadmin kesimi.
CREATE INDEX "UserBusiness_businessId_idx" ON "UserBusiness"("businessId");

-- Mavjud biriktiruvlarni ko'chirish: har biriktirilgan xodimga bitta qator.
-- `id` — cuid emas, lekin barqaror va takrorlanmas ("ub_" + user id): qayta
-- qo'llansa ham (INSERT OR IGNORE) dublikat hosil qilmaydi.
INSERT OR IGNORE INTO "UserBusiness" ("id", "userId", "businessId", "createdAt")
SELECT 'ub_' || "id", "id", "businessId", CURRENT_TIMESTAMP
FROM "User"
WHERE "businessId" IS NOT NULL;
