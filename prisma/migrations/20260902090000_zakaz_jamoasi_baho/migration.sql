-- ZAKAZ JAMOASI VA SIFAT NAZORATI (Disney Navoiy: sotuvchi + ijrochi jamoa).
--
-- FAQAT QO'SHUVCHI migratsiya: mavjud jadvallar qayta qurilmaydi, birorta
-- yozuv o'zgarmaydi. Zakaz ↔ xodim biriktiruvi uchun YANGI jadval
-- YARATILMAYDI — mavjud `DealEmployee` (UNIQUE dealId+categoryId+employeeId)
-- allaqachon bir lavozimga bir nechta xodimni sig'diradi.

-- Lavozim bayroqlari (default'lar mavjud xulqni saqlaydi: hammasi zakazga
-- biriktiriladi, bir zakazda bir lavozimdan bitta xodim).
ALTER TABLE "EmployeeCategory" ADD COLUMN "zakazgaBiriktiriladi" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "EmployeeCategory" ADD COLUMN "kopXodim" BOOLEAN NOT NULL DEFAULT false;

-- Xodimning shu zakazdagi ishiga baho (1..10) — biriktiruv bilan birga.
ALTER TABLE "DealEmployee" ADD COLUMN "baho" INTEGER;
ALTER TABLE "DealEmployee" ADD COLUMN "bahoIzoh" TEXT;
ALTER TABLE "DealEmployee" ADD COLUMN "bahoAt" DATETIME;

-- Butun zakazga tegishli mijoz fikri (bir zakazga bitta).
CREATE TABLE "DealFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "servisBahosi" INTEGER,
    "etiroz" TEXT,
    "yaxshilash" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DealFeedback_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DealFeedback_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DealFeedback_dealId_key" ON "DealFeedback" ("dealId");

CREATE INDEX "DealFeedback_businessId_createdAt_idx" ON "DealFeedback" ("businessId", "createdAt");
