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

  sheet.addRow([]);
  addCategorySection(sheet, "Kirim taqsimoti", report.kirimByCategory);
  sheet.addRow([]);
  addCategorySection(sheet, "Chiqim taqsimoti", report.chiqimByCategory);

  sheet.addRow([]);
  const footerRow = sheet.addRow([BRAND_SIGNATURE]);
  footerRow.font = { size: 9, color: { argb: FAINT_ARGB } };

  return workbook.xlsx.writeBuffer();
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
