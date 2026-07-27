import type { Bot } from "grammy";
import { InputFile } from "grammy";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { runWithTenant } from "@/lib/db/tenantContext";
import { MANAGER_ROLLAR } from "@/lib/auth/roles";
import { getMonthlyReport } from "@/lib/queries/report";
import { MonthlyReportDocument } from "@/lib/pdf/MonthlyReportDocument";
import { shiftMonthString, currentMonthString, parseMonthString } from "@/lib/date";
import { formatSomLabel, uzOyNomi } from "@/lib/format";

const SETTING_KEY = "lastMonthlyReportSentForMonth";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // har soatda tekshiradi

// Har tenant uchun alohida belgi — bir tenantdagi xato boshqasini to'xtatmasin.
function settingKeyFor(tenantId: string): string {
  return `${SETTING_KEY}:${tenantId}`;
}

/**
 * Har oyning 1-sanasida o'tgan oy hisobotini yuboradi.
 * Tenantlar bo'ylab aylanadi; har tenant hisoboti FAQAT shu tenantning
 * direktorlariga boradi (tenant kontekstida — izolyatsiya avtomatik).
 * Bitta tenantda xato chiqsa, qolganlari davom etadi.
 */
export async function checkAndSendMonthlyReport(bot: Bot): Promise<void> {
  const today = new Date();
  if (today.getUTCDate() !== 1) return;

  const reportMonth = shiftMonthString(currentMonthString(), -1);
  const tenants = await rawPrisma.tenant.findMany({ select: { id: true, name: true } });

  for (const tenant of tenants) {
    try {
      await runWithTenant(tenant.id, () => sendTenantMonthlyReport(bot, tenant.id, reportMonth));
    } catch (error) {
      console.error(`Oylik hisobot xatosi (tenant: ${tenant.name}):`, error);
    }
  }
}

/** Bitta tenant uchun oylik hisobot — tenant konteksti ichida chaqiriladi. */
async function sendTenantMonthlyReport(bot: Bot, tenantId: string, reportMonth: string): Promise<void> {
  const key = settingKeyFor(tenantId);
  const setting = await rawPrisma.appSetting.findUnique({ where: { key } });
  if (setting?.value === reportMonth) return;

  // Tenant-scoped: faqat shu tenantning direktorlari va bizneslari.
  const managers = await prisma.user.findMany({
    where: { rol: { in: MANAGER_ROLLAR }, isActive: true, telegramChatId: { not: null } },
  });
  if (managers.length === 0) return;

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

    for (const manager of managers) {
      if (!manager.telegramChatId) continue;
      try {
        await bot.api.sendDocument(
          manager.telegramChatId,
          new InputFile(buffer, `hisobot-${business.nomi}-${reportMonth}.pdf`),
          { caption }
        );
      } catch (error) {
        console.error(`Hisobotni ${manager.ism}ga yuborishda xatolik:`, error);
      }
    }
  }

  await rawPrisma.appSetting.upsert({
    where: { key },
    update: { value: reportMonth },
    create: { key, value: reportMonth },
  });
}

export function startMonthlyReportScheduler(bot: Bot): void {
  checkAndSendMonthlyReport(bot).catch((e) => console.error("Scheduler xatosi:", e));
  setInterval(() => {
    checkAndSendMonthlyReport(bot).catch((e) => console.error("Scheduler xatosi:", e));
  }, CHECK_INTERVAL_MS);
}
