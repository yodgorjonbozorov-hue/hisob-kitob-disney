-- KASSA TOPSHIRISH — TO'LOV KANALI KESIMI (naqd + Click + Payme + terminal).
--
-- MUAMMO. Topshirish faqat NAQD pulni bilardi: `AccountTransfer.summa` —
-- xodim qo'lidan chiqqan naqd. CRM'da esa pul Click/Payme/terminal bilan
-- ham keladi; u pul xodimning naqd kassasiga TUSHMAYDI (karta/hisob
-- kassasiga boradi), shuning uchun direktor topshirish yozuvidan "qancha
-- naqd, qancha Click, qancha Payme" degan savolga javob ola olmasdi.
--
-- QOIDA. Naqd qatori `AccountTransfer.summa` bilan AYNI raqam — pul
-- haqiqatda ko'chadi. Online qatorlari esa HISOBOT: o'sha pul allaqachon
-- karta/hisob kassasida va uni ikkinchi marta ko'chirish kassa qoldig'ini
-- buzardi. Shu sabab bu jadval LEDGERGA TEGMAYDI.
--
-- FAQAT QO'SHUVCHI migratsiya: mavjud jadvallar qayta qurilmaydi, birorta
-- yozuv o'zgarmaydi. Eski topshirishlarda kanal qatori YO'Q va ular
-- avvalgidek "naqd topshirish" bo'lib o'qiladi (orqaga moslik).
CREATE TABLE "TopshirishKanali" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "kanal" TEXT NOT NULL,
    "summa" INTEGER NOT NULL,
    "hisoblangan" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TopshirishKanali_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TopshirishKanali_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "AccountTransfer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Bitta topshirishda bir kanal IKKI MARTA bo'lmaydi (dublikat hisobot yo'q).
CREATE UNIQUE INDEX "TopshirishKanali_transferId_kanal_key" ON "TopshirishKanali"("transferId", "kanal");
CREATE INDEX "TopshirishKanali_businessId_kanal_createdAt_idx" ON "TopshirishKanali"("businessId", "kanal", "createdAt");
