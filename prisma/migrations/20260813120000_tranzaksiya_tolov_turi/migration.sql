-- Tranzaksiyada to'lov turi: "naqd" | "click" | "qarz" (null — eski yozuvlar,
-- ularda tur kassa turidan chiqariladi). Faqat ustun qo'shish — mavjud
-- ma'lumotga tegilmaydi (xavf: past).

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "tolovTuri" TEXT;
