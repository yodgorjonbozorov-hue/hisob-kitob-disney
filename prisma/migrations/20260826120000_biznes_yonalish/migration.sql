-- ---------------------------------------------------------------------------
-- BIZNES YO'NALISHI (sanoat) — Business.yonalish TEXT NULL.
--
-- Tariflar sahifasida foydalanuvchi biznes sohasini tanlaydi ("food",
-- "service", "agro" va h.k. — lib/pricing/profil.ts). Bu qiymat FAQAT
-- shaxsiylashtirish uchun: birinchi kirishdagi onboarding qadamlari,
-- tavsiya etiladigan modullar va boshlang'ich sozlamalar shu yo'nalishga
-- moslashadi. Narxga va hisob mantiqiga TA'SIR QILMAYDI.
--
-- Faqat qo'shuvchi o'zgarish: mavjud qatorlarda NULL qoladi (eski
-- bizneslar yo'nalishsiz ishlayveradi), ma'lumot yo'qolmaydi.
-- ---------------------------------------------------------------------------

ALTER TABLE "Business" ADD COLUMN "yonalish" TEXT;
