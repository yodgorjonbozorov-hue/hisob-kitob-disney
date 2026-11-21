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

/**
 * LOGIN SIFATIDAGI TELEFON — xalqaro standart (ITU-T E.164) ko'rinishi.
 *
 * O'zbekiston raqami `telNormalize` bilan `+998XXXXXXXXX` bo'ladi. Boshqa
 * davlat raqami faqat `+` bilan yozilgandagina qabul qilinadi: E.164 bo'yicha
 * `+`, birinchi raqam 1–9, jami 8–15 raqam. `+` siz chet el raqami NOANIQ
 * (mamlakat kodi qayerda tugashini bilib bo'lmaydi) — `null`.
 */
export function telE164(xom: string | null | undefined): string | null {
  const uz = telNormalize(xom);
  if (uz) return uz;
  const t = xom?.trim() ?? "";
  if (!t.startsWith("+")) return null;
  const raqamlar = t.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(raqamlar) ? `+${raqamlar}` : null;
}

/**
 * Kiritilgan matn telefon raqamiga o'xshaydimi: faqat raqam va telefon yozuv
 * belgilari (`+`, bo'shliq, `-`, `.`, qavslar) va kamida 9 ta raqam. Harfli
 * login ("admin", "kassir1") hech qachon telefon deb talqin qilinmaydi.
 */
export function telgaOxshaydi(xom: string | null | undefined): boolean {
  const t = xom?.trim() ?? "";
  return /^\+?[\d\s().-]+$/.test(t) && t.replace(/\D/g, "").length >= 9;
}

/**
 * Telefon-login uchun bazada uchrashi mumkin bo'lgan BARCHA ko'rinishlar.
 *
 * Ro'yxatdan o'tish ilgari raqamni foydalanuvchi qanday yozgan bo'lsa shunday
 * saqlardi (`+998901234567`, `998901234567`, `901234567`). Mavjud akkauntlar
 * ko'chirilmaydi — kirishda shu ro'yxat bo'yicha qidiriladi. Birinchi element
 * har doim E.164 (yangi yozuvlar shu ko'rinishda saqlanadi).
 */
export function telLoginKorinishlari(xom: string | null | undefined): string[] {
  if (!telgaOxshaydi(xom)) return [];
  const e164 = telE164(xom);
  if (!e164) return [];
  const raqamlar = e164.slice(1);
  const royxat = [e164, raqamlar];
  if (e164.startsWith("+998")) royxat.push(raqamlar.slice(3));
  return royxat;
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
