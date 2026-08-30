-- KIRIMDA SOTUVCHI/XODIM (xodim statistikasi).
--
-- `userId` — yozuvni kim kiritgani (audit, o'zgarmaydi); `sotuvchiId` — savdo
-- kimning hisobiga yozilishi. NULLABLE: eski yozuvlar tegilmaydi va avvalgidek
-- ishlaydi — statistika ular uchun `userId` ga tayanadi (backward-compatible).
ALTER TABLE "Transaction" ADD COLUMN "sotuvchiId" TEXT REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Xodim statistikasi kesimi: biznes + sotuvchi + davr.
CREATE INDEX "Transaction_businessId_sotuvchiId_sana_idx" ON "Transaction" ("businessId", "sotuvchiId", "sana");

-- `ON DELETE SET NULL` tekshiruvi uchun (foydalanuvchi o'chirilganda SQLite
-- bola jadvalni skanerlaydi) — userId indeksi bilan bir xil sabab.
CREATE INDEX "Transaction_sotuvchiId_idx" ON "Transaction" ("sotuvchiId");
