/**
 * Billing konstantalari — YAGONA manba.
 *
 * Bu qiymatlar hech qayerda takrorlanmasligi kerak: sinov muddati, ogohlantirish
 * chegarasi va bir martalik o'rnatish to'lovi faqat shu fayldan o'qiladi.
 * Tarif narxlari va modullari — `plans.ts` da.
 */

/**
 * Bepul sinov muddati (kun). Yangi kompaniyalar shu muddat bilan yaratiladi.
 * DIQQAT: mavjud tenantlarning `trialEndsAt` sanasi bu qiymat o'zgarganda
 * qayta hisoblanmaydi — ularga aytilgan muddat aytilganidek qoladi.
 */
export const TRIAL_KUNLARI = 7;

/** Muddat tugashiga shu kundan kam qolganda ogohlantirish ko'rsatiladi/yuboriladi. */
export const TRIAL_OGOHLANTIRISH_KUNLARI = 2;

/** Bir martalik o'rnatish to'lovi (USD): tizimga tushirish, sozlash va o'qitish. */
export const SETUP_FEE_USD = 150;

/** Bir kun millisekundda — muddat hisob-kitoblari uchun. */
export const KUN_MS = 24 * 60 * 60 * 1000;

/** Platforma egasining Telegram havolasi (demo so'rovidan keyin ko'rsatiladi). */
export const ADMIN_TELEGRAM = process.env.NEXT_PUBLIC_ADMIN_TELEGRAM || "https://t.me/hisobkitob_admin";
