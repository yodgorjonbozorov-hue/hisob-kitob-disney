/**
 * FAYL SAQLAGICH DRAYVERI (Faza 6.6).
 *
 * Ikki rejim bor va ular ataylab teng huquqli:
 *
 *  - "havola" — foydalanuvchi tashqi manzil beradi (Google Drive, Telegram
 *    havolasi, korporativ portal). Hech qanday sozlash talab qilmaydi va
 *    HAR DOIM ishlaydi. Ko'p kichik biznes uchun shu yetarli.
 *
 *  - "blob" — Vercel Blob'ga yuklash. `BLOB_READ_WRITE_TOKEN` bo'lgandagina
 *    ishlaydi; bo'lmasa aniq xato beriladi (jimgina "havola" ga tushib
 *    qolish — foydalanuvchini chalg'itadi, chunki fayl saqlanmaydi).
 *
 * SDK qo'shilmagan: Blob API oddiy `PUT` so'rovi, shuning uchun `fetch`
 * yetarli (loyihada Claude API ham shunday chaqiriladi).
 */

const BLOB_API = "https://blob.vercel-storage.com";

/** Yuklashga ruxsat etilgan turlar — ijro etiladigan fayllar ataylab yo'q. */
export const RUXSAT_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "text/plain",
  "text/csv",
] as const;

export const MAX_FAYL_BAYT = 10 * 1024 * 1024;

/**
 * MAGIC-BAYT TEKSHIRUVI (H-9): mijoz yuborgan `fayl.type` ga ISHONILMAYDI —
 * mazmunning boshlang'ich baytlari e'lon qilingan turga mos kelishi shart.
 * Aks holda .exe faylni "application/pdf" deb yuklab qo'yish mumkin edi.
 */
export function magicBaytMos(mimeType: string, mazmun: Buffer | Uint8Array): boolean {
  const buf = Buffer.isBuffer(mazmun) ? mazmun : Buffer.from(mazmun);
  const boshi = (imzo: number[], offset = 0) =>
    buf.length >= offset + imzo.length && imzo.every((x, i) => buf[offset + i] === x);

  switch (mimeType) {
    case "application/pdf":
      return boshi([0x25, 0x50, 0x44, 0x46]); // %PDF
    case "image/png":
      return boshi([0x89, 0x50, 0x4e, 0x47]);
    case "image/jpeg":
      return boshi([0xff, 0xd8, 0xff]);
    case "image/webp":
      return boshi([0x52, 0x49, 0x46, 0x46]) && boshi([0x57, 0x45, 0x42, 0x50], 8); // RIFF....WEBP
    // docx/xlsx — ZIP konteyner.
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      return boshi([0x50, 0x4b, 0x03, 0x04]) || boshi([0x50, 0x4b, 0x05, 0x06]);
    // Eski .doc/.xls — OLE konteyner.
    case "application/msword":
    case "application/vnd.ms-excel":
      return boshi([0xd0, 0xcf, 0x11, 0xe0]);
    case "text/plain":
    case "text/csv": {
      // Matnda imzo yo'q — hech bo'lmasa binar emasligini tekshiramiz
      // (dastlabki baytlarda NUL uchramasin).
      const n = Math.min(buf.length, 512);
      for (let i = 0; i < n; i++) if (buf[i] === 0) return false;
      return true;
    }
    default:
      return false;
  }
}

export class SaqlagichSozlanmaganError extends Error {
  constructor() {
    super(
      "Fayl saqlagich sozlanmagan (BLOB_READ_WRITE_TOKEN yo'q). " +
        "Hozircha faylni tashqi havola sifatida biriktiring."
    );
    this.name = "SaqlagichSozlanmaganError";
  }
}

/** Fayl yuklash mumkinmi — UI shu bo'yicha yuklash tugmasini ko'rsatadi. */
export function saqlagichBor(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Havolani tekshiradi. Faqat `http(s)` — `javascript:` va `data:` sxemalari
 * saqlangan havola bosilganda XSS yo'liga aylanardi.
 */
export function havolaniTekshir(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Havola noto'g'ri — to'liq manzil yozing (https://...)");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Faqat http yoki https havolalar qabul qilinadi");
  }
  return parsed.toString();
}

export interface YuklashNatijasi {
  url: string;
  saqlagich: "blob";
}

/** Faylni Blob'ga yuklaydi va ochiq o'qish manzilini qaytaradi. */
export async function faylYukla(params: {
  nomi: string;
  mimeType: string;
  mazmun: Buffer | Uint8Array;
  /** Test uchun — production'da global `fetch`. */
  fetchImpl?: typeof fetch;
}): Promise<YuklashNatijasi> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new SaqlagichSozlanmaganError();

  if (!(RUXSAT_MIME as readonly string[]).includes(params.mimeType)) {
    throw new Error("Bu fayl turi qabul qilinmaydi (PDF, rasm, Word, Excel yoki matn yuboring)");
  }
  if (params.mazmun.byteLength > MAX_FAYL_BAYT) {
    throw new Error("Fayl 10 MB dan katta bo'lmasligi kerak");
  }
  if (!magicBaytMos(params.mimeType, params.mazmun)) {
    throw new Error(
      "Fayl mazmuni e'lon qilingan turga mos emas — fayl buzilgan yoki turi noto'g'ri"
    );
  }

  // Nomdagi yo'l belgilari olib tashlanadi — katalogdan chiqib ketmasin.
  // `..` ni ham yo'qotamiz: bitta `/` almashtirish yetmaydi, chunki
  // "../../fayl.pdf" dan "..\_..\_fayl.pdf" qolib ketardi.
  const xavfsizNom =
    params.nomi
      .replace(/[^\w.\-]+/g, "_")
      .replace(/\.{2,}/g, "_")
      .replace(/^[._-]+/, "")
      .slice(-120) || "fayl";
  const f = params.fetchImpl ?? fetch;

  const res = await f(`${BLOB_API}/${encodeURIComponent(xavfsizNom)}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "x-api-version": "7",
      "x-content-type": params.mimeType,
      "x-add-random-suffix": "1",
    },
    body: params.mazmun as unknown as BodyInit,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Faylni yuklab bo'lmadi (${res.status}): ${body.slice(0, 150)}`);
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("Saqlagich manzil qaytarmadi");
  return { url: data.url, saqlagich: "blob" };
}
