-- ZAKAZDA ARALASH TO'LOV — bitta zakaz bir necha kanal bilan to'lanadi.
--
-- MUAMMO. `Deal.tolovTuri` bitta matn: zakaz faqat BITTA kanal bilan
-- to'langan deb hisoblanardi. Haqiqatda 1 000 000 lik zakaz naqd 300 000 +
-- click 400 000 + terminal 200 000 + qarz 100 000 bo'lishi mumkin. Muhimi —
-- pul QAYSI KASSAGA tushishi: bitta tranzaksiyada bitta `accountId` bor,
-- shuning uchun har kanal uchun ALOHIDA kirim yozilishi kerak.
--
-- YECHIM: to'lov qatorlari jadvali. `Deal.tolangan` — shu qatorlar
-- yig'indisi (eski, bir kanalli zakazlarda qatorlar YO'Q va `tolangan`
-- o'zi yetarli — orqaga moslik shunday saqlanadi). Qarz bu yerda kanal
-- EMAS: u zakaz summasidan qolgan qism.
--
-- FAQAT QO'SHUVCHI migratsiya: mavjud jadvallar qayta qurilmaydi, birorta
-- yozuv o'zgarmaydi va eski zakazlar tegilmaydi (ular qatorlarsiz ishlashda
-- davom etadi).
CREATE TABLE "DealTolov" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "kanal" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "transactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DealTolov_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DealTolov_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DealTolov_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- DUBLIKAT KIRIMGA QARSHI ASOSIY HIMOYA (Deal.transactionId bilan bir xil):
-- bitta to'lov qatori ikkinchi kirim yarata olmaydi.
CREATE UNIQUE INDEX "DealTolov_transactionId_key" ON "DealTolov"("transactionId");
CREATE INDEX "DealTolov_businessId_dealId_idx" ON "DealTolov"("businessId", "dealId");
