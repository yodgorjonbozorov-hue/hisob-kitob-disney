import { NextResponse } from "next/server";
// Demo tenantni aniqlash — sessiya/tenant qatlami amali (login bilan bir
// darajada), shuning uchun `rawPrisma` shu yerda ruxsat etilgan (CLAUDE.md:
// `src/lib/auth/`). Boshqa hech qayerda demo bayrog'i o'qilmaydi.
import { rawPrisma } from "@/lib/db/rawPrisma";
import { requestCache } from "@/lib/requestCache";

/**
 * DEMO REJIMI — ro'yxatdan o'tmagan mehmon uchun "faqat ko'rish" tenanti.
 *
 * ═══ NEGA SHUNDAY QURILGAN ═══
 * Demo — alohida ma'lumot qatlami EMAS, oddiy tenant. Shu sababli u real
 * mijozlardan aynan o'sha mexanizm bilan ajraladi, qaysi ki bugun to'lovchi
 * mijozlarni bir-biridan ajratib turibdi (`lib/db/tenantDb.ts`). Yangi
 * izolyatsiya kodi yozilmadi — yangi kod yangi teshik degani.
 *
 * ═══ QULFNING YAGONA QOIDASI ═══
 * Demo tenantda GET va HEAD dan boshqa HAR QANDAY so'rov rad etiladi.
 * Qulf `withTenant` da obuna (`billing`) va `readonlyOk` istisnolaridan ham
 * OLDIN turadi — aks holda `billing: true` bilan belgilangan route (masalan
 * to'lov boshlash) qulfdan o'tib, demo mehmon REAL `Payment` yozuvi
 * yaratardi.
 *
 * ═══ FAIL-CLOSED ═══
 * Yozishga ruxsat faqat ANIQ `demoYozish: true` bilan beriladi va u faqat
 * ma'lumotga tegmaydigan holat amallari uchun (aktiv biznes cookie'si).
 * Yangi route hech narsa yozmasa ham, demo'da avtomatik BLOKLANADI.
 */

/** Demo tenant/foydalanuvchi barqaror identifikatorlari (seed shu ID'lar bilan ishlaydi). */
export const DEMO_TENANT_ID = "tenant_balansa_demo";
export const DEMO_USER_ID = "user_balansa_demo";
export const DEMO_BUSINESS_ID = "biz_balansa_demo";
export const DEMO_TENANT_SLUG = "balansa-demo";
/** Demo hisobi logini. Parol hash'i tasodifiy — bu login bilan kirib bo'lmaydi. */
export const DEMO_LOGIN = "demo@balansa.local";
export const DEMO_BUSINESS_NOMI = "Balansa Demo";
export const DEMO_TENANT_NOMI = "Balansa Demo";

/** Mehmonga ko'rsatiladigan xabar — yozish urinishida qaytadi. */
export const DEMO_RAD_MATNI =
  "Demo rejimida o'zgartirish saqlanmaydi. O'z biznesingizda sinab ko'ring — 14 kun bepul.";

/** Demo'da ruxsat etilgan (ma'lumot o'zgartirmaydigan) HTTP metodlari. */
const OQISH_METODLARI = new Set(["GET", "HEAD"]);

/**
 * Shu so'rov demo qulfiga tushadimi. SOF funksiya — test qilish oson
 * (`tests/demo.test.ts` uni to'g'ridan-to'g'ri tekshiradi).
 *
 * @param demo         tenant demo bayrog'i
 * @param method       HTTP metodi
 * @param yozishIzni   route ANIQ ruxsat so'raganmi (faqat holat/cookie amallari)
 */
export function demoQulfi(demo: boolean, method: string, yozishIzni = false): boolean {
  if (!demo) return false;
  if (OQISH_METODLARI.has(method.toUpperCase())) return false;
  return !yozishIzni;
}

/** Qulf ishlaganda qaytariladigan yagona javob (403 + `demo: true` bayrog'i). */
export function demoRadJavobi(): NextResponse {
  return NextResponse.json({ error: DEMO_RAD_MATNI, demo: true }, { status: 403 });
}

/**
 * Foydalanuvchi demo tenantga tegishlimi.
 *
 * `withTenant` dan TASHQARIDAGI route'lar uchun (parol almashtirish,
 * Telegram bog'lash) — ular tenant kontekstini qurmaydi, lekin demo mehmon
 * ularga ham yeta oladi. So'rov ichida keshlanadi.
 */
export const demoFoydalanuvchimi = requestCache(async (userId: string): Promise<boolean> => {
  const user = await rawPrisma.user.findUnique({
    where: { id: userId },
    select: { tenant: { select: { demo: true } } },
  });
  return user?.tenant?.demo === true;
});

/** Demo tenant (mavjud bo'lsa) — kirish route'i uchun. */
export async function demoTenantniOl(): Promise<{
  tenantId: string;
  userId: string;
  login: string;
  ism: string;
  rol: string;
  businessId: string | null;
  sessionEpoch: number;
} | null> {
  const tenant = await rawPrisma.tenant.findFirst({
    where: { demo: true },
    select: { id: true },
  });
  if (!tenant) return null;
  // Demo tenantda foydalanuvchi bitta — direktor (OWNER). Yozish qulflangani
  // uchun OWNER roli imtiyoz bermaydi, faqat to'liq menyuni ochadi.
  const user = await rawPrisma.user.findFirst({
    where: { tenantId: tenant.id, isActive: true, rol: "OWNER" },
    select: { id: true, login: true, ism: true, rol: true, businessId: true, sessionEpoch: true },
  });
  if (!user) return null;
  return {
    tenantId: tenant.id,
    userId: user.id,
    login: user.login,
    ism: user.ism,
    rol: user.rol,
    businessId: user.businessId ?? null,
    sessionEpoch: user.sessionEpoch,
  };
}
