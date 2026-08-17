/**
 * Telegramga hujjat yuborish — eng sodda ko'rinishi.
 *
 * `src/lib/backup/send.ts` dan farqi: u Prisma'ga (ya'ni joriy sxemaga)
 * tayanadi va ilova ichida ishlaydi. Bu yerdagi funksiya esa build/skript
 * muhitida, sxema haqida hech narsa bilmasdan ishlashi kerak.
 *
 * SHIFRLASH SHU YERDA MAJBURIY (audit: Critical #2). Bu funksiya — skript
 * tomonidagi YAGONA Telegram chiqishi, shuning uchun shifrlash chaqiruvchiga
 * qoldirilmadi: bu yerda turgani uchun kelajakdagi yangi chaqiruvchi ham uni
 * tasodifan chetlab o'ta olmaydi. Kalit yo'q bo'lsa yuborish umuman
 * bajarilmaydi (fail-closed) — ochiq baza kanalga hech qachon chiqmaydi.
 * Shifrlash mantig'i `src/lib/backup/shifr-asos.cjs` da, ilova tomoni bilan
 * BIR XIL — kanaldagi fayllarni ikkala yo'l ham ocha oladi.
 *
 * `TELEGRAM_API_BASE` — faqat testda boshqa manzilga yo'naltirish uchun;
 * sozlanmasa haqiqiy Telegram ishlatiladi.
 */
import { Blob } from "node:buffer";
import { shifrla } from "../../src/lib/backup/shifr-asos.cjs";

/** Telegram bot hujjat limiti 50 MB — biroz zaxira bilan cheklaymiz. */
export const MAKS_BAYT = 45 * 1024 * 1024;

export function apiManzili() {
  return process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";
}

/**
 * Hujjatni kanalga yuboradi — HAR DOIM shifrlab.
 *
 * `bayt` ochiq holda beriladi va shu yerda AES-256-GCM bilan shifrlanadi;
 * fayl nomiga `.enc` qo'shiladi (nom faylning haqiqiy holatini aks ettirsin).
 * Kalit yo'q bo'lsa `ShifrKalitXato` tashlanadi va HECH NARSA yuborilmaydi.
 *
 * Muvaffaqiyatsiz bo'lsa xato tashlaydi. Xato matniga token QO'SHILMAYDI —
 * log'lar ochiq joyda turishi mumkin.
 */
export async function hujjatYubor({ token, chatId, bayt, nom, izoh }) {
  // Kalit yo'q bo'lsa shu qatorda to'xtaydi — quyidagi `fetch` ga yetib bormaydi.
  const shifrlangan = shifrla(Buffer.isBuffer(bayt) ? bayt : Buffer.from(bayt));

  // Hajm SHIFRLANGAN holat bo'yicha tekshiriladi — tarmoqqa aynan shu chiqadi.
  if (shifrlangan.byteLength > MAKS_BAYT) {
    throw new Error(`fayl juda katta (${shifrlangan.byteLength} bayt) — Telegramga sig'maydi`);
  }

  const shifrNom = nom.endsWith(".enc") ? nom : `${nom}.enc`;

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", izoh);
  form.append(
    "document",
    new Blob([shifrlangan], { type: "application/octet-stream" }),
    shifrNom
  );

  const res = await fetch(`${apiManzili()}/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const sabab = await res.text();
    throw new Error(`Telegram qabul qilmadi (${res.status}): ${sabab.slice(0, 300)}`);
  }
}
