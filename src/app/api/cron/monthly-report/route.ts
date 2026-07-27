import { bot } from "@/bot/bot";
import { checkAndSendMonthlyReport } from "@/bot/scheduler";
import { generateDueRecurring } from "@/lib/services/recurring";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { runWithTenant } from "@/lib/db/tenantContext";

/**
 * Vercel Cron kuniga bir marta shu route'ni chaqiradi.
 * - Oylik hisobot: tenantlar bo'ylab aylanadi (funksiya ichida "bugun 1-sanami" tekshiruvi bor)
 * - Takroriy tranzaksiyalar: har tenant o'z kontekstida, bittasida xato chiqsa qolgani to'xtamaydi
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  await checkAndSendMonthlyReport(bot);

  let recurringCount = 0;
  const tenants = await rawPrisma.tenant.findMany({ select: { id: true, name: true } });
  for (const tenant of tenants) {
    try {
      recurringCount += await runWithTenant(tenant.id, () => generateDueRecurring());
    } catch (error) {
      console.error(`Takroriy tranzaksiya xatosi (tenant: ${tenant.name}):`, error);
    }
  }

  return new Response(`OK (recurring: ${recurringCount})`, { status: 200 });
}
