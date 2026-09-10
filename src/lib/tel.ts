/**
 * TELEFON RAQAMI — YAGONA NORMALIZATSIYA MANBAI.
 *
 * NEGA ALOHIDA FAYL. Raqam mijoz kartochkasining ASOSIY identifikatori:
 * "bu odam allaqachon bazadami?" degan savolga aynan shu qiymat javob
 * beradi. Ilgari mantiq `lib/validation/qarz.ts` ichida turardi va faqat
 * qarz yo'li undan foydalanardi — mijozlar sahifasi esa raqamni XOM
 * saqlardi. Natijada bitta odam "+998 91 332 00 08" va "913320008"
 * ko'rinishida ikki kartochka bo'lib qolardi.
 *
 * QOIDA: raqamni solishtiradigan yoki saqlaydigan HAR joy shu fayldan
 * o'qiydi. Ikkinchi normalizatsiya mantig'i yozilmaydi — bo'lganda ikkalasi
 * bir-biridan ajralib, dublikat qaytadi.
 */

/**
 * O'zbekiston raqamini yagona ko'rinishga keltiradi: `+998901234567`.
 *
 * Foydalanuvchi raqamni har xil yozadi — `90 123 45 67`, `(90) 1234567`,
 * `998901234567`, `+998 90 123-45-67`. Bazada har xil ko'rinishda yotsa
 * bir mijozning ikkita kartochkasi paydo bo'lardi.
 *
 * Formatga tushmasa `null` qaytaradi (chaqiruvchi xato beradi).
 */
export function telNormalize(xom: string | null | undefined): string | null {
  if (!xom) return null;
  const raqamlar = xom.replace(/\D/g, "");
  if (raqamlar.length === 9) return `+998${raqamlar}`;
  if (raqamlar.length === 12 && raqamlar.startsWith("998")) return `+${raqamlar}`;
  return null;
}

/** Ko'rsatish uchun: `+998901234567` → `+998 90 123 45 67`. */
export function telKorinish(tel: string | null | undefined): string {
  const n = telNormalize(tel);
  if (!n) return tel ?? "";
  const d = n.slice(4);
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/**
 * Telefonni ikki qiymatga ajratadi: SOLISHTIRISH uchun normal ko'rinish va
 * SAQLASH uchun matn.
 *
 * Forma raqamni zod bilan normallashtirib yuborishi mumkin, kassa esa xom
 * matn yuboradi. Normallashmagan raqam (masalan chet el raqami) bo'yicha
 * kartochka QIDIRILMAYDI — lekin operator kiritgan matn baribir saqlanadi,
 * aks holda ma'lumot yo'qolardi.
 *
 * `saqlash` — normallashgan bo'lsa AYNAN normal ko'rinish. Ya'ni bazaga
 * har doim bitta format tushadi va keyingi qidiruvlar indeksdan foydalanadi.
 */
export function telAjrat(xom: string | null | undefined): {
  mos: string | null;
  saqlash: string | null;
} {
  const normal = telNormalize(xom);
  if (normal) return { mos: normal, saqlash: normal };
  const matn = xom?.trim();
  return { mos: null, saqlash: matn || null };
}
