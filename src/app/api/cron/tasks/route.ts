import { cronGuard } from "@/lib/cron/guard";
import { vazifaIshi } from "@/lib/cron/ishlar";

/**
 * TAKRORIYLAR VA VAZIFALAR — kuniga 06:00 da.
 *
 * Eng uzun qadam: har tenant ustidan aylanadi. Shuning uchun oxirida turadi
 * — u timeout bo'lsa ham zaxira, obuna va hisobotlar allaqachon bajarilgan.
 */
export const maxDuration = 60;

export async function GET(req: Request) {
  const rad = cronGuard(req);
  if (rad) return rad;

  const n = await vazifaIshi();
  return new Response(
    `OK (recurring: ${n.recurring}, recurringXato: ${n.recurringXato}, tasks: ${n.eslatma})`,
    { status: 200 }
  );
}
