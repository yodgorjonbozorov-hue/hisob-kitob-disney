/**
 * KUNLIK AVTOMATIK ZAXIRA (H-6 dan keyingi tartib).
 *
 * Asosiy yo'l — S3-mos saqlagich (R2/B2, `BACKUP_S3_*` env'lar):
 *   1. Baza OQIMLI dump qilinadi (RAMda faqat gzip natija turadi);
 *   2. `BACKUP_ENCRYPTION_KEY` bo'lsa AES-256-GCM bilan shifrlanadi
 *      (barcha mijozlar moliyasi tashqi saqlagichga ochiq holda CHIQMAYDI);
 *   3. `zaxira/` prefiksiga yuklanadi va retention qo'llanadi:
 *      oxirgi 30 kun + har oyning 1-sanasi (12 oy);
 *   4. Telegram kanalga FAQAT BILDIRISHNOMA boradi (hajm, yozuv soni) — fayl emas.
 *
 * Zaxira yo'l — S3 sozlanmagan bo'lsa eski usul: fayl Telegramga hujjat
 * sifatida (shifrlash kaliti bo'lsa shifrlangan holda). Bu 45 MB chegara va
 * "moliyaviy baza Telegramda" muammosini saqlaydi — S3 sozlash tavsiya etiladi.
 *
 * Env (Telegram): BACKUP_CHAT_ID, BACKUP_BOT_TOKEN (bo'lmasa TELEGRAM_BOT_TOKEN).
 */
import { createGzip } from "node:zlib";
import { once } from "node:events";
import { BRAND } from "@/lib/brand";
import { dumpNiOqimgaYoz } from "./dump";
import { shifrla, shifrlashYoqilgan } from "./shifr";
import { s3Sozlangan, s3Yukla, s3Royxat, s3Ochir } from "./s3";

/** Telegram bot hujjat limiti 50 MB — biroz zaxira bilan cheklaymiz. */
const MAKS_BAYT = 45 * 1024 * 1024;

const PREFIKS = "zaxira/";

export type ZaxiraNatija =
  | { holat: "s3-yuborildi"; bayt: number; yozuvlar: number; kalit: string; ochirildi: number }
  | { holat: "yuborildi"; bayt: number; yozuvlar: number }
  | { holat: "sozlanmagan" }
  | { holat: "juda-katta"; bayt: number };

/** Oqimli dump -> gzip bufer (faqat siqilgan natija RAMda turadi). */
async function gzipDump(): Promise<{ gz: Buffer; yozuvlar: number }> {
  const gzip = createGzip();
  const bolaklar: Buffer[] = [];
  gzip.on("data", (b: Buffer) => bolaklar.push(b));
  const tugadi = once(gzip, "end");

  const natija = await dumpNiOqimgaYoz(async (s) => {
    if (!gzip.write(s)) await once(gzip, "drain");
  });
  gzip.end();
  await tugadi;

  return { gz: Buffer.concat(bolaklar), yozuvlar: natija.jami };
}

/**
 * RETENTION (sof funksiya, testlanadi): qaysi kalitlar O'CHIRILISHI kerak.
 * Saqlanadi: oxirgi 30 kunlik har qanday zaxira + oyning 1-sanasidagi
 * zaxiralar (365 kungacha). Qolganlari o'chadi.
 */
export function retentionOchiriladiganlar(kalitlar: string[], bugun: Date): string[] {
  const KUN = 24 * 60 * 60 * 1000;
  const ochirish: string[] = [];
  for (const kalit of kalitlar) {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(kalit);
    if (!m) continue; // sanasiz fayl — qo'lda qo'yilgan, tegilmaydi
    const sana = new Date(`${m[1]}T00:00:00.000Z`);
    const yosh = (bugun.getTime() - sana.getTime()) / KUN;
    if (yosh <= 30) continue;
    if (m[1].endsWith("-01") && yosh <= 365) continue;
    ochirish.push(kalit);
  }
  return ochirish;
}

async function telegramgaXabar(matn: string): Promise<void> {
  const chatId = process.env.BACKUP_CHAT_ID;
  const token = process.env.BACKUP_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return; // bildirishnoma ixtiyoriy — zaxira S3'da baribir bor
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: matn }),
    });
  } catch (e) {
    console.error("Zaxira bildirishnomasi yuborilmadi:", e);
  }
}

export async function sendBackupToTelegram(): Promise<ZaxiraNatija> {
  const chatId = process.env.BACKUP_CHAT_ID;
  const token = process.env.BACKUP_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;

  if (!s3Sozlangan() && (!chatId || !token)) {
    console.warn("Zaxira o'tkazib yuborildi: na BACKUP_S3_*, na BACKUP_CHAT_ID sozlangan.");
    return { holat: "sozlanmagan" };
  }

  const { gz, yozuvlar } = await gzipDump();
  const sana = new Date().toISOString().slice(0, 10);

  // Shifrlash — kalit bo'lsa har ikkala yo'lda ham qo'llanadi (H-6).
  const mazmun = shifrlashYoqilgan() ? shifrla(gz) : gz;
  const kengaytma = shifrlashYoqilgan() ? ".json.gz.enc" : ".json.gz";

  if (s3Sozlangan()) {
    const kalit = `${PREFIKS}balansa-zaxira-${sana}${kengaytma}`;
    await s3Yukla(kalit, mazmun, "application/octet-stream");

    // Retention: eski kunliklarni o'chirish (oy boshi nusxalari qoladi).
    let ochirildi = 0;
    try {
      const bor = await s3Royxat(PREFIKS);
      for (const k of retentionOchiriladiganlar(bor, new Date())) {
        await s3Ochir(k);
        ochirildi++;
      }
    } catch (e) {
      console.error("Zaxira retention xatosi (yuklash muvaffaqiyatli):", e);
    }

    await telegramgaXabar(
      [
        `🗄 ${BRAND.nomi} — kunlik zaxira S3'ga yuklandi`,
        `Sana: ${sana} · Yozuv: ${yozuvlar} · Hajm: ${(mazmun.byteLength / 1024).toFixed(0)} KB`,
        shifrlashYoqilgan() ? "Shifrlangan: AES-256-GCM" : "⚠️ Shifrlanmagan (BACKUP_ENCRYPTION_KEY qo'ying)",
        `Fayl: ${kalit}`,
        ochirildi > 0 ? `Retention: ${ochirildi} ta eski nusxa o'chirildi` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
    return { holat: "s3-yuborildi", bayt: mazmun.byteLength, yozuvlar, kalit, ochirildi };
  }

  // --- Zaxira yo'l: Telegram hujjati (S3 sozlanmagan) ---
  if (mazmun.byteLength > MAKS_BAYT) {
    console.error(`Zaxira juda katta (${mazmun.byteLength} bayt) — Telegramga sig'maydi.`);
    return { holat: "juda-katta", bayt: mazmun.byteLength };
  }

  const caption = [
    `🗄 ${BRAND.nomi} — kunlik zaxira`,
    `Sana: ${sana}`,
    `Jami yozuv: ${yozuvlar}`,
    shifrlashYoqilgan() ? "Shifrlangan: AES-256-GCM" : "⚠️ Shifrlanmagan (BACKUP_ENCRYPTION_KEY qo'ying)",
    "",
    "Tiklash: npm run restore -- <fayl> --confirm",
  ].join("\n");

  const form = new FormData();
  form.append("chat_id", chatId!);
  form.append("caption", caption);
  form.append(
    "document",
    new Blob([mazmun as unknown as BlobPart], { type: "application/octet-stream" }),
    `balansa-zaxira-${sana}${kengaytma}`
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

  return { holat: "yuborildi", bayt: mazmun.byteLength, yozuvlar };
}
