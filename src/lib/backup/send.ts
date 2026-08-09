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
 * Env:
 *   BACKUP_CHAT_ID   — zaxira yuboriladigan yopiq kanal id (masalan -1004319743561)
 *   BACKUP_BOT_TOKEN — o'sha kanalga admin qilingan bot tokeni.
 *                      Qo'yilmasa TELEGRAM_BOT_TOKEN (asosiy bot) ishlatiladi.
 *
 * Ikkalasi ham yo'q bo'lsa zaxira jim o'tkazib yuboriladi (cron yiqilmaydi), lekin log yoziladi.
 */
import { gzipSync } from "node:zlib";
import { BRAND } from "@/lib/brand";
import { createDump, jamiYozuvlar } from "./dump";
import { shifrla } from "./shifr";

/** Telegram bot hujjat limiti 50 MB — biroz zaxira bilan cheklaymiz. */
const MAKS_BAYT = 45 * 1024 * 1024;

export type ZaxiraNatija =
  | { holat: "yuborildi"; bayt: number; yozuvlar: number }
  | { holat: "sozlanmagan" }
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

  const zaxira = await createDump();
  const gz = gzipSync(Buffer.from(JSON.stringify(zaxira)));

  // C-4: faylda parol hash'lari bilan butun baza bor — kanalga chiqishidan
  // oldin shifrlanadi. Parol yo'q bo'lsa zaxira baribir yuboriladi (zaxirasiz
  // qolish undan ham xavfli), lekin muammo har kuni kanalning o'zida ko'rinadi.
  const parol = process.env.ZAXIRA_PAROL;
  const hujjat = parol ? shifrla(gz, parol) : gz;
  if (!parol) {
    console.warn("Zaxira SHIFRLANMAGAN holda yuborilmoqda — ZAXIRA_PAROL o'rnating.");
  }

  if (hujjat.byteLength > MAKS_BAYT) {
    console.error(`Zaxira juda katta (${hujjat.byteLength} bayt) — Telegramga sig'maydi.`);
    return { holat: "juda-katta", bayt: hujjat.byteLength };
  }

  const sana = zaxira.createdAt.slice(0, 10);
  const yozuvlar = jamiYozuvlar(zaxira);
  const caption = [
    `🗄 ${BRAND.nomi} — kunlik zaxira`,
    parol
      ? "🔐 Shifrlangan (AES-256) — tiklashda ZAXIRA_PAROL kerak"
      : "⚠️ SHIFRLANMAGAN — Vercel env'ga ZAXIRA_PAROL qo'ying",
    `Sana: ${sana}`,
    `Jami yozuv: ${yozuvlar}`,
    `Tenant: ${zaxira.counts.tenant ?? 0} · Tranzaksiya: ${zaxira.counts.transaction ?? 0}`,
    "",
    "Tiklash: npm run restore -- <fayl> --confirm",
    ...(parol ? ["(fayl avval ochilmaydi — restore o'zi ochadi)"] : []),
  ].join("\n");

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append(
    "document",
    new Blob([new Uint8Array(hujjat)], { type: "application/octet-stream" }),
    `balansa-zaxira-${sana}.json.gz${parol ? ".shifr" : ""}`
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

  return { holat: "yuborildi", bayt: hujjat.byteLength, yozuvlar };
}
