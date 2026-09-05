-- ---------------------------------------------------------------------------
-- MIJOZ TELEGRAM XABARNOMASI (optom savdo)
--
-- Optom biznes mijozga tovar berganda, savdo yozilishi bilan mijozning
-- Telegramiga to'liq savdo ma'lumoti ketadi. Xabar SHUNCHAKI bildirishnoma
-- emas: har xabar bazadagi HAQIQIY chek/sotuv, to'lov tranzaksiyasi va qarz
-- yozuvi bilan bog'langan.
--
-- FAQAT QO'SHUVCHI migratsiya: mavjud jadvallar qayta qurilmaydi, birorta
-- yozuv o'zgarmaydi, eski savdo oqimlari tegilmaydi.
-- ---------------------------------------------------------------------------

-- ---- 1. MIJOZ KARTOCHKASI: Telegram ulanishi ----
--
-- "telegramConnected" degan ALOHIDA USTUN ATAYLAB QO'SHILMADI: u
-- `telegramChatId IS NOT NULL` dan hisoblanadi. Ikkita ustun bo'lsa ular
-- ajralib qolardi ("ulangan = ha, chatId = yo'q") va bot kimga yozishini
-- bilmay qolardi.
ALTER TABLE "Contact" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "Contact" ADD COLUMN "telegramUsername" TEXT;
ALTER TABLE "Contact" ADD COLUMN "telegramUlanganAt" DATETIME;
ALTER TABLE "Contact" ADD COLUMN "telegramToken" TEXT;
ALTER TABLE "Contact" ADD COLUMN "telegramTokenExpiresAt" DATETIME;

-- Token GLOBAL takrorlanmaydi: u tenantni ham, mijozni ham O'ZI aniqlaydi.
-- Ikki tenantda bir xil token bo'lsa bot noto'g'ri mijozga ulanib,
-- cross-tenant ma'lumot ochib yuborardi.
CREATE UNIQUE INDEX "Contact_telegramToken_key" ON "Contact"("telegramToken");

-- Bitta Telegram hisobi bitta bizneste FAQAT BITTA mijoz bo'ladi.
-- Bizneslar ORASIDA takrorlanishi mumkin va bu to'g'ri — bir odam ikki
-- ulgurji do'kondan mol oladi. (SQLite ham, Postgres ham NULL'larni
-- takrorlanish deb hisoblamaydi, shuning uchun ulanmagan mijozlar
-- cheklovga urilmaydi.)
CREATE UNIQUE INDEX "Contact_businessId_telegramChatId_key" ON "Contact"("businessId", "telegramChatId");

-- ---- 2. SOTUV SATRI: birlik va nom snapshot'i ----
--
-- NARX allaqachon snapshot edi (`birlikNarx`, `tannarx`). Endi BIRLIK va NOM
-- ham snapshot: katalogda "dona" → "quti" ga o'zgartirilsa yoki mahsulot
-- qayta nomlansa, mijozga yuborilgan eski chek O'ZGARMASLIGI kerak.
-- NULL — eski yozuvlar; o'qishda `Product` dan olinadi (orqaga moslik).
ALTER TABLE "Sale" ADD COLUMN "birlik" TEXT;
ALTER TABLE "Sale" ADD COLUMN "mahsulotNomi" TEXT;

-- ---- 3. XABARNOMA JURNALI ----
--
-- Dublikatdan himoya ILOVA MANTIG'IDA emas, BAZADA: quyidagi ikki unique
-- indeks bitta buyurtma + tur + versiya uchun ikkinchi xabarni bazaga
-- JISMONAN sig'dirmaydi (takroriy hodisa, ikki marta bosilgan tugma).
CREATE TABLE "TelegramNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "chekId" TEXT,
    "saleId" TEXT,
    "chatId" TEXT NOT NULL,
    "turi" TEXT NOT NULL,
    "holat" TEXT NOT NULL,
    "versiya" INTEGER NOT NULL DEFAULT 1,
    "matn" TEXT NOT NULL,
    "xato" TEXT,
    "urinish" INTEGER NOT NULL DEFAULT 1,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramNotification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TelegramNotification_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TelegramNotification_chekId_fkey" FOREIGN KEY ("chekId") REFERENCES "PosChek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TelegramNotification_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TelegramNotification_chekId_turi_versiya_key" ON "TelegramNotification"("chekId", "turi", "versiya");
CREATE UNIQUE INDEX "TelegramNotification_saleId_turi_versiya_key" ON "TelegramNotification"("saleId", "turi", "versiya");
CREATE INDEX "TelegramNotification_businessId_createdAt_idx" ON "TelegramNotification"("businessId", "createdAt");
CREATE INDEX "TelegramNotification_businessId_contactId_idx" ON "TelegramNotification"("businessId", "contactId");
CREATE INDEX "TelegramNotification_chekId_idx" ON "TelegramNotification"("chekId");
CREATE INDEX "TelegramNotification_saleId_idx" ON "TelegramNotification"("saleId");
CREATE INDEX "TelegramNotification_contactId_idx" ON "TelegramNotification"("contactId");
