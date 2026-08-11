import { TOSHKENT_OFFSET_MS, dateOnlyStringToUTCDate, utcDateToDateOnlyString } from "@/lib/date";

/**
 * Kunlik hisobot UI vaqt yordamchilari — hammasi Toshkent (UTC+5) bo'yicha.
 * Brauzer timezone'iga tayanmaydi: kassir telefoni boshqa mintaqada bo'lsa ham
 * kun va soat O'zbekiston bo'yicha ko'rinadi.
 */

const OYLAR = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

/** "2026-08-11" -> "11-avgust, 2026". */
export function sanaUz(sanaStr: string): string {
  const d = dateOnlyStringToUTCDate(sanaStr);
  return `${d.getUTCDate()}-${OYLAR[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
}

/** Sanani n kunga suradi: sanaSur("2026-08-11", -1) -> "2026-08-10". */
export function sanaSur(sanaStr: string, kun: number): string {
  const d = dateOnlyStringToUTCDate(sanaStr);
  d.setUTCDate(d.getUTCDate() + kun);
  return utcDateToDateOnlyString(d);
}

/** ISO vaqt -> "23:47" (Toshkent). */
export function soatToshkent(iso: string): string {
  const d = new Date(new Date(iso).getTime() + TOSHKENT_OFFSET_MS);
  const h = d.getUTCHours().toString().padStart(2, "0");
  const m = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

/** ISO vaqt -> "11.08.2026 — 23:47" (Toshkent). */
export function vaqtUzToshkent(iso: string): string {
  const d = new Date(new Date(iso).getTime() + TOSHKENT_OFFSET_MS);
  const kun = d.getUTCDate().toString().padStart(2, "0");
  const oy = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${kun}.${oy}.${d.getUTCFullYear()} — ${soatToshkent(iso)}`;
}
