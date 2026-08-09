/**
 * ZAXIRA SHIFRLASH (audit C-4) — ilova/ts-node tomoni.
 *
 * Nega shifr: zaxira Telegram kanaliga chiqadi va unda parol hash'lari bilan
 * butun baza bor. Bot tokeni yoki kanal a'zoligi oshkor bo'lsa hamma narsa
 * ochiq ketardi. Endi fayl kanalga chiqishidan OLDIN AES-256-GCM bilan
 * shifrlanadi; GCM autentifikatsiyalangan — noto'g'ri parol ham, buzilgan
 * fayl ham ochishda aniq xato beradi.
 *
 * FORMAT (v1, baytlar): "BZX1" (4) | salt (16) | iv (12) | tag (16) | shifrmatn.
 *
 * DIQQAT: xuddi shu format `scripts/lib/shifr.mjs` da ham bor — build
 * skriptlari (deploy-zaxira) Prisma'siz/sxemasiz muhitda ishlaydi va CJS
 * ts-node .mjs ni import qila olmaydi, shuning uchun ikki nusxa saqlanadi.
 * Mosligini `tests/shifr.test.ts` o'zaro ochib tekshiradi; formatni
 * o'zgartirsangiz IKKALA faylni birga o'zgartiring.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { gunzipSync } from "node:zlib";

export const SHIFR_MAGIC = Buffer.from("BZX1");

/** Baytlar shifrlangan zaxira faylimi (magic bo'yicha). */
export function shifrlanganmi(bayt: Buffer): boolean {
  return bayt.length >= SHIFR_MAGIC.length && bayt.subarray(0, 4).equals(SHIFR_MAGIC);
}

export function shifrla(bayt: Buffer, parol: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kalit = scryptSync(parol, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", kalit, iv);
  const shifrmatn = Buffer.concat([cipher.update(bayt), cipher.final()]);
  return Buffer.concat([SHIFR_MAGIC, salt, iv, cipher.getAuthTag(), shifrmatn]);
}

export function shifrOch(bayt: Buffer, parol: string): Buffer {
  if (!shifrlanganmi(bayt)) {
    throw new Error("bu shifrlangan zaxira fayli emas (magic mos kelmadi)");
  }
  const salt = bayt.subarray(4, 20);
  const iv = bayt.subarray(20, 32);
  const tag = bayt.subarray(32, 48);
  const shifrmatn = bayt.subarray(48);
  const kalit = scryptSync(parol, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", kalit, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(shifrmatn), decipher.final()]);
  } catch {
    throw new Error("zaxirani ochib bo'lmadi: ZAXIRA_PAROL noto'g'ri yoki fayl buzilgan");
  }
}

const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

/**
 * Zaxira faylini o'qiladigan JSON baytlariga keltiradi: shifrlangan bo'lsa
 * ochadi (ZAXIRA_PAROL talab qiladi), gzip bo'lsa ochadi. Eski shifrsiz
 * fayllar o'zgarishsiz o'tadi — tiklash orqaga mos qoladi.
 */
export function zaxiraFayliniOch(bayt: Buffer, parol = process.env.ZAXIRA_PAROL): Buffer {
  let ochiq = bayt;
  if (shifrlanganmi(ochiq)) {
    if (!parol) {
      throw new Error(
        "fayl shifrlangan, lekin ZAXIRA_PAROL sozlanmagan — ochish uchun o'sha parol kerak"
      );
    }
    ochiq = shifrOch(ochiq, parol);
  }
  if (ochiq.length >= 2 && ochiq.subarray(0, 2).equals(GZIP_MAGIC)) {
    ochiq = gunzipSync(ochiq);
  }
  return ochiq;
}
