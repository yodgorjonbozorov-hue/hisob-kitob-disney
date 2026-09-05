/**
 * MOLIYA MIGRATSIYASI — MA'LUMOT USTIGA QO'LLASH MASHQI.
 *
 * `20260905090000_moliya_pul_oqimi` production bazasiga MAVJUD yozuvlar
 * ustidan qo'llanadi. Eng katta xavf — `idempotencyKey` ustidagi UNIQUE
 * indeks: migratsiyadan keyin BARCHA eski yozuvlarda u NULL bo'ladi. Agar
 * dialekt NULL larni teng deb hisoblasa, indeks yaratish jadvalda bittadan
 * ko'p qator bo'lgan zahoti YIQILADI va deploy to'xtaydi.
 *
 * Shu bois test: migratsiyagacha bo'lgan bazani quradi, unga haqiqiy
 * tranzaksiyalar soladi, migratsiyani qo'llaydi va HECH NARSA
 * o'zgarmaganini tekshiradi.
 *
 * Ishga tushirish: npm run test:moliya-migratsiya
 */
process.env.DATABASE_URL = "file:./prisma/test-moliya-migr.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const DB = "prisma/test-moliya-migr.db";
const MIGRATSIYA = "20260905090000_moliya_pul_oqimi";

/* eslint-disable @typescript-eslint/no-explicit-any */
let client: any;
let oldingiHolat: any[] = [];

const q = (sql: string, args: unknown[] = []) => client.execute({ sql, args });
const ustunlar = async (jadval: string): Promise<string[]> =>
  (await client.execute(`PRAGMA table_info("${jadval}")`)).rows.map((r: any) => String(r.name));

async function qolla(dir: string) {
  const sql = readFileSync(join("prisma/migrations", dir, "migration.sql"), "utf8");
  await client.executeMultiple(sql);
}

before(async () => {
  rmSync(DB, { force: true });
  rmSync(`${DB}-journal`, { force: true });

  const { createClient } = await import("@libsql/client");
  client = createClient({ url: `file:./${DB}` });

  // 1. Migratsiyagacha bo'lgan HOLAT: shu migratsiyadan OLDINGI hammasi.
  const dirs = readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
  const chegara = dirs.indexOf(MIGRATSIYA);
  assert.ok(chegara > 0, "migratsiya papkasi topilishi kerak");
  for (const d of dirs.slice(0, chegara)) await qolla(d);

  // 2. HAQIQIY MA'LUMOT: tenant -> biznes -> user -> kategoriya -> kassa -> yozuvlar.
  const vaqt = new Date("2026-09-01T00:00:00.000Z").toISOString();
  await q(
    `INSERT INTO "Tenant" ("id","name","slug","createdAt","updatedAt") VALUES (?,?,?,?,?)`,
    ["t1", "Migratsiya testi", "migratsiya-testi", vaqt, vaqt]
  );
  await q(
    `INSERT INTO "Business" ("id","nomi","tenantId","createdAt") VALUES (?,?,?,?), (?,?,?,?)`,
    ["b1", "Biznes 1", "t1", vaqt, "b2", "Biznes 2", "t1", vaqt]
  );
  await q(
    `INSERT INTO "User" ("id","ism","login","parolHash","rol","tenantId","createdAt") VALUES (?,?,?,?,?,?,?)`,
    ["u1", "Direktor", "+998900000501", "x", "OWNER", "t1", vaqt]
  );
  await q(
    `INSERT INTO "Category" ("id","nomi","turi","businessId","createdAt") VALUES (?,?,?,?,?)`,
    ["c1", "Savdo", "kirim", "b1", vaqt]
  );
  await q(
    `INSERT INTO "Account" ("id","businessId","nomi","turi","createdAt") VALUES (?,?,?,?,?)`,
    ["a1", "b1", "Asosiy kassa", "naqd", vaqt]
  );

  // Bittadan ko'p yozuv SHART: UNIQUE indeks NULL larni teng deb hisoblasa
  // aynan shu yerda yiqiladi.
  for (let i = 1; i <= 5; i++) {
    await q(
      `INSERT INTO "Transaction"
         ("id","turi","categoryId","businessId","accountId","tolovTuri","summa","sana","izoh","userId","createdAt")
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [`tx${i}`, "kirim", "c1", "b1", "a1", "naqd", i * 100_000, vaqt, `Yozuv ${i}`, "u1", vaqt]
    );
  }
  oldingiHolat = (await q(`SELECT * FROM "Transaction" ORDER BY "id"`)).rows;
});

after(async () => {
  client?.close?.();
  rmSync(DB, { force: true });
  rmSync(`${DB}-journal`, { force: true });
});

test("migratsiya faqat QO'SHUVCHI — DROP/TRUNCATE/UPDATE yo'q", () => {
  const sql = readFileSync(join("prisma/migrations", MIGRATSIYA, "migration.sql"), "utf8");
  const kod = sql
    .split("\n")
    .filter((satr) => !satr.trim().startsWith("--"))
    .join("\n");

  for (const taqiq of ["DROP", "TRUNCATE", "DELETE", "UPDATE", "RENAME", "INSERT"]) {
    assert.equal(
      new RegExp(`\\b${taqiq}\\b`, "i").test(kod),
      false,
      `${taqiq} bo'lmasligi kerak — jadval qayta qurilmaydi va ma'lumot tegilmaydi`
    );
  }

  // Har `ADD COLUMN` NULL bo'lishi mumkin: NOT NULL bo'lsa mavjud qatorlar
  // uchun default kerak bo'lardi va migratsiya yiqilardi.
  const qatorlar = kod.split("\n").filter((s) => /ADD COLUMN/i.test(s));
  assert.equal(qatorlar.length, 6, "olti yangi ustun");
  for (const s of qatorlar) {
    assert.equal(/NOT NULL/i.test(s), false, `nullable bo'lishi shart: ${s.trim()}`);
    assert.equal(/DEFAULT/i.test(s), false, `default kerak emas: ${s.trim()}`);
  }
});

test("migratsiya mavjud ma'lumot ustiga muammosiz qo'llanadi", async () => {
  await qolla(MIGRATSIYA);

  const yangiUstunlar = await ustunlar("Transaction");
  for (const u of ["shaxsTuri", "shaxsId", "shaxsIsm", "pulUsuli", "amalId", "idempotencyKey"]) {
    assert.ok(yangiUstunlar.includes(u), `${u} ustuni qo'shildi`);
  }
});

test("mavjud yozuvlar bir bitga ham o'zgarmaydi", async () => {
  const keyin = (await q(`SELECT * FROM "Transaction" ORDER BY "id"`)).rows;
  assert.equal(keyin.length, oldingiHolat.length, "yozuvlar soni o'zgarmadi");

  for (let i = 0; i < keyin.length; i++) {
    for (const kalit of Object.keys(oldingiHolat[i])) {
      assert.deepEqual(
        keyin[i][kalit],
        oldingiHolat[i][kalit],
        `tx${i + 1}.${kalit} o'zgarmasligi kerak`
      );
    }
    // Yangi ustunlar eski yozuvlarda NULL — kod ularni shunday kutadi
    // (`tahrirlanadi: Boolean(amalId)`, `usulniChiqar` zaxira yo'li).
    for (const u of ["shaxsTuri", "shaxsId", "shaxsIsm", "pulUsuli", "amalId", "idempotencyKey"]) {
      assert.equal(keyin[i][u], null, `eski yozuvda ${u} NULL bo'lib qoladi`);
    }
  }
});

test("UNIQUE indeks ko'p NULL ni o'tkazadi, lekin biznes ichida takror kalitni o'tkazmaydi", async () => {
  // Beshta NULL kalitli yozuv allaqachon bor — indeks yaratilgani shuni
  // isbotladi. Yana bittasi ham o'tishi kerak.
  const vaqt = new Date("2026-09-02T00:00:00.000Z").toISOString();
  await q(
    `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","summa","sana","userId","createdAt")
     VALUES (?,?,?,?,?,?,?,?)`,
    ["tx6", "kirim", "c1", "b1", 1, vaqt, "u1", vaqt]
  );
  const soni = Number(
    (await q(`SELECT COUNT(*) AS n FROM "Transaction" WHERE "idempotencyKey" IS NULL`)).rows[0].n
  );
  assert.equal(soni, 6, "kalitsiz yozuvlar cheklovga umuman tegmaydi");

  // AYNI biznesda takror kalit — rad etiladi.
  const yoz = (id: string, businessId: string, kalit: string) =>
    q(
      `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","summa","sana","userId","createdAt","idempotencyKey")
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, "kirim", "c1", businessId, 1, vaqt, "u1", vaqt, kalit]
    );

  await yoz("tx7", "b1", "KALIT-A");
  await assert.rejects(() => yoz("tx8", "b1", "KALIT-A"), /UNIQUE|constraint/i);

  // BOSHQA biznesda AYNI kalit — o'tadi (cheklov businessId bilan scoped).
  await yoz("tx9", "b2", "KALIT-A");
  const jami = Number(
    (await q(`SELECT COUNT(*) AS n FROM "Transaction" WHERE "idempotencyKey" = 'KALIT-A'`)).rows[0].n
  );
  assert.equal(jami, 2, "ayni kalit ikki biznesda mustaqil yashaydi");
});
