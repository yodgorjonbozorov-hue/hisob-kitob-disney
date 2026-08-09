/**
 * ZAXIRA SHIFRLASH (audit C-4) — skript tomoni.
 *
 * Zaxira Telegram kanaliga chiqadi va unda parol hash'lari bilan butun baza
 * bor. Kanal yopiq bo'lsa ham bu YAGONA himoya qatlami edi: bot tokeni yoki
 * kanal a'zoligi oshkor bo'lsa hamma narsa ochiq ketardi. Endi fayl kanalga
 * chiqishidan OLDIN AES-256-GCM bilan shifrlanadi — kalitsiz fayl shunchaki
 * tasodifiy baytlar.
 *
 * Kalit: `ZAXIRA_PAROL` env o'zgaruvchisi (scrypt bilan kalitga aylantiriladi).
 * GCM autentifikatsiyalangan — noto'g'ri parol ham, buzilgan fayl ham
 * ochishda aniq xato beradi, jimgina buzuq JSON qaytmaydi.
 *
 * FORMAT (v1, baytlar): "BZX1" (4) | salt (16) | iv (12) | tag (16) | shifrmatn.
 *
 * DIQQAT: xuddi shu format `src/lib/backup/shifr.ts` da ham bor — u ilova/
 * ts-node tomonida ishlaydi (CJS muhiti .mjs ni import qila olmaydi).
 * Ikkalasining mosligini `tests/shifr.test.ts` o'zaro ochib tekshiradi;
 * formatni o'zgartirsangiz IKKALA faylni va VERSIYA'ni birga o'zgartiring.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export const SHIFR_MAGIC = Buffer.from("BZX1");

/** Baytlar shifrlangan zaxira faylimi (magic bo'yicha). */
export function shifrlanganmi(bayt) {
  return bayt.length >= SHIFR_MAGIC.length && bayt.subarray(0, 4).equals(SHIFR_MAGIC);
}

export function shifrla(bayt, parol) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kalit = scryptSync(parol, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", kalit, iv);
  const shifrmatn = Buffer.concat([cipher.update(bayt), cipher.final()]);
  return Buffer.concat([SHIFR_MAGIC, salt, iv, cipher.getAuthTag(), shifrmatn]);
}

export function shifrOch(bayt, parol) {
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
 * ochadi (parol talab qiladi), gzip bo'lsa ochadi. `gunzip` — chaqiruvchi
 * beradigan funksiya (node:zlib gunzipSync), bu modul faqat kriptoni biladi.
 */
export function zaxiraFayliniOch(bayt, gunzip, parol = process.env.ZAXIRA_PAROL) {
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
    ochiq = gunzip(ochiq);
  }
  return ochiq;
}
