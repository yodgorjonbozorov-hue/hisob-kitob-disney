import { cronGuard } from "@/lib/cron/guard";
import { billingIshi } from "@/lib/cron/ishlar";

/**
 * OBUNA — kuniga 04:00 da: davri tugagan statuslar va muddat eslatmalari.
 *
 * Zaxiradan KEYIN turadi: status o'zgarishi ma'lumotga ta'sir qiladi,
 * shuning uchun undan oldingi holat zaxirada saqlangan bo'lishi kerak.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  const rad = cronGuard(req);
  if (rad) return rad;

  const n = await billingIshi();
  return new Response(
    `OK (expired: ${n.expired}, eslatma: ${n.eslatma}, telegramsiz: ${n.telegramsiz})`,
    { status: 200 }
  );
}
