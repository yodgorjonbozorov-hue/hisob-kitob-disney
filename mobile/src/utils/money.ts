// Pul formatlash — yagona markaziy utilita.
// Backend pulni har doim Int (so'm) sifatida yuboradi; float matematika taqiqlangan.

const THIN_SPACE = ' ';

// 1250000 -> "1 250 000"
export function formatSum(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const negative = value < 0;
  const abs = Math.abs(Math.trunc(value));
  const grouped = String(abs).replace(/\B(?=(\d{3})+(?!\d))/g, THIN_SPACE);
  return negative ? `-${grouped}` : grouped;
}

// 1250000 -> "1 250 000 so'm"
export function formatSom(value: number): string {
  return `${formatSum(value)}${THIN_SPACE}so'm`;
}

// Kompakt ko'rinish: 4 900 000 -> "4,9 mln", 320 000 -> "320 ming"
export function formatCompact(value: number): string {
  const negative = value < 0;
  const abs = Math.abs(Math.trunc(value));
  let text: string;
  if (abs >= 1_000_000_000) {
    text = `${trimDecimal(abs / 1_000_000_000)} mlrd`;
  } else if (abs >= 1_000_000) {
    text = `${trimDecimal(abs / 1_000_000)} mln`;
  } else if (abs >= 100_000) {
    text = `${trimDecimal(abs / 1_000)} ming`;
  } else {
    text = formatSum(abs);
  }
  return negative ? `-${text}` : text;
}

function trimDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  const text = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
  return text.replace('.', ',');
}

// Kiritish maydoni uchun: "1250000" -> "1 250 000"; faqat raqamlarni qoldiradi.
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// "1 250 000" -> 1250000 (butun son). Bo'sh yoki noto'g'ri bo'lsa null.
export function parseAmountInput(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  return value;
}
