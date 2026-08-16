/**
 * Kunlik avtomatik zaxira: butun bazani JSON qilib, gzip'lab Telegramga hujjat sifatida yuboradi.
 *
 * Nega Telegram: qo'shimcha xizmat/hisob (S3, Blob) va qo'shimcha to'lov talab qilinmaydi,
 * fayl serverdan TASHQARIDA saqlanadi — server yoki baza butunlay yo'qolsa ham zaxira qo'lda qoladi.
 *
 * Nega ALOHIDA bot: zaxira mijozlar ishlatadigan asosiy botdan ajratilgan. Asosiy bot tokeni
 * almashsa yoki bot bloklansa ham zaxira ishlashda davom etadi, va zaxira kanali mijoz
 * yozishmalaridan butunlay boshqa botga tegishli bo'ladi.
 *
 * SHIFRLASH (audit: Critical #2). Fayl Telegramga chiqishdan OLDIN
 * AES-256-GCM bilan shifrlanadi — kanalga kirish huquqi bo'lgan yoki bot
 * tokenini qo'lga kiritgan odam endi hech narsa o'qiy olmaydi. Kalit
 * (`BACKUP_ENCRYPTION_KEY`) sozlanmagan bo'lsa zaxira UMUMAN yuborilmaydi:
 * ochiq baza yuborishdan ko'ra zaxirasiz qolish afzal (fail-closed).
 *
 * Env:
 *   BACKUP_CHAT_ID          — zaxira yuboriladigan yopiq kanal id (masalan -1004319743561)
 *   BACKUP_BOT_TOKEN        — o'sha kanalga admin qilingan bot tokeni.
 *                             Qo'yilmasa TELEGRAM_BOT_TOKEN (asosiy bot) ishlatiladi.
 *   BACKUP_ENCRYPTION_KEY   — 32 baytli shifr kaliti (hex yoki base64). MAJBURIY.
 *                             Kalitni zaxiradan ALOHIDA saqlang — yo'qolsa fayl ochilmaydi.
 *
 * Chat id yoki token yo'q bo'lsa zaxira jim o'tkazib yuboriladi (cron yiqilmaydi),
 * lekin log yoziladi.
 */
import { gzipSync } from "node:zlib";
import { BRAND } from "@/lib/brand";
import { KALIT_ENV, kalitBormi, shifrla } from "./crypto";
import { createDump, jamiYozuvlar } from "./dump";

/** Telegram bot hujjat limiti 50 MB — biroz zaxira bilan cheklaymiz. */
const MAKS_BAYT = 45 * 1024 * 1024;

export type ZaxiraNatija =
  | { holat: "yuborildi"; bayt: number; yozuvlar: number }
  | { holat: "sozlanmagan" }
  | { holat: "kalitsiz" }
  | { holat: "juda-katta"; bayt: number };

export async function sendBackupToTelegram(): Promise<ZaxiraNatija> {
  const chatId = process.env.BACKUP_CHAT_ID;
  const token = process.env.BACKUP_BOT_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN;

  if (!chatId || !token) {
    console.warn(
      "Zaxira o'tkazib yuborildi: BACKUP_CHAT_ID yoki bot tokeni sozlanmagan."
    );
    return { holat: "sozlanmagan" };
  }

  // FAIL-CLOSED: kalit yo'q bo'lsa bazani o'qishga ham urinmaymiz — ochiq
  // zaxira hech qanday sharoitda tarmoqqa chiqmasligi kerak.
  if (!kalitBormi()) {
    console.error(
      `Zaxira YUBORILMADI: ${KALIT_ENV} sozlanmagan yoki yaroqsiz. ` +
        "Shifrlanmagan zaxira yuborilmaydi (butun baza ochiq ketardi). " +
        `Kalit yaratish: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );
    return { holat: "kalitsiz" };
  }

  const zaxira = await createDump();
  // Avval siqiladi, keyin shifrlanadi: shifrlangan ma'lumot siqilmaydi
  // (u tasodifiy baytlarga o'xshaydi), teskari tartib hajmni kamaytirmasdi.
  const gz = gzipSync(Buffer.from(JSON.stringify(zaxira)));
  const shifrlangan = shifrla(gz);

  if (shifrlangan.byteLength > MAKS_BAYT) {
    console.error(`Zaxira juda katta (${shifrlangan.byteLength} bayt) — Telegramga sig'maydi.`);
    return { holat: "juda-katta", bayt: shifrlangan.byteLength };
  }

  const sana = zaxira.createdAt.slice(0, 10);
  const yozuvlar = jamiYozuvlar(zaxira);
  const caption = [
    `🗄 ${BRAND.nomi} — kunlik zaxira (shifrlangan)`,
    `Sana: ${sana}`,
    `Jami yozuv: ${yozuvlar}`,
    `Tenant: ${zaxira.counts.tenant ?? 0} · Tranzaksiya: ${zaxira.counts.transaction ?? 0}`,
    "",
    `🔐 AES-256-GCM · kalit: ${KALIT_ENV} env sekreti`,
    "Tiklash: npm run restore -- <fayl.json.gz.enc> --confirm",
    "(kalitsiz fayl ochilmaydi — kalitni alohida joyda saqlang)",
  ].join("\n");

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append(
    "document",
    new Blob([shifrlangan], { type: "application/octet-stream" }),
    `balansa-zaxira-${sana}.json.gz.enc`
  );

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    // Xato matnida token bo'lmaydi — Telegram faqat sabab qaytaradi (masalan "bot is not a member").
    const sabab = await res.text();
    throw new Error(`Telegram zaxirani qabul qilmadi (${res.status}): ${sabab.slice(0, 300)}`);
  }

  return { holat: "yuborildi", bayt: shifrlangan.byteLength, yozuvlar };
}
