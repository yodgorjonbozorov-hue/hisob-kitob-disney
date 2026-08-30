import { todayTashkentDateOnlyString } from "@/lib/date";

/**
 * Xodimlar statistikasi davr yordamchilari — API va sahifa bir xil default
 * ("Bu oy", Toshkent kalendari) bilan ishlashi uchun bitta joyda.
 */

const SANA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface SanaOraliq {
  from: string;
  to: string;
}

/** Joriy oy (Toshkent): oy boshi → bugun. */
export function joriyOyOraliq(now: Date = new Date()): SanaOraliq {
  const bugun = todayTashkentDateOnlyString(now);
  return { from: `${bugun.slice(0, 7)}-01`, to: bugun };
}

/** So'rovdan from/to o'qiydi; noto'g'ri yoki to'liqsiz bo'lsa null. */
export function sanaOraliqOqi(searchParams: URLSearchParams): SanaOraliq | null {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !SANA_REGEX.test(from) || !SANA_REGEX.test(to)) return null;
  // Teskari oraliq bo'sh natija berardi — foydalanuvchi adashganda to'g'rilab yuboriladi.
  return from <= to ? { from, to } : { from: to, to: from };
}
