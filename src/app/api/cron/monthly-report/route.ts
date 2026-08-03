import { bot } from "@/bot/bot";
import { checkAndSendMonthlyReport } from "@/bot/scheduler";
import { generateDueRecurring } from "@/lib/services/recurring";
import { sendExpiryWarnings } from "@/lib/billing/notify";
import { updateExpiredStatuses } from "@/lib/billing/subscribe";
import { sendTaskReminders } from "@/lib/tasks/service";
import { sendDailyDigest } from "@/lib/reports/dailyDigest";
import { sendBackupToTelegram } from "@/lib/backup/send";
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

  // ENG AVVAL zaxira: quyidagi biror qadam yiqilsa ham kunlik zaxira olinib bo'lgan bo'ladi.
  const zaxira = await sendBackupToTelegram(bot.api).catch((e) => {
    console.error("Zaxira xatosi:", e);
    return { holat: "xato" as const };
  });

  // Keyin statuslar yangilanadi: davri tugagan ACTIVE -> PAST_DUE.
  const expired = await updateExpiredStatuses().catch((e) => {
    console.error("Status yangilash xatosi:", e);
    return 0;
  });

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

  // Obuna/sinov muddati tugashiga oz qolgan tenantlarga Telegram ogohlantirish.
  const warned = await sendExpiryWarnings(bot).catch((e) => {
    console.error("Ogohlantirish xatosi:", e);
    return 0;
  });

  // Muddati kelgan vazifalar bo'yicha mas'ullarga eslatma (kuniga bir marta).
  const taskReminders = await sendTaskReminders(bot.api).catch((e) => {
    console.error("Vazifa eslatmalari xatosi:", e);
    return 0;
  });

  // Kunlik xulosa: kechagi kirim/chiqim har tenant direktorlariga.
  const digest = await sendDailyDigest(bot.api).catch((e) => {
    console.error("Kunlik xulosa xatosi:", e);
    return 0;
  });

  return new Response(
    `OK (zaxira: ${zaxira.holat}, expired: ${expired}, recurring: ${recurringCount}, warned: ${warned}, tasks: ${taskReminders}, digest: ${digest})`,
    { status: 200 }
  );
}
