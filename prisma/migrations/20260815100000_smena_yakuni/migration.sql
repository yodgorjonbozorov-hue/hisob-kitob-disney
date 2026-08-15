-- SMENA YAKUNI: kun ichida kassani bir necha marta sanab topshirish.
-- FAQAT yangi jadval qo'shiladi — mavjud jadvallarga va ma'lumotga
-- umuman tegilmaydi (xavf: past). Kirim/chiqim raqamlari o'zgarmaydi:
-- smena hech qanday Transaction/DailyTransaction yozmaydi.

-- CreateTable
CREATE TABLE "Smena" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "sana" DATETIME NOT NULL,
    "raqam" INTEGER NOT NULL,
    "boshlanishAt" DATETIME NOT NULL,
    "tugashAt" DATETIME NOT NULL,
    "yopganUserId" TEXT NOT NULL,
    "yopganIsm" TEXT,
    "naqd" INTEGER NOT NULL DEFAULT 0,
    "click" INTEGER NOT NULL DEFAULT 0,
    "qarz" INTEGER NOT NULL DEFAULT 0,
    "naqdChiqim" INTEGER NOT NULL DEFAULT 0,
    "boshlangichQoldiq" INTEGER NOT NULL DEFAULT 0,
    "kutilganNaqd" INTEGER NOT NULL DEFAULT 0,
    "sanalganNaqd" INTEGER NOT NULL DEFAULT 0,
    "farq" INTEGER NOT NULL DEFAULT 0,
    "qoldirilganNaqd" INTEGER NOT NULL DEFAULT 0,
    "izoh" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Smena_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
-- Bir kunda bir xil raqamli ikki smena bo'lmaydi: ikki xodim bir vaqtda
-- "Smenani yopish" bossa ikkinchisi shu kalitda to'xtaydi (race bazada yopiladi).
CREATE UNIQUE INDEX "Smena_businessId_sana_raqam_key" ON "Smena"("businessId", "sana", "raqam");
CREATE INDEX "Smena_businessId_sana_idx" ON "Smena"("businessId", "sana");
CREATE INDEX "Smena_businessId_tugashAt_idx" ON "Smena"("businessId", "tugashAt");
