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
  return `${formatSom(value)} soʻm`;
}

/**
 * PDF (Helvetica) uchun xavfsiz matn — o'zbek lotinidagi maxsus apostroflarni
 * (ʻ U+02BB, ʼ U+02BC, curly ' ') oddiy ASCII apostrofga aylantiradi, aks holda
 * Helvetica ularni ko'rsatmaydi (bo'sh katakcha).
 */
export function pdfSafe(text: string): string {
  return text.replace(/[ʻʼ‘’`]/g, "'");
}

// ─────────────────────────────────────────────────────────────────────────────
// Pul formatlash — YAGONA MANBA. Kod bazasida `.toLocaleString()` ishlatilmaydi.
// Pul butun son (so'm) sifatida saqlanadi — float emas (yaxlitlash xatosi bo'lmasin).
// ─────────────────────────────────────────────────────────────────────────────

/** `12 450 000 soʻm` — guruhlangan, uz-UZ. Jadval/ro'yxat/summa uchun asosiy format. */
export function formatMoney(value: number): string {
  return `${formatSom(value)} soʻm`;
}

/**
 * `12,4 mln` / `1,2 mlrd` / `980 ming` — KPI kartalari va grafik o'qlari uchun ixcham.
 * Manfiy qiymatlar ham qo'llab-quvvatlanadi.
 */
export function formatMoneyCompact(value: number): string {
  const neg = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const fmt = (n: number, suffix: string) => {
    // Bir kasrli, keraksiz nol tushiriladi: 12,0 → 12
    const rounded = Math.round(n * 10) / 10;
    const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
    return `${neg}${s} ${suffix}`;
  };
  if (abs >= 1_000_000_000) return fmt(abs / 1_000_000_000, "mlrd");
  if (abs >= 1_000_000) return fmt(abs / 1_000_000, "mln");
  if (abs >= 10_000) return fmt(abs / 1_000, "ming");
  return `${neg}${formatSom(abs)}`;
}

/** "1 250 000" yoki "1250000" kabi kiritilgan matndan raqamni ajratib oladi. */
export function parseSomInput(raw: string): number {
  const cleaned = raw.replace(/[^\d]/g, "");
  if (!cleaned) return 0;
  return parseInt(cleaned, 10);
}

/**
 * Erkin matndan summa o'qiydi — Telegram botda odam qanday yozsa shunday:
 * "2 mln" → 2 000 000, "2.5 mln" → 2 500 000, "500 ming" → 500 000,
 * "2 500 000" → 2 500 000. Tushunarsiz bo'lsa 0 qaytadi.
 */
export function parseSummaText(raw: string): number {
  const s = raw.toLowerCase().replace(/\s+/g, " ").trim();
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(mlrd|milliard|mln|million|mil|ming|k)\b/);
  if (!m) return parseSomInput(s);
  const son = parseFloat(m[1].replace(",", "."));
  const kof =
    m[2] === "mlrd" || m[2] === "milliard"
      ? 1_000_000_000
      : m[2] === "ming" || m[2] === "k"
        ? 1_000
        : 1_000_000;
  return Math.round(son * kof);
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

/**
 * TO'LIQ PAYT (instant) — "16.08.2026 19:42", Asia/Tashkent (UTC+5, DSTsiz).
 *
 * `formatDateUZ` dan farqi: u DateOnly (UTC-yarim tun) qiymatlar uchun,
 * bu esa haqiqiy vaqt nuqtasi uchun (kassa topshirig'i, qaror payti).
 * Toshkent siljishi QO'LDA qo'shiladi — server UTC'da ishlaydi va
 * `toLocaleString` mintaqasi muhitga qarab o'zgarib ketishi mumkin.
 */
export function formatToshkentVaqt(date: Date): string {
  const t = new Date(date.getTime() + 5 * 60 * 60 * 1000);
  const d = t.getUTCDate().toString().padStart(2, "0");
  const m = (t.getUTCMonth() + 1).toString().padStart(2, "0");
  const soat = t.getUTCHours().toString().padStart(2, "0");
  const daq = t.getUTCMinutes().toString().padStart(2, "0");
  return `${d}.${m}.${t.getUTCFullYear()} ${soat}:${daq}`;
}

/**
 * FAQAT SOAT — "19:42", Asia/Tashkent. Sana alohida sarlavhada ko'rinadigan
 * guruhlangan ro'yxatlarda kerak (kategoriya tafsiloti): har qatorda to'liq
 * sanani takrorlash o'qishni sekinlashtiradi.
 */
export function formatToshkentSoat(date: Date): string {
  return formatToshkentVaqt(date).split(" ")[1];
}

/** Sana + oy nomi bilan: "24 Iyul 2026". DateOnly (UTC) qiymat uchun. */
export function formatDate(date: Date): string {
  const d = date.getUTCDate();
  const m = uzOyNomi(date.getUTCMonth());
  const y = date.getUTCFullYear();
  return `${d} ${m} ${y}`;
}

/** `formatMoneyCompact` uchun qisqa alias (REDESIGN.md lug'ati). */
export const formatCompact = formatMoneyCompact;

/**
 * "24 iyul" (joriy yil) yoki "24 iyul 2025" (boshqa yil) — kichik oy nomi.
 * DateOnly (UTC) qiymat uchun.
 */
export function formatDateUz(date: Date, now: Date = new Date()): string {
  const d = date.getUTCDate();
  const m = uzOyNomi(date.getUTCMonth()).toLowerCase();
  const y = date.getUTCFullYear();
  return y === now.getUTCFullYear() ? `${d} ${m}` : `${d} ${m} ${y}`;
}

/**
 * Nisbiy kun (bosh harf bilan): `Bugun`, `Kecha`, `Ertaga`, aks holda "24 iyul".
 * Kassa lentasi kun sarlavhalari uchun. Asia/Tashkent kun chegaralari.
 */
export function formatRelativeDay(date: Date, now: Date = new Date()): string {
  const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const dayIndex = (d: Date) => Math.floor((d.getTime() + TASHKENT_OFFSET_MS) / 86_400_000);
  const diff = dayIndex(now) - dayIndex(date);
  if (diff === 0) return "Bugun";
  if (diff === 1) return "Kecha";
  if (diff === -1) return "Ertaga";
  return formatDateUz(date, now);
}

/**
 * Nisbiy sana (o'zbekcha): `bugun`, `kecha`, `3 kun oldin`, aks holda to'liq sana.
 * Taqqoslash Asia/Tashkent (UTC+5) kun chegaralari bo'yicha amalga oshiriladi.
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const dayIndex = (d: Date) => Math.floor((d.getTime() + TASHKENT_OFFSET_MS) / 86_400_000);
  const diff = dayIndex(now) - dayIndex(date);
  if (diff === 0) return "bugun";
  if (diff === 1) return "kecha";
  if (diff === -1) return "ertaga";
  if (diff > 1 && diff <= 30) return `${diff} kun oldin`;
  if (diff < -1 && diff >= -30) return `${-diff} kundan keyin`;
  return formatDateUZ(date);
}

export function formatMonthLabel(year: number, monthIndex0: number): string {
  return `${UZ_OYLAR[monthIndex0]} ${year}`;
}

export function uzOyNomi(monthIndex0: number): string {
  return UZ_OYLAR[monthIndex0];
}
