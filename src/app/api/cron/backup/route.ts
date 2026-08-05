import { cronGuard } from "@/lib/cron/guard";
import { zaxiraIshi } from "@/lib/cron/ishlar";

/**
 * ZAXIRA VA TOZALASH — kuniga 03:00 da.
 *
 * Eng avval bajariladi: qolgan cron'lardan birortasi yiqilsa ham kunlik
 * zaxira olinib bo'lgan bo'ladi.
 *
 * `?only=backup` — zaxirani qo'lda tekshirish uchun (tozalash qadamlarisiz).
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  const rad = cronGuard(req);
  if (rad) return rad;

  const faqatZaxira = new URL(req.url).searchParams.get("only") === "backup";
  const n = await zaxiraIshi({ faqatZaxira });

  return new Response(
    `OK (zaxira: ${n.zaxira}, suhbat: ${n.suhbat}, rl: ${n.rateLimit})`,
    { status: 200 }
  );
}
