-- M-13: avans hisoblangandan ko'p bo'lsa farq yo'qolmasin — keyingi oyga
-- qarz sifatida o'tadi va keyingi oy hisob-kitobida chegiriladi.
ALTER TABLE "Payroll" ADD COLUMN "keyingiOygaQarz" INTEGER NOT NULL DEFAULT 0;
