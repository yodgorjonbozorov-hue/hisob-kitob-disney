-- ---------------------------------------------------------------------------
-- TA'MINOT (OMBOR) — TAKROR SAQLASHDAN HIMOYA VA BEKOR QILISH IZI.
--
-- Muammo 1 (takror saqlash): "Ta'minotni saqlash" tugmasi ikki marta
-- bosilsa yoki tarmoq javobni yo'qotib brauzer so'rovni qayta yuborsa,
-- ombor IKKI MARTA oshib, ta'minotchiga qarz ham ikki marta yozilardi.
-- Ilova darajasidagi tekshiruv yetarli emas: ikki so'rov bir vaqtda kelsa
-- ikkalasi ham "hali yo'q" deb ko'radi.
--
-- Shuning uchun himoya BAZAGA qo'yiladi: `idempotencyKey` — frontend har
-- oqim uchun bir marta yaratadigan kalit. Ikkinchi so'rov UNIQUE cheklovga
-- uriladi va xizmat qatlami MAVJUD ta'minotni qaytaradi (xato emas).
-- NULL qiymatlar bir-biriga teng emas (SQLite ham, Postgres ham), shuning
-- uchun kalitsiz eski yozuvlar cheklovga tegmaydi.
--
-- Muammo 2 (bekor qilish): ta'minot allaqachon ombor, qarz va chiqim
-- yozgan bo'ladi. Uni "o'chirish" emas, TESKARI YOZUV bilan bekor qilish
-- kerak va bu izsiz qolmasligi shart — kim, qachon va nega bekor qilgani
-- yoziladi.
--
-- Ma'lumot yo'qolmaydi: uchala ustun ham NULL bo'lib qo'shiladi, mavjud
-- buyurtmalar avvalgidek ishlaydi.
-- ---------------------------------------------------------------------------

ALTER TABLE "PurchaseOrder" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "bekorSana" DATETIME;
ALTER TABLE "PurchaseOrder" ADD COLUMN "bekorSabab" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN "bekorUserId" TEXT;

CREATE UNIQUE INDEX "PurchaseOrder_businessId_idempotencyKey_key"
  ON "PurchaseOrder" ("businessId", "idempotencyKey");

-- Ta'minotlar ro'yxati qabul sanasi bo'yicha saralanadi.
CREATE INDEX "PurchaseOrder_businessId_qabulSana_idx"
  ON "PurchaseOrder" ("businessId", "qabulSana");
