-- ---------------------------------------------------------------------------
-- CRM ZAKAZ PIPELINE — KUTILAYOTGAN / BUGUNGI / JARAYONDA / YUTILDI.
--
-- MUAMMO. Doska "Yangi → Aloqa qilindi → Taklif yuborildi → Yutildi →
-- Yo'qotildi" bosqichlariga tayanardi. Disney Navoiy zakazi esa OLDINDAN
-- olinadi: 01.09 da murojaat, xizmat 18.09 da. Bunday zakazning o'rni
-- bosqich bilan emas, SANA bilan aniqlanadi — 18.09 kelganda u o'zi
-- "bugungi" bo'lib qolishi kerak, hech kim uni qo'lda ko'chirmasdan.
--
-- YECHIM (yangi jadval YO'Q — `Deal` ga to'rt ustun):
--   1. `holat` — ish jarayoni holati: KUTILMOQDA | JARAYONDA | YUTILDI |
--      YOQOTILDI. "BUGUNGI" bu yerda YO'Q va ataylab yo'q: u
--      `holat = KUTILMOQDA AND sana = bugun` shartidan O'QISHDA
--      hisoblanadi. Ya'ni kun almashganda BAZAGA HECH NARSA yozilmaydi —
--      kunlik cron kerak emas va "cron ishlamay qoldi" degan xavf yo'q.
--   2. `tolangan` — haqiqatda olingan pul. To'lov holati (to'liq / qisman /
--      qarzga) shundan hisoblanadi; alohida `paymentStatus` ustuni
--      qo'shilmadi, aks holda u summa bilan zid holatga tushib qolardi.
--   3. `tolovTuri` — pul kanali ("naqd" | "click" | "qarz"), kirim
--      tranzaksiyasiga o'sha ko'rinishda uzatiladi.
--   4. `debtId` (+ UNIQUE, FK) — YUTILDI bosilganda to'lanmagan qism uchun
--      ochilgan qarz. UNIQUE aynan `transactionId` dagi kabi: bitta zakaz
--      ikkita qarz ham, ikkita kirim ham yarata olmasin. Himoya BAZADA,
--      kod tekshiruvida emas.
--
-- BOSQICHLAR TEGILMAYDI. `stageId` o'z joyida qoladi va `holat` dan kelib
-- chiqib sinxron yuritiladi (`lib/crm/pipeline.ts`), chunki dashboard, AI
-- analitikasi va xodim reytingi hali `Stage.turi` (OPEN/WON/LOST) ni
-- o'qiydi. Ular hech qanday o'zgarishsiz ishlashda davom etadi.
--
-- SQLite'da mavjud jadvalga FK qo'shish uni QAYTA QURISHNI talab qiladi,
-- shuning uchun `Deal` INSERT ... SELECT bilan to'liq ko'chiriladi
-- (`20260825090000_crm_kunlik_buyurtma` dagi bilan bir xil naqsh).
-- Ma'lumot yo'qolmaydi: barcha eski ustunlar nomma-nom ko'chiriladi.
-- ---------------------------------------------------------------------------

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

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
    "holat" TEXT NOT NULL DEFAULT 'KUTILMOQDA',
    "tolangan" INTEGER NOT NULL DEFAULT 0,
    "tolovTuri" TEXT,
    "debtId" TEXT,
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    CONSTRAINT "Deal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deal_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Deal_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- BACKFILL. Eski zakazning holati bosqich TURIDAN o'qiladi — bu yagona
-- mavjud manba (WON/LOST/OPEN). Shunda doska migratsiyadan keyin ham
-- avvalgi haqiqatni ko'rsatadi: yutilgani "Yutildi" ustunida qoladi.
--
-- `tolangan`: kirim yozilgan zakaz — puli kelgan zakaz, demak to'liq
-- to'langan. Kirim yozilmagani 0 (qarzga) sifatida qoladi. Bu mavjud
-- ma'lumotning ROSTGO'Y o'qilishi: boshqa manba yo'q, taxmin qilinmaydi.
INSERT INTO "new_Deal" (
    "id", "businessId", "contactId", "nomi", "summa", "categoryId", "stageId",
    "masulId", "manba", "sana", "muddat", "yopilganAt", "transactionId",
    "holat", "tolangan", "tolovTuri", "debtId", "izoh", "createdAt", "deletedAt"
)
SELECT
    d."id", d."businessId", d."contactId", d."nomi", d."summa", d."categoryId", d."stageId",
    d."masulId", d."manba", d."sana", d."muddat", d."yopilganAt", d."transactionId",
    CASE (SELECT s."turi" FROM "Stage" s WHERE s."id" = d."stageId")
        WHEN 'WON' THEN 'YUTILDI'
        WHEN 'LOST' THEN 'YOQOTILDI'
        ELSE 'KUTILMOQDA'
    END,
    CASE WHEN d."transactionId" IS NOT NULL THEN d."summa" ELSE 0 END,
    NULL,
    NULL,
    d."izoh", d."createdAt", d."deletedAt"
FROM "Deal" d;

DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";

CREATE INDEX "Deal_businessId_stageId_idx" ON "Deal"("businessId", "stageId");
CREATE INDEX "Deal_businessId_masulId_idx" ON "Deal"("businessId", "masulId");
CREATE INDEX "Deal_businessId_sana_idx" ON "Deal"("businessId", "sana");
-- Doskaning asosiy kesimi: ustunlar `holat` + `sana` dan hisoblanadi.
CREATE INDEX "Deal_businessId_holat_sana_idx" ON "Deal"("businessId", "holat", "sana");
CREATE INDEX "Deal_categoryId_idx" ON "Deal"("categoryId");
-- DUBLIKAT KIRIM VA DUBLIKAT QARZGA QARSHI ASOSIY HIMOYA.
CREATE UNIQUE INDEX "Deal_transactionId_key" ON "Deal"("transactionId");
CREATE UNIQUE INDEX "Deal_debtId_key" ON "Deal"("debtId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
