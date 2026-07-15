import ExcelJS from "exceljs";
import { parseMonthString } from "@/lib/date";
import { uzOyNomi } from "@/lib/format";
import type { MonthlyReport } from "@/lib/queries/report";

const SOM_FORMAT = '#,##0 "so\'m"';

export async function buildMonthlyReportWorkbook(report: MonthlyReport): Promise<ExcelJS.Buffer> {
  const { year, monthIndex0 } = parseMonthString(report.month);
  const monthLabel = `${uzOyNomi(monthIndex0)} ${year}`;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Disney Navoiy";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Hisobot");
  sheet.columns = [
    { header: "", key: "a", width: 30 },
    { header: "", key: "b", width: 20 },
    { header: "", key: "c", width: 12 },
  ];

  sheet.mergeCells("A1:C1");
  sheet.getCell("A1").value = `Disney Navoiy — Oylik hisobot: ${monthLabel}`;
  sheet.getCell("A1").font = { bold: true, size: 14 };

  sheet.addRow([]);
  const summaryHeaderRow = sheet.addRow(["Ko'rsatkich", "Summa"]);
  summaryHeaderRow.font = { bold: true };

  const kirimRow = sheet.addRow(["Jami kirim", report.jamiKirim]);
  kirimRow.getCell(2).numFmt = SOM_FORMAT;
  kirimRow.getCell(2).font = { color: { argb: "FF059669" } };

  const chiqimRow = sheet.addRow(["Jami chiqim", report.jamiChiqim]);
  chiqimRow.getCell(2).numFmt = SOM_FORMAT;
  chiqimRow.getCell(2).font = { color: { argb: "FFE11D48" } };

  const foydaRow = sheet.addRow(["Sof foyda", report.sofFoyda]);
  foydaRow.getCell(2).numFmt = SOM_FORMAT;
  foydaRow.getCell(2).font = { bold: true, color: { argb: report.sofFoyda >= 0 ? "FF059669" : "FFE11D48" } };

  sheet.addRow([]);
  addCategorySection(sheet, "Kirim taqsimoti", report.kirimByCategory);
  sheet.addRow([]);
  addCategorySection(sheet, "Chiqim taqsimoti", report.chiqimByCategory);

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
