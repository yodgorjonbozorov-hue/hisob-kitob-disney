-- ---------------------------------------------------------------------------
-- AI COPILOT — CHAT TARIXI (ko'p suhbat).
--
-- Ilgari `AiConversation` da foydalanuvchi × biznes uchun ATIGI BITTA qator
-- bor edi (UNIQUE(businessId, userId)): "Yangi suhbat" bosilganda avvalgi
-- yozishma o'chib ketardi va chat tarixi degan tushuncha yo'q edi.
--
-- `AiSuhbat` o'sha cheklovni olib tashlaydi: har suhbat — alohida qator,
-- sarlavhasi bilan. Egalik kaliti o'zgarmagan (businessId + userId), ya'ni
-- xavfsizlik modeli AYNAN AVVALGIDEK qoladi.
--
-- MA'LUMOT YO'QOLMAYDI: mavjud yozishmalar yangi jadvalga ko'chiriladi
-- (xabarlar JSON formati bir xil: [{ rol, matn }]) va shundan keyingina
-- eski jadval o'chiriladi.
-- ---------------------------------------------------------------------------

CREATE TABLE "AiSuhbat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sarlavha" TEXT NOT NULL,
    "xabarlar" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Eski yozishmalar (bo'lsa) — bitta "Avvalgi suhbat" sifatida ko'chadi.
INSERT INTO "AiSuhbat" ("id", "tenantId", "businessId", "userId", "sarlavha", "xabarlar", "updatedAt", "createdAt")
SELECT "id", "tenantId", "businessId", "userId", 'Avvalgi suhbat', "xabarlar", "updatedAt", "createdAt"
FROM "AiConversation";

DROP TABLE "AiConversation";

CREATE INDEX "AiSuhbat_businessId_userId_updatedAt_idx" ON "AiSuhbat"("businessId", "userId", "updatedAt");
CREATE INDEX "AiSuhbat_tenantId_updatedAt_idx" ON "AiSuhbat"("tenantId", "updatedAt");
