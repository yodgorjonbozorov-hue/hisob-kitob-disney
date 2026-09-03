-- CRM DOSKA TARTIBI: yangi yaratilgan yoki holati hozirgina o'zgargan zakaz
-- ro'yxat BOSHIDA tursin.
--
-- MUAMMO. `Deal` da oxirgi o'zgarish vaqti yo'q edi: doska `sana` bo'yicha
-- tartiblanar, "Yutildi" ga hozirgina o'tkazilgan zakaz ustun oxiriga tushib
-- ketardi. Yechim — `updatedAt` ustuni (Prisma `@updatedAt`: har yozuvda
-- o'zi yangilanadi, `updateMany` da ham).
--
-- FAQAT QO'SHUVCHI migratsiya: jadval qayta qurilmaydi, birorta yozuv
-- o'chmaydi. SQLite'da mavjud jadvalga `NOT NULL` / `CURRENT_TIMESTAMP`
-- default'li ustun qo'shib bo'lmaydi, shuning uchun ustun nullable
-- (`Debt.updatedAt` bilan bir xil yo'l — 20260816090000_qarz_tizimi).
ALTER TABLE "Deal" ADD COLUMN "updatedAt" DATETIME;

-- BACKFILL: eski zakazlarda oxirgi ma'lum o'zgarish — yopilgan vaqti
-- (yutilgan/yo'qotilgan), bo'lmasa yaratilgan vaqti. Shunda migratsiyadan
-- keyin doska tartibi hozirgi haqiqatga yaqin bo'ladi va null qolmaydi.
UPDATE "Deal" SET "updatedAt" = COALESCE("yopilganAt", "createdAt") WHERE "updatedAt" IS NULL;

-- Doskaning tartib kesimi.
CREATE INDEX "Deal_businessId_updatedAt_idx" ON "Deal"("businessId", "updatedAt");
