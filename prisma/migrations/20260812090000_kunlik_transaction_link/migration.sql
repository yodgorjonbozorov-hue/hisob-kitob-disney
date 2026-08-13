-- Kunlik hisobot: Yozuvlar (Transaction) bilan avto-sinxron uchun bog'lanish.
-- Faqat ustun qo'shish — mavjud ma'lumotga tegilmaydi (xavf: past).

-- AlterTable
ALTER TABLE "DailyTransaction" ADD COLUMN "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DailyTransaction_transactionId_key" ON "DailyTransaction"("transactionId");
