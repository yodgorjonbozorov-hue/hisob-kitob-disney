import { timingSafeEqual } from "node:crypto";

/**
 * Maxfiy qiymatlarni (imzo, kalit, token) TIMING-SAFE taqqoslash.
 *
 * Oddiy `===` birinchi farq qilgan baytda to'xtaydi — hujumchi javob vaqtini
 * o'lchab kalitni bayt-bayt topa oladi. `timingSafeEqual` esa har doim bir xil
 * vaqt sarflaydi.
 *
 * Uzunlik farqi `timingSafeEqual`da xato beradi, shuning uchun oldin
 * tekshiriladi — uzunlik sir emas (maxfiy qiymatlar sobit uzunlikda).
 */
export function secretlarTeng(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * `Authorization: Bearer <secret>` sarlavhasini tekshiradi.
 *
 * FAIL-CLOSED: `secret` sozlanmagan (bo'sh) bo'lsa HAR DOIM false qaytadi —
 * aks holda "Bearer undefined" yuborgan har kim cron'ni ishga tushira olardi.
 */
export function bearerTogri(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  if (!authHeader?.startsWith("Bearer ")) return false;
  return secretlarTeng(authHeader.slice("Bearer ".length), secret);
}
