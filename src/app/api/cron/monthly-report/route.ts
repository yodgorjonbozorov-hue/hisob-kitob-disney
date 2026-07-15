import { bot } from "@/bot/bot";
import { checkAndSendMonthlyReport } from "@/bot/scheduler";

/** Vercel Cron kuniga bir marta shu route'ni chaqiradi; funksiya ichida "bugun 1-sanami" tekshiruvi bor. */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await checkAndSendMonthlyReport(bot);
  return new Response("OK", { status: 200 });
}
