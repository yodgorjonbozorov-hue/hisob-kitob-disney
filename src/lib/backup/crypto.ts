/**
 * ZAXIRA SHIFRLASH — AES-256-GCM (TypeScript qobig'i).
 *
 * Nega kerak (audit: Critical #2): zaxiralar butun bazani — barcha
 * tenantlarning moliyaviy ma'lumoti, mijoz ismlari, telefon raqamlari,
 * parol hashlari bilan — Telegram kanaliga OCHIQ holda yuborardi. Kanalga
 * kirish huquqi bo'lgan (yoki bot tokenini qo'lga kiritgan) har kim hamma
 * narsani o'qiy olardi.
 *
 * Nega AES-256-GCM: shifrlash bilan birga BUTUNLIKNI ham tekshiradi
 * (autentifikatsiya tegi). Ya'ni fayl yo'lda o'zgartirilgan bo'lsa,
 * deshifrlash jimgina noto'g'ri ma'lumot bermaydi — XATO tashlaydi.
 * Buzilgan zaxiradan tiklash zaxirasizlikdan ham xavfliroq.
 *
 * MANTIQNING O'ZI bu faylda EMAS — `./shifr-asos.cjs` da. Sababi: aynan shu
 * shifrlash `scripts/deploy-zaxira.mjs` (oddiy `node`, TypeScript'siz)
 * tomonidan ham ishlatiladi va u `.ts` faylni import qila olmaydi. Ikki
 * nusxa format bir kun ajralib ketishiga olib kelardi — natijada kanaldagi
 * fayl ochilmay qolardi.
 *
 * Kalit: `BACKUP_ENCRYPTION_KEY` env sekreti (32 bayt).
 *   Yaratish:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   Formati:   64 belgili hex YOKI base64 (32 baytga teng bo'lishi shart).
 *
 * DIQQAT: kalit zaxiradan ALOHIDA saqlanishi kerak (parol menejeri, Vercel
 * env). Kalit yo'qolsa zaxirani hech kim — siz ham — ocha olmaydi.
 */
import * as asos from "./shifr-asos.cjs";

/** Kalit olinadigan env o'zgaruvchisi. */
export const KALIT_ENV: string = asos.KALIT_ENV;

/** Shifrlangan zaxira fayli shu bayt ketma-ketligi bilan boshlanadi. */
export const SARLAVHA: Buffer = asos.SARLAVHA;

/** Kalit sozlanmagan yoki yaroqsiz. Zaxira YUBORILMAYDI (fail-closed). */
export const ShifrKalitXato: typeof asos.ShifrKalitXato = asos.ShifrKalitXato;

/**
 * Env'dagi kalitni 32 baytga aylantiradi.
 * @throws ShifrKalitXato — sozlanmagan yoki uzunligi noto'g'ri bo'lsa.
 */
export function kalitOl(): Buffer {
  return asos.kalitOl();
}

/** Kalit sozlangan va yaroqlimi (yuborishdan OLDIN tekshirish uchun). */
export function kalitBormi(): boolean {
  return asos.kalitBormi();
}

/** Ma'lumot shifrlanganmi (sarlavha bo'yicha). Kalitsiz ham ishlaydi. */
export function shifrlanganmi(buf: Buffer): boolean {
  return asos.shifrlanganmi(buf);
}

/**
 * AES-256-GCM bilan shifrlaydi.
 * @throws ShifrKalitXato — kalit yo'q bo'lsa. Ochiq ma'lumot QAYTARILMAYDI.
 */
export function shifrla(ochiq: Buffer): Buffer<ArrayBuffer> {
  return asos.shifrla(ochiq);
}

/**
 * AES-256-GCM bilan deshifrlaydi.
 * @throws ShifrKalitXato — kalit yo'q; Error — fayl formati buzilgan yoki
 *   kalit boshqa (GCM tegi mos kelmaydi).
 */
export function deshifrla(shifrlangan: Buffer): Buffer<ArrayBuffer> {
  return asos.deshifrla(shifrlangan);
}
