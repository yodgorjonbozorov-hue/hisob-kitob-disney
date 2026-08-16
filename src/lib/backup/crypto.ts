/**
 * ZAXIRA SHIFRLASH — AES-256-GCM.
 *
 * Nega kerak (audit: Critical #2): kunlik zaxira butun bazani — barcha
 * tenantlarning moliyaviy ma'lumoti, mijoz ismlari, telefon raqamlari —
 * Telegram kanaliga OCHIQ holda yuborardi. Kanalga kirish huquqi bo'lgan
 * (yoki bot tokenini qo'lga kiritgan) har kim hamma narsani o'qiy olardi.
 *
 * Nega AES-256-GCM: shifrlash bilan birga BUTUNLIKNI ham tekshiradi
 * (autentifikatsiya tegi). Ya'ni fayl yo'lda o'zgartirilgan bo'lsa,
 * deshifrlash jimgina noto'g'ri ma'lumot bermaydi — XATO tashlaydi.
 * Buzilgan zaxiradan tiklash zaxirasizlikdan ham xavfliroq.
 *
 * Kalit: `BACKUP_ENCRYPTION_KEY` env sekreti (32 bayt).
 *   Yaratish:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   Formati:   64 belgili hex YOKI base64 (32 baytga teng bo'lishi shart).
 *
 * DIQQAT: kalit zaxiradan ALOHIDA saqlanishi kerak (parol menejeri, Vercel
 * env). Kalit yo'qolsa zaxirani hech kim — siz ham — ocha olmaydi.
 *
 * Fayl formati (bayt tartibida):
 *   [0..4]   sarlavha "BLNS1"  — bu fayl shifrlanganini aniqlash uchun
 *   [5..16]  IV (12 bayt)      — har shifrlashda YANGI tasodifiy qiymat
 *   [17..32] GCM tegi (16 bayt)
 *   [33..]   shifrlangan ma'lumot
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Kalit olinadigan env o'zgaruvchisi. */
export const KALIT_ENV = "BACKUP_ENCRYPTION_KEY";

const ALGORITM = "aes-256-gcm";
const KALIT_BAYT = 32; // AES-256
const IV_BAYT = 12; // GCM uchun tavsiya etilgan uzunlik
const TEG_BAYT = 16;

/** Shifrlangan zaxira fayli shu bayt ketma-ketligi bilan boshlanadi. */
export const SARLAVHA = Buffer.from("BLNS1", "ascii");

/** Kalit sozlanmagan yoki yaroqsiz. Zaxira YUBORILMAYDI (fail-closed). */
export class ShifrKalitXato extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShifrKalitXato";
  }
}

const KALIT_YORIQNOMA =
  `${KALIT_ENV} env sekreti sozlanmagan yoki yaroqsiz. ` +
  "32 baytli kalit kerak (64 belgili hex yoki base64). Yaratish: " +
  `node -e "console.log(require('crypto').randomBytes(${KALIT_BAYT}).toString('hex'))"`;

/**
 * Env'dagi kalitni 32 baytga aylantiradi.
 * @throws ShifrKalitXato — sozlanmagan yoki uzunligi noto'g'ri bo'lsa.
 */
export function kalitOl(): Buffer {
  const xom = process.env[KALIT_ENV]?.trim();
  if (!xom) throw new ShifrKalitXato(KALIT_YORIQNOMA);

  // Hex (64 belgi) yoki base64 — ikkalasi ham qulay, natija 32 bayt bo'lishi shart.
  const buf = /^[0-9a-fA-F]{64}$/.test(xom)
    ? Buffer.from(xom, "hex")
    : Buffer.from(xom, "base64");

  if (buf.length !== KALIT_BAYT) {
    throw new ShifrKalitXato(
      `${KALIT_ENV} uzunligi ${buf.length} bayt — ${KALIT_BAYT} bayt bo'lishi shart. ${KALIT_YORIQNOMA}`
    );
  }
  return buf;
}

/** Kalit sozlangan va yaroqlimi (yuborishdan OLDIN tekshirish uchun). */
export function kalitBormi(): boolean {
  try {
    kalitOl();
    return true;
  } catch {
    return false;
  }
}

/** Ma'lumot shifrlanganmi (sarlavha bo'yicha). Kalitsiz ham ishlaydi. */
export function shifrlanganmi(buf: Buffer): boolean {
  return buf.length >= SARLAVHA.length && buf.subarray(0, SARLAVHA.length).equals(SARLAVHA);
}

/**
 * AES-256-GCM bilan shifrlaydi.
 * @throws ShifrKalitXato — kalit yo'q bo'lsa. Ochiq ma'lumot QAYTARILMAYDI.
 */
export function shifrla(ochiq: Buffer): Buffer<ArrayBuffer> {
  const kalit = kalitOl();
  // IV har safar yangi: bir kalit bilan IV takrorlanishi GCM'da halokatli.
  const iv = randomBytes(IV_BAYT);
  const cipher = createCipheriv(ALGORITM, kalit, iv);
  const shifr = Buffer.concat([cipher.update(ochiq), cipher.final()]);
  return Buffer.concat([SARLAVHA, iv, cipher.getAuthTag(), shifr]);
}

/**
 * AES-256-GCM bilan deshifrlaydi.
 * @throws ShifrKalitXato — kalit yo'q; Error — fayl formati buzilgan yoki
 *   kalit boshqa (GCM tegi mos kelmaydi).
 */
export function deshifrla(shifrlangan: Buffer): Buffer<ArrayBuffer> {
  if (!shifrlanganmi(shifrlangan)) {
    throw new Error("Zaxira fayli shifrlangan formatda emas (sarlavha topilmadi).");
  }
  const engKam = SARLAVHA.length + IV_BAYT + TEG_BAYT;
  if (shifrlangan.length < engKam) {
    throw new Error("Shifrlangan zaxira buzilgan: fayl juda qisqa.");
  }

  const kalit = kalitOl();
  const iv = shifrlangan.subarray(SARLAVHA.length, SARLAVHA.length + IV_BAYT);
  const teg = shifrlangan.subarray(SARLAVHA.length + IV_BAYT, engKam);
  const tana = shifrlangan.subarray(engKam);

  const decipher = createDecipheriv(ALGORITM, kalit, iv);
  decipher.setAuthTag(teg);
  try {
    return Buffer.concat([decipher.update(tana), decipher.final()]);
  } catch {
    // GCM tegi mos kelmadi — noto'g'ri kalit yoki fayl o'zgartirilgan.
    throw new Error(
      "Zaxirani ochib bo'lmadi: kalit noto'g'ri yoki fayl o'zgartirilgan " +
        "(GCM butunlik tekshiruvi o'tmadi)."
    );
  }
}
