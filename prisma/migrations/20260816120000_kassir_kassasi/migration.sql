-- KASSIR KASSASI: kassa topshirish tizimi.
-- FAQAT yangi jadval qo'shiladi — mavjud jadvallarga va ma'lumotga umuman
-- tegilmaydi (xavf: past). Kirim/chiqim/sof raqamlari o'zgarmaydi: bu yerda
-- hech qanday Transaction ham, AccountTransfer ham yozilmaydi.

-- CreateTable
CREATE TABLE "CashHandover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "turi" TEXT NOT NULL DEFAULT 'topshirish',
    "kassirId" TEXT NOT NULL,
    "kassirIsm" TEXT,
    "qabulId" TEXT,
    "qabulIsm" TEXT,
    "hisoblangan" INTEGER NOT NULL,
    "topshirilgan" INTEGER NOT NULL,
    "farq" INTEGER NOT NULL DEFAULT 0,
    "holat" TEXT NOT NULL DEFAULT 'kutilmoqda',
    "farqYopildi" BOOLEAN NOT NULL DEFAULT false,
    "izoh" TEXT,
    "qarorIzoh" TEXT,
    "topshirilganAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qabulAt" DATETIME,
    "radAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashHandover_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
-- Direktor paneli: "kutilayotgan topshiriqlar" ro'yxati eng ko'p o'qiladigan so'rov.
CREATE INDEX "CashHandover_businessId_holat_topshirilganAt_idx" ON "CashHandover"("businessId", "holat", "topshirilganAt");
-- Kassir kassasi qoldig'i va "Kassa tarixi" — kassir bo'yicha kesim.
CREATE INDEX "CashHandover_businessId_kassirId_topshirilganAt_idx" ON "CashHandover"("businessId", "kassirId", "topshirilganAt");
