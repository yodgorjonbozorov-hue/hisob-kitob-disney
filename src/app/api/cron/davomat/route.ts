import { NextResponse } from "next/server";
import { cronGuard } from "@/lib/cron/guard";
import { davomatIshi } from "@/lib/cron/ishlar";

export const maxDuration = 60;

/** Davomat cron'i: o'tgan Toshkent kuni bo'yicha kelmaganlarni belgilaydi. */
export async function GET(req: Request) {
  const guard = cronGuard(req);
  if (guard) return guard;
  return NextResponse.json(await davomatIshi());
}
