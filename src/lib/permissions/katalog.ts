import type { Rol } from "@/lib/auth/roles";

/**
 * GRANULAR HUQUQLAR KATALOGI — maxsus rollar (PRO) uchun yagona haqiqat manbai.
 *
 * Tizim rollari (OWNER/ADMIN/CASHIER/SELLER) modul/nav SKELETINI beradi,
 * granular huquqlar esa shu skelet ichida aniq amallarni ochadi/yopadi.
 * Maxsus rol (Role.huquqlar) va foydalanuvchi override'lari (User.huquqPlus/
 * huquqMinus) shu kataloq kodlari bilan ishlaydi.
 *
 * Client va server ikkalasida ishlatiladi — server-only import qo'shilmasin.
 */

export interface Huquq {
  code: string;
  label: string;
  guruh: string;
}

export const HUQUQLAR: Huquq[] = [
  // Mahsulot va ombor
  { code: "mahsulot.korish", label: "Mahsulotlarni ko'rish", guruh: "Mahsulot va ombor" },
  { code: "mahsulot.qoshish", label: "Mahsulot qo'shish/tahrirlash", guruh: "Mahsulot va ombor" },
  { code: "ombor.korish", label: "Omborni ko'rish", guruh: "Mahsulot va ombor" },
  { code: "ombor.kirim", label: "Ombor kirimi yaratish", guruh: "Mahsulot va ombor" },
  { code: "ombor.tuzatish", label: "Qoldiq (kg) o'zgartirish", guruh: "Mahsulot va ombor" },
  // Moliya
  { code: "tranzaksiya.korish", label: "Yozuvlarni (tranzaksiya) ko'rish", guruh: "Moliya" },
  { code: "tranzaksiya.yaratish", label: "Yozuv (kirim/chiqim) yaratish", guruh: "Moliya" },
  { code: "kassa.korish", label: "Kassalarni ko'rish", guruh: "Moliya" },
  { code: "pul.berish", label: "Pul berish (o'tkazma yaratish)", guruh: "Moliya" },
  { code: "pul.qabul", label: "Pul qabul qilish", guruh: "Moliya" },
  // Magazin (POS / QR / Barcode)
  { code: "pos.sotish", label: "Kassada (POS) sotish", guruh: "Magazin" },
  { code: "pos.qaytarish", label: "Chekni qaytarish/bekor qilish", guruh: "Magazin" },
  { code: "barcode.boshqarish", label: "Shtrix-kod va QR biriktirish", guruh: "Magazin" },
  // Sotuv va qarz
  { code: "sotuv.yaratish", label: "Sotuv yaratish", guruh: "Sotuv va qarz" },
  { code: "qarz.korish", label: "Qarzlarni ko'rish", guruh: "Sotuv va qarz" },
  { code: "qarz.tolash", label: "Qarz to'lash/yopish", guruh: "Sotuv va qarz" },
  // Xarid
  { code: "xarid.korish", label: "Xarid buyurtmalarini ko'rish", guruh: "Xarid" },
  { code: "xarid.qabul", label: "Xarid qabul qilish va to'lash", guruh: "Xarid" },
  // Boshqaruv
  { code: "hisobot.korish", label: "Hisobotlarni ko'rish", guruh: "Boshqaruv" },
  { code: "foydalanuvchi.boshqarish", label: "Foydalanuvchilarni boshqarish", guruh: "Boshqaruv" },
  { code: "rol.boshqarish", label: "Rollarni boshqarish", guruh: "Boshqaruv" },
];

export const HUQUQ_KODLARI: ReadonlySet<string> = new Set(HUQUQLAR.map((h) => h.code));

/** Katalogdagi barcha kodlar (OWNER/ADMIN uchun default to'plam). */
export const BARCHA_HUQUQLAR: string[] = HUQUQLAR.map((h) => h.code);

/**
 * Tizim rollari uchun DEFAULT huquq to'plamlari — maxsus rol tayinlanmagan
 * foydalanuvchining granular huquqlari shu yerdan olinadi (eski xatti-harakat
 * bilan mos: kassir sotuv/qarz/kassa bilan ishlaydi, sotuvchi faqat yozuv kiritadi).
 */
export const ROL_DEFAULT_HUQUQLAR: Record<Rol, string[]> = {
  SUPERADMIN: BARCHA_HUQUQLAR,
  OWNER: BARCHA_HUQUQLAR,
  ADMIN: BARCHA_HUQUQLAR,
  CASHIER: [
    "mahsulot.korish",
    "ombor.korish",
    "ombor.kirim",
    "tranzaksiya.korish",
    "tranzaksiya.yaratish",
    "kassa.korish",
    "pul.berish",
    "pul.qabul",
    "sotuv.yaratish",
    "qarz.korish",
    "qarz.tolash",
    // Kassada sotish — kassirning asosiy amali. Chekni QAYTARISH esa
    // ataylab yo'q: qaytarish pulni kassadan chiqaradi, bu boshqaruvchi
    // qarori (mavjud "sotuvni bekor qilish" qoidasi bilan bir xil).
    "pos.sotish",
  ],
  SELLER: ["tranzaksiya.korish", "tranzaksiya.yaratish", "pul.qabul"],
};

/** UI uchun guruhlangan katalog. */
export function huquqlarGuruhlab(): Array<{ guruh: string; huquqlar: Huquq[] }> {
  const natija: Array<{ guruh: string; huquqlar: Huquq[] }> = [];
  for (const h of HUQUQLAR) {
    const oxirgi = natija[natija.length - 1];
    if (oxirgi && oxirgi.guruh === h.guruh) oxirgi.huquqlar.push(h);
    else natija.push({ guruh: h.guruh, huquqlar: [h] });
  }
  return natija;
}

/** JSON massivni xavfsiz o'qish — buzilgan qiymatda bo'sh ro'yxat. */
export function huquqJsonParse(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(value);
    if (!Array.isArray(arr)) return [];
    return arr.filter((k): k is string => typeof k === "string" && HUQUQ_KODLARI.has(k));
  } catch {
    return [];
  }
}
