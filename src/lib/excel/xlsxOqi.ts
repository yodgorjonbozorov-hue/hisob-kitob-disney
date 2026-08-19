import ExcelJS from "exceljs";
import { csvYasa } from "@/lib/csv";

/**
 * XLSX -> CSV.
 *
 * Nega kerak: katalog eksporti Excel fayl beradi va mijoz aynan o'sha faylda
 * narx/qoldiqni to'ldirib qaytadan yuklaydi. Uni "CSV qilib saqlang" deyish
 * — importning eng ko'p uziladigan joyi. Shuning uchun xlsx serverda
 * o'qiladi va keyingi bosqichga oddiy CSV matn bo'lib tushadi: tahlil qiluvchi
 * kod bitta va formatdan qat'i nazar bir xil ishlaydi.
 *
 * Faqat BIRINCHI varaq o'qiladi — katalog bir varaqda bo'ladi.
 */
export async function xlsxdanCsv(buffer: ArrayBuffer): Promise<string> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return "";

  const satrlar: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const katak: string[] = [];
    // `row.values` 1 dan boshlanadi (0-indeks bo'sh).
    const qiymatlar = row.values as unknown[];
    for (let i = 1; i < qiymatlar.length; i++) {
      katak.push(katakMatn(qiymatlar[i]));
    }
    satrlar.push(katak);
  });

  if (satrlar.length === 0) return "";
  const sarlavha = satrlar[0];
  return csvYasa(sarlavha, satrlar.slice(1));
}

/** Excel katagi formula/havola/sana bo'lishi mumkin — hammasi matnga keltiriladi. */
function katakMatn(qiymat: unknown): string {
  if (qiymat === null || qiymat === undefined) return "";
  if (typeof qiymat === "object") {
    const o = qiymat as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (Array.isArray(o.richText)) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return String(o.result);
    if (qiymat instanceof Date) return qiymat.toISOString().slice(0, 10);
    return "";
  }
  return String(qiymat);
}
