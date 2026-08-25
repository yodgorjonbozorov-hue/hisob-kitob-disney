-- ---------------------------------------------------------------------------
-- CRM KUNLIK BUYURTMALAR — KIRIM MODULI BILAN BITTA MANBAGA BOG'LANISH.
--
-- Muammo: CRM bitimi "Yutildi" bo'lganda kirim QOTIRILGAN "Sotuv"
-- kategoriyasiga yozilardi. Ya'ni buyurtma "Onajon" bo'lsa ham, Kirimdagi
-- kategoriya kesimida u "Sotuv" ichida ko'rinardi — CRM va Kirim ikki xil
-- haqiqat ko'rsatardi. Buyurtma sanasi ham yo'q edi: "bugun qancha
-- buyurtma olindi" degan savolga javob beradigan maydon umuman yo'q edi.
--
-- Yechim (uchta yangi bog'lanish, YANGI JADVAL YO'Q):
--   1. `Deal.categoryId` -> `Category` (SET NULL) — buyurtma AYNAN Kirim
--      modulidagi kategoriyani ko'rsatadi. Alohida CRM kategoriya tizimi
--      qurilmaydi.
--   2. `Deal.sana` — buyurtma kuni (UTC-yarim tun).
--   3. `Deal.transactionId` -> `Transaction` (SET NULL) va UNIQUE —
--      bitta buyurtma ko'pi bilan BITTA kirim tranzaksiyasi yaratadi.
--      Bu himoya ATAYLAB bazada: ilova kodi ham, frontend ham xato qilsa
--      (yoki ikki so'rov bir vaqtda kelsa) ikkinchi yozuv shu cheklovga
--      uriladi. Ilgari ustun oddiy TEXT edi — hech qanday kafolat yo'q edi.
--
-- SQLite'da mavjud ustunga FK qo'shish jadvalni qayta qurishni talab qiladi,
-- shuning uchun `Deal` INSERT ... SELECT bilan to'liq ko'chiriladi
-- (`20260804091000_ondelete_siyosati` dagi bilan bir xil naqsh).
-- Ma'lumot yo'qolmaydi: barcha eski ustunlar nomma-nom ko'chiriladi,
-- yangi ikkitasi NULL bo'lib qoladi (eski bitimlar avvalgidek ishlaydi).
-- ---------------------------------------------------------------------------

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- HIMOYA: UNIQUE indeksdan OLDIN dublikatlarni tozalash. Eski kod bitta
-- tranzaksiyani ikki bitimga bog'lamasdi, lekin cheklov bazada bo'lmagani
-- uchun buni KAFOLATLAB bo'lmaydi. Dublikat topilsa — bittasi (id bo'yicha
-- birinchisi) bog'lanishni saqlab qoladi, qolganlari uziladi (kirim yozuvi
-- JOYIDA QOLADI, faqat CRM havolasi ochiladi). Aks holda migratsiya
-- "UNIQUE constraint failed" bilan yarim yo'lda to'xtardi.
UPDATE "Deal"
SET "transactionId" = NULL
WHERE "transactionId" IS NOT NULL
  AND "id" NOT IN (
    SELECT MIN("id") FROM "Deal"
    WHERE "transactionId" IS NOT NULL
    GROUP BY "transactionId"
  );

CREATE TABLE "new_Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT,
    "nomi" TEXT NOT NULL,
    "summa" INTEGER NOT NULL DEFAULT 0,
    "categoryId" TEXT,
    "stageId" TEXT NOT NULL,
    "masulId" TEXT NOT NULL,
    "manba" TEXT,
    "sana" DATETIME,
    "muddat" DATETIME,
    "yopilganAt" DATETIME,
    "transactionId" TEXT,
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Deal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deal_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Deal" ("businessId", "contactId", "createdAt", "deletedAt", "id", "izoh", "manba", "masulId", "muddat", "nomi", "stageId", "summa", "transactionId", "yopilganAt") SELECT "businessId", "contactId", "createdAt", "deletedAt", "id", "izoh", "manba", "masulId", "muddat", "nomi", "stageId", "summa", "transactionId", "yopilganAt" FROM "Deal";
DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";
CREATE INDEX "Deal_businessId_stageId_idx" ON "Deal"("businessId", "stageId");
CREATE INDEX "Deal_businessId_masulId_idx" ON "Deal"("businessId", "masulId");
CREATE INDEX "Deal_businessId_sana_idx" ON "Deal"("businessId", "sana");
CREATE INDEX "Deal_categoryId_idx" ON "Deal"("categoryId");
-- DUBLIKAT KIRIMGA QARSHI ASOSIY HIMOYA (5-talab).
CREATE UNIQUE INDEX "Deal_transactionId_key" ON "Deal"("transactionId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
