/**
 * Kunlik avtomatik zaxira: butun bazani JSON qilib, gzip'lab Telegramga hujjat sifatida yuboradi.
 *
 * Nega Telegram: bot va kanal allaqachon bor, qo'shimcha xizmat/hisob (S3, Blob) va
 * qo'shimcha to'lov talab qilinmaydi, fayl serverdan TASHQARIDA saqlanadi — server yoki
 * baza butunlay yo'qolsa ham zaxira qo'lda qoladi.
 *
 * Sozlash: `BACKUP_CHAT_ID` env — zaxira yuboriladigan shaxsiy kanal/chat id.
 * Env yo'q bo'lsa zaxira jim o'tkazib yuboriladi (cron yiqilmaydi), lekin log yoziladi.
 */
import { gzipSync } from "node:zlib";
import { InputFile } from "grammy";
import { BRAND } from "@/lib/brand";
import { createDump, jamiYozuvlar } from "./dump";

/** Telegram bot hujjat limiti 50 MB — biroz zaxira bilan cheklaymiz. */
const MAKS_BAYT = 45 * 1024 * 1024;

type SendDocumentApi = {
  sendDocument: (
    chatId: string,
    doc: InputFile,
    opts?: { caption?: string }
  ) => Promise<unknown>;
};

export type ZaxiraNatija =
  | { holat: "yuborildi"; bayt: number; yozuvlar: number }
  | { holat: "sozlanmagan" }
  | { holat: "juda-katta"; bayt: number };

export async function sendBackupToTelegram(api: SendDocumentApi): Promise<ZaxiraNatija> {
  const chatId = process.env.BACKUP_CHAT_ID;
  if (!chatId) {
    console.warn("Zaxira o'tkazib yuborildi: BACKUP_CHAT_ID env sozlanmagan.");
    return { holat: "sozlanmagan" };
  }

  const zaxira = await createDump();
  const gz = gzipSync(Buffer.from(JSON.stringify(zaxira)));

  if (gz.byteLength > MAKS_BAYT) {
    console.error(`Zaxira juda katta (${gz.byteLength} bayt) — Telegramga sig'maydi.`);
    return { holat: "juda-katta", bayt: gz.byteLength };
  }

  const sana = zaxira.createdAt.slice(0, 10);
  const yozuvlar = jamiYozuvlar(zaxira);
  const caption = [
    `🗄 ${BRAND.nomi} — kunlik zaxira`,
    `Sana: ${sana}`,
    `Jami yozuv: ${yozuvlar}`,
    `Tenant: ${zaxira.counts.tenant ?? 0} · Tranzaksiya: ${zaxira.counts.transaction ?? 0}`,
    "",
    "Tiklash: npm run restore -- <fayl.json> --confirm",
  ].join("\n");

  await api.sendDocument(
    chatId,
    new InputFile(gz, `balansa-zaxira-${sana}.json.gz`),
    { caption }
  );

  return { holat: "yuborildi", bayt: gz.byteLength, yozuvlar };
}
