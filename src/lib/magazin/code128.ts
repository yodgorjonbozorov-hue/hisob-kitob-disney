/**
 * CODE 128-B SHTRIX-KOD — SVG generatori (tashqi kutubxonasiz).
 *
 * Nega o'zimiz yozamiz: shtrix-kod chizish — jadval bo'yicha yo'l-yo'l
 * to'rtburchak chizishdan iborat, ya'ni bir necha o'nlab satr. Buning uchun
 * brauzer DOM'iga tayanadigan kutubxona olib kelish (JsBarcode) server tomonda
 * chop etish sahifasini murakkablashtirardi.
 *
 * Nega aynan Code 128-B: u 32..126 oralig'idagi BARCHA ASCII belgilarni
 * kodlaydi. Demak bitta generator ham zavod raqamini ("4601234567890"), ham
 * Balansa kalitini ("BALANSA-PRODUCT-8F92KX21") chizadi. EAN-13 faqat 13 ta
 * raqamni kodlaydi va ikkinchi holatda umuman ishlamasdi.
 *
 * Skanerlar uchun natija farq qilmaydi: Code 128 — do'kon skanerlarining
 * standart to'plamiga kiradigan simvologiya.
 */

/**
 * Code 128 naqshlari: har qiymat uchun ketma-ket chiziq/oraliq kengliklari
 * (modul birligida). Birinchi raqam — CHIZIQ, keyingisi — oraliq va h.k.
 * Har naqsh 11 modul (to'xtash naqshi — 13).
 *
 * Bu jadval standartning o'zi: qo'lda o'zgartirilmaydi.
 */
const NAQSHLAR: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312",
  "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131",
  "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
  "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112",
  "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412",
  "211214", "211232", "2331112",
];

/** Start-B kod qiymati (Code 128-B rejimini ochadi). */
const START_B = 104;
/** To'xtash naqshi (13 modul). */
const STOP = 106;
/** Nazorat yig'indisi moduli. */
const MOD = 103;

/** Code 128-B kodlay oladigan belgilar: bosiladigan ASCII (bo'shliq..tilda). */
export function code128Mumkinmi(matn: string): boolean {
  if (!matn) return false;
  for (const ch of matn) {
    const c = ch.charCodeAt(0);
    if (c < 32 || c > 126) return false;
  }
  return true;
}

export interface Code128Natija {
  /** Har element kengligi (modul) va u chiziqmi. Chizishga tayyor. */
  moduller: boolean[];
  /** Nazorat yig'indisi qiymati (test uchun ochiq). */
  checksum: number;
}

/**
 * Matnni Code 128-B modullar ketma-ketligiga aylantiradi.
 * `true` — qora chiziq moduli, `false` — oq oraliq moduli.
 */
export function code128Modullar(matn: string): Code128Natija {
  if (!code128Mumkinmi(matn)) {
    throw new Error("Code 128-B faqat bosiladigan ASCII belgilarni kodlaydi");
  }

  const qiymatlar: number[] = [START_B];
  for (const ch of matn) {
    qiymatlar.push(ch.charCodeAt(0) - 32);
  }

  // Nazorat yig'indisi: start + Σ(pozitsiya × qiymat), pozitsiya 1 dan boshlanadi.
  let sum = START_B;
  for (let i = 1; i < qiymatlar.length; i++) {
    sum += i * qiymatlar[i];
  }
  const checksum = sum % MOD;
  qiymatlar.push(checksum, STOP);

  const moduller: boolean[] = [];
  for (const q of qiymatlar) {
    const naqsh = NAQSHLAR[q];
    // Naqshdagi har raqam — ketma-ket element kengligi; birinchisi CHIZIQ.
    for (let i = 0; i < naqsh.length; i++) {
      const kenglik = Number(naqsh[i]);
      const chiziqmi = i % 2 === 0;
      for (let k = 0; k < kenglik; k++) moduller.push(chiziqmi);
    }
  }
  return { moduller, checksum };
}

export interface BarcodeSvgOpts {
  /** Bitta modul kengligi (px). Do'kon skanerlari uchun 2 yetarli. */
  modul?: number;
  /** Chiziqlar balandligi (px). */
  balandlik?: number;
  /** Chetdagi bo'sh zona (modulda). Standart minimum — 10. */
  jimZona?: number;
  /** Rasm ostiga matnni yozish. */
  matnKorsatilsin?: boolean;
}

/**
 * Shtrix-kodni SVG matni sifatida qaytaradi.
 *
 * SVG (rastr emas) ataylab: chop etishda o'lcham qanday bo'lishidan qat'i
 * nazar chiziq chetlari aniq qoladi — skaner uchun bu hal qiluvchi.
 */
export function barcodeSvg(matn: string, opts: BarcodeSvgOpts = {}): string {
  const modul = opts.modul ?? 2;
  const balandlik = opts.balandlik ?? 70;
  const jimZona = opts.jimZona ?? 10;
  const matnKorsatilsin = opts.matnKorsatilsin ?? true;
  const matnJoyi = matnKorsatilsin ? 18 : 0;

  const { moduller } = code128Modullar(matn);
  const kenglik = (moduller.length + jimZona * 2) * modul;
  const jamiBalandlik = balandlik + matnJoyi;

  // Ketma-ket `true` modullarni bitta to'rtburchakka birlashtiramiz — SVG
  // hajmi bir necha barobar kichrayadi (har modul uchun alohida <rect> emas).
  const rects: string[] = [];
  let i = 0;
  while (i < moduller.length) {
    if (!moduller[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < moduller.length && moduller[j]) j++;
    const x = (jimZona + i) * modul;
    const w = (j - i) * modul;
    rects.push(`<rect x="${x}" y="0" width="${w}" height="${balandlik}" />`);
    i = j;
  }

  const matnEl = matnKorsatilsin
    ? `<text x="${kenglik / 2}" y="${balandlik + 14}" text-anchor="middle" ` +
      `font-family="monospace" font-size="13" fill="#000">${xmlXavfsiz(matn)}</text>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${kenglik}" height="${jamiBalandlik}" ` +
    `viewBox="0 0 ${kenglik} ${jamiBalandlik}" role="img" aria-label="Shtrix-kod ${xmlXavfsiz(matn)}">` +
    `<rect width="${kenglik}" height="${jamiBalandlik}" fill="#fff" />` +
    `<g fill="#000">${rects.join("")}</g>${matnEl}</svg>`
  );
}

/** SVG ichiga matn qo'yishdan oldin XML belgilarini xavfsizlantiradi. */
function xmlXavfsiz(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
