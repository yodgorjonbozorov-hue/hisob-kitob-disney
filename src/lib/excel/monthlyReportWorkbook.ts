import ExcelJS from "exceljs";
import { parseMonthString } from "@/lib/date";
import { uzOyNomi } from "@/lib/format";
import { BRAND, BRAND_SIGNATURE } from "@/lib/brand";
import type { MonthlyReport } from "@/lib/queries/report";

const SOM_FORMAT = '#,##0 "so\'m"';
/** Brend va semantik ranglar ARGB'da (docs/BRAND.md) */
const BRAND_ARGB = "FF0F766E";
const INCOME_ARGB = "FF16A34A";
const EXPENSE_ARGB = "FFDC2626";
const FAINT_ARGB = "FF64748B";

export async function buildMonthlyReportWorkbook(report: MonthlyReport): Promise<ExcelJS.Buffer> {
  const { year, monthIndex0 } = parseMonthString(report.month);
  const monthLabel = `${uzOyNomi(monthIndex0)} ${year}`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = BRAND.nomi;
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Hisobot");
  sheet.columns = [
    { header: "", key: "a", width: 30 },
    { header: "", key: "b", width: 20 },
    { header: "", key: "c", width: 12 },
  ];

  // Brend sarlavhasi — birinchi qator
  sheet.mergeCells("A1:C1");
  sheet.getCell("A1").value = BRAND.nomi;
  sheet.getCell("A1").font = { bold: true, size: 12, color: { argb: BRAND_ARGB } };

  sheet.mergeCells("A2:C2");
  sheet.getCell("A2").value = `${report.businessNomi} — Oylik hisobot: ${monthLabel}`;
  sheet.getCell("A2").font = { bold: true, size: 14 };

  sheet.addRow([]);
  const summaryHeaderRow = sheet.addRow(["Ko'rsatkich", "Summa"]);
  summaryHeaderRow.font = { bold: true };

  const kirimRow = sheet.addRow(["Jami kirim", report.jamiKirim]);
  kirimRow.getCell(2).numFmt = SOM_FORMAT;
  kirimRow.getCell(2).font = { color: { argb: INCOME_ARGB } };

  const chiqimRow = sheet.addRow(["Jami chiqim", report.jamiChiqim]);
  chiqimRow.getCell(2).numFmt = SOM_FORMAT;
  chiqimRow.getCell(2).font = { color: { argb: EXPENSE_ARGB } };

  const foydaRow = sheet.addRow(["Sof foyda", report.sofFoyda]);
  foydaRow.getCell(2).numFmt = SOM_FORMAT;
  foydaRow.getCell(2).font = {
    bold: true,
    color: { argb: report.sofFoyda >= 0 ? INCOME_ARGB : EXPENSE_ARGB },
  };

  // Avto rejimi: sotilgan mashinalar alohida varaqda (har mashina bo'yicha sof foyda).
  if (report.avto && report.avto.qatorlar.length > 0) {
    addAvtoSheet(workbook, report.avto, monthLabel);
  }

  sheet.addRow([]);
  addCategorySection(sheet, "Kirim taqsimoti", report.kirimByCategory);
  sheet.addRow([]);
  addCategorySection(sheet, "Chiqim taqsimoti", report.chiqimByCategory);

  sheet.addRow([]);
  const footerRow = sheet.addRow([BRAND_SIGNATURE]);
  footerRow.font = { size: 9, color: { argb: FAINT_ARGB } };

  return workbook.xlsx.writeBuffer();
}

/** "Sotilgan mashinalar" varag'i: olingan narx, xarajat, sotilgan narx, sof foyda. */
function addAvtoSheet(
  workbook: ExcelJS.Workbook,
  yakun: NonNullable<MonthlyReport["avto"]>,
  monthLabel: string
) {
  const sheet = workbook.addWorksheet("Sotilgan mashinalar");
  sheet.columns = [
    { header: "", key: "a", width: 28 },
    { header: "", key: "b", width: 16 },
    { header: "", key: "c", width: 16 },
    { header: "", key: "d", width: 16 },
    { header: "", key: "e", width: 16 },
    { header: "", key: "f", width: 12 },
  ];

  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = `Sotilgan mashinalar bo'yicha sof foyda — ${monthLabel}`;
  sheet.getCell("A1").font = { bold: true, size: 14 };
  sheet.addRow([]);

  const header = sheet.addRow(["Mashina", "Olingan narx", "Xarajat", "Sotilgan narx", "Sof foyda", "Marja"]);
  header.font = { bold: true };

  for (const q of yakun.qatorlar) {
    const row = sheet.addRow([
      q.avtoRaqam ? `${q.nomi} (${q.avtoRaqam})` : q.nomi,
      q.olinganNarx,
      q.xarajat,
      q.sotilganNarx,
      q.sofFoyda,
      q.sotilganNarx > 0 ? q.sofFoyda / q.sotilganNarx : 0,
    ]);
    [2, 3, 4, 5].forEach((c) => (row.getCell(c).numFmt = SOM_FORMAT));
    row.getCell(6).numFmt = "0.0%";
    row.getCell(5).font = { color: { argb: q.sofFoyda >= 0 ? INCOME_ARGB : EXPENSE_ARGB } };
  }

  const jamiSotilganSumma = yakun.jamiTannarx + yakun.jamiXarajat + yakun.jamiSofFoyda;
  const jami = sheet.addRow([
    `Jami: ${yakun.jamiSotilgan} ta mashina`,
    yakun.jamiTannarx,
    yakun.jamiXarajat,
    jamiSotilganSumma,
    yakun.jamiSofFoyda,
    jamiSotilganSumma > 0 ? yakun.jamiSofFoyda / jamiSotilganSumma : 0,
  ]);
  jami.font = { bold: true };
  [2, 3, 4, 5].forEach((c) => (jami.getCell(c).numFmt = SOM_FORMAT));
  jami.getCell(6).numFmt = "0.0%";
  jami.getCell(5).font = {
    bold: true,
    color: { argb: yakun.jamiSofFoyda >= 0 ? INCOME_ARGB : EXPENSE_ARGB },
  };

  sheet.addRow([]);
  const footerRow = sheet.addRow([BRAND_SIGNATURE]);
  footerRow.font = { size: 9, color: { argb: FAINT_ARGB } };
}

function addCategorySection(
  sheet: ExcelJS.Worksheet,
  title: string,
  data: { nomi: string; summa: number; foiz: number }[]
) {
  const titleRow = sheet.addRow([title]);
  titleRow.font = { bold: true, size: 12 };

  const headerRow = sheet.addRow(["Kategoriya", "Summa", "Foiz"]);
  headerRow.font = { bold: true };

  for (const item of data) {
    const row = sheet.addRow([item.nomi, item.summa, item.foiz / 100]);
    row.getCell(2).numFmt = SOM_FORMAT;
    row.getCell(3).numFmt = "0.0%";
  }

  if (data.length === 0) {
    sheet.addRow(["Ma'lumot yo'q"]);
  }
}
