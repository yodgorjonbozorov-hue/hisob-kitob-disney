-- MOLIYA: "PUL OLDIM / PUL BERDIM" OQIMI.
--
-- MUAMMO. Tranzaksiya "qancha va qaysi kategoriyaga" degan savolga javob
-- berardi, lekin "KIMDAN olindi / KIMGA berildi" degan savolga YO'Q. Direktor
-- ro'yxatga qarab "bu 3 mln kimga ketdi?" degan savolga javob topa olmasdi —
-- javob faqat izohda, erkin matnda yotardi.
--
-- YECHIM: tomon (shaxs) yozuvning O'ZIDA saqlanadi. FK ATAYLAB YO'Q
-- (`Debt.masulId` uslubi): mijoz yoki ta'minotchi kartochkasi o'chirilsa ham
-- moliya tarixi o'qiladigan bo'lib qolishi kerak, shuning uchun nom SNAPSHOT
-- sifatida yoziladi.
--
-- `amalId` — bitta "Pul oldim/berdim" amalining barcha yozuvlarini
-- birlashtiradi: qarzga bog'langan to'lov bir necha qarzga taqsimlansa har
-- qarz uchun alohida kirim yoziladi (kategoriya kesimi saqlansin), lekin ular
-- bitta amal — tuzatish va bekor qilish hammasiga birdan tegadi.
--
-- `idempotencyKey` — takror yuborishdan himoya (`PurchaseOrder` bilan bir xil
-- uslub): himoya bazada, ya'ni ikkita bir vaqtli so'rov ham o'tolmaydi.
--
-- FAQAT QO'SHUVCHI migratsiya: jadval qayta qurilmaydi, birorta yozuv
-- o'zgarmaydi, barcha yangi ustunlar NULL bo'lishi mumkin — eski yozuvlar
-- avvalgidek ishlashda davom etadi.
ALTER TABLE "Transaction" ADD COLUMN "shaxsTuri" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "shaxsId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "shaxsIsm" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pulUsuli" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "amalId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "idempotencyKey" TEXT;

CREATE INDEX "Transaction_businessId_amalId_idx" ON "Transaction"("businessId", "amalId");
CREATE INDEX "Transaction_businessId_shaxsTuri_shaxsId_idx" ON "Transaction"("businessId", "shaxsTuri", "shaxsId");

-- TAKROR BOSISHGA QARSHI ASOSIY HIMOYA. SQLite'da UNIQUE indeks bir nechta
-- NULL ni o'tkazadi, shuning uchun kalitsiz (eski va tizim) yozuvlar bu
-- cheklovga umuman tegmaydi.
CREATE UNIQUE INDEX "Transaction_businessId_idempotencyKey_key" ON "Transaction"("businessId", "idempotencyKey");
