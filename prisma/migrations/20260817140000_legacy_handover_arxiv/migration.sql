-- LEGACY CASHHANDOVER → ACCOUNT LEDGER MIGRATSIYASI (sxema qismi).
--
-- Faqat bitta ustun va bitta unique indeks qo'shiladi (xavf: past).
-- Ma'lumot KO'CHIRILMAYDI — uni alohida, qaytariladigan va hisobot beradigan
-- skript bajaradi: scripts/kassa-handover-migratsiya.ts.
--
-- NEGA UNIQUE: migratsiya idempotent bo'lishi shart. `legacyCashHandoverId`
-- unique bo'lgani uchun bir CashHandover ikkinchi marta ko'chirilmaydi va
-- dublikat pul harakati yaratilmaydi.
--
-- SQLite'da NULL qiymatlar unique indeksni buzmaydi, shuning uchun ko'chirilmagan
-- (oddiy) o'tkazmalar ta'sirlanmaydi.

ALTER TABLE "AccountTransfer" ADD COLUMN "legacyCashHandoverId" TEXT;

CREATE UNIQUE INDEX "AccountTransfer_legacyCashHandoverId_key"
  ON "AccountTransfer"("legacyCashHandoverId");
