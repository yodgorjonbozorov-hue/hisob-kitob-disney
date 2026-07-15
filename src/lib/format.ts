const UZ_OYLAR = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
];

/** Guruhlaydi: 1250000 -> "1 250 000". ICU/uz-UZ locale'ga tayanmaydi. */
export function formatSom(value: number): string {
  const negative = value < 0;
  const digits = Math.round(Math.abs(value)).toString();
  let grouped = "";
  for (let i = 0; i < digits.length; i++) {
    const posFromEnd = digits.length - i;
    grouped += digits[i];
    if (posFromEnd > 1 && posFromEnd % 3 === 1) {
      grouped += " ";
    }
  }
  return (negative ? "-" : "") + grouped;
}

export function formatSomLabel(value: number): string {
  return `${formatSom(value)} so'm`;
}

/** "1 250 000" yoki "1250000" kabi kiritilgan matndan raqamni ajratib oladi. */
export function parseSomInput(raw: string): number {
  const cleaned = raw.replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  return parseInt(cleaned, 10);
}

export function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function changeDirection(value: number | null): "up" | "down" | "flat" {
  if (value === null || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

/** DateOnly (UTC-midnight) qiymatni "01.07.2026" formatida ko'rsatadi. */
export function formatDateUZ(date: Date): string {
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}.${m}.${y}`;
}

export function formatMonthLabel(year: number, monthIndex0: number): string {
  return `${UZ_OYLAR[monthIndex0]} ${year}`;
}

export function uzOyNomi(monthIndex0: number): string {
  return UZ_OYLAR[monthIndex0];
}
