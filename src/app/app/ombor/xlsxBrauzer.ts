import { katakMatn } from "@/lib/excel/katakMatn";
import { rasmUstunIndeksi } from "@/lib/excel/rasmUstun";

/**
 * KATTA EXCELNI BRAUZERDA O'QISH.
 *
 * Nega serverda emas: rasmli katalog fayli yuzlab megabayt bo'ladi (har
 * tovar surati bilan). Uni serverga yuborish — sekin internetda o'nlab
 * daqiqa, server xotirasiga esa umuman sig'maydi. Fayl foydalanuvchining
 * O'Z kompyuterida ochiladi: qatorlar kichik CSV matnga, rasmlar esa
 * alohida siqilgan fayllarga aylanadi — tarmoqqa faqat shu yengil qism
 * chiqadi.
 *
 * ExcelJS shu yerda dinamik import qilinadi: kutubxona og'ir, faqat import
 * oynasida kerak — asosiy sahifalar yukiga qo'shilmasin.
 */

/** Import baribir 500 qator bilan cheklangan — bu chegara katta zaxira bilan. */
const MAKS_SATR = 5001;

/** 180 MB fayl bemalol ochiladi; bu chegara faqat brauzerni himoya qiladi. */
export const MAKS_BRAUZER_FAYL = 400 * 1024 * 1024;

export interface TopilganRasm {
  /** Varaqdagi qator raqami (1 dan, sarlavha ham 1). */
  qator: number;
  blob: Blob;
}

export interface BrauzerOqishNatijasi {
  /** Sarlavha + tovar qatorlari (matn holida). */
  satrlar: string[][];
  /** Har satrning varaqdagi asl raqami — rasm shu raqam orqali bog'lanadi. */
  varaqQatorlari: number[];
  /** Qator raqami -> katakka joylashtirilgan rasm. */
  rasmlar: Map<number, TopilganRasm>;
}

const RASM_MIME: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  gif: "image/gif",
};

export async function xlsxniBrauzerdaOqi(fayl: File): Promise<BrauzerOqishNatijasi> {
  if (fayl.size > MAKS_BRAUZER_FAYL) {
    throw new Error("Fayl 400 MB dan katta — brauzerda ochib bo'lmaydi, uni bo'lib yuklang");
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await fayl.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Excel faylda varaq topilmadi");

  const satrlar: string[][] = [];
  const varaqQatorlari: number[] = [];
  ws.eachRow({ includeEmpty: false }, (row, raqam) => {
    if (satrlar.length >= MAKS_SATR) return;
    const katak: string[] = [];
    // `row.values` 1 dan boshlanadi (0-indeks bo'sh).
    const qiymatlar = row.values as unknown[];
    for (let i = 1; i < qiymatlar.length; i++) {
      katak.push(katakMatn(qiymatlar[i]));
    }
    satrlar.push(katak);
    varaqQatorlari.push(raqam);
  });

  // Rasmlar katakka "yopishtirilgan" bo'ladi — ankeri qaysi qatorda tursa,
  // o'sha qatordagi tovarga tegishli deb olinadi. Bir qatorda bir nechta
  // rasm bo'lsa birinchisi qoladi.
  const rasmlar = new Map<number, TopilganRasm>();
  for (const img of ws.getImages()) {
    const qator = Math.floor(img.range.tl.nativeRow) + 1;
    if (rasmlar.has(qator)) continue;
    const media = wb.getImage(Number(img.imageId));
    if (!media?.buffer) continue;
    const mime = RASM_MIME[media.extension ?? ""] ?? "application/octet-stream";
    rasmlar.set(qator, {
      qator,
      blob: new Blob([media.buffer as unknown as BlobPart], { type: mime }),
    });
  }

  return { satrlar, varaqQatorlari, rasmlar };
}

/**
 * Yuklangan rasm havolalarini jadvalga qo'shadi.
 *
 * Faylda rasm ustuni allaqachon bo'lsa (masalan, Balansa eksporti qayta
 * yuklanayotgan bo'lsa) — o'sha ustunning katagi yangilanadi; bo'lmasa
 * oxiriga "Rasm" ustuni qo'shiladi. Import serveri bu ustunni nomidan
 * taniydi (`rasmUstun.ts` — bitta manba).
 */
export function rasmlarniUstungaQoy(
  satrlar: string[][],
  varaqQatorlari: number[],
  urllar: Map<number, string>
): string[][] {
  if (satrlar.length === 0 || urllar.size === 0) return satrlar;
  const sarlavha = [...satrlar[0]];
  let indeks = rasmUstunIndeksi(sarlavha);
  if (indeks < 0) {
    indeks = sarlavha.length;
    sarlavha.push("Rasm");
  }
  const yangi: string[][] = [sarlavha];
  for (let i = 1; i < satrlar.length; i++) {
    const qator = [...satrlar[i]];
    while (qator.length <= indeks) qator.push("");
    const url = urllar.get(varaqQatorlari[i]);
    if (url) qator[indeks] = url;
    yangi.push(qator);
  }
  return yangi;
}
