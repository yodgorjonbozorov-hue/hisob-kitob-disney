-- ---------------------------------------------------------------------------
-- XABARNOMA: BITTA IDEMPOTENCY KALITI + QARZ SNAPSHOT'i
--
-- Ikki muammo tuzatiladi (ikkalasi ham `TelegramNotification` ustida).
--
-- 1) DUBLIKAT TO'SIG'I NULL'GA TAYANIB QOLGAN EDI.
--    Avvalgi himoya ikkita kompozit unique edi:
--      unique(chekId, turi, versiya) va unique(saleId, turi, versiya).
--    Ularning birinchi ustuni NULL bo'lishi mumkin, SQLite ham, PostgreSQL
--    ham NULL'larni bir-biriga TENG DEB HISOBLAMAYDI — ya'ni yakka sotuv
--    yozuvida (chekId = NULL) birinchi cheklov UMUMAN ishlamasdi va butun
--    himoya jimgina ikkinchisiga qolib ketardi. Endi bitta NON-NULL kalit:
--      "CHEK:{chekId}:{turi}:{versiya}" | "SALE:{saleId}:{turi}:{versiya}".
--
-- 2) QARZ QAYTA URINISHDA QAYTA HISOBLANARDI.
--    "Oldingi qarz" ledgerdan har o'qishda ayirma bilan chiqarilardi. Xabar
--    kech ketsa (Telegram yiqilib, keyin qayta urinilsa) oradan boshqa savdo
--    yoki to'lov o'tgan bo'lishi mumkin va mijoz O'SHA savdo haqida BOSHQA
--    raqamlarni ko'rardi. Endi qarz holati xabar YOZILGAN PAYTDA snapshot
--    sifatida saqlanadi.
--
--    QOIDA: savdo xabari — TARIXIY hujjat (snapshot); botdagi "Mening qarzim"
--    — REAL-TIME `Debt` ledger o'qishi. Ikkalasi ataylab farq qiladi.
--
-- FAQAT QO'SHUVCHI migratsiya: jadval qayta qurilmaydi, birorta yozuv
-- yo'qolmaydi. Mavjud satrlar kalit bilan to'ldiriladi va qarz snapshoti
-- 0 bo'lib qoladi (bu yozuvlar allaqachon yuborilgan, qayta yuborilmaydi).
-- ---------------------------------------------------------------------------

-- ---- 1. IDEMPOTENCY KALITI ----
-- Bo'sh matn bilan qo'shiladi (SQLite NOT NULL ustunga default talab qiladi),
-- darhol to'ldiriladi va FAQAT SHUNDAN KEYIN unique indeks quriladi.
ALTER TABLE "TelegramNotification" ADD COLUMN "idempotencyKey" TEXT NOT NULL DEFAULT '';

UPDATE "TelegramNotification"
SET "idempotencyKey" = CASE
      WHEN "chekId" IS NOT NULL
        THEN 'CHEK:' || "chekId" || ':' || "turi" || ':' || CAST("versiya" AS TEXT)
      WHEN "saleId" IS NOT NULL
        THEN 'SALE:' || "saleId" || ':' || "turi" || ':' || CAST("versiya" AS TEXT)
      -- Buyurtmasiz xabar (qarz eslatmasi) — id ning o'zi kalit bo'ladi.
      ELSE 'XABAR:' || "id"
    END
WHERE "idempotencyKey" = '';

DROP INDEX "TelegramNotification_chekId_turi_versiya_key";
DROP INDEX "TelegramNotification_saleId_turi_versiya_key";

CREATE UNIQUE INDEX "TelegramNotification_idempotencyKey_key" ON "TelegramNotification"("idempotencyKey");

-- ---- 2. QARZ SNAPSHOT'i ----
ALTER TABLE "TelegramNotification" ADD COLUMN "debtBefore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TelegramNotification" ADD COLUMN "debtAdded" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TelegramNotification" ADD COLUMN "debtAfter" INTEGER NOT NULL DEFAULT 0;

-- ---- 3. PARALLEL YUBORISHGA QARSHI "BAND" BELGISI ----
-- `idempotencyKey` ikkinchi SATR ochilishini to'sadi, lekin o'zi ikkinchi
-- YUBORISHNI to'smaydi: ikki so'rov bir vaqtda kelsa (tugma ikki marta
-- bosildi), birinchisi satrni yaratib jo'natayotgan payt ikkinchisi o'sha
-- satrni "yiqilgan ekan, qayta urinaman" deb o'qib qolardi. Endi satr
-- shartli UPDATE bilan band qilinadi va faqat band qila olgan oqim yuboradi.
ALTER TABLE "TelegramNotification" ADD COLUMN "bandAt" DATETIME;
