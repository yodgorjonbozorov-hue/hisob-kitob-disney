/**
 * KO'CHIRISH OQIMI — `npm run kochirish` (scripts/kochirish.mjs).
 *
 * Bu skript yangi production bazasini quradi — u yiqilsa yoki noto'g'ri
 * bazaga qaratilsa oqibati og'ir. Shuning uchun HAR himoyasi sinaladi:
 *
 *  - YANGI_DATABASE_URL berilmasa umuman boshlanmasligi (fail-closed);
 *  - eski va yangi URL bir xil bo'lsa to'xtashi;
 *  - eski baza to'liq migratsiya qilinmagan bo'lsa to'xtashi (chala sxema
 *    bilan dump olish — jimgina chala zaxira degani);
 *  - eski bazada kassaga bog'lanmagan tranzaksiya bo'lsa to'xtashi;
 *  - yangi baza bo'sh bo'lmasa to'xtashi (noto'g'ri nishon / takror urinish);
 *  - to'liq oqim: haqiqiy ma'lumot ko'chadi, sonlar va summalar mos;
 *  - ESKI BAZA O'ZGARMASLIGI — ko'chirishdan keyin ham sonlar bir xil;
 *  - takror ishga tushirish yangi bazani ikki nusxa qilmasligi.
 *
 * Ishga tushirish: npm run test:kochirish
 */
process.env.DATABASE_URL = "file:./prisma/test-kochirish-eski.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const ESKI_DB = "prisma/test-kochirish-eski.db";
const YANGI_DB = "prisma/test-kochirish-yangi.db";
const ESKI_URL = `file:./${ESKI_DB}`;
const YANGI_URL = `file:./${YANGI_DB}`;
const SURAT = "prisma/backups/test-kochirish-surat.json";

let eski: any;
let yangi: any;

const son = async (c: any, sql: string) => Number((await c.execute(sql)).rows[0].n);

/** kochirish.mjs ni berilgan env bilan ishga tushiradi. */
function kochir(env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, ["scripts/kochirish.mjs"], {
    env: {
      ...process.env,
      DATABASE_URL: ESKI_URL,
      YANGI_DATABASE_URL: YANGI_URL,
      KOCHIRISH_SURAT: SURAT,
      ...env,
    },
    encoding: "utf8",
  });
}

function tozala() {
  for (const f of [ESKI_DB, YANGI_DB]) {
    rmSync(f, { force: true });
    rmSync(`${f}-journal`, { force: true });
  }
  rmSync(SURAT, { force: true });
}

/** Eski bazani JORIY sxema + haqiqiy ma'lumot bilan quradi. */
async function eskiBazaniQur() {
  tozala();
  const { createClient } = await import("@libsql/client");
  eski = createClient({ url: ESKI_URL });

  // Barcha migratsiyalar (production'dagi holat) + _applied_migrations belgisi.
  const hammasi = readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
  await eski.execute(
    "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"
  );
  for (const d of hammasi) {
    await eski.executeMultiple(readFileSync(join("prisma/migrations", d, "migration.sql"), "utf8"));
    await eski.execute({ sql: "INSERT INTO _applied_migrations (name) VALUES (?)", args: [d] });
  }

  const iso = (s: string) => new Date(s).toISOString();
  const q = (sql: string, args: unknown[] = []) => eski.execute({ sql, args });

  await q(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","createdAt","updatedAt")
     VALUES ('T1','Alfa','alfa','ACTIVE','PRO',?,?)`,
    [iso("2026-07-01"), iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Business" ("id","nomi","isActive","omborli","turi","createdAt","tenantId")
     VALUES ('B1','Alfa do''kon',1,1,'umumiy',?,'T1')`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "User" ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId")
     VALUES ('U1','Egasi','+998901000001','h','OWNER',1,?,0,'T1')`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Category" ("id","nomi","turi","tartib","isActive","createdAt","businessId")
     VALUES ('C1','Sotuv','kirim',0,1,?,'B1')`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Account" ("id","businessId","nomi","turi","isActive","tartib","createdAt")
     VALUES ('A1','B1','Naqd kassa','naqd',1,0,?)`,
    [iso("2026-07-01")]
  );
  for (let i = 1; i <= 20; i++) {
    await q(
      `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","accountId","summa","sana","userId","createdAt")
       VALUES (?,'kirim','C1','B1','A1',?,?,'U1',?)`,
      [`TX${i}`, 100_000 * i, iso("2026-07-10"), iso("2026-07-10")]
    );
  }
  await q(
    `INSERT INTO "Product" ("id","businessId","nomi","kelganNarx","sotuvNarx","miqdor","isActive","createdAt")
     VALUES ('P1','B1','Un',5000,8000,100,1,?)`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Sale" ("id","businessId","productId","miqdor","birlikNarx","tannarx","jamiSumma","tolovTuri","mijozNomi","userId","sana","createdAt")
     VALUES ('S1','B1','P1',10,8000,5000,80000,'qarz','Akmal','U1',?,?)`,
    [iso("2026-07-12"), iso("2026-07-12T09:30:00Z")]
  );
  await q(
    `INSERT INTO "Debt" ("id","businessId","turi","saleId","mijozNomi","jamiSumma","tolangan","isYopilgan","userId","createdAt")
     VALUES ('D1','B1','olinadigan','S1','Akmal',80000,20000,0,'U1',?)`,
    [iso("2026-07-12")]
  );
}

before(async () => {
  await eskiBazaniQur();
});

after(async () => {
  eski?.close?.();
  yangi?.close?.();
  tozala();
});

test("YANGI_DATABASE_URL yo'q — umuman boshlanmaydi (fail-closed)", () => {
  const res = kochir({ YANGI_DATABASE_URL: undefined });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /YANGI_DATABASE_URL/);
  // Zaxira fayli ham yaratilmagan bo'lishi kerak — hech qadam bajarilmagan.
  assert.equal(existsSync(SURAT), false);
});

test("eski va yangi URL bir xil — to'xtaydi", () => {
  const res = kochir({ YANGI_DATABASE_URL: ESKI_URL });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /BIR XIL/);
});

test("eski baza orqada bo'lsa — to'xtaydi", async () => {
  // Bitta migratsiya belgisini vaqtincha olib turamiz.
  const oxirgi = await eski.execute(
    "SELECT name FROM _applied_migrations ORDER BY name DESC LIMIT 1"
  );
  const nom = String(oxirgi.rows[0].name);
  await eski.execute({ sql: "DELETE FROM _applied_migrations WHERE name = ?", args: [nom] });
  try {
    const res = kochir();
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /orqada/);
  } finally {
    await eski.execute({ sql: "INSERT INTO _applied_migrations (name) VALUES (?)", args: [nom] });
  }
});

test("kassaga bog'lanmagan tranzaksiya bo'lsa — to'xtaydi", async () => {
  await eski.execute("UPDATE \"Transaction\" SET accountId = NULL WHERE id = 'TX1'");
  try {
    const res = kochir();
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /kassaga bog'lanmagan/);
  } finally {
    await eski.execute("UPDATE \"Transaction\" SET accountId = 'A1' WHERE id = 'TX1'");
  }
});

test("yangi baza bo'sh bo'lmasa — to'xtaydi", async () => {
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: YANGI_URL });
  await c.execute("CREATE TABLE begona (id INTEGER PRIMARY KEY)");
  c.close?.();
  try {
    const res = kochir();
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /bo'sh emas/);
  } finally {
    rmSync(YANGI_DB, { force: true });
  }
});

test("to'liq oqim: ma'lumot ko'chadi, sonlar va summalar mos", async () => {
  const res = kochir();
  assert.equal(res.status, 0, `kochirish yiqildi:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /KO'CHIRISH TUGADI/);

  const { createClient } = await import("@libsql/client");
  yangi = createClient({ url: YANGI_URL });

  assert.equal(await son(yangi, 'SELECT COUNT(*) n FROM "Transaction"'), 20);
  assert.equal(await son(yangi, 'SELECT COUNT(*) n FROM "Sale"'), 1);
  assert.equal(await son(yangi, 'SELECT COUNT(*) n FROM "Debt"'), 1);
  assert.equal(await son(yangi, 'SELECT COUNT(*) n FROM "Account"'), 1);

  const eskiSum = await son(eski, 'SELECT SUM(summa) n FROM "Transaction"');
  const yangiSum = await son(yangi, 'SELECT SUM(summa) n FROM "Transaction"');
  assert.equal(yangiSum, eskiSum);
  assert.equal(await son(yangi, 'SELECT tolangan n FROM "Debt" WHERE id=\'D1\''), 20000);

  // Yangi bazada barcha migratsiyalar belgilangan — keyingi deploy
  // ularni qayta qo'llashga urinmaydi.
  const lokal = readdirSync("prisma/migrations").filter((d) =>
    existsSync(join("prisma/migrations", d, "migration.sql"))
  ).length;
  assert.equal(await son(yangi, "SELECT COUNT(*) n FROM _applied_migrations"), lokal);
});

test("eski baza o'zgarmagan (faqat o'qilgan)", async () => {
  assert.equal(await son(eski, 'SELECT COUNT(*) n FROM "Transaction"'), 20);
  assert.equal(await son(eski, 'SELECT SUM(summa) n FROM "Transaction"'), 21_000_000);
  assert.equal(await son(eski, 'SELECT COUNT(*) n FROM "Sale"'), 1);
  assert.equal(await son(eski, 'SELECT COUNT(*) n FROM "Debt"'), 1);
});

test("takror ishga tushirish ikki nusxa yaratmaydi — bo'sh emas himoyasi ushlaydi", () => {
  const res = kochir();
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /bo'sh emas/);
});
