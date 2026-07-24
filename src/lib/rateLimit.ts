/**
 * Oddiy xotira-asosidagi rate limiter (per-IP). Serverless'da har instansiya
 * uchun alohida — global emas, lekin brute-force'ni sezilarli sekinlashtiradi.
 */
interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

/**
 * @returns { ok, retryAfter } — ok=false bo'lsa limit oshgan.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count += 1;
  if (b.count > limit) {
    return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Muvaffaqiyatli amaldan keyin hisoblagichni tozalaydi. */
export function rateLimitReset(key: string): void {
  buckets.delete(key);
}
