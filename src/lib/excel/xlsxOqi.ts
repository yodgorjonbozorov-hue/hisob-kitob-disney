import ExcelJS from "exceljs";
import { csvYasa } from "@/lib/csv";
import { katakMatn } from "@/lib/excel/katakMatn";

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

/** Foydalanuvchiga ko'rsatiladigan xato — route buni 400 bilan qaytaradi. */
export class XlsxXato extends Error {}

/**
 * Ichki XML hajmining chegarasi (siqilmagan holda).
 *
 * Nega kerak: ExcelJS faylni to'liq xotira modeliga yozadi va bu model XML
 * hajmidan ~8-10 barobar katta bo'ladi. 10 MB lik siqilgan xlsx ichida
 * 100 MB dan ortiq XML (200 ming qator) bo'lishi mumkin — uni parse qilish
 * kichik serverda xotirani to'ldirib, so'rovni abadiy osiltirib qo'yadi.
 * Import baribir 500 qator bilan cheklangan, shuning uchun 10 MB XML
 * (taxminan 20 ming qator) juda katta zaxira bilan yetarli.
 */
const MAKS_XML_HAJM = 10 * 1024 * 1024;

/**
 * O'qiladigan satrlar chegarasi (sarlavha bilan).
 *
 * Bu jimgina kesish emas: importning o'zi 500 qatordan keyin har bir ortiqcha
 * qatorni ochiq xato qilib ko'rsatadi. Chegara faqat million qatorli fayldan
 * ulkan CSV matn yasashning oldini oladi.
 */
const MAKS_SATR = 5001;

/**
 * Zip markaziy katalogidan `.xml`/`.rels` fayllarning siqilmagan umumiy
 * hajmini o'qiydi — arxiv OCHILMAYDI, shuning uchun bir zumda ishlaydi.
 *
 * Media (rasm) fayllar hisobga olinmaydi: ular parse qilinmaydi va hajmi
 * yuklangan faylning 10 MB chegarasi bilan allaqachon cheklangan.
 *
 * `null` — markaziy katalog o'qilmadi (zip emas yoki zip64): bu holda
 * tekshiruv o'tkazib yuboriladi va yakuniy hukmni ExcelJS chiqaradi.
 */
export function zipXmlHajmi(buffer: ArrayBuffer): number | null {
  const b = Buffer.from(buffer);
  if (b.length < 22) return null;

  // EOCD (End of Central Directory) yozuvi fayl oxiridan qidiriladi —
  // undan keyin faqat izoh (maksimal 65535 bayt) turishi mumkin.
  const past = Math.max(0, b.length - 22 - 65535);
  let eocd = -1;
  for (let i = b.length - 22; i >= past; i--) {
    if (b.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const yozuvSoni = b.readUInt16LE(eocd + 10);
  let ofset = b.readUInt32LE(eocd + 16);
  if (ofset === 0xffffffff) return null;

  let jami = 0;
  for (let k = 0; k < yozuvSoni; k++) {
    if (ofset + 46 > b.length || b.readUInt32LE(ofset) !== 0x02014b50) return null;
    const hajm = b.readUInt32LE(ofset + 24);
    const nomUzunlik = b.readUInt16LE(ofset + 28);
    const extraUzunlik = b.readUInt16LE(ofset + 30);
    const izohUzunlik = b.readUInt16LE(ofset + 32);
    if (hajm === 0xffffffff) return null;
    const nom = b.toString("latin1", ofset + 46, ofset + 46 + nomUzunlik);
    if (/\.(xml|rels)$/i.test(nom)) jami += hajm;
    ofset += 46 + nomUzunlik + extraUzunlik + izohUzunlik;
  }
  return jami;
}

export async function xlsxdanCsv(
  buffer: ArrayBuffer,
  chegaralar?: { maksXmlHajm?: number; maksSatr?: number }
): Promise<string> {
  const maksXmlHajm = chegaralar?.maksXmlHajm ?? MAKS_XML_HAJM;
  const maksSatr = chegaralar?.maksSatr ?? MAKS_SATR;

  // Parse qilishdan OLDIN hajm tekshiriladi: katta fayl xotirani to'ldirib
  // butun serverni osiltirmasin. Aynan shu holat "yuklanmoqda"da abadiy
  // qolib ketishning sababi edi.
  const xmlHajm = zipXmlHajmi(buffer);
  if (xmlHajm !== null && xmlHajm > maksXmlHajm) {
    throw new XlsxXato(
      "Excel fayl ichi juda katta — bir martada 500 tagacha tovar yuklanadi. " +
        "Faylni kichikroq bo'laklarga bo'lib yuklang."
    );
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new XlsxXato("Excel faylni o'qib bo'lmadi — fayl buzilgan yoki formati noto'g'ri");
  }
  const ws = wb.worksheets[0];
  if (!ws) return "";

  const satrlar: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    if (satrlar.length >= maksSatr) return;
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
