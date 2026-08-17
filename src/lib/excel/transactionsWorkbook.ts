import ExcelJS from "exceljs";
import { formatDateUZ } from "@/lib/format";

interface Row {
  sana: Date;
  turi: string;
  category: { nomi: string };
  summa: number;
  izoh: string | null;
  user: { ism: string };
  /** KG SAVDOSI (mijozga xos): miqdor grammda va o'sha savdodagi 1 kg narxi. */
  miqdorGr?: number | null;
  kgNarxi?: number | null;
}

/** Tranzaksiyalar ro'yxatini Excel workbook (buffer) ga aylantiradi. */
export async function buildTransactionsWorkbook(items: Row[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Tranzaksiyalar");

  ws.columns = [
    { header: "Sana", key: "sana", width: 14 },
    { header: "Turi", key: "turi", width: 10 },
    { header: "Kategoriya", key: "kategoriya", width: 24 },
    // Kg ustunlari HAR DOIM bor, lekin kg savdosi bo'lmasa bo'sh qoladi —
    // shu bilan eksport ustunlari mijozdan mijozga o'zgarmaydi.
    { header: "Miqdor (kg)", key: "miqdor", width: 12 },
    { header: "1 kg narxi", key: "kgNarxi", width: 14 },
    { header: "Summa", key: "summa", width: 16 },
    { header: "Izoh", key: "izoh", width: 30 },
    { header: "Kim kiritdi", key: "kim", width: 18 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const t of items) {
    ws.addRow({
      sana: formatDateUZ(new Date(t.sana)),
      turi: t.turi === "kirim" ? "Kirim" : "Chiqim",
      kategoriya: t.category.nomi,
      miqdor: t.miqdorGr != null ? t.miqdorGr / 1000 : "",
      kgNarxi: t.kgNarxi ?? "",
      summa: t.summa,
      izoh: t.izoh ?? "",
      kim: t.user.ism,
    });
  }
  ws.getColumn("summa").numFmt = "# ##0";
  ws.getColumn("kgNarxi").numFmt = "# ##0";
  ws.getColumn("miqdor").numFmt = "# ##0.###";

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
