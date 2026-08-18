/**
 * Brend fakti — yagona manba (docs/BRAND.md "Brand Lock").
 * Brend nomi ko'rinadigan har joyda (metadata, bot, PDF, Excel, email) shu yerdan olinadi,
 * qattiq yozilmaydi. Route nomlari (`/app/hisobot`, `/app/tranzaksiyalar`) brend emas — o'zgarmaydi.
 */
export const BRAND = {
  nomi: "Balansa",
  domen: "balansa.uz",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://balansa.uz",
  tagline: "Biznesingiz balansda",
  tavsif:
    "Kichik va o'rta biznes uchun yagona boshqaruv platformasi: kirim-chiqim, ombor, sotuv, " +
    "qarzdorlik, CRM va hisobotlar bitta tizimda.",
  /** Asosiy brend rangi (PDF/Excel kabi CSS'siz kontekstlar uchun) */
  rang: "#0F766E",
  rangAkssent: "#5EEAD4",
} as const;

/** Footer / hisobot pastki satri: "Balansa · balansa.uz" */
export const BRAND_SIGNATURE = `${BRAND.nomi} · ${BRAND.domen}`;

/**
 * Migratsiya izohi — eski nomni bilgan foydalanuvchilar uchun.
 * Rebrandingdan 1 oy o'tgach (2026-09-01) landing va login sahifasidan olib tashlanadi.
 */
export const ESKI_NOM_IZOHI = "Hisob-Kitob endi Balansa";

/**
 * Aloqa ma'lumotlari — saytdagi footer va yordam matnlari uchun yagona manba.
 *
 * `telefon` ataylab `null`: dizayn maketidagi "+998 90 000 00 00" — o'rin
 * egallovchi raqam, chin raqam emas. Chin raqam ma'lum bo'lganda shu yerga
 * yoziladi va footerda avtomatik paydo bo'ladi.
 */
export const ALOQA = {
  telegram: "@balansa_uz",
  telefon: null as string | null,
} as const;
