import { TOSHKENT_OFFSET_MS, dateOnlyStringToUTCDate, utcDateToDateOnlyString } from "@/lib/date";

/**
 * DAVOMAT VAQT HISOBI — sof funksiyalar (DB'siz, testlanadigan).
 *
 * Qoidalar (CLAUDE.md konventsiyasi):
 *  - Kalendar kuni TOSHKENT (UTC+5, DSTsiz) bo'yicha almashadi;
 *  - Jadvaldagi "HH:MM" — Toshkent devor soati;
 *  - Bazada barcha vaqtlar UTC `Date` sifatida saqlanadi;
 *  - Mijoz soatiga HECH QACHON ishonilmaydi — hisob server `Date.now()` dan.
 */

/** "HH:MM" -> kun boshidan o'tgan daqiqalar. Noto'g'ri format -> null. */
export function soatniDaqiqaga(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Daqiqa -> "HH:MM". */
export function daqiqaniSoatga(daqiqa: number): string {
  const d = ((daqiqa % 1440) + 1440) % 1440;
  const h = Math.floor(d / 60);
  const m = d % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** UTC instant -> Toshkent kalendar kuni ("YYYY-MM-DD"). */
export function toshkentSana(instant: Date): string {
  return utcDateToDateOnlyString(new Date(instant.getTime() + TOSHKENT_OFFSET_MS));
}

/** UTC instant -> Toshkent devor soati "HH:MM". */
export function toshkentSoat(instant: Date): string {
  const t = new Date(instant.getTime() + TOSHKENT_OFFSET_MS);
  return daqiqaniSoatga(t.getUTCHours() * 60 + t.getUTCMinutes());
}

/** UTC instant -> Toshkent hafta kuni (0=Yakshanba ... 6=Shanba). */
export function toshkentHaftaKuni(instant: Date): number {
  return new Date(instant.getTime() + TOSHKENT_OFFSET_MS).getUTCDay();
}

/** "YYYY-MM-DD" (Toshkent kuni) -> hafta kuni (0=Yakshanba ... 6=Shanba). */
export function sanaHaftaKuni(sana: string): number {
  return dateOnlyStringToUTCDate(sana).getUTCDay();
}

/**
 * Toshkent kalendar kunidagi "HH:MM" devor soatini UTC instant'ga aylantiradi.
 * Masalan sana="2026-08-28", hhmm="09:00" -> 2026-08-28T04:00:00Z.
 */
export function toshkentVaqtniUTCga(sana: string, hhmm: string): Date {
  const daqiqa = soatniDaqiqaga(hhmm);
  const kun = dateOnlyStringToUTCDate(sana);
  return new Date(kun.getTime() + (daqiqa ?? 0) * 60_000 - TOSHKENT_OFFSET_MS);
}

export interface JadvalKuni {
  ishKuni: boolean;
  boshlanish: string | null;
  tugash: string | null;
}

export interface KechikishHisobi {
  /** Xom kechikish: jadval boshlanishidan keyin o'tgan to'liq daqiqalar (>=0). */
  xomDaqiqa: number;
  /** Jarima daqiqasi: imtiyoz (grace) ichida bo'lsa 0, aks holda xom qiymat. */
  jarimaDaqiqa: number;
  /** true — imtiyoz ichida yoki vaqtida kelgan. */
  vaqtida: boolean;
}

/**
 * KECHIKISH HISOBI — chegara mantig'i ANIQ va testlangan:
 * boshlanish 09:00, imtiyoz 5 daqiqa bo'lsa:
 *   09:00..09:05 (shu jumladan 09:05:59) -> vaqtida (xom 0..5, jarima 0)
 *   09:06 -> kechikdi (xom 6, jarima 6)
 * Xom daqiqa to'liq o'tgan daqiqalar bilan hisoblanadi (floor):
 * 09:05:59 da xom = 5, ya'ni imtiyoz chegarasi ichida.
 */
export function kechikishHisobla(params: {
  kelgan: Date;
  sana: string;
  boshlanish: string;
  imtiyozDaqiqa: number;
}): KechikishHisobi {
  const boshlanishUTC = toshkentVaqtniUTCga(params.sana, params.boshlanish);
  const farqMs = params.kelgan.getTime() - boshlanishUTC.getTime();
  const xomDaqiqa = Math.max(0, Math.floor(farqMs / 60_000));
  const vaqtida = xomDaqiqa <= params.imtiyozDaqiqa;
  return { xomDaqiqa, jarimaDaqiqa: vaqtida ? 0 : xomDaqiqa, vaqtida };
}

export interface KetishHisobi {
  ishlanganDaqiqa: number;
  ertaKetishDaqiqa: number;
  ortiqchaDaqiqa: number;
}

/** Ketish hisobi: ishlangan vaqt, erta ketish va ortiqcha (overtime) daqiqalar. */
export function ketishHisobla(params: {
  kelgan: Date;
  ketgan: Date;
  sana: string;
  tugash: string | null;
}): KetishHisobi {
  const ishlanganDaqiqa = Math.max(
    0,
    Math.floor((params.ketgan.getTime() - params.kelgan.getTime()) / 60_000)
  );
  if (!params.tugash) return { ishlanganDaqiqa, ertaKetishDaqiqa: 0, ortiqchaDaqiqa: 0 };
  const tugashUTC = toshkentVaqtniUTCga(params.sana, params.tugash);
  const farq = Math.floor((params.ketgan.getTime() - tugashUTC.getTime()) / 60_000);
  return {
    ishlanganDaqiqa,
    ertaKetishDaqiqa: farq < 0 ? -farq : 0,
    ortiqchaDaqiqa: farq > 0 ? farq : 0,
  };
}

/** Daqiqani "N soat M daqiqa" ko'rinishiga keltiradi (UI uchun). */
export function daqiqaMatn(daqiqa: number): string {
  const soat = Math.floor(daqiqa / 60);
  const qoldiq = daqiqa % 60;
  if (soat <= 0) return `${qoldiq} daqiqa`;
  if (qoldiq === 0) return `${soat} soat`;
  return `${soat} soat ${qoldiq} daqiqa`;
}
