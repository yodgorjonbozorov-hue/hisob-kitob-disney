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
import { getKassaHolati } from "@/lib/queries/accounts";
import { getBugungiHolat } from "@/lib/queries/bugun";

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
/**
 * "Kassadagi pul" kartasi — faol kassalar joriy qoldig'i.
 *
 * Qoldiqqa TA'SIR QILADIGAN har bir amal `dashboardYangilandi(businessId)`
 * chaqiradi: tranzaksiya (yozish/tahrir/o'chirish/tiklash/import/ko'chirish),
 * kassalararo o'tkazma va uning qarori, hamda kassaning O'ZI o'zgarganda
 * (ochish, nomlash, faol/nofaol qilish, o'chirish) — oxirgisi `faolSoni` va
 * `nofaolJami` ni o'zgartiradi.
 */
export const getKassaHolatiKesh = keshlangan("dashboard:kassa-holati", getKassaHolati);
/**
 * "Bugungi holat" bloki.
 *
 * Kesh kalitiga `sana` ham kiradi (keshlangan() barcha argumentlarni kalitga
 * qo'shadi) — shuning uchun yarim tundan keyin eski kunning bloki qaytmaydi:
 * yangi kun = yangi kalit. `crmYoqilgan` ham kalitda: modul yoqib/o'chirilsa
 * blok tarkibi darhol mos keladi.
 *
 * Bekor qilinishi: tranzaksiya va kassa amallaridan tashqari QARZ (yozish,
 * to'lov, bekor) va CRM buyurtmasi (yaratish, tahrir, bosqichga ko'chirish,
 * kirimga o'tkazish) ham `dashboardYangilandi(businessId)` chaqiradi.
 */
export const getBugungiHolatKesh = keshlangan("dashboard:bugungi-holat", getBugungiHolat);
