/**
 * POSTGRESQL SURATI VA MIGRATSIYA HISOBOTI — `xom-surat.mjs` ning Postgres jufti.
 *
 * NEGA ALOHIDA FAYL VA NEGA `.cjs`. `scripts/lib/xom-surat.mjs` butunlay SQLite'ga qurilgan:
 * `sqlite_master` dan jadval qidiradi, `PRAGMA foreign_keys` bilan FK'ni
 * o'chiradi va `_applied_migrations` jadvalini o'zi yuritadi. Postgres'da
 * bularning birortasi yo'q. Uni "ikki dialektli" qilishga urinish har
 * funksiyani ikki shoxli qilardi — o'qilishi ham, sinalishi ham qiyin.
 * Shuning uchun Postgres yo'li shu yerda, ALOHIDA turadi; chaqiruvchi
 * (`deploy-zaxira.mjs`, `xom-zaxira.mjs`) provayderga qarab birini tanlaydi.
 *
 * FARQLAR (SQLite yo'li bilan taqqoslaganda):
 *
 *   | Nima              | SQLite (`xom-surat.mjs`)      | Postgres (shu fayl)        |
 *   |-------------------|-------------------------------|----------------------------|
 *   | jadval ro'yxati   | `sqlite_master`               | `information_schema`       |
 *   | migratsiya hisobi | `_applied_migrations` (o'zimiz)| `_prisma_migrations` (Prisma)|
 *   | surat formati     | JSON (jadval -> qatorlar)     | `pg_dump` (custom format)  |
 *   | tiklash           | INSERT'lar + FK tekshiruvi    | `pg_restore`               |
 *
 * KENGAYTMA `.cjs`: loyihada `"type": "module"`, ya'ni `.mjs` fayllarni
 * testlardagi ts-node (CommonJS) `require` qila olmaydi. CommonJS moduli esa
 * HAR IKKALA tomondan o'qiladi — `.mjs` skriptlar `import` bilan, testlar
 * `require` bilan oladi (`src/lib/backup/shifr-asos.cjs` bilan bir xil uslub).
 *
 * NEGA `pg_dump`: Postgres'da mantiqiy zaxiraning standart vositasi shu.
 * O'zimiz JSON yig'ish Postgres tiplarini (numeric, jsonb, array, timestamptz)
 * qayta ixtiro qilishni talab qilardi va aynan tiklash kunida buzilardi.
 * `pg_dump` esa sxemani ham, ma'lumotni ham, ketma-ketliklarni (sequence)
 * ham o'zi to'g'ri chiqaradi.
 *
 * DIQQAT: `pg_dump` — TASHQI dastur. Build muhitida bo'lmasligi mumkin
 * (masalan Vercel build image'ida yo'q). Shuning uchun `pgDumpBormi()`
 * alohida tekshiriladi va chaqiruvchi zaxirasiz davom etmaydi.
 */
const { spawnSync } = require("node:child_process");
const { readdirSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const MIGRATSIYALAR = "prisma/migrations";

/** Prisma migratsiya hisoboti shu jadvalda yuritiladi. */
const HISOBOT_JADVAL = "_prisma_migrations";

/** `pg` klientini ochadi (chaqiruvchi `end()` qiladi). */
async function pgKlient(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL sozlanmagan.");
  const { Client } = await import("pg");
  const c = new Client({ connectionString: url });
  await c.connect();
  return c;
}

/** Diskdagi migratsiya papkalari (tartib bo'yicha) — SQLite yo'li bilan bir xil. */
function migratsiyaRoyxati() {
  if (!existsSync(MIGRATSIYALAR)) return [];
  return readdirSync(MIGRATSIYALAR)
    .filter((d) => existsSync(join(MIGRATSIYALAR, d, "migration.sql")))
    .sort();
}

/** Bazadagi ilova jadvallari (Prisma xizmat jadvali hisobga olinmaydi). */
async function ilovaJadvallari(c) {
  const res = await c.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  );
  return res.rows.map((r) => String(r.table_name)).filter((n) => n !== HISOBOT_JADVAL);
}

/** Qo'llangan migratsiyalar soni; hisobot jadvali yo'q bo'lsa 0. */
async function hisobotSoni(c) {
  const bor = await c.query(`SELECT to_regclass('public.${HISOBOT_JADVAL}') AS t`);
  if (!bor.rows[0]?.t) return 0;
  // Yarim qolgan (rollback qilingan) migratsiya "qo'llangan" hisoblanmaydi.
  const res = await c.query(
    `SELECT COUNT(*) n FROM "${HISOBOT_JADVAL}" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
  );
  return Number(res.rows[0].n);
}

/**
 * Hali qo'llanmagan migratsiyalar.
 *
 * SQLite yo'lidagi bilan bir xil EHTIYOTKOR qoida: hisobot jadvali umuman
 * yo'q bo'lsa HAMMASI kutayotgan deb qaraladi — noaniqlikda "zaxira kerak
 * emas" deb qaror qilish xavfli.
 */
async function kutayotganMigratsiyalar(c) {
  const hammasi = migratsiyaRoyxati();
  const bor = await c.query(`SELECT to_regclass('public.${HISOBOT_JADVAL}') AS t`);
  if (!bor.rows[0]?.t) return hammasi;

  const res = await c.query(
    `SELECT migration_name FROM "${HISOBOT_JADVAL}" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
  );
  const qollangan = new Set(res.rows.map((r) => String(r.migration_name)));
  return hammasi.filter((d) => !qollangan.has(d));
}

/** `pg_dump` tizimda bormi (build muhitida bo'lmasligi mumkin). */
function pgDumpBormi() {
  return spawnSync("pg_dump", ["--version"], { encoding: "utf8" }).status === 0;
}

/**
 * `pg_restore` tizimda bormi.
 *
 * Alohida tekshiriladi, chunki ZAXIRA bilan UNDAN QAYTISH — ikki xil
 * vosita. `pg_dump` bor-u `pg_restore` yo'q muhitda zaxira olinaveradi,
 * lekin u kerak bo'lgan kuni ochilmaydi — ya'ni zaxira yo'q bilan barobar.
 */
function pgRestoreBormi() {
  return spawnSync("pg_restore", ["--version"], { encoding: "utf8" }).status === 0;
}

/**
 * Butun bazani `pg_dump` bilan suratga oladi.
 *
 * Format — `custom` (`-Fc`): u O'ZI siqilgan va `pg_restore` bilan tanlab
 * tiklanadi. Shuning uchun chaqiruvchi uni QAYTA gzip qilmaydi.
 *
 * @returns {{ bayt: Buffer, jadvallar: number }}
 */
async function suratOl(url = process.env.DATABASE_URL) {
  if (!pgDumpBormi()) {
    throw new Error(
      "pg_dump topilmadi. PostgreSQL zaxirasi shu vositaga tayanadi — " +
        "build muhitiga postgresql-client o'rnating (masalan `apt-get install -y postgresql-client`)."
    );
  }

  const res = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", url], {
    maxBuffer: 1024 * 1024 * 512,
    encoding: "buffer",
  });
  if (res.status !== 0) {
    throw new Error(`pg_dump yiqildi (kod ${res.status}): ${String(res.stderr).slice(0, 300)}`);
  }

  const c = await pgKlient(url);
  try {
    const jadvallar = (await ilovaJadvallari(c)).length;
    return { bayt: res.stdout, jadvallar };
  } finally {
    await c.end();
  }
}

/**
 * `pg_dump` suratini bazaga qaytaradi (`pg_restore`).
 *
 * `--clean --if-exists`: mavjud obyektlar avval o'chiriladi, ya'ni tiklash
 * to'la almashtirish bo'ladi (SQLite yo'lidagi `DELETE FROM` bilan bir xil
 * ma'no). `--single-transaction`: o'rtada uzilsa baza yarim holatda qolmaydi.
 */
function suratTikla(bayt, url = process.env.DATABASE_URL) {
  if (!pgRestoreBormi()) {
    throw new Error("pg_restore topilmadi — postgresql-client o'rnating.");
  }
  const res = spawnSync(
    "pg_restore",
    ["--clean", "--if-exists", "--no-owner", "--no-privileges", "--single-transaction", "--dbname", url],
    { input: bayt, maxBuffer: 1024 * 1024 * 512, encoding: "buffer" }
  );
  if (res.status !== 0) {
    throw new Error(`pg_restore yiqildi (kod ${res.status}): ${String(res.stderr).slice(0, 500)}`);
  }
}

// CommonJS eksportlari — ESM tomoni nomli eksportlarni shu ko'rinishda ishonchli aniqlaydi.
exports.HISOBOT_JADVAL = HISOBOT_JADVAL;
exports.pgKlient = pgKlient;
exports.migratsiyaRoyxati = migratsiyaRoyxati;
exports.ilovaJadvallari = ilovaJadvallari;
exports.hisobotSoni = hisobotSoni;
exports.kutayotganMigratsiyalar = kutayotganMigratsiyalar;
exports.pgDumpBormi = pgDumpBormi;
exports.pgRestoreBormi = pgRestoreBormi;
exports.suratOl = suratOl;
exports.suratTikla = suratTikla;
