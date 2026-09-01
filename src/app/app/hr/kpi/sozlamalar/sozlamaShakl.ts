/** Bonus sozlamalari formasining umumiy yordamchilari. */

export interface IntervalForm {
  dan: number;
  gacha: number | null;
  foiz: number;
}

export interface QoidaForm {
  minBall: number;
  maxBall: number;
  foiz: number;
}

/**
 * Odam yozadigan foizni butun songa o'giradi ("2,5" → 250).
 *
 * Foiz bazada YUZDAN BIR aniqlikda saqlanadi, shuning uchun float hech
 * qachon serverga ketmaydi (loyihada float taqiqlangan).
 */
export function foizgaAylantir(matn: string): number {
  const n = parseFloat(matn.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Foizni ko'rsatish uchun ("250" → "2.5"). */
export function foizMatni(foiz: number): string {
  return String(foiz / 100);
}

/** Faqat raqamlarni oladi (bo'sh joyli summa kiritish uchun). */
export function songa(v: string): number {
  return Math.max(0, parseInt(v.replace(/\D/g, ""), 10) || 0);
}
