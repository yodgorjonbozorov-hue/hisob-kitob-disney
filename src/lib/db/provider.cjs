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

exports.isPostgres = isPostgres;
