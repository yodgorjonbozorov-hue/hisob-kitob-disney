/**
 * Telegramga hujjat yuborish — eng sodda ko'rinishi.
 *
 * `src/lib/backup/send.ts` dan farqi: u Prisma'ga (ya'ni joriy sxemaga)
 * tayanadi va ilova ichida ishlaydi. Bu yerdagi funksiya esa build/skript
 * muhitida, sxema haqida hech narsa bilmasdan ishlashi kerak.
 *
 * `TELEGRAM_API_BASE` — faqat testda boshqa manzilga yo'naltirish uchun;
 * sozlanmasa haqiqiy Telegram ishlatiladi.
 */
import { Blob } from "node:buffer";

/** Telegram bot hujjat limiti 50 MB — biroz zaxira bilan cheklaymiz. */
export const MAKS_BAYT = 45 * 1024 * 1024;

export function apiManzili() {
  return process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";
}

/**
 * Hujjatni kanalga yuboradi. Muvaffaqiyatsiz bo'lsa xato tashlaydi.
 * Xato matniga token QO'SHILMAYDI — log'lar ochiq joyda turishi mumkin.
 */
export async function hujjatYubor({ token, chatId, bayt, nom, izoh }) {
  if (bayt.byteLength > MAKS_BAYT) {
    throw new Error(`fayl juda katta (${bayt.byteLength} bayt) — Telegramga sig'maydi`);
  }

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", izoh);
  form.append("document", new Blob([bayt], { type: "application/gzip" }), nom);

  const res = await fetch(`${apiManzili()}/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const sabab = await res.text();
    throw new Error(`Telegram qabul qilmadi (${res.status}): ${sabab.slice(0, 300)}`);
  }
}
