import { bot } from "@/bot/bot";
import { checkAndSendMonthlyReport } from "@/bot/scheduler";
import { generateDueRecurring } from "@/lib/services/recurring";

/**
 * Vercel Cron kuniga bir marta shu route'ni chaqiradi.
 * - Oylik hisobot (funksiya ichida "bugun 1-sanami" tekshiruvi bor)
 * - Muddati kelgan takroriy tranzaksiyalarni yaratish (idempotent)
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await checkAndSendMonthlyReport(bot);
  const recurringCount = await generateDueRecurring().catch(() => 0);
  return new Response(`OK (recurring: ${recurringCount})`, { status: 200 });
}
