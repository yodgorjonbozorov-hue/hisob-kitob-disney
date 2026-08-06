import { unstable_cache, revalidateTag } from "next/cache";
import { currentTenantId, runWithTenant } from "@/lib/db/tenantContext";

/**
 * DASHBOARD KESHI.
 *
 * Muammo: bitta dashboard yuklanishi o'nlab DB so'rovini keltirib chiqaradi,
 * Turso'da har so'rov ~160 ms. Ma'lumot esa har soniyada o'zgarmaydi.
 *
 * MUHIM — TENANT IZOLYATSIYASI: `unstable_cache` callback'i so'rov
 * kontekstidan TASHQARIDA (keshni to'ldirish paytida) chaqirilishi mumkin,
 * ya'ni AsyncLocalStorage'dagi tenant konteksti u yerda YO'Q bo'ladi.
 * Shuning uchun:
 *   1. `tenantId` kesh kalitiga ANIQ kiritiladi (aks holda bir tenantning
 *      keshlangan raqami boshqasiga ko'rinib ketardi);
 *   2. callback ichida `runWithTenant` QAYTA chaqiriladi.
 *
 * Kesh 60 soniya yashaydi va yozuv o'zgarganda `dashboardYangilandi()`
 * bilan darhol bekor qilinadi.
 */

export const KESH_SONIYA = 60;

/** Biznes bo'yicha dashboard keshi tegi. */
export function dashboardTag(businessId: string): string {
  return `dashboard:${businessId}`;
}

/**
 * Tranzaksiya/sotuv/qarz o'zgarganda chaqiriladi — dashboard keshini bekor qiladi.
 * Xato bersa (masalan statik render kontekstida) asosiy amal buzilmasin.
 */
export function dashboardYangilandi(businessId: string): void {
  try {
    revalidateTag(dashboardTag(businessId));
  } catch (error) {
    console.error("Kesh yangilash xatosi:", error);
  }
}

/**
 * `businessId` bilan boshlanadigan o'qish funksiyasini keshlaydi.
 *
 * Kesh kaliti: [nomi, tenantId, businessId, ...qolgan argumentlar].
 */
export function keshlangan<A extends unknown[], R>(
  nomi: string,
  fn: (businessId: string, ...args: A) => Promise<R>
): (businessId: string, ...args: A) => Promise<R> {
  return async (businessId: string, ...args: A): Promise<R> => {
    const tenantId = currentTenantId();
    const oralik = unstable_cache(
      // Kesh ichida tenant konteksti yo'q — qayta o'rnatamiz.
      (tid: string, bid: string, ...rest: A) => runWithTenant(tid, () => fn(bid, ...rest)),
      [nomi],
      { revalidate: KESH_SONIYA, tags: [dashboardTag(businessId)] }
    );
    try {
      return await oralik(tenantId, businessId, ...args);
    } catch (error) {
      // Next kesh infratuzilmasi yo'q muhitda (test, skript) — to'g'ridan-to'g'ri.
      if (error instanceof Error && /incremental cache|static generation store/i.test(error.message)) {
        return fn(businessId, ...args);
      }
      throw error;
    }
  };
}
