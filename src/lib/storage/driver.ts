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
