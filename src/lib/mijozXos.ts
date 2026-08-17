/**
 * MIJOZGA XOS (BESPOKE) IMKONIYATLAR.
 *
 * Ba'zi bloklar bitta mijozning iltimosiga ko'ra yasalgan — ular tarifning
 * umumiy imkoniyati EMAS. Bunday blokni `isPro()` bilan ochish xato: PRO
 * tarifdagi HAR mijoz uni ko'radi va mahsulot begona raqamlar bilan to'ladi.
 *
 * Shuning uchun bunday bloklar shu yerdagi ro'yxat bo'yicha ochiladi.
 * Ro'yxat kalit sifatida tenant `slug` yoki kompaniya nomini qabul qiladi —
 * ikkalasi ham bir xil ko'rinishga keltiriladi ("Fortex Selos" == "fortex-selos"),
 * shuning uchun slug to'qnashuv suffiksi bilan yaratilgan bo'lsa ham
 * ("fortex-selos-2") mijoz nomi bo'yicha topiladi.
 *
 * Kengaytirish uchun kod tegilmaydi — env yetarli:
 *   BUGUN_PANEL_MIJOZLARI="fortex-selos,Boshqa Mijoz"
 *   KG_SAVDO_MIJOZLARI="fortex-selos,Boshqa Mijoz"
 */

/** Slug yoki kompaniya nomini taqqoslash kalitiga aylantiradi. */
function kalit(s: string): string {
  return s
    .toLowerCase()
    .replace(/['ʼ’`]/g, "") // o' g' kabi apostroflar tushiriladi
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function royxat(env: string | undefined, standart: string): Set<string> {
  const xom = (env ?? standart).split(",");
  return new Set(xom.map(kalit).filter(Boolean));
}

/**
 * "Bugun (kunlik ko'rsatkichlar)" bloki ochiq mijozlar.
 *
 * Bazadagi tenant — "Fortex Selos UZB" (`fortex-selos-uzb`). Qisqa nom ham
 * ro'yxatda: mijoz kompaniya nomini "Fortex Selos" ga o'zgartirsa yoki
 * ikkinchi tenant shu nom bilan ochilsa blok yo'qolib qolmasin.
 */
const BUGUN_PANEL = royxat(
  process.env.BUGUN_PANEL_MIJOZLARI,
  "fortex-selos-uzb,fortex-selos"
);

/** Tenantning taqqoslash kalitlari: slug ham, kompaniya nomi ham. */
function tenantKalitlari(tenant: { name: string; slug: string }): string[] {
  return [kalit(tenant.slug), kalit(tenant.name)];
}

/**
 * Dashboard'dagi "Bugun" bloki (kg, kassalar jami, foydalanuvchi/ta'minotchi
 * soni) shu mijozga ko'rinadimi. Fortex Selos uchun buyurtma qilingan blok.
 */
export function bugunPaneliKorinadi(tenant: { name: string; slug: string }): boolean {
  return tenantKalitlari(tenant).some((k) => BUGUN_PANEL.has(k));
}

/**
 * KG SAVDOSI ochiq mijozlar — "Selos" kabi kategoriya bosilganda summa emas,
 * MIQDOR (kg) va 1 KG NARXI so'raladigan oyna.
 *
 * Fortex Selos mahsulotni og'irlik bilan sotadi va narx har savdoda
 * savdolashib belgilanadi. Boshqa mijozlar uchun bu faqat chalg'ituvchi
 * qadam bo'lardi: ularning "Pul kirdi" ekrani va kategoriyalari
 * O'ZGARMAYDI (bayroq ham, menyu ham, hisobot bloki ham ko'rinmaydi).
 */
const KG_SAVDO = royxat(process.env.KG_SAVDO_MIJOZLARI, "fortex-selos-uzb,fortex-selos");

/** Kg savdosi (miqdor × 1 kg narxi) shu mijozga ochiqmi. */
export function kgSavdoKorinadi(tenant: { name: string; slug: string }): boolean {
  return tenantKalitlari(tenant).some((k) => KG_SAVDO.has(k));
}
