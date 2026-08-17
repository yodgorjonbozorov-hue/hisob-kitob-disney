/**
 * KG SAVDOSI — o'lchov, hisob va formatlash. YAGONA MANBA.
 *
 * Nega alohida fayl: kg savdosida ikkita mutlaqo boshqa birlik bir yozuvda
 * yashaydi — OG'IRLIK (mahsulot ko'rsatkichi) va PUL (moliyaviy balans).
 * Ularni aralashtirish eng qimmat xato bo'lardi: kg kassa qoldig'iga
 * qo'shilib ketsa hisob buziladi. Shu bois:
 *
 *   - kg bazada GRAMDA butun son (`Transaction.miqdorGr`) — float emas,
 *     chunki 100.5 × 5000 kabi oddiy hisobda ham float xato beradi;
 *   - narx `Transaction.kgNarxi` — 1 kg uchun so'm (butun son), o'sha
 *     savdodagi REAL narx snapshoti (keyin o'zgarmaydi);
 *   - summa HAR DOIM shu ikkisidan hisoblanadi (`kgSumma`), frontend
 *     yuborgan qiymatga ishonilmaydi.
 *
 * Narx qotirilmagan: 100 kg × 4 500, 100 kg × 5 000 va 100 kg × 5 500 —
 * uchalasi ham to'g'ri savdo. Minimal/maksimal narx nazorati YO'Q (kerak
 * bo'lsa keyin alohida imkoniyat sifatida qo'shiladi).
 */

/** 1 kg = 1000 gramm. Bazadagi miqdor shu minor birlikda. */
export const GRAM = 1000;

/** Bir savdodagi maksimal miqdor (kg) — kiritish xatosidan himoya. */
export const MAX_KG = 1_000_000;

/** Bir kg uchun maksimal narx (so'm) — kiritish xatosidan himoya. */
export const MAX_KG_NARXI = 1_000_000_000;

/** Miqdor gramm aniqligida (3 xona) berilganmi — kasr qoldiq qolmasligi shart. */
export function kgAniqmi(kg: number): boolean {
  if (!Number.isFinite(kg)) return false;
  const gr = kg * GRAM;
  return Math.abs(gr - Math.round(gr)) < 1e-6;
}

/**
 * kg → gramm (butun son). Faqat tekshirilgan qiymat bilan chaqiriladi
 * (zod: `miqdorKgSchema`), shu bois bu yerda yaxlitlash yetarli.
 */
export function kgToGram(kg: number): number {
  return Math.round(kg * GRAM);
}

/** gramm → kg (ko'rsatish va hisobot uchun; 3 xonagacha aniq). */
export function gramToKg(gr: number): number {
  return gr / GRAM;
}

/**
 * SUMMA — yagona haqiqat manbai: miqdor × 1 kg narxi.
 *
 * Butun so'mga yaxlitlanadi (pul har doim Int): 100,5 kg × 5 001 = 502 600,5
 * → 502 601. Yaxlitlash faqat SHU YERDA bo'ladi.
 */
export function kgSumma(miqdorGr: number, kgNarxi: number): number {
  return Math.round((miqdorGr * kgNarxi) / GRAM);
}

/**
 * O'RTACHA SOTUV NARXI (so'm/kg) — FAQAT statistik ko'rsatkich.
 * Yozuvlardagi real `kgNarxi` qiymatlariga hech qanday ta'sir qilmaydi.
 */
export function ortachaKgNarxi(jamiSumma: number, jamiGr: number): number {
  if (jamiGr <= 0) return 0;
  return Math.round((jamiSumma * GRAM) / jamiGr);
}

/** Uch xonali guruhlash: 100500 → "100 500". Pul formatidan mustaqil (lib/format.ts). */
function guruhla(butun: string): string {
  let out = "";
  for (let i = 0; i < butun.length; i++) {
    const qoldi = butun.length - i;
    out += butun[i];
    if (qoldi > 1 && qoldi % 3 === 1) out += " ";
  }
  return out;
}

/**
 * Grammdagi miqdorni o'qiladigan kg matniga aylantiradi: 100500 → "100,5".
 * Kasr qismi o'zbekcha vergul bilan, ortiqcha nollar tushiriladi.
 */
export function formatKg(gr: number): string {
  const manfiy = gr < 0;
  const abs = Math.abs(Math.round(gr));
  const butun = Math.floor(abs / GRAM);
  const kasr = abs % GRAM;
  const kasrMatn = kasr === 0 ? "" : `,${String(kasr).padStart(3, "0").replace(/0+$/, "")}`;
  return `${manfiy ? "-" : ""}${guruhla(String(butun))}${kasrMatn}`;
}

/** "100,5 kg" — ro'yxat va hisobotlar uchun asosiy format. */
export function formatKgLabel(gr: number): string {
  return `${formatKg(gr)} kg`;
}

/**
 * Foydalanuvchi kiritgan matndan kg qiymatini oladi: "100,5" → 100.5.
 *
 * Vergul ham, nuqta ham qabul qilinadi (telefon klaviaturasi ikkisini ham
 * beradi), guruh bo'shliqlari tushiriladi, kasr qismi 3 xona (gramm) bilan
 * cheklanadi. Noto'g'ri matn — 0 (UI "Miqdorni kiriting" deb ogohlantiradi).
 */
export function parseKgInput(matn: string): number {
  const tozalangan = matn.replace(/\s/g, "").replace(",", ".");
  const moslik = /^\d*\.?\d{0,3}/.exec(tozalangan);
  const son = Number(moslik?.[0] ?? "");
  if (!Number.isFinite(son) || son <= 0) return 0;
  return Math.round(son * GRAM) / GRAM;
}
