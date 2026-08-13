/**
 * Ilova kalendari — Asia/Tashkent (UTC+5, DSTsiz). Server UTC'da ishlaydi
 * (Vercel), shuning uchun "bugun" HAR DOIM `todayTashkentDateOnlyString`
 * orqali olinadi. UTC bo'yicha "bugun" olinsa, Toshkent vaqti 00:00–05:00
 * oralig'ida kechagi sana chiqadi va yozuv noto'g'ri kunga tushadi (H-2).
 */

/** "YYYY-MM-DD" -> UTC-midnight Date. Server/klient timezone farqidan himoyalangan. */
export function dateOnlyStringToUTCDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** UTC-midnight Date -> "YYYY-MM-DD" (input[type=date] uchun). */
export function utcDateToDateOnlyString(date: Date): string {
  const y = date.getUTCFullYear();
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Toshkent (Asia/Tashkent, UTC+5, DSTsiz) bo'yicha bugungi sana "YYYY-MM-DD".
 *
 * Kunlik hisobotda kun chegarasi O'ZBEKISTON yarim tunida o'tishi kerak —
 * server esa UTC'da ishlaydi (Vercel). Shuning uchun vaqt 5 soatga siljitilib,
 * natijaning UTC-komponenti Toshkent kalendar kunini beradi.
 */
export const TOSHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function todayTashkentDateOnlyString(now: Date = new Date()): string {
  return utcDateToDateOnlyString(new Date(now.getTime() + TOSHKENT_OFFSET_MS));
}

/** "YYYY-MM" -> { from, to } UTC-midnight chegaralari (to — keyingi oyning 1-kuni, exclusive). */
export function monthRangeUTC(monthStr: string): { from: Date; to: Date } {
  const [yearStr, monthStr2] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr2, 10); // 1-12
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1));
  return { from, to };
}

/** Joriy oyni "YYYY-MM" formatida qaytaradi. */
export function currentMonthString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

/** "YYYY-MM" oyni n oy oldinga suradi. */
export function shiftMonthString(monthStr: string, delta: number): string {
  const [yearStr, monthPart] = monthStr.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthPart, 10) - 1; // 0-based
  const d = new Date(Date.UTC(year, month + delta, 1));
  const ny = d.getUTCFullYear();
  const nm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${ny}-${nm}`;
}

export function parseMonthString(monthStr: string): { year: number; monthIndex0: number } {
  const [yearStr, monthPart] = monthStr.split("-");
  return { year: parseInt(yearStr, 10), monthIndex0: parseInt(monthPart, 10) - 1 };
}
