/**
 * MIGRATSIYA VA TIKLASH XAVFSIZLIGI — REGRESSIYA TESTI (audit: P0-2).
 *
 * P0-1 build zanjirini Postgres'da ISHLAYDIGAN qildi. Bu test esa o'sha
 * zanjirning XATO holatlarda ma'lumot yo'qotmasligini qo'riqlaydi —
 * auditda topilgan uchta real xavf bo'yicha:
 *
 *   1. TESKARI YO'NALISH. Sxema Postgres'ga o'tkazilgan, `DATABASE_URL` esa
 *      hali SQLite. Qo'riqchisiz `db-migrate.mjs` Postgres SQL'ini libsql
 *      orqali qo'llashga urinardi va YARIM QO'LLARDI: o'lchandi — 47 jadval
 *      yaratilib, keyin `near "CONSTRAINT": syntax error` bilan to'xtardi,
 *      hisobotga esa hech narsa yozilmasdi.
 *
 *   2. PRISMA VERSIYASI TASODIFGA QOLGAN. `npx prisma` mahalliy paketni
 *      topolmasa internetdan eng so'nggisini tortadi — o'lchandi: Prisma 7.x
 *      tushib, 5.x sxemasini rad etdi. Migratsiya qo'llaydigan vosita
 *      versiyasi aniq bo'lishi kerak.
 *
 *   3. TASDIQSIZ TIKLASH. `zaxira:xom -- --tikla` maqsad bazani BUTUNLAY
 *      almashtiradi, lekin `restore.ts` dagi `--confirm` kabi himoyasi
 *      yo'q edi: noto'g'ri env bilan bitta chaqiruv production'ni zaxira
 *      nusxasi bilan almashtirib yuborardi.
 *
 * Ishga tushirish:
 *   PG_TEST_URL="postgresql://postgres@127.0.0.1:5432/balansa_test" \
 *     npm run test:pg-xavfsizlik
 *
 * `PG_TEST_URL` berilmasa bazaga tegadigan testlar o'tkazib yuboriladi.
 * ⚠️ Ko'rsatilgan baza TO'LIQ TOZALANADI. PRODUCTION bazani BERMANG.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client as PgClient } from "pg";

const PG = process.env.PG_TEST_URL;
const sabab = PG ? undefined : "PG_TEST_URL sozlanmagan — Postgres testlari o'tkazib yuborildi";

const ILDIZ = process.cwd();
const PG_MIGRATSIYA = "prisma/migrations-postgres/00000000000000_init/migration.sql";
const KALIT = randomBytes(32).toString("hex");

let c: PgClient;
let pgSurat: typeof import("../scripts/lib/pg-surat.cjs");
let shifr: typeof import("../src/lib/backup/shifr-asos.cjs");

/**
 * POSTGRES holatidagi vaqtinchalik loyiha nusxasi.
 *
 * Repodagi sxema SQLite holatida QOLADI (ko'chish hali qilinmagan) —
 * shuning uchun "sxema Postgres'ga o'tkazilgan" holat alohida papkada
 * qayta tiklanadi va skript o'sha papkadan turib ishga tushiriladi.
 */
function pgLoyihaQur(opts: { nodeModules: boolean }) {
  const papka = mkdtempSync(join(tmpdir(), "pg-xavfsizlik-"));
  mkdirSync(join(papka, "prisma"), { recursive: true });
  writeFileSync(
    join(papka, "prisma/schema.prisma"),
    readFileSync(join(ILDIZ, "prisma/schema.prisma"), "utf8").replace(
      'provider = "sqlite"',
      'provider = "postgresql"'
    )
  );
  cpSync(join(ILDIZ, "prisma/migrations-postgres"), join(papka, "prisma/migrations"), {
    recursive: true,
  });
  cpSync(join(ILDIZ, "package.json"), join(papka, "package.json"));
  if (opts.nodeModules) {
    // Mahalliy Prisma CLI ko'rinishi uchun (symlink — nusxa emas).
    spawnSync("ln", ["-sfn", join(ILDIZ, "node_modules"), join(papka, "node_modules")]);
  }
  return papka;
}

/**
 * `db-migrate.mjs` ni berilgan papkadan turib ishga tushiradi.
 *
 * P0-3 DAN KEYIN: Postgres'da bazaga YOZADIGAN yo'l `MIGRATSIYA_RUXSAT=ha`
 * bayrog'i ostida turadi (busiz skript faqat kutayotganlarni O'QIYDI va
 * deploy'ni to'xtatadi). Shu bois yozishni kutadigan testlar bayroqni
 * OSHKORA beradi — qaysi rejim sinalayotgani test matnidan ko'rinib tursin.
 */
function migratsiya(cwd: string, env: Record<string, string | undefined>) {
  return spawnSync(process.execPath, [join(ILDIZ, "scripts/db-migrate.mjs")], {
    cwd,
    env: { ...process.env, MIGRATSIYA_RUXSAT: "", ...env },
    encoding: "utf8",
  });
}

before(async () => {
  pgSurat = await import("../scripts/lib/pg-surat.cjs");
  shifr = await import("../src/lib/backup/shifr-asos.cjs");
  if (!PG) return;
  const { Client } = await import("pg");
  c = new Client({ connectionString: PG });
  await c.connect();
});

after(async () => {
  if (c) await c.end();
});

// ───────────── 1. Teskari yo'nalish: PG sxema + SQLite URL ─────────────

test("PG sxema + SQLite URL: migratsiya BOSHLANMAYDI, baza yaratilmaydi", () => {
  const papka = pgLoyihaQur({ nodeModules: false });
  const db = join(papka, "yarim.db");

  try {
    const res = migratsiya(papka, { DATABASE_URL: `file:${db}` });

    assert.equal(res.status, 1, "yarim ko'chishda to'xtashi kerak");
    assert.match(res.stderr, /PostgreSQL uchun sozlangan/);
    assert.match(res.stderr, /YARIM qo'llanadi/, "sabab tushuntirilishi kerak");
    assert.match(res.stderr, /Baza O'ZGARTIRILMADI/);
    // Eng muhimi: bazaga UMUMAN tegilmagan.
    assert.ok(!existsSync(db), "baza fayli yaratilmasligi kerak");
  } finally {
    rmSync(papka, { recursive: true, force: true });
  }
});

test("SQLite sxema + PG URL: avvalgi qo'riqchi ham joyida (P0-1)", () => {
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: "postgresql://foydalanuvchi:parol@127.0.0.1:1/yoq" },
    encoding: "utf8",
  });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /provider = "sqlite"/);
  assert.match(res.stderr, /Baza O'ZGARTIRILMADI/);
});

// ───────────── 2. Prisma CLI versiyasi tasodifga qolmaydi ─────────────

test("mahalliy Prisma CLI bo'lmasa migratsiya BOSHLANMAYDI", () => {
  // `npx prisma` internetdan boshqa (mos kelmaydigan) versiyani tortib
  // kelishi mumkin — bunday vosita bilan migratsiya qo'llash xavfli.
  const papka = pgLoyihaQur({ nodeModules: false });

  try {
    const res = migratsiya(papka, {
      DATABASE_URL: "postgresql://x:y@127.0.0.1:1/yoq",
      MIGRATSIYA_RUXSAT: "ha",
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /Prisma CLI topilmadi/);
    assert.match(res.stderr, /Baza O'ZGARTIRILMADI/);
  } finally {
    rmSync(papka, { recursive: true, force: true });
  }
});

test("db-migrate mahalliy binarni ishlatadi (npx orqali tortmaydi)", () => {
  const kod = readFileSync("scripts/db-migrate.mjs", "utf8");
  assert.match(kod, /node_modules", "\.bin", "prisma"/, "mahalliy binar yo'li bo'lishi kerak");
  assert.ok(
    !/spawnSync\("npx"/.test(kod),
    "npx orqali chaqirilsa versiya tasodifga qoladi (Prisma 7.x tushib qolgan edi)"
  );
});

// ───────────── 3. Tasdiqsiz tiklash ─────────────

test("UZOQDAGI bazaga tasdiqsiz tiklash RAD etiladi", () => {
  const res = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", "--tikla", "yoq.dump"], {
    env: { ...process.env, DATABASE_URL: "postgresql://admin:MAXFIY@db.example.com:5432/prod" },
    encoding: "utf8",
  });

  assert.equal(res.status, 1, "tasdiqsiz tiklash bajarilmasligi kerak");
  assert.match(res.stderr, /tasdiqsiz bajarilmaydi/);
  assert.match(res.stderr, /Baza O'ZGARTIRILMADI/);
  // Parol xato matnida ochiq turmasin.
  assert.ok(!res.stderr.includes("MAXFIY"), "parol log'ga chiqmasligi kerak");
  assert.match(res.stderr, /:\/\/\*\*\*@/, "ulanish satri maskalanishi kerak");
});

test("uzoqdagi Turso bazasi ham tasdiq talab qiladi", () => {
  const res = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", "--tikla", "yoq.json"], {
    env: { ...process.env, DATABASE_URL: "libsql://balansa-prod.turso.io" },
    encoding: "utf8",
  });
  assert.equal(res.status, 1);
  assert.match(res.stderr, /tasdiqsiz bajarilmaydi/);
});

test("LOKAL file: bazada tasdiq so'ralmaydi (kundalik ish sekinlashmasin)", () => {
  const papka = mkdtempSync(join(tmpdir(), "lok-tikla-"));
  const db = `file:${join(papka, "lok.db")}`;
  const fayl = join(papka, "surat.json");

  try {
    assert.equal(
      spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
        env: { ...process.env, DATABASE_URL: db },
        encoding: "utf8",
      }).status,
      0
    );
    assert.equal(
      spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", fayl], {
        env: { ...process.env, DATABASE_URL: db },
        encoding: "utf8",
      }).status,
      0
    );

    const res = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", "--tikla", fayl], {
      env: { ...process.env, DATABASE_URL: db },
      encoding: "utf8",
    });
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /Tiklandi/);
  } finally {
    rmSync(papka, { recursive: true, force: true });
  }
});

// ───────────── 4. Haqiqiy Postgres: migratsiya va tiklash ─────────────

test("PG -> PG normal migratsiya ishlaydi", { skip: sabab }, async () => {
  await c.query("DROP SCHEMA IF EXISTS public CASCADE");
  await c.query("CREATE SCHEMA public");

  const papka = pgLoyihaQur({ nodeModules: true });
  try {
    const res = migratsiya(papka, { DATABASE_URL: PG, MIGRATSIYA_RUXSAT: "ha" });
    assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, /Migratsiya tugadi/);

    const n = await c.query<{ n: string }>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema='public'"
    );
    assert.ok(Number(n.rows[0].n) > 40, "sxema qurilishi kerak");
  } finally {
    rmSync(papka, { recursive: true, force: true });
  }
});

test("buzuq migratsiya: FALSE SUCCESS yo'q va baza yarim qolmaydi", { skip: sabab }, async () => {
  await c.query("DROP SCHEMA IF EXISTS public CASCADE");
  await c.query("CREATE SCHEMA public");

  const papka = pgLoyihaQur({ nodeModules: true });
  try {
    assert.equal(migratsiya(papka, { DATABASE_URL: PG, MIGRATSIYA_RUXSAT: "ha" }).status, 0);

    // Ataylab buzuq migratsiya qo'shamiz.
    const buzuq = join(papka, "prisma/migrations/00000000000001_buzuq");
    mkdirSync(buzuq, { recursive: true });
    writeFileSync(
      join(buzuq, "migration.sql"),
      'CREATE TABLE "Yangi" ("id" TEXT NOT NULL);\nBU SQL EMAS;\n'
    );

    const res = migratsiya(papka, { DATABASE_URL: PG, MIGRATSIYA_RUXSAT: "ha" });
    assert.equal(res.status, 1, "yiqilgan migratsiya muvaffaqiyat deb ko'rsatilmasligi kerak");

    // Postgres migratsiyani TRANZAKSIYADA qo'llaydi — yarim qolmaydi.
    const yangi = await c.query<{ n: string }>(
      "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema='public' AND table_name='Yangi'"
    );
    assert.equal(Number(yangi.rows[0].n), 0, "yiqilgan migratsiya orqaga qaytarilishi kerak");

    // Hisobotda "tugallanmagan" bo'lib qoladi — keyingi urinishlar to'xtaydi.
    const hisobot = await c.query<{ migration_name: string; finished_at: Date | null }>(
      `SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at`
    );
    const oxirgi = hisobot.rows[hisobot.rows.length - 1];
    assert.equal(oxirgi.migration_name, "00000000000001_buzuq");
    assert.equal(oxirgi.finished_at, null, "yiqilgani 'tugallangan' deb belgilanmasligi kerak");
  } finally {
    rmSync(papka, { recursive: true, force: true });
  }
});

test("buzilgan surat: tiklash YIQILADI va baza o'zgarmaydi", { skip: sabab }, async () => {
  await c.query("DROP SCHEMA IF EXISTS public CASCADE");
  await c.query("CREATE SCHEMA public");
  await c.query(readFileSync(PG_MIGRATSIYA, "utf8"));
  await c.query(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","createdAt","updatedAt")
     VALUES ('T1','Alfa','alfa','ACTIVE','PRO',now(),now())`
  );

  const { bayt } = await pgSurat.suratOl(PG);
  const papka = mkdtempSync(join(tmpdir(), "buzuq-surat-"));
  const yol = join(papka, "buzuq.dump");

  try {
    // Yarim kesilgan surat — eng tipik buzilish.
    writeFileSync(yol, bayt.subarray(0, Math.floor(bayt.length / 3)));

    const res = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", "--tikla", yol, "--tasdiq"], {
      env: { ...process.env, DATABASE_URL: PG },
      encoding: "utf8",
    });
    assert.equal(res.status, 1, "buzilgan suratdan tiklash muvaffaqiyat bo'lmasligi kerak");
    assert.match(res.stderr, /pg_restore yiqildi/);

    // `--single-transaction` tufayli baza o'z holicha qoladi.
    const tenant = await c.query<{ name: string }>(`SELECT name FROM "Tenant"`);
    assert.equal(tenant.rows.length, 1, "buzilgan tiklash ma'lumotni yo'qotmasligi kerak");
    assert.equal(tenant.rows[0].name, "Alfa");
  } finally {
    rmSync(papka, { recursive: true, force: true });
  }
});

test("shifrlangan surat o'zgartirilsa tiklash YIQILADI", { skip: sabab }, async () => {
  process.env.BACKUP_ENCRYPTION_KEY = KALIT;
  const { bayt } = await pgSurat.suratOl(PG);
  const shifrlangan = shifr.shifrla(bayt);
  shifrlangan[shifrlangan.length - 1] ^= 0xff;

  const papka = mkdtempSync(join(tmpdir(), "shifr-buzuq-"));
  const yol = join(papka, "buzuq.dump.enc");

  try {
    writeFileSync(yol, shifrlangan);
    const res = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", "--tikla", yol, "--tasdiq"], {
      env: { ...process.env, DATABASE_URL: PG, BACKUP_ENCRYPTION_KEY: KALIT },
      encoding: "utf8",
    });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /GCM butunlik tekshiruvi/);
  } finally {
    rmSync(papka, { recursive: true, force: true });
    delete process.env.BACKUP_ENCRYPTION_KEY;
  }
});
