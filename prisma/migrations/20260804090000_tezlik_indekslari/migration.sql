-- TEZLIK: kompozit (bir nechta ustunli) indekslar.
--
-- Muammo: Transaction jadvalida faqat bitta ustunli indekslar bor edi
-- (sana, turi, businessId, ...). Barcha issiq so'rovlar esa DOIM
-- "businessId + sana oralig'i" (ko'pincha + turi) bo'yicha filtrlaydi.
-- SQLite bunday holatda faqat BITTA indeksni tanlaydi va qolgan shartlarni
-- qatorlarni o'qib chiqib tekshiradi — biznes o'sgani sayin panel/hisobot
-- sekinlashadi.
--
-- Quyidagi indekslar so'rov shakliga aynan mos keladi, shuning uchun baza
-- faqat kerakli qatorlarni o'qiydi.

-- Panel, hisobot, kunlik dinamika, oylik yig'indilar.
CREATE INDEX IF NOT EXISTS "Transaction_businessId_sana_idx"
  ON "Transaction"("businessId", "sana");

-- Kirim/chiqim kesimidagi yig'indilar va kategoriya breakdown'i.
CREATE INDEX IF NOT EXISTS "Transaction_businessId_turi_sana_idx"
  ON "Transaction"("businessId", "turi", "sana");

-- Tranzaksiyalar ro'yxati: o'chirilmaganlar, eng yangisi birinchi.
CREATE INDEX IF NOT EXISTS "Transaction_businessId_deletedAt_sana_idx"
  ON "Transaction"("businessId", "deletedAt", "sana");

-- Kategoriya bo'yicha budjet sarfi.
CREATE INDEX IF NOT EXISTS "Transaction_businessId_categoryId_sana_idx"
  ON "Transaction"("businessId", "categoryId", "sana");

-- Bildirishnomalar: ochiq qarzlarni turi va yoshi bo'yicha tanlash.
CREATE INDEX IF NOT EXISTS "Debt_businessId_isYopilgan_turi_createdAt_idx"
  ON "Debt"("businessId", "isYopilgan", "turi", "createdAt");

-- Ombor: kam qolgan / tugagan mahsulotlar.
CREATE INDEX IF NOT EXISTS "Product_businessId_isActive_miqdor_idx"
  ON "Product"("businessId", "isActive", "miqdor");

-- Sotuv hisobotlari sana oralig'i bo'yicha.
CREATE INDEX IF NOT EXISTS "Sale_businessId_createdAt_idx"
  ON "Sale"("businessId", "createdAt");
