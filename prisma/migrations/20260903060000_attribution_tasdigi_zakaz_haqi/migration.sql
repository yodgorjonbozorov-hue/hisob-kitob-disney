-- ATTRIBUTION TASDIG'I VA IJROCHI ZAKAZ HAQI.
--
-- FAQAT QO'SHIMCHA (additive): mavjud ustunlar va yozuvlar tegilmaydi,
-- DROP/RENAME yo'q. Standart qiymatlar mavjud qatorlarni O'ZGARTIRMAYDI:
--   · `tasdiqlangan = 1` — hozirgi biriktiruvlar avvalgidek hisoblanadi;
--   · `zakazHaqi = 0`    — hech bir lavozim to'satdan pul hisoblab qolmaydi.
-- Ya'ni bu migratsiya o'z-o'zidan hech kimning KPI yoki oyligini surmaydi.

-- Xodim biriktiruvi odam tomonidan tasdiqlanganmi.
ALTER TABLE "DealEmployee" ADD COLUMN "tasdiqlangan" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DealEmployee" ADD COLUMN "tasdiqlaganUserId" TEXT;

-- Lavozimning bir zakaz uchun haqi (so'm). 0 — zakaz soniga qarab to'lanmaydi.
ALTER TABLE "EmployeeCategory" ADD COLUMN "zakazHaqi" INTEGER NOT NULL DEFAULT 0;

-- Oylik hisobi tasdiqlangan biriktiruvlarni xodim va davr bo'yicha yig'adi.
CREATE INDEX "DealEmployee_businessId_employeeId_tasdiqlangan_idx"
  ON "DealEmployee"("businessId", "employeeId", "tasdiqlangan");
