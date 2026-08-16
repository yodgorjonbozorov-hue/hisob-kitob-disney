-- Kunlik hisobot: kassa topshirish (xodim -> direktor) maydonlari.
-- Faqat ustun qo'shish — mavjud ma'lumotga tegilmaydi (xavf: past).

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN "submittedBy" TEXT;

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN "submittedByIsm" TEXT;

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN "submittedAt" DATETIME;

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN "sanalganNaqd" INTEGER;
