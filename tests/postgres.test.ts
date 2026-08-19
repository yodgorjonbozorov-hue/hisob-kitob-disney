/**
 * POSTGRESQL MOSLIGI — Faza 5.1 ning sinalmagan qismi.
 *
 * Loyiha SQLite/Turso'da ishlaydi, Postgres yo'li esa KOD ICHIDA tayyor
 * turibdi (`src/lib/db/dialect.ts`, `prisma/migrations-postgres/`). Ya'ni
 * o'sha kod hech qachon BAJARILMAGAN: `to_char` noto'g'ri yozilgan bo'lsa
 * yoki generatsiya qilingan sxema Postgres'da qo'llanmasa, bu faqat
 * ko'chish kunida, production ma'lumoti bilan ma'lum bo'lardi.
 *
 * Shu bois bu yerda haqiqiy PostgreSQL bazasi ishlatiladi:
 *
 *   PG_TEST_URL="postgresql://postgres@127.0.0.1:5432/balansa_test" \
 *     npm run test:postgres
 *
 * `PG_TEST_URL` berilmasa baza talab qiladigan testlar O'TKAZIB YUBORILADI —
 * Postgres yo'q mashinada ham to'plam yashil qoladi. Sxema eskirmaganini
 * tekshiradigan test esa HAR DOIM ishlaydi, chunki unga baza kerak emas.
 *
 * ⚠️ Ko'rsatilgan baza TO'LIQ TOZALANADI (`DROP SCHEMA public CASCADE`).
 * Faqat sinov bazasini bering.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Client as PgClient } from "pg";

const MIGRATSIYA = "prisma/migrations-postgres/00000000000000_init/migration.sql";

const PG = process.env.PG_TEST_URL;
const sabab = PG ? undefined : "PG_TEST_URL sozlanmagan — Postgres testlari o'tkazib yuborildi";

// Dialekt funksiyalari provayderni `DATABASE_URL` dan aniqlaydi. Ular
// import paytida emas, chaqirilganda o'qiydi, shuning uchun shu yerda
// o'rnatish yetarli — lekin dialekt import qilinishidan OLDIN.
process.env.DATABASE_URL = PG ?? "postgresql://sinov:sinov@127.0.0.1:5432/sinov";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sanaKalitSql, registrsizTeng, isPostgres, qidiruvRejimi } =
  require("../src/lib/db/dialect") as typeof import("../src/lib/db/dialect");

let c: PgClient;

/** `Prisma.Sql` ni `pg` tushunadigan ko'rinishga o'tkazadi ($1, $2, ...). */
function pgSorov(sql: { text: string; values: unknown[] }) {
  return { text: sql.text, values: sql.values };
}

const iso = (s: string) => new Date(s).toISOString();

before(async () => {
  if (!PG) return;

  const { Client } = await import("pg");
  c = new Client({ connectionString: PG });
  await c.connect();

  await c.query("DROP SCHEMA IF EXISTS public CASCADE");
  await c.query("CREATE SCHEMA public");
  await c.query(readFileSync(MIGRATSIYA, "utf8"));

  await c.query(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","createdAt","updatedAt")
     VALUES ('T1','Alfa','alfa','ACTIVE','PRO',$1,$1)`,
    [iso("2026-07-01")]
  );
  await c.query(
    `INSERT INTO "Business" ("id","nomi","isActive","omborli","turi","createdAt","tenantId")
     VALUES ('B1','Alfa dokon',true,true,'umumiy',$1,'T1')`,
    [iso("2026-07-01")]
  );
  await c.query(
    `INSERT INTO "User" ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId")
     VALUES ('U1','Egasi','+998901000001','h','OWNER',true,$1,false,'T1'),
            ('U2','Kassir','Aziz.Karimov','h','KASSIR',true,$1,false,'T1')`,
    [iso("2026-07-01")]
  );
  await c.query(
    `INSERT INTO "Category" ("id","nomi","turi","tartib","isActive","createdAt","businessId")
     VALUES ('C1','Sotuv','kirim',0,true,$1,'B1')`,
    [iso("2026-07-01")]
  );

  // Ikki oy, uch kun — sana kaliti guruhlashini tekshirish uchun.
  const sanalar = [
    ["TX1", "2026-07-10T09:00:00Z", 100_000],
    ["TX2", "2026-07-10T18:30:00Z", 200_000],
    ["TX3", "2026-07-11T07:15:00Z", 300_000],
    ["TX4", "2026-08-01T00:00:00Z", 400_000],
  ] as const;
  for (const [id, sana, summa] of sanalar) {
    await c.query(
      `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","summa","sana","userId","createdAt")
       VALUES ($1,'kirim','C1','B1',$2,$3,'U1',$3)`,
      [id, summa, sana]
    );
  }
});

after(async () => {
  if (c) await c.end();
});

// ---------- Bazasiz tekshiruv ----------

test("Postgres migratsiyasi sxemadan orqada qolmagan", () => {
  // `prisma/migrations-postgres/` ishlatilmayotgani uchun u jimgina eskiradi:
  // sxemaga yangi model qo'shilsa, bu fayl o'zi yangilanmaydi va ko'chish
  // kuni yarim sxema chiqadi. Shuning uchun qayta generatsiya qilib
  // solishtiramiz — vaqtinchalik faylga, asl faylga tegmasdan.
  const papka = mkdtempSync(join(tmpdir(), "pg-sxema-"));
  const vaqtinchalik = join(papka, "migration.sql");

  try {
    const res = spawnSync(process.execPath, ["scripts/pg-migratsiya.mjs", "--chiqish", vaqtinchalik], {
      encoding: "utf8",
    });
    assert.equal(res.status, 0, `generatsiya yiqildi:\n${res.stdout}\n${res.stderr}`);

    assert.equal(
      readFileSync(vaqtinchalik, "utf8"),
      readFileSync(MIGRATSIYA, "utf8"),
      `${MIGRATSIYA} sxemadan orqada qolgan. Yangilash: npm run pg:migratsiya`
    );
  } finally {
    rmSync(papka, { recursive: true, force: true });
  }
});

test("dialekt Postgres URL'ni tanidi", () => {
  assert.equal(isPostgres(), true);
  assert.deepEqual(qidiruvRejimi(), { mode: "insensitive" });
});

// ---------- Sxema ----------

test("migratsiya toza Postgres bazasiga qo'llanadi", { skip: sabab }, async () => {
  const jadval = await c.query<{ n: string }>(
    "SELECT COUNT(*) n FROM information_schema.tables WHERE table_schema='public'"
  );
  const fk = await c.query<{ n: string }>(
    `SELECT COUNT(*) n FROM information_schema.table_constraints
     WHERE constraint_schema='public' AND constraint_type='FOREIGN KEY'`
  );

  // KUTILGAN SONLAR QO'LDA YOZILMAYDI — sxemadan va migratsiya faylining
  // O'ZIDAN hisoblanadi.
  //
  // Nega: ilgari bu yerda `40` va `76` qotirilgan edi. Sxemaga yangi model
  // qo'shilganda ular yangilanmadi va son 46 ga chiqib ketdi — test esa
  // JIMGINA qizil bo'lib turavergan edi, chunki `PG_TEST_URL` sozlanmagan
  // mashinada u umuman ishga tushmaydi. Ya'ni qo'lda yozilgan son bu yerda
  // hech narsani qo'riqlamaydi, faqat eskiradi.
  //
  // Endi tekshirilayotgan narsa aniq: "migratsiya fayli o'zi e'lon qilgan
  // hamma narsani haqiqatan yaratdimi va sxemadagi har model uchun jadval
  // bormi".
  const migratsiyaMatni = readFileSync(MIGRATSIYA, "utf8");
  const kutilganJadval = (readFileSync("prisma/schema.prisma", "utf8").match(/^model\s+\w+/gm) ?? [])
    .length;
  const kutilganFk = (migratsiyaMatni.match(/FOREIGN KEY/g) ?? []).length;

  assert.equal(
    Number(jadval.rows[0].n),
    kutilganJadval,
    "sxemadagi har model uchun Postgres'da jadval bo'lishi kerak"
  );
  assert.equal(
    Number(fk.rows[0].n),
    kutilganFk,
    "migratsiyada e'lon qilingan har FK bazada yaratilgan bo'lishi kerak"
  );
});

test("login uchun funksional indeks o'z joyida", { skip: sabab }, async () => {
  const res = await c.query<{ indexdef: string }>(
    "SELECT indexdef FROM pg_indexes WHERE indexname='User_login_lower_idx'"
  );
  assert.equal(res.rows.length, 1, "indeks yo'q — login butun jadvalni skanerlaydi");
  assert.match(res.rows[0].indexdef, /lower\(login\)/i);
});

// ---------- Dialekt: registrsiz login ----------

test("registrsizTeng registrga befarq topadi", { skip: sabab }, async () => {
  for (const kiritilgan of ["aziz.karimov", "AZIZ.KARIMOV", "Aziz.Karimov"]) {
    const sql = registrsizTeng('"login"', kiritilgan) as unknown as {
      text: string;
      values: unknown[];
    };
    const res = await c.query<{ id: string }>({
      text: `SELECT "id" FROM "User" WHERE ${sql.text} LIMIT 2`,
      values: sql.values,
    });
    assert.deepEqual(
      res.rows.map((r) => r.id),
      ["U2"],
      `"${kiritilgan}" topilishi kerak edi`
    );
  }
});

test("registrsizTeng funksional indeksdan foydalanadi", { skip: sabab }, async () => {
  // Kichik jadvalda planner har doim seqscan tanlaydi — indeks ishlatilishini
  // ko'rish uchun seqscan'ni vaqtincha o'chiramiz. Tekshirilayotgani "tez"
  // emas, "ifoda indeksga MOS" ekani.
  const sql = registrsizTeng('"login"', "aziz.karimov") as unknown as {
    text: string;
    values: unknown[];
  };
  await c.query("SET enable_seqscan = off");
  const plan = await c.query<{ "QUERY PLAN": string }>({
    text: `EXPLAIN SELECT "id" FROM "User" WHERE ${sql.text}`,
    values: sql.values,
  });
  await c.query("SET enable_seqscan = on");

  const matn = plan.rows.map((r) => r["QUERY PLAN"]).join("\n");
  assert.match(matn, /User_login_lower_idx/, `planner indeksni ko'rmadi:\n${matn}`);
});

// ---------- Dialekt: sana kaliti ----------

test("sanaKalitSql kunlik kalitni to'g'ri hosil qiladi", { skip: sabab }, async () => {
  const kalit = sanaKalitSql('"sana"', 10) as unknown as { text: string; values: unknown[] };
  const res = await c.query<{ kun: string; jami: string }>(
    pgSorov({
      text: `SELECT ${kalit.text} AS kun, SUM("summa") AS jami
             FROM "Transaction" GROUP BY 1 ORDER BY 1`,
      values: kalit.values,
    })
  );

  assert.deepEqual(
    res.rows.map((r) => [r.kun, Number(r.jami)]),
    [
      ["2026-07-10", 300_000],
      ["2026-07-11", 300_000],
      ["2026-08-01", 400_000],
    ]
  );
});

test("sanaKalitSql oylik kalitni to'g'ri hosil qiladi", { skip: sabab }, async () => {
  const kalit = sanaKalitSql('"sana"', 7) as unknown as { text: string; values: unknown[] };
  const res = await c.query<{ oy: string; jami: string }>(
    pgSorov({
      text: `SELECT ${kalit.text} AS oy, SUM("summa") AS jami
             FROM "Transaction" GROUP BY 1 ORDER BY 1`,
      values: kalit.values,
    })
  );

  assert.deepEqual(
    res.rows.map((r) => [r.oy, Number(r.jami)]),
    [
      ["2026-07", 600_000],
      ["2026-08", 400_000],
    ]
  );
});

// ---------- Rate limit atomikligi ----------

test("rate limit hisoblagichi Postgres'da ATOMIK oshadi", { skip: sabab }, async () => {
  // `src/lib/rateLimit.ts` dagi ayni so'rov. Muhimi shu: bir vaqtda kelgan
  // 20 ta so'rov 20 ta TURLI qiymat olishi kerak. Agar `RETURNING` o'rniga
  // alohida SELECT bo'lsa, hammasi oxirgi qiymatni ko'rar va limit ishlamasdi.
  const OSHIRISH = `UPDATE "AppSetting"
       SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT)
     WHERE "key" = $1
     RETURNING "value"`;

  await c.query(`INSERT INTO "AppSetting" ("key","value") VALUES ('rl:sinov','0')`);

  const { Client } = await import("pg");
  const ulanishlar = await Promise.all(
    Array.from({ length: 20 }, async () => {
      const k = new Client({ connectionString: PG });
      await k.connect();
      return k;
    })
  );

  try {
    const natijalar = await Promise.all(
      ulanishlar.map((k) => k.query<{ value: string }>(OSHIRISH, ["rl:sinov"]))
    );
    const qiymatlar = natijalar.map((r) => Number(r.rows[0].value)).sort((a, b) => a - b);
    assert.deepEqual(
      qiymatlar,
      Array.from({ length: 20 }, (_, i) => i + 1),
      "har bir so'rov o'ZINING navbat raqamini olishi kerak"
    );
  } finally {
    await Promise.all(ulanishlar.map((k) => k.end()));
  }

  const oxiri = await c.query<{ value: string }>(
    `SELECT "value" FROM "AppSetting" WHERE "key"='rl:sinov'`
  );
  assert.equal(oxiri.rows[0].value, "20");
});
