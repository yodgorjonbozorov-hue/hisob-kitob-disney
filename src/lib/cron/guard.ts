import { bearerTogri } from "@/lib/security/compare";

/**
 * CRON GUARD — barcha cron route'lari uchun yagona tekshiruv.
 *
 * FAIL-CLOSED: `CRON_SECRET` sozlanmagan bo'lsa route umuman ishlamaydi.
 * Ilgari taqqoslash `"Bearer undefined"` bilan mos kelib ketardi — har kim
 * zaxira olishi, obuna statuslarini o'zgartirishi va barcha mijozlarga
 * Telegram xabar yuborishi mumkin edi (audit: C-5).
 *
 * `null` qaytsa — davom etish mumkin; `Response` qaytsa — o'shani qaytaring.
 */
export function cronGuard(req: Request): Response | null {
  if (!process.env.CRON_SECRET) {
    return new Response("Cron sozlanmagan", { status: 503 });
  }
  if (!bearerTogri(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
