/**
 * BAZA PROVAYDERINI ANIQLASH — yagona manba.
 *
 * NEGA .cjs VA NEGA ALOHIDA FAYL. Bu qoida ikki xil muhitda kerak:
 *   - ilova ichida (`src/lib/db/dialect.ts`, TypeScript, Next bundli);
 *   - build/deploy skriptlarida (`scripts/*.mjs`, oddiy `node`) — ular
 *     `.ts` faylni import qila olmaydi.
 *
 * Qoida ikki joyda takrorlansa, bir kun ajralib ketadi: masalan `.ts`
 * tomonda `postgres://` qo'shiladi-yu, skript tomonda qo'shilmaydi —
 * natijada ilova Postgres'ga ulanadi, deploy skripti esa SQLite deb
 * o'ylab yiqiladi. Shuning uchun aniqlash SHU YERDA, bitta joyda.
 * (`src/lib/backup/shifr-asos.cjs` bilan bir xil uslub.)
 */

/** `postgresql://` yoki `postgres://` — Postgres; qolgani (file:, libsql:) SQLite. */
function isPostgres(url) {
  return /^postgres(ql)?:\/\//i.test(url ?? "");
}

/**
 * Ulanish satrini LOGGA CHIQARISH uchun xavfsiz ko'rinishga keltiradi.
 *
 * NEGA (audit: P0-3). `DATABASE_URL` — sir. U parol (`postgresql://user:PAROL@host`)
 * yoki token (`libsql://...?authToken=...`) saqlaydi. Skriptlar esa "qaysi bazaga
 * ulanyapmiz" deb uni chop etadi — va CI logi OMMAVIY bo'lishi mumkin. GitHub
 * sekret maskalashi bu yerda yetarli emas: u faqat TO'LIQ sekret matnini
 * to'sadi, URL ning bir bo'lagini (masalan faqat parolni) emas.
 *
 * Har skript o'zicha maskalasa bittasi esdan chiqadi — shuning uchun qoida
 * `isPostgres` bilan bir joyda turadi.
 *
 * Maskalanadi: `user:parol@`, `authToken=...`, `password=...`.
 * Qoladi: sxema, host, port, baza nomi — nosozlikni tushunish uchun shu yetarli.
 */
function yashirUrl(url) {
  if (!url) return "(sozlanmagan)";
  return String(url)
    .replace(/\/\/[^/@]*@/, "//***@")
    .replace(/([?&](authToken|password|sslpassword)=)[^&]*/gi, "$1***");
}

exports.isPostgres = isPostgres;
exports.yashirUrl = yashirUrl;
