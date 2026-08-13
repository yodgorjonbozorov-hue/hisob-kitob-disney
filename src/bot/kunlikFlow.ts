import type { Context } from "grammy";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { confirmKunlikReport } from "@/lib/services/kunlik";
import type { Rol } from "@/lib/auth/roles";
import { utcDateToDateOnlyString } from "@/lib/date";
import { formatSomLabel } from "@/lib/format";

/**
 * KUN YAKUNINI TELEGRAMDA TASDIQLASH.
 *
 * Cron eslatmasidagi (lib/reports/kunlikEslatma.ts) `kht:ok:<reportId>`
 * tugmasi shu yerga keladi. Huquq xizmat qatlamida tekshiriladi
 * (confirmKunlikReport → getKunlikRuxsat): FAQAT tayinlangan direktor
 * (M-7, A variant). Direktor kassir bo'lishi ham mumkin, shuning uchun
 * bot darajasida managerOnly QO'YILMAYDI.
 */
export async function handleKunlikTasdiqCallback(ctx: Context, user: User) {
  const reportId = (ctx.callbackQuery?.data ?? "").slice("kht:ok:".length);
  const report = await prisma.dailyReport.findFirst({
    where: { id: reportId },
    include: { business: { select: { nomi: true } } },
  });
  if (!report) {
    await ctx.answerCallbackQuery({ text: "Hisobot topilmadi" });
    return;
  }

  const sanaStr = utcDateToDateOnlyString(report.sana);
  let yangi;
  try {
    yangi = await confirmKunlikReport(
      report.businessId,
      { userId: user.id, ism: user.ism, rol: user.rol as Rol },
      sanaStr
    );
  } catch (error) {
    const xabar = error instanceof Error ? error.message : "Tasdiqlab bo'lmadi";
    await ctx.answerCallbackQuery({ text: xabar.slice(0, 190) });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Tasdiqlandi" });
  await ctx.editMessageText(
    `🟢 ${report.business.nomi} — ${sanaStr.split("-").reverse().join(".")} kun yakuni tasdiqlandi.\n` +
      `💰 Jami: ${formatSomLabel(yangi.jamiSumma)}\n` +
      `Tasdiqladi: ${user.ism}`
  );
}
