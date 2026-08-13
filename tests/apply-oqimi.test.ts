/**
 * APPLY OQIMI — `npm run apply:hammasi` va uning qismlari.
 *
 * Bu skript production bazasiga yozadi, ya'ni u yiqilsa oqibati og'ir.
 * Shuning uchun uning HAR bir himoyasi sinaladi:
 *
 *  - `DATABASE_URL` yo'q bo'lsa umuman ishga tushmasligi (fail-closed);
 *  - migratsiya hisoboti bazaga mos kelmasa O'RTADA emas, BOSHIDA to'xtashi
 *    (aks holda "table already exists" bilan yarim qo'llangan baza qoladi);
 *  - to'liq oqim eski holatdagi bazada ishlashi va ma'lumot yo'qotmasligi;
 *  - ikkinchi marta ishga tushirish xavfsizligi (idempotentlik);
 *  - xom suratdan TIKLASH ishlashi — bu orqaga qaytish yo'li, sinalmagan
 *    tiklash tooli xavfli.
 *
 * Ishga tushirish: npm run test:apply-oqimi
 */
process.env.DATABASE_URL = "file:./prisma/test-apply-oqim.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const DB = "prisma/test-apply-oqim.db";
const URL = `file:./${DB}`;
const ESKI_OXIRGI = "20260804073000_bepul_tenant";
const SURAT = "prisma/backups/test-apply-oqim-surat.json";

let client: any;
const son = async (sql: string) => Number((await client.execute(sql)).rows[0].n);

/** Skriptni berilgan env bilan ishga tushiradi. */
function ishga(args: string[], env: Record<string, string | undefined> = {}) {
  return spawnSync(process.execPath, args, {
    env: { ...process.env, DATABASE_URL: URL, ...env },
    encoding: "utf8",
  });
}

/** Eski holatdagi baza + ma'lumot (production'ning aynan holati). */
async function eskiHolatniQur() {
  rmSync(DB, { force: true });
  rmSync(`${DB}-journal`, { force: true });

  const { createClient } = await import("@libsql/client");
  client = createClient({ url: URL });

  const hammasi = readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
  const chegara = hammasi.indexOf(ESKI_OXIRGI);
  for (const d of hammasi.slice(0, chegara + 1)) {
    await client.executeMultiple(readFileSync(join("prisma/migrations", d, "migration.sql"), "utf8"));
  }

  const iso = (s: string) => new Date(s).toISOString();
  const q = (sql: string, args: unknown[]) => client.execute({ sql, args });

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
  for (let i = 1; i <= 12; i++) {
    await q(
      `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","summa","sana","userId","createdAt")
       VALUES (?,'kirim','C1','B1',?,?,'U1',?)`,
      [`TX${i}`, 100_000 * i, iso("2026-07-10"), iso("2026-07-10")]
    );
  }
  await q(
    `INSERT INTO "Product" ("id","businessId","nomi","kelganNarx","sotuvNarx","miqdor","isActive","createdAt")
     VALUES ('P1','B1','Un',5000,8000,100,1,?)`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Sale" ("id","businessId","productId","miqdor","birlikNarx","tannarx","jamiSumma","tolovTuri","mijozNomi","userId","createdAt")
     VALUES ('S1','B1','P1',10,8000,5000,80000,'naqd','Akmal','U1',?)`,
    [iso("2026-07-12T09:30:00Z")]
  );
}

before(async () => {
  await eskiHolatniQur();
});

after(() => {
  rmSync(SURAT, { force: true });
});

// ---------- Himoyalar ----------

test("DATABASE_URL yo'q bo'lsa umuman ishga tushmaydi", () => {
  const res = ishga(["scripts/apply-hammasi.mjs"], { DATABASE_URL: "" });
  assert.notEqual(res.status, 0, "ulanishsiz to'xtashi kerak");
  assert.match(res.stderr + res.stdout, /DATABASE_URL sozlanmagan/);
});

test("migratsiya hisoboti mos kelmasa BOSHIDA to'xtaydi", () => {
  // Baza eski holatda, lekin `_applied_migrations` bo'sh — runner hammasini
  // boshidan qo'llashga urinardi va "table already exists" bilan O'RTADA
  // yiqilardi. Skript buni oldindan ko'rishi kerak.
  const res = ishga(["scripts/apply-hammasi.mjs"]);
  assert.notEqual(res.status, 0);
  const chiqish = res.stdout + res.stderr;
  assert.match(chiqish, /hisoboti baza holatiga mos kelmaydi/);
  assert.match(chiqish, /Hech narsa o'zgartirilmadi/);
  assert.match(chiqish, /migratsiya:belgila/, "yechim ko'rsatilishi kerak");
});

test("migratsiya:belgila tasdiqsiz hech narsa o'zgartirmaydi", async () => {
  const res = ishga(["scripts/migratsiya-belgila.mjs", ESKI_OXIRGI]);
  assert.equal(res.status, 0);
  assert.match(res.stdout, /Hech narsa o'zgartirilmadi/);

  const belgilangan = await son(`SELECT COUNT(*) n FROM sqlite_master WHERE name='_applied_migrations'`);
  if (belgilangan > 0) {
    assert.equal(await son("SELECT COUNT(*) n FROM _applied_migrations"), 0);
  }
});

test("migratsiya:belgila noto'g'ri nomni rad etadi", () => {
  const res = ishga(["scripts/migratsiya-belgila.mjs", "yoq-bunday-migratsiya", "--tasdiq"]);
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /topilmadi/);
});

// ---------- To'liq oqim ----------

test("to'liq oqim: belgilash -> apply -> tekshiruv", async () => {
  const belgila = ishga(["scripts/migratsiya-belgila.mjs", ESKI_OXIRGI, "--tasdiq"]);
  assert.equal(belgila.status, 0, belgila.stderr);
  assert.equal(await son("SELECT COUNT(*) n FROM _applied_migrations"), 14);

  const res = ishga(["scripts/apply-hammasi.mjs"]);
  assert.equal(res.status, 0, `apply yiqildi:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /HAMMASI MUVAFFAQIYATLI/);
});

test("ma'lumot yo'qolmadi va yangi sxema o'z joyida", async () => {
  assert.equal(await son(`SELECT COUNT(*) n FROM "Transaction"`), 12);
  assert.equal(await son(`SELECT SUM("summa") n FROM "Transaction"`), 7_800_000);
  assert.equal(await son(`SELECT COUNT(*) n FROM "Sale"`), 1);

  // Migratsiyadan keyingi majburiy holat.
  assert.equal(await son(`SELECT COUNT(*) n FROM "Transaction" WHERE "accountId" IS NULL`), 0);
  assert.equal(await son(`SELECT COUNT(*) n FROM "Sale" WHERE "sana" IS NULL`), 0);
  assert.ok(await son(`SELECT COUNT(*) n FROM "Account"`) > 0, "kassa ochilishi kerak");

  const fk = await client.execute("PRAGMA foreign_key_check");
  assert.equal(fk.rows.length, 0);
});

test("ikkinchi marta ishga tushirish xavfsiz (idempotent)", async () => {
  const oldin = {
    tx: await son(`SELECT COUNT(*) n FROM "Transaction"`),
    summa: await son(`SELECT SUM("summa") n FROM "Transaction"`),
    kassa: await son(`SELECT COUNT(*) n FROM "Account"`),
  };

  const res = ishga(["scripts/apply-hammasi.mjs"]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Kutayotgan migratsiya yo'q/);

  assert.equal(await son(`SELECT COUNT(*) n FROM "Transaction"`), oldin.tx);
  assert.equal(await son(`SELECT SUM("summa") n FROM "Transaction"`), oldin.summa);
  assert.equal(await son(`SELECT COUNT(*) n FROM "Account"`), oldin.kassa, "takroriy kassa ochilmasligi kerak");
});

// ---------- Orqaga qaytish yo'li ----------

test("xom surat olinadi va undan TIKLASH ishlaydi", async () => {
  const olish = ishga(["scripts/xom-zaxira.mjs", SURAT]);
  assert.equal(olish.status, 0, olish.stderr);
  assert.ok(existsSync(SURAT));

  // Ma'lumotni ataylab buzamiz — tiklash uni qaytarishi kerak.
  await client.execute(`DELETE FROM "Transaction" WHERE "id" IN ('TX1','TX2','TX3')`);
  await client.execute(`UPDATE "Sale" SET "jamiSumma" = 1 WHERE "id" = 'S1'`);
  assert.equal(await son(`SELECT COUNT(*) n FROM "Transaction"`), 9);

  const tiklash = ishga(["scripts/xom-zaxira.mjs", "--tikla", SURAT]);
  assert.equal(tiklash.status, 0, tiklash.stderr);

  assert.equal(await son(`SELECT COUNT(*) n FROM "Transaction"`), 12, "o'chirilgan yozuvlar qaytishi kerak");
  assert.equal(await son(`SELECT SUM("summa") n FROM "Transaction"`), 7_800_000);
  assert.equal(await son(`SELECT "jamiSumma" n FROM "Sale" WHERE "id"='S1'`), 80_000, "buzilgan qiymat tiklanishi kerak");

  const fk = await client.execute("PRAGMA foreign_key_check");
  assert.equal(fk.rows.length, 0, "tiklashdan keyin FK toza bo'lishi kerak");
});

test("xom surat sxemaga bog'liq emas — eski bazada ham ishlaydi", async () => {
  // Aynan shu sabab uchun u yozilgan: `npm run backup` (Prisma) eski bazada
  // "no such table: Account" bilan yiqiladi, xom surat esa ishlaydi.
  await eskiHolatniQur();

  const prisma = ishga(["-r", "ts-node/register", "scripts/backup.ts"]);
  assert.notEqual(prisma.status, 0, "Prisma zaxirasi eski bazada yiqilishi KUTILADI");
  // Eski bazada yetishmayotgan narsa jadval ham, ustun ham bo'lishi mumkin
  // (sxema qaysi migratsiyada oldinlab ketganiga qarab).
  assert.match(prisma.stdout + prisma.stderr, /no such (table|column)|does not exist/i);

  const xom = ishga(["scripts/xom-zaxira.mjs", SURAT]);
  assert.equal(xom.status, 0, `xom surat eski bazada ham ishlashi kerak:\n${xom.stderr}`);
  assert.match(xom.stdout, /Xom surat tayyor/);
});
