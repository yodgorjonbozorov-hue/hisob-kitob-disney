/**
 * PUL RAQAMLARINI YASHIRISH — bosh sahifadagi ko'z tugmasi.
 *
 * Nima uchun: direktor bosh sahifani xodimlar yoki mijozlar oldida ochadi.
 * Oylik aylanma va sof foyda — yonidagi odam ko'rmasligi kerak bo'lgan
 * raqamlar. Shuning uchun har kartaning yonida ko'z tugmasi bor.
 *
 * NEGA COOKIE (localStorage emas): tanlov SERVERDA o'qilishi kerak. Aks
 * holda sahifa avval haqiqiy raqam bilan chizilib, keyin JS ishga tushgach
 * yashirilardi — ya'ni summa har yuklanishda bir lahza KO'RINIB ketardi va
 * yashirishning ma'nosi qolmasdi.
 *
 * Server va klient ikkalasi ham shu faylni import qiladi — format bitta.
 */

export const YASHIRIN_COOKIE = "pul_yashirin";

/**
 * Ko'z tugmasi bor kartalar. "kassa" va "qarz" keyin qo'shildi — eski
 * cookie'da ular yo'q va `yashirinniOqi` ularni ochiq (false) deb o'qiydi,
 * ya'ni mavjud foydalanuvchilar uchun hech narsa o'zgarmaydi.
 */
export type PulKarta = "kirim" | "chiqim" | "foyda" | "kassa" | "qarz";

export const PUL_KARTALARI: PulKarta[] = ["kirim", "chiqim", "foyda", "kassa", "qarz"];

export type YashirinHolat = Record<PulKarta, boolean>;

export const HAMMASI_OCHIQ: YashirinHolat = {
  kirim: false,
  chiqim: false,
  foyda: false,
  kassa: false,
  qarz: false,
};

/** Cookie qiymatini holatga aylantiradi. Noma'lum kalitlar e'tiborsiz qoladi. */
export function yashirinniOqi(xom: string | null | undefined): YashirinHolat {
  const holat: YashirinHolat = { ...HAMMASI_OCHIQ };
  if (!xom) return holat;
  for (const bolak of xom.split(",")) {
    const kalit = bolak.trim() as PulKarta;
    if (PUL_KARTALARI.includes(kalit)) holat[kalit] = true;
  }
  return holat;
}

/** Holatni cookie qiymatiga aylantiradi (yashiringanlari vergul bilan). */
export function yashirinMatn(holat: YashirinHolat): string {
  return PUL_KARTALARI.filter((k) => holat[k]).join(",");
}

/** Yashiringan summa o'rniga chiqadigan belgi. */
export const YASHIRIN_BELGI = "•••";
