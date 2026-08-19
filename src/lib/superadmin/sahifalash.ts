/**
 * SERVER TOMONIDA SAHIFALASH (talab 43).
 *
 * Superadmin jadvallari 100 000 yozuv bilan ham ishlashi kerak, shuning uchun
 * filtr/saralash/sahifalash HAR DOIM bazada bajariladi — brauzerga faqat
 * bitta sahifa yuboriladi. Bu tur barcha ro'yxat servislarida bir xil.
 */

export const STANDART_LIMIT = 25;
/** Yuqori chegara — mijoz `?limit=100000` yozib bazani cho'ktira olmasligi uchun. */
export const MAKS_LIMIT = 100;

export interface SahifaSorovi {
  sahifa: number;
  limit: number;
}

export interface SahifaNatija<T> {
  qatorlar: T[];
  jami: number;
  sahifa: number;
  limit: number;
  sahifalar: number;
}

/** `?sahifa=&limit=` parametrlarini xavfsiz o'qiydi. */
export function sahifaParametrlari(params: URLSearchParams): SahifaSorovi {
  const sahifa = Math.max(1, Number(params.get("sahifa") ?? 1) || 1);
  const xom = Number(params.get("limit") ?? STANDART_LIMIT) || STANDART_LIMIT;
  const limit = Math.min(MAKS_LIMIT, Math.max(1, xom));
  return { sahifa, limit };
}

export function skip(s: SahifaSorovi): number {
  return (s.sahifa - 1) * s.limit;
}

export function sahifaNatija<T>(qatorlar: T[], jami: number, s: SahifaSorovi): SahifaNatija<T> {
  return {
    qatorlar,
    jami,
    sahifa: s.sahifa,
    limit: s.limit,
    sahifalar: Math.max(1, Math.ceil(jami / s.limit)),
  };
}
