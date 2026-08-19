import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

/**
 * MAHSULOT KODLARI — Balansa QR va zavod shtrix-kodi.
 *
 * Ikki xil kod bir vaqtda yashaydi va bu ataylab:
 *
 *   `barcode` — QUTI USTIDAGI zavod raqami (Coca-Cola 1.5L → 4601234567890).
 *               Do'kon uni o'zgartirmaydi, faqat saqlaydi va skanerlaydi.
 *   `qrKod`   — zavod kodi YO'Q tovar uchun (o'z ishlab chiqarishi, og'irlik
 *               bo'yicha sotiladigan mahsulot) Balansa yaratadigan barqaror
 *               kalit.
 *
 * QR ICHIDA FAQAT KALIT bo'ladi. Narx yoki qoldiq QR'ga yozilmaydi — aks
 * holda narx har o'zgarganda butun do'kondagi stikerlarni qayta chop etish
 * kerak bo'lardi va skanerlangan eski stiker noto'g'ri narx ko'rsatardi.
 * Narx har doim bazadan, skanerlash paytida o'qiladi.
 */

/** Balansa QR kalitining doimiy prefiksi. */
export const QR_PREFIKS = "BALANSA-PRODUCT-";

/**
 * Kalitning tasodifiy qismidagi alifbo. Adashtiradigan belgilar (0/O, 1/I/L)
 * ATAYLAB olib tashlangan: kassir kodni ba'zan qo'lda kiritadi.
 */
const ALIFBO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const UZUNLIK = 8;

/**
 * Yangi Balansa QR kaliti yaratadi ("BALANSA-PRODUCT-8F92KX21").
 *
 * `randomBytes` (Math.random emas): kod mahsulotning ommaviy identifikatori,
 * taxmin qilinadigan ketma-ketlik bo'lmasligi kerak.
 */
export function yangiQrKod(): string {
  const baytlar = randomBytes(UZUNLIK);
  let s = "";
  for (let i = 0; i < UZUNLIK; i++) {
    s += ALIFBO[baytlar[i] % ALIFBO.length];
  }
  return QR_PREFIKS + s;
}

/** Matn Balansa QR kalitiga o'xshaydimi (skanerlangan qiymatni ajratish uchun). */
export function balansaQrMi(matn: string): boolean {
  return new RegExp(`^${QR_PREFIKS}[${ALIFBO}]{${UZUNLIK}}$`).test(matn.trim().toUpperCase());
}

/**
 * Skanerdan kelgan qiymatni normallashtiradi.
 *
 * Nega kerak: HID rejimidagi skaner ba'zan oxiriga Enter/Tab qo'shadi,
 * kamera esa QR ichidagi bo'shliqlarni ham beradi. Balansa kalitlari
 * REGISTRSIZ solishtiriladi, zavod raqami esa o'zgartirilmaydi (unda
 * harflar bo'lishi mumkin va ular ma'noli).
 */
export function kodniNormallash(xom: string): string {
  const t = xom.trim().replace(/[\r\n\t]+/g, "");
  return t.toUpperCase().startsWith(QR_PREFIKS) ? t.toUpperCase() : t;
}

/**
 * QR kodni SVG matni sifatida chizadi.
 *
 * `qrcode` paketining `create()` funksiyasi faqat modul matritsasini beradi —
 * SVG'ni o'zimiz yozamiz, chunki paketning tayyor SVG chiqishida rang va
 * chekka o'lchamlarini boshqarish cheklangan, bizga esa chop etish uchun
 * aniq o'lcham kerak.
 */
export function qrSvg(matn: string, opts: { olcham?: number; chekka?: number } = {}): string {
  const olcham = opts.olcham ?? 240;
  const chekka = opts.chekka ?? 4; // modul birligida — standart "quiet zone"

  // Xato tuzatish darajasi M: stiker biroz kir yoki g'ijim bo'lsa ham o'qiladi,
  // lekin kod H darajasidagidek katta bo'lib ketmaydi.
  const qr = QRCode.create(matn, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const data = qr.modules.data;
  const jami = n + chekka * 2;

  const rects: string[] = [];
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!data[y * n + x]) {
        x++;
        continue;
      }
      let x2 = x;
      while (x2 < n && data[y * n + x2]) x2++;
      rects.push(`<rect x="${x + chekka}" y="${y + chekka}" width="${x2 - x}" height="1" />`);
      x = x2;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${olcham}" height="${olcham}" ` +
    `viewBox="0 0 ${jami} ${jami}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="QR kod">` +
    `<rect width="${jami}" height="${jami}" fill="#fff" />` +
    `<g fill="#000">${rects.join("")}</g></svg>`
  );
}
