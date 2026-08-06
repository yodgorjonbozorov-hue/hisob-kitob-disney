-- AI SUHBATI SERVER TOMONDA (S-7).
--
-- Ilgari suhbat tarixi mijozdan (brauzerdan) kelardi: foydalanuvchi soxta
-- `assistant` xabarini yuborib modelni chalg'itishi mumkin edi (prompt
-- injection). Tool'lar tenant-scoped bo'lgani uchun ma'lumot sizmasdi, lekin
-- model xohlagan matnni chiqarishi mumkin edi.
--
-- Endi mijoz faqat SAVOL yuboradi; tarix shu jadvaldan olinadi.
-- Bu VAQTINCHALIK holat — zaxira ro'yxatiga kirmaydi.

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xabarlar" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AiConversation_tenantId_updatedAt_idx" ON "AiConversation"("tenantId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiConversation_businessId_userId_key" ON "AiConversation"("businessId", "userId");
