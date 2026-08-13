import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * ZAXIRA SHIFRLASH (H-6) — AES-256-GCM.
 *
 * Zaxira barcha mijozlarning to'liq moliyaviy bazasi. U tashqi saqlagichga
 * (S3/Telegram) FAQAT shifrlangan holda chiqishi kerak — saqlagich buzilsa
 * ham mazmun ochilmaydi.
 *
 * Kalit: `BACKUP_ENCRYPTION_KEY` env — 64 belgili hex (32 bayt) yoki istalgan
 * parol-ibora (SHA-256 orqali kalitga aylantiriladi).
 *
 * Format: "BXV1" (4 bayt magic) + IV (12) + auth tag (16) + shifrlangan mazmun.
 * GCM auth tag mazmun BUZILGANINI ham ushlaydi — noto'g'ri kalit yoki
 * o'zgartirilgan fayl deshifrlashda aniq xato beradi.
 */

const MAGIC = Buffer.from("BXV1", "ascii");

export function shifrlashYoqilgan(): boolean {
  return Boolean(process.env.BACKUP_ENCRYPTION_KEY);
}

function kalit(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) throw new Error("BACKUP_ENCRYPTION_KEY sozlanmagan");
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return createHash("sha256").update(raw, "utf8").digest();
}

export function shifrla(mazmun: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", kalit(), iv);
  const shifrlangan = Buffer.concat([cipher.update(mazmun), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), shifrlangan]);
}

/** Fayl shifrlangan formatdami (magic bayt bo'yicha). */
export function shifrlanganmi(mazmun: Buffer): boolean {
  return mazmun.length > MAGIC.length + 28 && mazmun.subarray(0, 4).equals(MAGIC);
}

export function deshifrla(mazmun: Buffer): Buffer {
  if (!shifrlanganmi(mazmun)) {
    throw new Error("Fayl shifrlangan zaxira formatida emas (BXV1 magic topilmadi)");
  }
  const iv = mazmun.subarray(4, 16);
  const tag = mazmun.subarray(16, 32);
  const shifrlangan = mazmun.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", kalit(), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(shifrlangan), decipher.final()]);
  } catch {
    throw new Error("Deshifrlash yiqildi — kalit noto'g'ri yoki fayl buzilgan");
  }
}
