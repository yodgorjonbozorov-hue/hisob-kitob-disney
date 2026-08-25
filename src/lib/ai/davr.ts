import {
  dateOnlyStringToUTCDate,
  utcDateToDateOnlyString,
  monthRangeUTC,
  shiftMonthString,
  currentMonthString,
  todayTashkentDateOnlyString,
  parseMonthString,
} from "@/lib/date";
import { uzOyNomi } from "@/lib/format";

/**
 * AI COPILOT — DAVR QATLAMI.
 *
 * Model hech qachon sana chegarasini O'ZI hisoblamaydi: u faqat davr KODINI
 * ("bugun", "oy", "2026-07") beradi, chegaralarni esa shu fayl hisoblaydi.
 * Sabab: "bu oy" ning boshi va oxiri — moliyaviy javobning yarmi; uni modelga
 * ishonib topshirish taxminiy raqamga olib boradi.
 *
 * Kun chegarasi Toshkent (UTC+5) bo'yicha: "bugun" so'ralganda foydalanuvchi
 * o'z kalendar kunini nazarda tutadi, server esa UTC'da ishlaydi.
 */

/** Qo'llab-quvvatlanadigan davr kodlari (model shu ro'yxatdan tanlaydi). */
export const DAVR_KODLARI = ["bugun", "kecha", "hafta", "oy", "3oy", "yil"] as const;
export type DavrKod = (typeof DAVR_KODLARI)[number];

export interface Davr {
  /** Boshlanish — UTC-yarim tun, oraliqqa KIRADI. */
  from: Date;
  /** Tugash — UTC-yarim tun, oraliqqa KIRMAYDI (exclusive). */
  to: Date;
  /** "YYYY-MM-DD" — filtr havolalari uchun (`/app/tranzaksiyalar?from=...`). */
  fromStr: string;
  /** "YYYY-MM-DD" — oxirgi KIRADIGAN kun. */
  toStr: string;
  /** Odam o'qiydigan nom: "Avgust 2026", "Bugun", "So'nggi 3 oy". */
  nomi: string;
  /** Davrdagi kunlar soni — oldingi davrni bir xil uzunlikda olish uchun. */
  kunlar: number;
  /** Butun kalendar oy bo'lsa "YYYY-MM" — oylik so'rovlar shundan foydalanadi. */
  oy: string | null;
}

const KUN_MS = 24 * 60 * 60 * 1000;

function kunlarSoni(from: Date, to: Date): number {
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / KUN_MS));
}

function qur(from: Date, to: Date, nomi: string, oy: string | null = null): Davr {
  return {
    from,
    to,
    fromStr: utcDateToDateOnlyString(from),
    toStr: utcDateToDateOnlyString(new Date(to.getTime() - KUN_MS)),
    nomi,
    kunlar: kunlarSoni(from, to),
    oy,
  };
}

/** "YYYY-MM" oyi uchun davr. */
export function oyDavri(oyStr: string): Davr {
  const { from, to } = monthRangeUTC(oyStr);
  const { year, monthIndex0 } = parseMonthString(oyStr);
  return qur(from, to, `${uzOyNomi(monthIndex0)} ${year}`, oyStr);
}

/** "YYYY-MM-DD" ikki sana orasidagi davr (ikkalasi ham kiradi). */
export function oraliqDavri(fromStr: string, toStr: string): Davr {
  const from = dateOnlyStringToUTCDate(fromStr);
  const to = new Date(dateOnlyStringToUTCDate(toStr).getTime() + KUN_MS);
  return qur(from, to, `${fromStr} — ${toStr}`);
}

const SANA_RE = /^\d{4}-\d{2}-\d{2}$/;
const OY_RE = /^\d{4}-\d{2}$/;

/**
 * Davr matnini chegaralarga aylantiradi. Tushunarsiz qiymat — joriy oy
 * (fail-safe: javob baribir chiqadi, lekin qaysi davr ekani nomida ko'rinadi).
 *
 * Qabul qilinadigan shakllar:
 *   "bugun" | "kecha" | "hafta" | "oy" | "3oy" | "yil"
 *   "2026-07"                  — kalendar oy
 *   "2026-07-01:2026-07-15"    — ixtiyoriy oraliq
 */
export function davrniHal(xom: string | null | undefined, bugunStr = todayTashkentDateOnlyString()): Davr {
  const kod = (xom ?? "").trim().toLowerCase();
  const bugun = dateOnlyStringToUTCDate(bugunStr);

  if (OY_RE.test(kod)) return oyDavri(kod);
  if (kod.includes(":")) {
    const [a, b] = kod.split(":");
    if (SANA_RE.test(a) && SANA_RE.test(b) && a <= b) return oraliqDavri(a, b);
  }
  if (SANA_RE.test(kod)) return oraliqDavri(kod, kod);

  switch (kod) {
    case "bugun":
      return qur(bugun, new Date(bugun.getTime() + KUN_MS), "Bugun");
    case "kecha": {
      const kecha = new Date(bugun.getTime() - KUN_MS);
      return qur(kecha, bugun, "Kecha");
    }
    case "hafta": {
      // Dushanbadan boshlanadi (o'zbek ish haftasi). getUTCDay: 0 = yakshanba.
      const kun = bugun.getUTCDay();
      const orqaga = kun === 0 ? 6 : kun - 1;
      const boshi = new Date(bugun.getTime() - orqaga * KUN_MS);
      return qur(boshi, new Date(bugun.getTime() + KUN_MS), "Bu hafta");
    }
    case "3oy": {
      const joriy = bugunStr.slice(0, 7);
      const { from } = monthRangeUTC(shiftMonthString(joriy, -2));
      const { to } = monthRangeUTC(joriy);
      return qur(from, to, "So'nggi 3 oy");
    }
    case "yil": {
      const yil = Number(bugunStr.slice(0, 4));
      return qur(new Date(Date.UTC(yil, 0, 1)), new Date(Date.UTC(yil + 1, 0, 1)), `${yil}-yil`);
    }
    case "oy":
    default:
      return oyDavri(bugunStr.slice(0, 7));
  }
}

/**
 * Solishtirish uchun oldingi davr.
 *
 * Kalendar oy — oldingi kalendar oy (oy uzunligi turlicha bo'lgani uchun
 * "30 kun oldin" noto'g'ri solishtirish berardi). Qolgan hollarda — AYNI
 * uzunlikdagi darhol oldingi oraliq.
 */
export function oldingiDavr(d: Davr): Davr {
  if (d.oy) return oyDavri(shiftMonthString(d.oy, -1));
  const uzunlik = d.to.getTime() - d.from.getTime();
  const to = d.from;
  const from = new Date(d.from.getTime() - uzunlik);
  const nomi =
    d.kunlar === 1
      ? "Oldingi kun"
      : `Oldingi ${d.kunlar} kun`;
  return qur(from, to, nomi);
}

/** Joriy oy kodi — UI va default davr uchun. */
export function joriyOy(): string {
  return currentMonthString();
}
