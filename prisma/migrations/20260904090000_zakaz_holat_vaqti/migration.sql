-- ZAKAZ HOLAT VAQTI — doska ustunlari ichidagi tartib uchun.
--
-- MUAMMO: "Yutildi" ustuni zakaz SANASI bo'yicha tartiblanardi, shuning
-- uchun endigina yutilgan zakaz ustunning eng pastiga tushib ketardi.
-- Tartib ZAKAZ QACHON SHU HOLATGA O'TGANIGA bog'liq bo'lishi kerak.
--
-- FAQAT QO'SHIMCHA (additive): DROP/RENAME yo'q, mavjud ustunlar tegilmaydi.
-- Ustun NULL bo'lishi mumkin, shuning uchun mavjud yozuvlarga standart
-- qiymat majburlanmaydi — quyidagi UPDATE ularni mavjud vaqtlardan to'ldiradi.
ALTER TABLE "Deal" ADD COLUMN "holatAt" DATETIME;

-- ESKI YOZUVLARNI TO'LDIRISH. Yopilgan (YUTILDI/YOQOTILDI) zakazda
-- `yopilganAt` — aynan holatga o'tgan vaqt; qolganida esa yaratilish vaqti
-- eng yaqin haqiqat. Bu o'qish qatlamidagi zaxira qoidasi bilan bir xil
-- (`lib/crm/pipeline.ts` → `holatVaqti`), shuning uchun to'ldirilgan va
-- to'ldirilmagan baza bir xil tartib beradi.
UPDATE "Deal" SET "holatAt" = COALESCE("yopilganAt", "createdAt") WHERE "holatAt" IS NULL;

-- Ustun ichidagi tartib kesimi: biznes + holat + holat vaqti.
CREATE INDEX "Deal_businessId_holat_holatAt_idx" ON "Deal"("businessId", "holat", "holatAt");
