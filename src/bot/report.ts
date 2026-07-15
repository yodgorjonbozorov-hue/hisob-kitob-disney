import { InlineKeyboard, InputFile, type Context } from "grammy";
import { renderToBuffer } from "@react-pdf/renderer";
import { getMonthlyReport } from "@/lib/queries/report";
import { MonthlyReportDocument } from "@/lib/pdf/MonthlyReportDocument";
import { buildMonthlyReportWorkbook } from "@/lib/excel/monthlyReportWorkbook";
import { formatSomLabel, formatPercent, uzOyNomi } from "@/lib/format";
import { currentMonthString, parseMonthString } from "@/lib/date";

/** Faqat admin uchun chaqiriladi (bot/index.ts'da rol tekshirilgan). */
export async function sendMonthlyReportText(ctx: Context, month: string = currentMonthString()) {
  const report = await getMonthlyReport(month);
  const { year, monthIndex0 } = parseMonthString(report.month);

  const topKirim = report.kirimByCategory.slice(0, 3);
  const topChiqim = report.chiqimByCategory.slice(0, 3);

  const lines = [
    `📊 ${uzOyNomi(monthIndex0)} ${year} — oylik hisobot`,
    "",
    `Jami kirim: ${formatSomLabel(report.jamiKirim)} (${formatPercent(report.changePct.kirim)})`,
    `Jami chiqim: ${formatSomLabel(report.jamiChiqim)} (${formatPercent(report.changePct.chiqim)})`,
    `Sof foyda: ${formatSomLabel(report.sofFoyda)} (${formatPercent(report.changePct.sofFoyda)})`,
  ];

  if (topKirim.length > 0) {
    lines.push("", "Eng ko'p kirim keltirgan kategoriyalar:");
    topKirim.forEach((c, i) => lines.push(`${i + 1}. ${c.nomi} — ${formatSomLabel(c.summa)}`));
  }
  if (topChiqim.length > 0) {
    lines.push("", "Eng ko'p xarajat qilingan kategoriyalar:");
    topChiqim.forEach((c, i) => lines.push(`${i + 1}. ${c.nomi} — ${formatSomLabel(c.summa)}`));
  }

  await ctx.reply(lines.join("\n"), {
    reply_markup: new InlineKeyboard()
      .text("PDF", `report:pdf:${report.month}`)
      .text("Excel", `report:excel:${report.month}`),
  });
}

/** Faqat admin uchun chaqiriladi (bot/index.ts'da rol tekshirilgan). */
export async function sendReportDocument(ctx: Context, month: string, format: "pdf" | "excel") {
  const report = await getMonthlyReport(month);
  await ctx.answerCallbackQuery({ text: "Fayl tayyorlanmoqda..." });

  if (format === "pdf") {
    const buffer = await renderToBuffer(MonthlyReportDocument({ report }));
    await ctx.replyWithDocument(new InputFile(buffer, `hisobot-${month}.pdf`));
  } else {
    const buffer = await buildMonthlyReportWorkbook(report);
    await ctx.replyWithDocument(new InputFile(Buffer.from(buffer), `hisobot-${month}.xlsx`));
  }
}
