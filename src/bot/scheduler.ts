import type { Bot } from "grammy";
import { InputFile } from "grammy";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getMonthlyReport } from "@/lib/queries/report";
import { MonthlyReportDocument } from "@/lib/pdf/MonthlyReportDocument";
import { shiftMonthString, currentMonthString, parseMonthString } from "@/lib/date";
import { formatSomLabel, uzOyNomi } from "@/lib/format";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";

const SETTING_KEY = "lastMonthlyReportSentForMonth";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // har soatda tekshiradi

async function getLastSentMonth(): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
  return setting?.value ?? null;
}

async function markSentMonth(month: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: month },
    create: { key: SETTING_KEY, value: month },
  });
}

/**
 * Har oyning 1-sanasida o'tgan oy hisobotini har bir faol biznes uchun alohida,
 * barcha direktorlarga (admin) avtomatik yuboradi.
 */
export async function checkAndSendMonthlyReport(bot: Bot): Promise<void> {
  const today = new Date();
  if (today.getUTCDate() !== 1) return;

  const reportMonth = shiftMonthString(currentMonthString(), -1);
  const lastSent = await getLastSentMonth();
  if (lastSent === reportMonth) return;

  const admins = await prisma.user.findMany({
    where: { rol: { in: MANAGER_ROLLAR }, isActive: true, telegramChatId: { not: null } },
  });
  if (admins.length === 0) return;

  const businesses = await prisma.business.findMany({ where: { isActive: true }, orderBy: { nomi: "asc" } });
  const { year, monthIndex0 } = parseMonthString(reportMonth);

  for (const business of businesses) {
    const report = await getMonthlyReport(business.id, reportMonth);
    // Bo'sh biznes uchun hisobot yubormaymiz.
    if (report.jamiKirim === 0 && report.jamiChiqim === 0) continue;

    const buffer = await renderToBuffer(MonthlyReportDocument({ report }));
    const caption = [
      `📊 ${business.nomi} — ${uzOyNomi(monthIndex0)} ${year} (avtomatik hisobot)`,
      `Jami kirim: ${formatSomLabel(report.jamiKirim)}`,
      `Jami chiqim: ${formatSomLabel(report.jamiChiqim)}`,
      `Sof foyda: ${formatSomLabel(report.sofFoyda)}`,
    ].join("\n");

    for (const admin of admins) {
      if (!admin.telegramChatId) continue;
      try {
        await bot.api.sendDocument(
          admin.telegramChatId,
          new InputFile(buffer, `hisobot-${business.nomi}-${reportMonth}.pdf`),
          { caption }
        );
      } catch (error) {
        console.error(`Hisobotni ${admin.ism}ga yuborishda xatolik:`, error);
      }
    }
  }

  await markSentMonth(reportMonth);
}

export function startMonthlyReportScheduler(bot: Bot): void {
  checkAndSendMonthlyReport(bot).catch((e) => console.error("Scheduler xatosi:", e));
  setInterval(() => {
    checkAndSendMonthlyReport(bot).catch((e) => console.error("Scheduler xatosi:", e));
  }, CHECK_INTERVAL_MS);
}
