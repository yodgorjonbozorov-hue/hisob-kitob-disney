-- Doimiy bepul mijoz (hamkor / o'z kompaniyasi): obuna muddati va to'lov talab
-- qilinmaydi. Bloklash bundan ustun turadi (BLOCKED baribir yopadi).
ALTER TABLE "Tenant" ADD COLUMN "bepul" BOOLEAN NOT NULL DEFAULT false;
