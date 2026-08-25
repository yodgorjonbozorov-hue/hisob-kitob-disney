/**
 * YANGI XODIM YARATISHDAGI YORDAMCHILAR (login va parol taklifi).
 *
 * Ikkalasi ham TAKLIF — foydalanuvchi ustidan yozishi mumkin. Yagona
 * maqsadi: "login o'ylab topish" va "parol o'ylab topish" bosqichlarida
 * biznes egasini to'xtatib qo'ymaslik.
 */

/** O'zbek lotin harflarini oddiy ASCII ga tushiradi (login uchun). */
const HARF: Record<string, string> = {
  "ʻ": "", "'": "", "‘": "", "’": "", "`": "",
  ă: "a", â: "a", á: "a", à: "a",
  ĕ: "e", é: "e", è: "e",
  í: "i", ì: "i",
  ó: "o", ò: "o", ö: "o", ő: "o",
  ú: "u", ù: "u", ü: "u", ű: "u",
  ç: "c", ş: "s", ğ: "g", ñ: "n",
};

/**
 * Ismdan login taklifi: "Fayruza Nazarova" → "fayruza.nazarova".
 *
 * Band bo'lsa server 409 qaytaradi va foydalanuvchi qo'lda tuzatadi —
 * bu yerda bazaga so'rov yubormaymiz (har harfda so'rov ketardi).
 */
export function loginTaklifi(ism: string): string {
  const past = ism.trim().toLowerCase();
  let natija = "";
  for (const belgi of past) {
    natija += HARF[belgi] ?? belgi;
  }
  return natija
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 50);
}

/**
 * Vaqtinchalik parol.
 *
 * Alifboda CHALKASHADIGAN belgilar yo'q (0/O, 1/l/I): parol qo'lda
 * ko'chiriladi va "nol edimi, katta O edimi" degan savol bitta muvaffaqiyatsiz
 * kirishga arziydi. `crypto.getRandomValues` — `Math.random()` parol uchun
 * yaroqsiz (oldindan aytsa bo'ladi).
 */
const ALIFBO = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";

export function parolTaklifi(uzunlik = 12): string {
  const baytlar = new Uint32Array(uzunlik);
  crypto.getRandomValues(baytlar);
  let natija = "";
  for (const b of baytlar) natija += ALIFBO[b % ALIFBO.length];
  return natija;
}
