import { keshlangan } from "@/lib/cache";
import {
  getMonthSummary,
  getCategoryBreakdown,
  getTrend,
  getDailyDynamics,
} from "@/lib/queries/dashboard";
import { getQarzJamlari } from "@/lib/queries/qarz";
import { getTolovTaqsimoti } from "@/lib/queries/tolovTaqsimoti";
import { getOmborKartasi } from "@/lib/queries/inventory";
import {
  getKassaXulosa,
  getPulOqimi,
  getBugungiHolat,
  getDiqqatAlertlari,
} from "@/lib/queries/dashboardPanel";

/**
 * Dashboard so'rovlarining KESHLANGAN variantlari (60 s).
 *
 * Nega alohida fayl: `next/cache` faqat Next runtime'ida ishlaydi, shuning
 * uchun `queries/dashboard.ts` toza (keshsiz) qoladi — testlar, bot va
 * cron o'sha yerdan to'g'ridan-to'g'ri chaqiradi va har doim eng yangi
 * raqamni oladi. Sahifalar esa shu yerdan oladi.
 *
 * Yozuv o'zgarganda kesh `dashboardYangilandi(businessId)` bilan bekor
 * qilinadi (lib/cache.ts) — foydalanuvchi 60 soniya kutmaydi.
 */

export const getMonthSummaryKesh = keshlangan("dashboard:oylik-xulosa", getMonthSummary);
export const getCategoryBreakdownKesh = keshlangan("dashboard:kategoriya", getCategoryBreakdown);
export const getTrendKesh = keshlangan("dashboard:trend", getTrend);
export const getDailyDynamicsKesh = keshlangan("dashboard:kunlik", getDailyDynamics);
/**
 * "Menga qarzdor" kartasi. Qarz yozilganda ham, to'lov qabul qilinganda ham
 * route'lar `dashboardYangilandi(businessId)` chaqiradi — karta darhol
 * yangilanadi, foydalanuvchi 60 soniya kutmaydi.
 */
export const getQarzJamlariKesh = keshlangan("dashboard:qarz-jamlari", getQarzJamlari);
/**
 * "Jami kirim/chiqim" kartasi ichidagi to'lov taqsimoti. Karta summasi bilan
 * bitta oy va bitta to'plamdan hisoblanadi, shuning uchun kesh ham birga
 * bekor qilinadi.
 */
export const getTolovTaqsimotiKesh = keshlangan("dashboard:tolov-taqsimoti", getTolovTaqsimoti);
/**
 * "Ombordagi mahsulotlar" kartasi. Ombor harakatlari (kirim, sotuv,
 * to'g'rilash) `dashboardYangilandi(businessId)` chaqiradi — qoldiq
 * o'zgarishi kartada darhol ko'rinadi.
 */
export const getOmborKartasiKesh = keshlangan("dashboard:ombor-kartasi", getOmborKartasi);

// ---------------------------------------------------------------------------
// BOSHQARUV PANELI (yangi bloklar) — `queries/dashboardPanel.ts` keshlangan.
// Kesh tegi bir xil (`dashboard:businessId`), shuning uchun yozuv o'zgarganda
// KPI ham, grafik ham, ogohlantirishlar ham birga yangilanadi.
// ---------------------------------------------------------------------------

/** "Kassada" kartasi — barcha faol kassalar joriy qoldig'i. */
export const getKassaXulosaKesh = keshlangan("dashboard:kassa-xulosa", getKassaXulosa);
/** "Pul oqimi" grafigi — kunlik (92 kun) va oylik (12 oy) seriya. */
export const getPulOqimiKesh = keshlangan("dashboard:pul-oqimi", getPulOqimi);
/** "Bugungi holat" bloki. */
export const getBugungiHolatKesh = keshlangan("dashboard:bugungi-holat", getBugungiHolat);
/** "Diqqat talab qiladi" bloki. */
export const getDiqqatAlertlariKesh = keshlangan("dashboard:diqqat", getDiqqatAlertlari);
