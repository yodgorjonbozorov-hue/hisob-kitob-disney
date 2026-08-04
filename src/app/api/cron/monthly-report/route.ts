import { checkAndSendMonthlyReport } from "@/bot/scheduler";
import { generateDueRecurring } from "@/lib/services/recurring";
import { sendExpiryWarnings } from "@/lib/billing/notify";
import { updateExpiredStatuses } from "@/lib/billing/subscribe";
import { sendTaskReminders } from "@/lib/tasks/service";
import { sendDailyDigest } from "@/lib/reports/dailyDigest";
import { sendBackupToTelegram } from "@/lib/backup/send";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { runWithTenant } from "@/lib/db/tenantContext";
import { bearerTogri } from "@/lib/security/compare";
import { cleanupOldConversations } from "@/bot/conversationStore";

/**
 * Vercel Cron kuniga bir marta shu route'ni chaqiradi.
 * - Oylik hisobot: tenantlar bo'ylab aylanadi (funksiya ichida "bugun 1-sanami" tekshiruvi bor)
 * - Takroriy tranzaksiyalar: har tenant o'z kontekstida, bittasida xato chiqsa qolgani to'xtamaydi
 */

/**
 * Standart 10 soniya bu route uchun kam: zaxira butun bazani 23 ta ketma-ket so'rov bilan
 * o'qiydi, ustiga oylik hisobot PDF'lari va Telegram yuborishlari bor. Funksiya va baza
 * hozir turli qit'ada (iad1 / Tokio) — har so'rov ~160 ms. Limitsiz qoldirilsa zaxira
 * jimgina timeout bo'lardi.
 */
export const maxDuration = 60;
export async function GET(req: Request) {
  // FAIL-CLOSED: CRON_SECRET sozlanmagan bo'lsa route umuman ishlamaydi.
  // Ilgari taqqoslash `"Bearer undefined"` bilan mos kelib ketardi — har kim
  // zaxira olishi, obuna statuslarini o'zgartirishi va barcha mijozlarga
  // Telegram xabar yuborishi mumkin edi.
  if (!process.env.CRON_SECRET) {
    return new Response("Cron sozlanmagan", { status: 503 });
  }
  if (!bearerTogri(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Bot moduli TELEGRAM_BOT_TOKEN'ni import paytida talab qiladi — shuning uchun
  // statik emas, shu yerda yuklanadi (build env'siz ham o'tsin; lib/tasks/service.ts
  // dagi bilan bir xil usul).
  const { bot } = await import("@/bot/bot");

  // ENG AVVAL zaxira: quyidagi biror qadam yiqilsa ham kunlik zaxira olinib bo'lgan bo'ladi.
  const zaxira = await sendBackupToTelegram().catch((e) => {
    console.error("Zaxira xatosi:", e);
    return { holat: "xato" as const };
  });

  // `?only=backup` — zaxirani qo'lda tekshirish uchun. Qolgan qadamlar mijozlarga real
  // Telegram xabar yuboradi (obuna ogohlantirishi, vazifa eslatmasi), shuning uchun
  // tekshiruvda ular ataylab o'tkazib yuboriladi.
  if (new URL(req.url).searchParams.get("only") === "backup") {
    return new Response(`OK (faqat zaxira: ${zaxira.holat})`, { status: 200 });
  }

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

  // Obuna/sinov muddati bo'yicha eslatmalar (3 kun / 1 kun / tugadi / kechikdi).
  const eslatma = await sendExpiryWarnings(bot).catch((e) => {
    console.error("Eslatma xatosi:", e);
    return { yuborilgan: 0, telegramsiz: [] as string[] };
  });
  // Telegram ulanmagan mijozlarga xabar yetmaydi — ularni qo'lda bog'lanish uchun log'ga chiqaramiz
  // (superadmin panelida ham "TG yo'q" belgisi bilan ko'rinadi).
  if (eslatma.telegramsiz.length > 0) {
    console.warn("Telegram ulanmagan (eslatma yetmadi):", eslatma.telegramsiz.join(", "));
  }

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

  // Tashlab ketilgan bot suhbatlarini tozalash (24 soatdan eski holatlar).
  const tozalangan = await cleanupOldConversations().catch((e) => {
    console.error("Bot suhbatlarini tozalash xatosi:", e);
    return 0;
  });

  return new Response(
    `OK (zaxira: ${zaxira.holat}, expired: ${expired}, recurring: ${recurringCount}, ` +
      `eslatma: ${eslatma.yuborilgan}, telegramsiz: ${eslatma.telegramsiz.length}, ` +
      `tasks: ${taskReminders}, digest: ${digest}, suhbat tozalandi: ${tozalangan})`,
    { status: 200 }
  );
}
