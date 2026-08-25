/**
 * SOTILGAN MAHSULOTLAR bloki uchun sana presetlari.
 *
 * Presetlar brauzer soatidan EMAS, serverdan kelgan "bugun" satridan
 * hisoblanadi (`todayTashkentDateOnlyString`). Sabab: telefon vaqt mintaqasi
 * noto'g'ri qo'yilgan bo'lsa "Bugun" tugmasi serverdagi bugundan boshqa kunni
 * so'rardi va ro'yxat bo'sh chiqardi. Sana arifmetikasi UTC'da bajariladi —
 * `Sale.sana` ham UTC yarim tuni (lib/date.ts qoidasi).
 */

export type SotuvPreset = "bugun" | "kecha" | "hafta" | "oy" | "oraliq";

export interface SanaOraligi {
  from: string;
  to: string;
}

/** "YYYY-MM-DD" ga kun qo'shadi/ayiradi. */
export function kunQosh(sana: string, delta: number): string {
  const d = new Date(`${sana}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Preset → oraliq. "oraliq" — foydalanuvchi o'zi tanlaydi, shu bois bugun. */
export function presetOraligi(preset: SotuvPreset, bugun: string): SanaOraligi {
  if (preset === "kecha") {
    const kecha = kunQosh(bugun, -1);
    return { from: kecha, to: kecha };
  }
  if (preset === "hafta") {
    // Dushanba — hafta boshi (getUTCDay: yakshanba = 0).
    const kun = new Date(`${bugun}T00:00:00.000Z`).getUTCDay();
    return { from: kunQosh(bugun, -((kun + 6) % 7)), to: bugun };
  }
  if (preset === "oy") {
    return { from: `${bugun.slice(0, 7)}-01`, to: bugun };
  }
  return { from: bugun, to: bugun };
}

export const SOTUV_PRESETLAR: { key: SotuvPreset; label: string }[] = [
  { key: "bugun", label: "Bugun" },
  { key: "kecha", label: "Kecha" },
  { key: "hafta", label: "Shu hafta" },
  { key: "oy", label: "Shu oy" },
  { key: "oraliq", label: "Sana oralig'i" },
];

/** "1-avgust — 25-avgust" ko'rinishidagi qisqa sarlavha. */
const OYLAR = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

export function sanaMatni(sana: string): string {
  const [, oy, kun] = sana.split("-");
  return `${parseInt(kun, 10)}-${OYLAR[parseInt(oy, 10) - 1]}`;
}

export function oraliqMatni({ from, to }: SanaOraligi): string {
  return from === to ? sanaMatni(from) : `${sanaMatni(from)} — ${sanaMatni(to)}`;
}
