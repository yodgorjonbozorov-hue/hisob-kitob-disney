-- Onlayn to'lov (Payme / Click) uchun tranzaksiya holati maydonlari.
-- SQLite: yangi ustunlar ixtiyoriy (NULL) bo'lishi shart.
ALTER TABLE "Payment" ADD COLUMN "providerState" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "providerCreatedAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "cancelTime" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "cancelReason" INTEGER;

-- Provider tranzaksiya id bo'yicha qidiruv (callback'lar shu bo'yicha keladi).
CREATE INDEX "Payment_externalId_idx" ON "Payment"("externalId");
