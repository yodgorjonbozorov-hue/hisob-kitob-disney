import ExcelJS from "exceljs";
import {
  EKSPORT_SARLAVHASI,
  eksportQatoriMassiv,
  type EksportQatori,
} from "@/lib/queries/mahsulotEksport";

/**
 * Katalogni Excel (.xlsx) qilib beradi.
 *
 * Ustunlar import kutadigan sarlavhalar bilan bir xil — shu fayl tahrirlanib
 * qaytadan yuklansa import uni tanidi hisob.
 */
export async function buildMahsulotlarWorkbook(qatorlar: EksportQatori[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mahsulotlar");

  ws.columns = EKSPORT_SARLAVHASI.map((s) => ({ header: s, width: Math.max(12, s.length + 4) }));
  ws.getRow(1).font = { bold: true };

  for (const q of qatorlar) ws.addRow(eksportQatoriMassiv(q));

  // Pul va son ustunlari — o'qiladigan format (so'm butun son).
  for (const nom of ["F", "G", "H", "I"]) ws.getColumn(nom).numFmt = "# ##0";

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
