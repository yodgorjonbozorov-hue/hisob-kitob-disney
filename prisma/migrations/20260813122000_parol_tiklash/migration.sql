-- H-7: parolni Telegram bot orqali mustaqil tiklash. Kod bazada faqat
-- SHA-256 hash ko'rinishida saqlanadi, muddati 10 daqiqa.
ALTER TABLE "User" ADD COLUMN "resetCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN "resetCodeExpiresAt" DATETIME;
