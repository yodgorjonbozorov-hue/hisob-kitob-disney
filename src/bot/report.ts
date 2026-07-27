import { InlineKeyboard, InputFile, type Context } from "grammy";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getMonthlyReport } from "@/lib/queries/report";
import { MonthlyReportDocument } from "@/lib/pdf/MonthlyReportDocument";
import { buildMonthlyReportWorkbook } from "@/lib/excel/monthlyReportWorkbook";
import { formatSomLabel, formatPercent, uzOyNomi } from "@/lib/format";
import { currentMonthString, parseMonthString } from "@/lib/date";

/**
 * /hisobot uchun biznes tanlash. Bitta biznes bo'lsa to'g'ridan-to'g'ri hisobot yuboradi.
 * Faqat admin uchun chaqiriladi (bot/index.ts'da rol tekshirilgan).
 */
export async function startMonthlyReport(ctx: Context) {
  const businesses = await prisma.business.findMany({
    where: { isActive: true },
    orderBy: { nomi: "asc" },
  });
  if (businesses.length === 0) {
    await ctx.reply("Hali biznes yaratilmagan.");
    return;
  }
  if (businesses.length === 1) {
    await sendMonthlyReportText(ctx, businesses[0].id, currentMonthString());
    return;
  }

  const keyboard = new InlineKeyboard();
  businesses.forEach((b, i) => {
    keyboard.text(b.nomi, `rbiz:${b.id}`);
    if (i % 2 === 1) keyboard.row();
  });
  await ctx.reply("Qaysi biznes uchun hisobot?", { reply_markup: keyboard });
}

/** rbiz:<businessId> callback — tanlangan biznes uchun joriy oy hisobotini yuboradi. */
export async function handleReportBusinessCallback(ctx: Context) {
  const data = ctx.callbackQuery?.data ?? "";
  const businessId = data.startsWith("rbiz:") ? data.slice(5) : null;
  await ctx.answerCallbackQuery();
  if (!businessId) return;
  await sendMonthlyReportText(ctx, businessId, currentMonthString());
}

export async function sendMonthlyReportText(
  ctx: Context,
  businessId: string,
  month: string = currentMonthString()
) {
  const report = await getMonthlyReport(businessId, month);
  const { year, monthIndex0 } = parseMonthString(report.month);

  const topKirim = report.kirimByCategory.slice(0, 3);
  const topChiqim = report.chiqimByCategory.slice(0, 3);

  const lines = [
    `📊 ${report.businessNomi} — ${uzOyNomi(monthIndex0)} ${year}`,
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
      .text("PDF", `report:pdf:${businessId}:${report.month}`)
      .text("Excel", `report:excel:${businessId}:${report.month}`),
  });
}

/** report:(pdf|excel):<businessId>:<month> callback. Faqat direktor uchun. */
export async function sendReportDocument(
  ctx: Context,
  businessId: string,
  month: string,
  format: "pdf" | "excel"
) {
  // Callback'dagi businessId tashqi input — tenant-scoped client orqali tekshiriladi (IDOR himoya).
  const business = await prisma.business.findFirst({ where: { id: businessId }, select: { id: true } });
  if (!business) {
    await ctx.answerCallbackQuery({ text: "Biznes topilmadi" });
    return;
  }

  const report = await getMonthlyReport(businessId, month);
  await ctx.answerCallbackQuery({ text: "Fayl tayyorlanmoqda..." });

  if (format === "pdf") {
    const buffer = await renderToBuffer(MonthlyReportDocument({ report }));
    await ctx.replyWithDocument(new InputFile(buffer, `hisobot-${month}.pdf`));
  } else {
    const buffer = await buildMonthlyReportWorkbook(report);
    await ctx.replyWithDocument(new InputFile(Buffer.from(buffer), `hisobot-${month}.xlsx`));
  }
}
