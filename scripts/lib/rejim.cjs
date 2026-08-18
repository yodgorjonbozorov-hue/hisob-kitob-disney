/**
 * MIGRATSIYA REJIMI — migratsiya QAYERDA bajarilishini belgilaydi.
 *
 * MUAMMO (audit: P0-3). Zaxira va migratsiya `npm run build` zanjirida
 * turadi, ya'ni ular Vercel BUILD muhitida bajariladi. PostgreSQL zaxirasi
 * esa `pg_dump` ga tayanadi va Vercel build image'ida u YO'Q. Natijada
 * Postgres'ga o'tilsa har deploy build bosqichida to'xtardi — yoki
 * `ZAXIRASIZ_DAVOM=ha` bilan chetlab o'tilib, ZAXIRASIZ migratsiya
 * qilinardi. Ikkalasi ham yaroqsiz.
 *
 * YECHIM. Postgres'da migratsiya va zaxira BUILD'dan ajratiladi va CI
 * (GitHub Actions, `migratsiya.yml`) ga o'tadi — u yerda `postgresql-client`
 * bor. CI o'zini shu bayroq bilan tanitadi:
 *
 *     MIGRATSIYA_RUXSAT=ha
 *
 * Bayroqsiz (ya'ni Vercel build'da) Postgres yo'li bazaga YOZMAYDI: u faqat
 * kutayotgan migratsiya bor-yo'qligini tekshiradi va bo'lsa deploy'ni
 * TO'XTATADI. Shu tarzda:
 *   - build hech qachon `pg_dump` talab qilmaydi;
 *   - production migratsiyasi build ichida JIMGINA bajarilmaydi;
 *   - sxemasi eskirgan ilova production'ga chiqib ketmaydi.
 *
 * SQLite/Turso yo'liga BU QOIDA TEGMAYDI: u bugungi production va uning
 * deploy oqimi avvalgidek — build migratsiyani o'zi qo'llaydi.
 */

/** CI bayrog'i nomi (bir joyda — ikki skript ham shundan oladi). */
const RUXSAT_ENV = "MIGRATSIYA_RUXSAT";

/**
 * Bazaga yozadigan migratsiya/zaxira amallariga ruxsat berilganmi.
 *
 * Faqat migratsiya CI'si (`\.github/workflows/migratsiya.yml`) `ha` qiladi.
 */
function migratsiyaRuxsati() {
  return (process.env[RUXSAT_ENV] ?? "").trim().toLowerCase() === "ha";
}

exports.RUXSAT_ENV = RUXSAT_ENV;
exports.migratsiyaRuxsati = migratsiyaRuxsati;
