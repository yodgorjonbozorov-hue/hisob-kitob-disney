-- KASSA TRANSFERI: qabul tasdig'i + shaxsiy kassa rejimi.
--
-- BARCHA o'zgarishlar ADDITIVE (xavf: past): faqat yangi ustunlar va indeks
-- qo'shiladi, mavjud qatorlar tegilmaydi. Eski o'tkazmalar `turi='transfer'`
-- va `holat='bajarildi'` bo'lib qoladi — qoldiq hisobi ular uchun o'zgarmaydi.
--
-- MUHIM: qoldiq hisobiga faqat holat IN ('bajarildi','bekor') qatorlar kiradi
-- (lib/queries/accounts.ts). "bekor" qoladi, chunki uni storno qatori nolga
-- chiqaradi; "kutilmoqda" va "rad" esa hech qachon pul ko'chirmagan.

-- AccountTransfer: o'tkazma turi va qabul tasdig'i maydonlari.
ALTER TABLE "AccountTransfer" ADD COLUMN "turi" TEXT NOT NULL DEFAULT 'transfer';
ALTER TABLE "AccountTransfer" ADD COLUMN "tasdiqlaganId" TEXT;
ALTER TABLE "AccountTransfer" ADD COLUMN "tasdiqlaganIsm" TEXT;
ALTER TABLE "AccountTransfer" ADD COLUMN "tasdiqlanganAt" DATETIME;
ALTER TABLE "AccountTransfer" ADD COLUMN "radAt" DATETIME;
ALTER TABLE "AccountTransfer" ADD COLUMN "qarorIzoh" TEXT;

-- CreateIndex: "kutilayotgan o'tkazmalar" paneli har sahifa yuklanishida o'qiladi.
CREATE INDEX "AccountTransfer_businessId_holat_createdAt_idx" ON "AccountTransfer"("businessId", "holat", "createdAt");

-- Business: shaxsiy kassa rejimi (opt-in).
ALTER TABLE "Business" ADD COLUMN "shaxsiyKassa" BOOLEAN NOT NULL DEFAULT false;
