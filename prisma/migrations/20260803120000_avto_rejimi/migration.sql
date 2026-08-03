-- Avto rejimi (olib-sotar bizneslar) + ikki tomonlama qarzdorlik.
-- SQLite'da ALTER TABLE ADD COLUMN faqat NULL yoki doimiy DEFAULT bilan ishlaydi —
-- shu bois barcha yangi ustunlar ixtiyoriy yoki default qiymatli.

-- Biznes turi: "umumiy" | "avto".
ALTER TABLE "Business" ADD COLUMN "turi" TEXT NOT NULL DEFAULT 'umumiy';

-- Mahsulot: umumiy izoh + avto maydonlari (umumiy bizneslarda NULL).
ALTER TABLE "Product" ADD COLUMN "izoh" TEXT;
ALTER TABLE "Product" ADD COLUMN "avtoYil" INTEGER;
ALTER TABLE "Product" ADD COLUMN "avtoRaqam" TEXT;
ALTER TABLE "Product" ADD COLUMN "avtoRang" TEXT;

-- Qarz: yo'nalish, mahsulotga bog'lanish, muddat.
-- Mavjud qarzlarning barchasi qarzga sotuvdan yaratilgan → "olinadigan" (bizga qarzdor).
ALTER TABLE "Debt" ADD COLUMN "turi" TEXT NOT NULL DEFAULT 'olinadigan';
ALTER TABLE "Debt" ADD COLUMN "productId" TEXT REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Debt" ADD COLUMN "muddat" DATETIME;

-- CreateIndex
CREATE INDEX "Debt_businessId_turi_idx" ON "Debt"("businessId", "turi");

-- CreateIndex
CREATE INDEX "Debt_productId_idx" ON "Debt"("productId");
