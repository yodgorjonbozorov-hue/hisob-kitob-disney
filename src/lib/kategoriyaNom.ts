/**
 * KATEGORIYA NOMI QOIDALARI — normallashtirish va tizim kategoriyalari.
 *
 * Ikki qoida shu yerda birlashtirildi, chunki ikkalasi ham "nom" ustida
 * ishlaydi va ikkalasi ham UI'da, API'da va servislarda BIR XIL javob
 * berishi shart. Ilgari ular umuman yo'q edi:
 *
 *  1. DUBLIKAT. Bazadagi `@@unique([nomi, turi, businessId])` registrga
 *     SEZGIR: "Bantik" va "bantik" ikki alohida kategoriya bo'lardi va
 *     hisobotda bitta xarajat ikki qatorga bo'linib ketardi.
 *  2. TIZIM KATEGORIYALARI. POS, qarz, ombor va HR servislari kategoriyani
 *     NOMI bo'yicha topadi (`ensureCategoryTx`). Foydalanuvchi "Sotuv" ni
 *     "Savdo" ga o'zgartirsa, keyingi sotuvda servis "Sotuv" ni QAYTA
 *     yaratardi — bitta savdo oqimi ikki kategoriyaga bo'linib ketardi.
 */

/**
 * Taqqoslash uchun nom: chetlardagi bo'shliqlar olib tashlanadi, ichkaridagi
 * ketma-ket bo'shliqlar bittaga siqiladi, harflar kichraytiriladi.
 *
 * DIQQAT — bazadagi unique indeks `lower(trim("nomi"))` ifodasidan iborat,
 * ya'ni ichki bo'shliqni SIQMAYDI. Bu funksiya undan QAT'IYROQ: baza
 * dublikat deb hisoblagan har bir juftlikni bu ham dublikat deb hisoblaydi
 * (teskarisi emas). Shu yo'nalish ataylab tanlangan — aks holda ilova
 * "bo'ladi" deb o'tkazgan nom bazada kutilmagan xatoga urilardi.
 */
export function kategoriyaNormal(nomi: string): string {
  return nomi.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Saqlanadigan ko'rinish: faqat ortiqcha bo'shliqlar tozalanadi, registr tegilmaydi. */
export function kategoriyaTozala(nomi: string): string {
  return nomi.trim().replace(/\s+/g, " ");
}

/**
 * SERVISLAR AVTOMATIK ISHLATADIGAN KATEGORIYALAR.
 *
 * Har nom `ensureCategoryTx()` ga QOTIRILGAN holda uzatiladi — manba
 * fayllar izohda ko'rsatilgan. Ro'yxat o'zgarsa, u yerdagi doimiy ham
 * o'zgarishi shart (`tests/kategoriya-boshqaruv.test.ts` buni tekshiradi).
 */
export const TIZIM_KATEGORIYALARI: Record<"kirim" | "chiqim", string[]> = {
  kirim: [
    "Sotuv", // lib/services/pos.ts, inventory.ts, crm/kirim.ts
    "Qarz to'lovi", // lib/services/qarz.ts — xaridor qarzini to'ladi
  ],
  chiqim: [
    "Qarz to'lash", // lib/services/qarz.ts — biz qarzimizni to'ladik
    "Tovar xaridi", // lib/services/xarid.ts
    "Mashina xaridi", // lib/services/inventory.ts (avto rejimi)
    "Mashina xarajati", // lib/services/inventory.ts (avto rejimi)
    "Oylik", // lib/services/hr.ts
    "Avans", // lib/services/hr.ts
  ],
};

const TIZIM_NORMAL: Record<"kirim" | "chiqim", Set<string>> = {
  kirim: new Set(TIZIM_KATEGORIYALARI.kirim.map(kategoriyaNormal)),
  chiqim: new Set(TIZIM_KATEGORIYALARI.chiqim.map(kategoriyaNormal)),
};

/**
 * Shu nom+tur juftligi tizim kategoriyasimi?
 *
 * Tur ham tekshiriladi: chiqimdagi "Sotuv" oddiy foydalanuvchi kategoriyasi —
 * uni hech qaysi servis o'zi yaratmaydi, demak qulflashning ma'nosi yo'q.
 */
export function tizimKategoriyasi(nomi: string, turi: string): boolean {
  if (turi !== "kirim" && turi !== "chiqim") return false;
  return TIZIM_NORMAL[turi].has(kategoriyaNormal(nomi));
}

/**
 * AVTOMATIK KATEGORIYA IZLASH — servislar uchun (POS, qarz, ombor, HR, CSV).
 *
 * Nega kerak: servislar kategoriyani NOMI bo'yicha `upsert` qilardi, ya'ni
 * taqqoslash registrga sezgir edi. Baza endi registrga befarq yagonalikni
 * talab qilgani uchun ("Sotuv" va "sotuv" bir xil), foydalanuvchi qo'lda
 * "sotuv" yaratib qo'ygan biznesda keyingi savdo `upsert` orqali "Sotuv" ni
 * YARATMOQCHI bo'lardi va indeksga urilib SOTUVNI YIQITARDI.
 *
 * Shu bois avval mavjudlari registrsiz solishtiriladi; topilmasa yaratiladi.
 * Yaratish chaqiruvchida `upsert` bo'lib qoladi — bir xil nomli ikki
 * parallel so'rov o'sha yerda birlashadi.
 *
 * Ro'yxat bitta biznesning bitta yo'nalishidagi kategoriyalari (odatda
 * o'nlab), shuning uchun uni to'liq o'qish arzon.
 */
export async function kategoriyaIdTop(
  mavjudlar: () => Promise<{ id: string; nomi: string }[]>,
  yarat: () => Promise<{ id: string }>,
  nomi: string
): Promise<string> {
  const norm = kategoriyaNormal(nomi);
  const topildi = (await mavjudlar()).find((c) => kategoriyaNormal(c.nomi) === norm);
  if (topildi) return topildi.id;
  return (await yarat()).id;
}
