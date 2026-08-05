import { cronGuard } from "@/lib/cron/guard";
import { hisobotIshi } from "@/lib/cron/ishlar";

/** HISOBOTLAR — kuniga 05:00 da: oylik hisobot (oyning 1-sanasi) va kunlik xulosa. */
export const maxDuration = 60;

export async function GET(req: Request) {
  const rad = cronGuard(req);
  if (rad) return rad;

  const n = await hisobotIshi();
  return new Response(`OK (digest: ${n.digest})`, { status: 200 });
}
