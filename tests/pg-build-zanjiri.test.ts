/**
 * BUILD ZANJIRI POSTGRESQL'DA — REGRESSIYA TESTI (audit: P0-1).
 *
 * MUAMMO. `npm run build` zanjiridagi beshta skript libsql klientiga QOTIRIB
 * bog'langan edi va `DATABASE_URL` Postgres bo'lsa birinchi qadamdayoq
 * yiqilardi:
 *
 *   URL_SCHEME_NOT_SUPPORTED: The client supports only "libsql:", ... got "postgresql:"
 *
 * Ya'ni Postgres'ga birinchi deploy build bosqichida to'xtardi. Bu test
 * o'sha yo'lni HAQIQIY PostgreSQL bilan yuritadi.
 *
 * Ishga tushirish:
 *   PG_TEST_URL="postgresql://postgres@127.0.0.1:5432/balansa_test" \
 *     npm run test:pg-build
 *
 * `PG_TEST_URL` berilmasa baza talab qiladigan testlar O'TKAZIB YUBORILADI
 * (`tests/postgres.test.ts` bilan bir xil qoida) — manba tekshiruvlari esa
 * har doim ishlaydi, chunki ularga baza kerak emas.
 *
 * ⚠️ Ko'rsatilgan baza TO'LIQ TOZALANADI (`DROP SCHEMA public CASCADE`).
 * Faqat sinov bazasini bering. PRODUCTION bazaga hech qachon yozilmaydi.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { randomBytes } from "node:crypto";
import { readFileSync, existsSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client as PgClient } from "pg";

const PG = process.env.PG_TEST_URL;
const sabab = PG ? undefined : "PG_TEST_URL sozlanmagan — Postgres testlari o'tkazib yuborildi";

const PG_MIGRATSIYA = "prisma/migrations-postgres/00000000000000_init/migration.sql";
const KALIT = randomBytes(32).toString("hex");

let c: PgClient;
let pgSurat: typeof import("../scripts/lib/pg-surat.cjs");
let shifr: typeof import("../src/lib/backup/shifr-asos.cjs");

/** Soxta Telegram: kelgan hujjatni ushlab qoladi. */
class SoxtaTelegram {
  server!: Server;
  port = 0;
  qabullar: { nom: string; bayt: Buffer; izoh: string }[] = [];

  async boshla() {
    this.server = createServer((req, res) => {
      const bolaklar: Buffer[] = [];
      req.on("data", (b) => bolaklar.push(b));
      req.on("end", () => {
        const chegara = /boundary=(.+)$/.exec(req.headers["content-type"] ?? "")?.[1] ?? "";
        this.qabullar.push(ajrat(Buffer.concat(bolaklar), chegara));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    this.port = (this.server.address() as { port: number }).port;
  }

  manzil() {
    return `http://127.0.0.1:${this.port}`;
  }

  toxtat() {
    this.server?.close();
  }
}

/** multipart/form-data ni eng zarur qismlarga ajratadi. */
function ajrat(tana: Buffer, chegara: string) {
  const ajratgich = Buffer.from(`--${chegara}`);
  const bolaklar: Buffer[] = [];
  let joy = tana.indexOf(ajratgich);
  while (joy >= 0) {
    const keyingi = tana.indexOf(ajratgich, joy + ajratgich.length);
    if (keyingi < 0) break;
    bolaklar.push(tana.subarray(joy + ajratgich.length + 2, keyingi - 2));
    joy = keyingi;
  }

  let nom = "";
  let izoh = "";
  let bayt: Buffer = Buffer.alloc(0);
  for (const bolak of bolaklar) {
    const bosh = bolak.indexOf("\r\n\r\n");
    if (bosh < 0) continue;
    const sarlavha = bolak.subarray(0, bosh).toString("utf8");
    const tanasi = bolak.subarray(bosh + 4);
    if (sarlavha.includes('name="document"')) {
      nom = /filename="([^"]+)"/.exec(sarlavha)?.[1] ?? "";
      bayt = tanasi;
    } else if (sarlavha.includes('name="caption"')) {
      izoh = tanasi.toString("utf8");
    }
  }
  return { nom, izoh, bayt };
}

/** `deploy-zaxira.mjs` ni berilgan env bilan ishga tushiradi (asinxron — server shu jarayonda). */
function ishga(skript: string, env: Record<string, string | undefined>) {
  const bola = spawn(process.execPath, [`scripts/${skript}`], {
    env: {
      ...process.env,
      BACKUP_CHAT_ID: "",
      BACKUP_BOT_TOKEN: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_API_BASE: "",
      ZAXIRASIZ_DAVOM: "",
      BACKUP_ENCRYPTION_KEY: "",
      ...env,
    },
  });
  let stdout = "";
  let stderr = "";
  bola.stdout.on("data", (d) => (stdout += String(d)));
  bola.stderr.on("data", (d) => (stderr += String(d)));
  return new Promise<{ status: number | null; stdout: string; stderr: string }>((r) =>
    bola.on("close", (status) => r({ status, stdout, stderr }))
  );
}

/** Bo'sh sxema + Balansa jadvallari. */
async function sxemaQur() {
  await c.query("DROP SCHEMA IF EXISTS public CASCADE");
  await c.query("CREATE SCHEMA public");
  await c.query(readFileSync(PG_MIGRATSIYA, "utf8"));
}

/** Prisma migratsiya hisobotini yaratib, bitta migratsiyani "qo'llangan" deb belgilaydi. */
async function hisobotQur(qollangan: string[]) {
  await c.query(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      id varchar(36) PRIMARY KEY,
      checksum varchar(64) NOT NULL,
      finished_at timestamptz,
      migration_name varchar(255) NOT NULL,
      logs text,
      rolled_back_at timestamptz,
      started_at timestamptz NOT NULL DEFAULT now(),
      applied_steps_count integer NOT NULL DEFAULT 0
    )`);
  await c.query(`DELETE FROM "_prisma_migrations"`);
  for (const nom of qollangan) {
    await c.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name)
       VALUES (gen_random_uuid()::text, 'x', now(), $1)`,
      [nom]
    );
  }
}

const telegram = new SoxtaTelegram();

before(async () => {
  pgSurat = await import("../scripts/lib/pg-surat.cjs");
  shifr = await import("../src/lib/backup/shifr-asos.cjs");
  if (!PG) return;

  const { Client } = await import("pg");
  c = new Client({ connectionString: PG });
  await c.connect();
  await telegram.boshla();
});

after(async () => {
  telegram.toxtat();
  if (c) await c.end();
});

// ───────────── Manba tekshiruvlari (bazasiz ham ishlaydi) ─────────────

test("build zanjiridagi skriptlar libsql klientini QOTIRIB qurmaydi", () => {
  // Aynan shu qotirilgan ulanish butun Postgres deploy'ini to'xtatib qo'ygan edi.
  const zanjir = [
    "scripts/deploy-zaxira.mjs",
    "scripts/db-migrate.mjs",
    "scripts/bootstrap-superadmin.mjs",
    "scripts/bir-martalik-parol.mjs",
  ];

  for (const yol of zanjir) {
    const kod = readFileSync(yol, "utf8");
    // `db-migrate.mjs` da libsql import bor, lekin u FAQAT SQLite shoxida
    // ishlatiladi — shuning uchun tekshiruv "provayder tekshirilganmi"
    // bo'yicha, importning o'zi bo'yicha emas.
    if (/createClient\(|PrismaLibSQL/.test(kod)) {
      assert.match(
        kod,
        /isPostgres/,
        `${yol}: libsql klienti quriladi, lekin provayder tekshirilmaydi — ` +
          "Postgres URL bilan bu skript butun build zanjirini to'xtatadi"
      );
    }
  }
});

test("provayder aniqlash YAGONA manbadan olinadi", () => {
  // Ikki nusxa bo'lsa bir kun ajralib ketadi: ilova Postgres'ga ulanadi,
  // deploy skripti esa SQLite deb o'ylab yiqiladi.
  assert.ok(existsSync("src/lib/db/provider.cjs"));
  assert.match(
    readFileSync("src/lib/db/dialect.ts", "utf8"),
    /from "\.\/provider\.cjs"/,
    "dialect.ts provayder qoidasini o'zi takrorlamasligi kerak"
  );
  for (const yol of ["scripts/deploy-zaxira.mjs", "scripts/db-migrate.mjs", "scripts/xom-zaxira.mjs"]) {
    assert.match(readFileSync(yol, "utf8"), /db\/provider\.cjs/, `${yol} yagona manbadan olishi kerak`);
  }
});

test("db-migrate: Postgres URL + sqlite sxema — aniq xato, baza tegilmaydi", async () => {
  // Yarim bajarilgan ko'chish: URL almashgan, sxema esa yo'q. Bu holatda
  // SQLite migratsiyalarini Postgres'ga qo'llash — eng yomon variant.
  const res = await ishga("db-migrate.mjs", {
    DATABASE_URL: "postgresql://foydalanuvchi:parol@127.0.0.1:1/yoq",
  });
  assert.equal(res.status, 1, "yarim ko'chishda to'xtashi kerak");
  assert.match(res.stderr, /provider = "sqlite"/);
  assert.match(res.stderr, /Baza O'ZGARTIRILMADI/);
  assert.match(res.stderr, /POSTGRES-KOCHISH\.md/, "yechim ko'rsatilishi kerak");
});

// ───────────── Postgres qatlami ─────────────

test("pg-surat: jadval, hisobot va kutayotgan migratsiyalarni to'g'ri ko'radi", { skip: sabab }, async () => {
  await sxemaQur();

  const jadvallar = await pgSurat.ilovaJadvallari(c);
  assert.ok(jadvallar.length >= 40, `ilova jadvallari topilishi kerak (topildi: ${jadvallar.length})`);
  assert.ok(!jadvallar.includes("_prisma_migrations"), "xizmat jadvali hisobga olinmasin");

  // Hisobot jadvali umuman yo'q — HAMMASI kutayotgan deb qaraladi (ehtiyotkor).
  assert.equal(await pgSurat.hisobotSoni(c), 0);
  const hammasi = pgSurat.migratsiyaRoyxati();
  assert.deepEqual(await pgSurat.kutayotganMigratsiyalar(c), hammasi);

  // Bittasi qo'llangan deb belgilansa — qolgani kutayotgan bo'ladi.
  await hisobotQur([hammasi[0]]);
  assert.equal(await pgSurat.hisobotSoni(c), 1);
  assert.deepEqual(await pgSurat.kutayotganMigratsiyalar(c), hammasi.slice(1));
});

test("pg_dump -> pg_restore aylanma yo'li ma'lumotni saqlaydi", { skip: sabab }, async () => {
  await sxemaQur();
  await c.query(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","createdAt","updatedAt")
     VALUES ('T1','Alfa','alfa','ACTIVE','PRO',now(),now())`
  );

  const { bayt, jadvallar } = await pgSurat.suratOl(PG);
  assert.ok(jadvallar >= 40);
  assert.equal(bayt.subarray(0, 5).toString("ascii"), "PGDMP", "pg_dump custom formati bo'lishi kerak");

  // Ma'lumotni buzamiz, keyin suratdan tiklaymiz.
  await c.query(`DELETE FROM "Tenant"`);
  assert.equal((await c.query(`SELECT COUNT(*) n FROM "Tenant"`)).rows[0].n, "0");

  pgSurat.suratTikla(bayt, PG);
  const keyin = await c.query<{ name: string }>(`SELECT name FROM "Tenant"`);
  assert.equal(keyin.rows.length, 1);
  assert.equal(keyin.rows[0].name, "Alfa");
});

// ───────────── deploy-zaxira.mjs — Postgres yo'li ─────────────

test("deploy-zaxira: bo'sh Postgres bazasi — zaxira talab qilinmaydi", { skip: sabab }, async () => {
  await c.query("DROP SCHEMA IF EXISTS public CASCADE");
  await c.query("CREATE SCHEMA public");

  const oldin = telegram.qabullar.length;
  const res = await ishga("deploy-zaxira.mjs", { DATABASE_URL: PG, TELEGRAM_API_BASE: telegram.manzil() });

  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Baza bo'sh/);
  assert.equal(telegram.qabullar.length, oldin);
});

test("deploy-zaxira: hisobot bazaga mos kelmasa TO'XTAYDI", { skip: sabab }, async () => {
  // Jadvallar bor, `_prisma_migrations` bo'sh — yarim qurilgan baza.
  await sxemaQur();

  const res = await ishga("deploy-zaxira.mjs", { DATABASE_URL: PG });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /hisoboti baza holatiga mos kelmaydi/);
});

test("deploy-zaxira: kalitsiz Postgres zaxirasi YUBORILMAYDI (fail-closed)", { skip: sabab }, async () => {
  await sxemaQur();
  await hisobotQur([pgSurat.migratsiyaRoyxati()[0]]);

  const oldin = telegram.qabullar.length;
  const res = await ishga("deploy-zaxira.mjs", {
    DATABASE_URL: PG,
    BACKUP_CHAT_ID: "-100123",
    BACKUP_BOT_TOKEN: "sinov-token",
    TELEGRAM_API_BASE: telegram.manzil(),
    // BACKUP_ENCRYPTION_KEY ataylab bo'sh
  });

  assert.notEqual(res.status, 0, "kalitsiz davom etmasligi kerak");
  assert.match(res.stderr, /shifrlab bo'lmaydi/i);
  assert.equal(telegram.qabullar.length, oldin, "hech narsa yuborilmasligi kerak");
});

test("deploy-zaxira: Postgres zaxirasi SHIFRLANGAN holda Telegramga ketadi", { skip: sabab }, async () => {
  await sxemaQur();
  await c.query(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","createdAt","updatedAt")
     VALUES ('T9','Maxfiy Kompaniya','maxfiy','ACTIVE','PRO',now(),now())`
  );
  await hisobotQur([pgSurat.migratsiyaRoyxati()[0]]);

  const oldin = telegram.qabullar.length;
  const res = await ishga("deploy-zaxira.mjs", {
    DATABASE_URL: PG,
    BACKUP_CHAT_ID: "-100123",
    BACKUP_BOT_TOKEN: "sinov-token",
    TELEGRAM_API_BASE: telegram.manzil(),
    BACKUP_ENCRYPTION_KEY: KALIT,
  });

  assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  assert.equal(telegram.qabullar.length, oldin + 1, "zaxira yuborilishi kerak");

  const kelgan = telegram.qabullar[telegram.qabullar.length - 1];
  assert.match(kelgan.nom, /^balansa-migratsiya-oldidan-\d{4}-\d{2}-\d{2}\.dump\.enc$/);
  assert.match(kelgan.izoh, /Baza: PostgreSQL/);

  // Ochiq ma'lumot chiqmasligi kerak.
  assert.ok(shifr.shifrlanganmi(kelgan.bayt), "fayl shifrlangan bo'lishi kerak");
  assert.ok(
    !kelgan.bayt.toString("latin1").includes("Maxfiy Kompaniya"),
    "tenant nomi ochiq ko'rinmasligi kerak"
  );

  // Kalit bilan ochilganda haqiqiy pg_dump chiqadi va u TIKLANADI.
  process.env.BACKUP_ENCRYPTION_KEY = KALIT;
  const ochilgan = shifr.deshifrla(kelgan.bayt);
  assert.equal(ochilgan.subarray(0, 5).toString("ascii"), "PGDMP");

  await c.query(`DELETE FROM "Tenant"`);
  pgSurat.suratTikla(ochilgan, PG);
  const tiklangan = await c.query<{ name: string }>(`SELECT name FROM "Tenant"`);
  assert.equal(tiklangan.rows[0]?.name, "Maxfiy Kompaniya", "kanaldagi zaxira tiklanadigan bo'lishi kerak");
});

// ───────────── SQLite yo'li buzilmagani ─────────────

test("SQLite yo'li avvalgidek: xom surat olinadi va tiklanadi", () => {
  const papka = mkdtempSync(join(tmpdir(), "sq-zanjir-"));
  const db = join(papka, "sinov.db");
  const fayl = join(papka, "surat.json");
  const env = { ...process.env, DATABASE_URL: `file:${db}`, BACKUP_ENCRYPTION_KEY: "" };

  try {
    const migrate = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env, encoding: "utf8" });
    assert.equal(migrate.status, 0, migrate.stderr);
    assert.match(migrate.stdout, /Migratsiya tugadi/);

    const ol = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", fayl], { env, encoding: "utf8" });
    assert.equal(ol.status, 0, ol.stderr);
    assert.match(ol.stdout, /Xom surat tayyor/);

    const tikla = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", "--tikla", fayl], {
      env,
      encoding: "utf8",
    });
    assert.equal(tikla.status, 0, tikla.stderr);
    assert.match(tikla.stdout, /tashqi kalitlar toza/);
  } finally {
    rmSync(papka, { recursive: true, force: true });
  }
});
