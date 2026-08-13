-- M-10: kunlik hisobotda yopilgan davr qaytmasligi kerak.
-- qulflashKun — CONFIRMED kun necha kundan keyin avtomatik LOCKED bo'ladi
-- (0 = avto qulflash o'chirilgan). holat String bo'lgani uchun "LOCKED"
-- qiymatiga sxema o'zgarishi kerak emas.
ALTER TABLE "DailyReportSetting" ADD COLUMN "qulflashKun" INTEGER NOT NULL DEFAULT 7;

-- M-9: qayta ochish endi majburiy sabab bilan — oxirgi sabab tarixda ko'rinadi.
ALTER TABLE "DailyReport" ADD COLUMN "qaytaOchishSabab" TEXT;
