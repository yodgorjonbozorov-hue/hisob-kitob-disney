/**
 * BAZA DIALEKTI (Faza 5.1) — SQLite va PostgreSQL farqlari.
 *
 * Farqlar ilgari to'rt joyga sochilgan edi. Provayder almashganda
 * ularning birortasini unutish jimgina noto'g'ri natija berardi:
 * `strftime` Postgres'da umuman yo'q (so'rov yiqiladi va bu darhol
 * ko'rinadi), lekin `COLLATE NOCASE` ni unutish sintaksis xatosi
 * BERMAYDI — qidiruv shunchaki registrga sezgir bo'lib qoladi va hech
 * kim sezmaydi. Shu bois dialekt bitta faylga yig'ildi va shu yerda
 * ikkala yo'l ham sinaladi.
 *
 * Test bazaga ULANMAYDI: faqat generatsiya qilingan SQL matni tekshiriladi.
 *
 * Ishga tushirish: npm run test:dialect
 */
process.env.DATABASE_URL = "file:./prisma/test-dialect.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

let isPostgres: any;
let qidiruvRejimi: any;
let sanaKalitSql: any;
let registrsizTeng: any;
let eskiUrl: string | undefined;

/** `Prisma.Sql` ni o'qish uchun tekis matnga aylantiradi. */
function matn(sql: any): string {
  return String(sql.strings ? sql.strings.join(" ? ") : sql.sql ?? sql);
}

/** Berilgan `DATABASE_URL` bilan funksiyani chaqiradi. */
function url<T>(u: string, fn: () => T): T {
  const oldingi = process.env.DATABASE_URL;
  process.env.DATABASE_URL = u;
  try {
    return fn();
  } finally {
    process.env.DATABASE_URL = oldingi;
  }
}

before(async () => {
  eskiUrl = process.env.DATABASE_URL;
  ({ isPostgres, qidiruvRejimi, sanaKalitSql, registrsizTeng } = await import(
    "@/lib/db/dialect"
  ));
});

after(() => {
  if (eskiUrl !== undefined) process.env.DATABASE_URL = eskiUrl;
});

// ---------- Provayderni aniqlash ----------

test("Postgres URL'lari to'g'ri aniqlanadi", () => {
  assert.equal(isPostgres("postgresql://u:p@host:5432/db"), true);
  assert.equal(isPostgres("postgres://u:p@host/db"), true);
  assert.equal(isPostgres("POSTGRESQL://u:p@host/db"), true, "registr muhim emas");
});

test("SQLite va Turso URL'lari Postgres deb hisoblanmaydi", () => {
  assert.equal(isPostgres("file:./prisma/dev.db"), false);
  assert.equal(isPostgres("libsql://baza.turso.io"), false);
  assert.equal(isPostgres(undefined), false, "URL yo'q — SQLite (build paytidagi holat)");
  assert.equal(isPostgres(""), false);
});

test("URL ichida 'postgres' so'zi bo'lgani yetarli emas", () => {
  // Turso bazasi "postgres-kochish" deb nomlangan bo'lsa ham SQLite qolishi kerak.
  assert.equal(isPostgres("libsql://postgres-kochish.turso.io"), false);
  assert.equal(isPostgres("file:./postgresql.db"), false);
});

// ---------- Qidiruv rejimi ----------

test("SQLite'da qidiruv rejimi BO'SH bo'ladi", () => {
  // Muhim: SQLite'da Prisma `mode: "insensitive"` ni qo'llab-quvvatlamaydi
  // va berilsa so'rov XATO beradi. Bo'sh obyekt spread qilinganda yo'qoladi.
  const rejim = url("file:./x.db", () => qidiruvRejimi());
  assert.deepEqual(rejim, {});
  assert.deepEqual({ contains: "a", ...rejim }, { contains: "a" });
});

test("Postgres'da qidiruv registrga befarq bo'ladi", () => {
  const rejim = url("postgresql://u:p@h/db", () => qidiruvRejimi());
  assert.deepEqual(rejim, { mode: "insensitive" });
});

// ---------- Sana kaliti ----------

test("SQLite'da sana kaliti strftime bilan, ikkala saqlash turini qo'llaydi", () => {
  const oy = matn(url("file:./x.db", () => sanaKalitSql('t."sana"', 7)));
  assert.match(oy, /strftime/, "SQLite yo'li strftime ishlatadi");
  assert.match(oy, /typeof/, "matn va INTEGER saqlash ikkalasi ham qo'llanishi kerak");
  assert.match(oy, /substr/);
});

test("Postgres'da sana kaliti to_char bilan, CASE'siz", () => {
  const oy = matn(url("postgresql://u:p@h/db", () => sanaKalitSql('t."sana"', 7)));
  assert.match(oy, /to_char/);
  assert.ok(!oy.includes("strftime"), "SQLite funksiyasi qolib ketmasligi kerak");
  assert.ok(!oy.includes("typeof"), "Postgres'da ikkilanish yo'q — CASE keraksiz");

  const kun = matn(url("postgresql://u:p@h/db", () => sanaKalitSql('t."sana"', 10)));
  assert.match(kun, /to_char/);
});

test("sana formati uzunlikka mos keladi", () => {
  // Format qiymati parametr sifatida uzatiladi, shuning uchun `values` dan olinadi.
  const oy: any = url("postgresql://u:p@h/db", () => sanaKalitSql('t."sana"', 7));
  const kun: any = url("postgresql://u:p@h/db", () => sanaKalitSql('t."sana"', 10));
  assert.ok(oy.values.includes("YYYY-MM"), `oy formati kutilgan: ${JSON.stringify(oy.values)}`);
  assert.ok(kun.values.includes("YYYY-MM-DD"), `kun formati kutilgan: ${JSON.stringify(kun.values)}`);
});

// ---------- Registrsiz taqqoslash ----------

test("SQLite'da COLLATE NOCASE, Postgres'da LOWER()", () => {
  const s = matn(url("file:./x.db", () => registrsizTeng('"login"', "+998901112233")));
  assert.match(s, /COLLATE NOCASE/);

  const p = matn(url("postgresql://u:p@h/db", () => registrsizTeng('"login"', "+998901112233")));
  assert.match(p, /LOWER/);
  assert.ok(!p.includes("COLLATE"), "SQLite sintaksisi Postgres yo'liga o'tib ketmasligi kerak");
});

test("qidirilayotgan qiymat SQL'ga yopishtirilmaydi (parametr bo'lib qoladi)", () => {
  // Inyeksiya himoyasi: qiymat `values` da bo'lishi, matnda bo'lmasligi kerak.
  const yomon = "' OR 1=1 --";
  for (const u of ["file:./x.db", "postgresql://u:p@h/db"]) {
    const sql: any = url(u, () => registrsizTeng('"login"', yomon));
    assert.ok(sql.values.includes(yomon), `${u}: qiymat parametr bo'lishi kerak`);
    assert.ok(!matn(sql).includes("OR 1=1"), `${u}: qiymat SQL matniga tushmasligi kerak`);
  }
});

// ---------- Postgres migratsiyasi ----------

test("Postgres boshlang'ich migratsiyasi mavjud va to'liq", () => {
  const yol = "prisma/migrations-postgres/00000000000000_init/migration.sql";
  assert.ok(existsSync(yol), `${yol} topilmadi — npm run pg:migratsiya`);

  const sql = readFileSync(yol, "utf8");
  const jadvallar = (sql.match(/CREATE TABLE/g) ?? []).length;

  // Sxemadagi model soni bilan solishtiramiz — yangi model qo'shilib
  // migratsiya qayta generatsiya qilinmasa, shu test ogohlantiradi.
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modellar = (schema.match(/^model\s+\w+\s*\{/gm) ?? []).length;
  assert.equal(
    jadvallar,
    modellar,
    `Postgres migratsiyasi eskirgan: sxemada ${modellar} model, migratsiyada ${jadvallar} jadval. ` +
      "`npm run pg:migratsiya` ishga tushiring."
  );

  // Login uchun funksional indeks — dialekt qatlamining Postgres yo'li shunga tayanadi.
  assert.match(sql, /CREATE INDEX "User_login_lower_idx" ON "User" \(LOWER\("login"\)\)/);
  // SQLite qoldiqlari bo'lmasligi kerak.
  assert.ok(!sql.includes("PRAGMA"), "Postgres SQL'ida PRAGMA bo'lmasligi kerak");
});
