/**
 * MIGRATSIYA ZANJIRI — MA'LUMOT USTIGA APPLY QILISH MASHQI.
 *
 * Boshqa barcha testlar BO'SH bazadan boshlaydi: ular migratsiyalar
 * sxemani to'g'ri qurishini tekshiradi, lekin "ustiga apply qilish"
 * yo'lini umuman sinamaydi.
 *
 * Aynan shu yerda xavf. Uch migratsiya jadvalni QAYTA QURADI (SQLite'da
 * `ALTER TABLE` cheklangani uchun `CREATE new_X` + `INSERT ... SELECT` +
 * `DROP` + `RENAME`):
 *   - `ondelete_siyosati` — 23 jadvalning FK siyosatini o'zgartiradi;
 *   - `sotuv_sana_bekor`  — `Sale.sana` NOT NULL, `createdAt` dan to'ldiriladi;
 *   - `mijozlar_moduli`   — `Sale` va `Debt` ga `contactId` qo'shadi.
 *
 * Bunday migratsiyada `INSERT ... SELECT` dagi ustunlar ro'yxati noto'g'ri
 * bo'lsa ma'lumot JIMGINA yo'qoladi — migratsiya "muvaffaqiyatli" tugaydi.
 * Shu bois bu test: eski holatdagi bazani quradi, unga haqiqiy ma'lumot
 * soladi, kutilayotgan migratsiyalarni qo'llaydi va HECH NARSA
 * yo'qolmaganini tekshiradi.
 *
 * Ishga tushirish: npm run test:migratsiya
 */
process.env.DATABASE_URL = "file:./prisma/test-zanjir.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const DB = "prisma/test-zanjir.db";
const URL = `file:./${DB}`;

/**
 * Kutilayotgan migratsiyalar shundan KEYIN boshlanadi. Yangi migratsiya
 * qo'shilsa bu qiymat o'zgarmaydi — test avtomatik uni ham qamrab oladi.
 */
const ESKI_OXIRGI = "20260804073000_bepul_tenant";

let client: any;
let oldingi: Record<string, number> = {};
let kutilayotganlar: string[] = [];

const iso = (s: string) => new Date(s).toISOString();
const q = (sql: string, args: unknown[] = []) => client.execute({ sql, args });
const son = async (sql: string) => Number((await client.execute(sql)).rows[0].n);
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
  client = createClient({ url: URL });

  const hammasi = readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
  const chegara = hammasi.indexOf(ESKI_OXIRGI);
  assert.ok(chegara >= 0, `${ESKI_OXIRGI} topilmadi — ESKI_OXIRGI ni yangilang`);

  // 1) Eski holat: production'dagi baza shunday ko'rinadi.
  for (const dir of hammasi.slice(0, chegara + 1)) await qolla(dir);
  kutilayotganlar = hammasi.slice(chegara + 1);

  // 2) Haqiqiy ma'lumot: ikki tenant, uch foydalanuvchi, 26 tranzaksiya,
  //    ombor, sotuv (biri qarzga), qarz va audit yozuvlari.
  await q(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","createdAt","updatedAt")
     VALUES ('T1','Alfa MChJ','alfa','ACTIVE','PRO',?,?), ('T2','Beta Savdo','beta','TRIAL','STANDARD',?,?)`,
    [iso("2026-07-01"), iso("2026-07-01"), iso("2026-07-05"), iso("2026-07-05")]
  );
  await q(
    `INSERT INTO "Business" ("id","nomi","isActive","omborli","turi","createdAt","tenantId")
     VALUES ('B1','Alfa do''kon',1,1,'umumiy',?,'T1'), ('B2','Beta ombor',1,1,'umumiy',?,'T2')`,
    [iso("2026-07-01"), iso("2026-07-05")]
  );
  await q(
    `INSERT INTO "User" ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId")
     VALUES ('U1','Alfa egasi','+998901000001','h','OWNER',1,?,0,'T1'),
            ('U2','Alfa kassiri','+998901000002','h','CASHIER',1,?,0,'T1'),
            ('U3','Beta egasi','+998901000003','h','OWNER',1,?,0,'T2')`,
    [iso("2026-07-01"), iso("2026-07-02"), iso("2026-07-05")]
  );
  await q(
    `INSERT INTO "Category" ("id","nomi","turi","tartib","isActive","createdAt","businessId")
     VALUES ('C1','Sotuv','kirim',0,1,?,'B1'), ('C2','Ijara','chiqim',1,1,?,'B1'), ('C3','Sotuv','kirim',0,1,?,'B2')`,
    [iso("2026-07-01"), iso("2026-07-01"), iso("2026-07-05")]
  );

  for (let i = 1; i <= 25; i++) {
    const kun = String((i % 28) + 1).padStart(2, "0");
    await q(
      `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","summa","sana","izoh","userId","createdAt")
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        `TX${i}`,
        i % 3 === 0 ? "chiqim" : "kirim",
        i % 3 === 0 ? "C2" : "C1",
        "B1",
        100_000 * i,
        iso(`2026-07-${kun}`),
        `Yozuv ${i}`,
        i % 2 ? "U1" : "U2",
        iso(`2026-07-${kun}`),
      ]
    );
  }
  await q(
    `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","summa","sana","userId","createdAt")
     VALUES ('TXB','kirim','C3','B2',500000,?,'U3',?)`,
    [iso("2026-07-10"), iso("2026-07-10")]
  );

  await q(
    `INSERT INTO "Product" ("id","businessId","nomi","kelganNarx","sotuvNarx","miqdor","isActive","createdAt")
     VALUES ('P1','B1','Un',5000,8000,100,1,?), ('P2','B1','Shakar',9000,12000,50,1,?)`,
    [iso("2026-07-01"), iso("2026-07-01")]
  );
  // DIQQAT: bu sotuvlarda `sana` ustuni HALI YO'Q — u kutilayotgan
  // migratsiyada qo'shiladi va `createdAt` dan to'ldirilishi kerak.
  await q(
    `INSERT INTO "Sale" ("id","businessId","productId","miqdor","birlikNarx","tannarx","jamiSumma","tolovTuri","mijozNomi","userId","createdAt")
     VALUES ('S1','B1','P1',10,8000,5000,80000,'naqd','Akmal','U2',?),
            ('S2','B1','P2',5,12000,9000,60000,'qarz','Bekhzod','U2',?)`,
    [iso("2026-07-12T09:30:00Z"), iso("2026-07-18T14:00:00Z")]
  );
  await q(
    `INSERT INTO "Debt" ("id","businessId","turi","saleId","productId","mijozNomi","jamiSumma","tolangan","isYopilgan","userId","createdAt")
     VALUES ('D1','B1','olinadigan','S2','P2','Bekhzod',60000,20000,0,'U2',?)`,
    [iso("2026-07-18T14:00:00Z")]
  );
  await q(
    `INSERT INTO "AuditLog" ("id","action","entity","entityId","createdAt","businessId","userId")
     VALUES ('A1','create','sale','S1',?,'B1','U2'), ('A2','create','transaction','TX1',?,'B1','U1')`,
    [iso("2026-07-12"), iso("2026-07-02")]
  );

  for (const t of [
    "Tenant", "Business", "User", "Category", "Transaction", "Product", "Sale", "Debt", "AuditLog",
  ]) {
    oldingi[t] = await son(`SELECT COUNT(*) n FROM "${t}"`);
  }

  // 3) Kutilayotgan migratsiyalar — ma'lumot USTIGA.
  for (const dir of kutilayotganlar) await qolla(dir);
});

after(async () => {
  await client?.close?.();
});

// ---------- Migratsiyalar qo'llanishi ----------

test("kutilayotgan migratsiyalar ma'lumot ustiga xatosiz qo'llanadi", () => {
  // `before` ichida qo'llandi — bu yerga yetib kelgani xatosiz o'tganini bildiradi.
  assert.ok(kutilayotganlar.length >= 13, `kutilayotganlar: ${kutilayotganlar.length}`);
});

// ---------- Hech narsa yo'qolmadi ----------

test("barcha jadvallardagi yozuvlar soni o'zgarmadi", async () => {
  for (const [jadval, kutilgan] of Object.entries(oldingi)) {
    const hozir = await son(`SELECT COUNT(*) n FROM "${jadval}"`);
    assert.equal(hozir, kutilgan, `${jadval}: ${kutilgan} yozuvdan ${hozir} qoldi`);
  }
});

test("moliyaviy summalar buzilmadi", async () => {
  // 100 000 x (1+...+25) = 32 500 000, ustiga B2 dagi 500 000.
  assert.equal(await son(`SELECT SUM("summa") n FROM "Transaction"`), 33_000_000);
  assert.equal(await son(`SELECT SUM("jamiSumma") n FROM "Sale"`), 140_000);
  assert.equal(await son(`SELECT SUM("tolangan") n FROM "Debt"`), 20_000);
});

test("yozuvlarning maydonlari joyida qoldi", async () => {
  const s1: any = (await client.execute(`SELECT * FROM "Sale" WHERE "id"='S1'`)).rows[0];
  assert.equal(Number(s1.jamiSumma), 80_000);
  assert.equal(String(s1.mijozNomi), "Akmal");
  assert.equal(String(s1.tolovTuri), "naqd");

  const d1: any = (await client.execute(`SELECT * FROM "Debt" WHERE "id"='D1'`)).rows[0];
  assert.equal(String(d1.saleId), "S2", "sotuv bilan bog'lanish saqlanishi kerak");
  assert.equal(Number(d1.jamiSumma), 60_000);
});

// ---------- Yaxlitlik ----------

test("tashqi kalitlar va baza yaxlitligi buzilmadi", async () => {
  const fk = await client.execute("PRAGMA foreign_key_check");
  assert.equal(fk.rows.length, 0, `foreign_key_check: ${JSON.stringify(fk.rows.slice(0, 3))}`);

  const it: any = (await client.execute("PRAGMA integrity_check")).rows[0];
  assert.equal(String(it.integrity_check), "ok");
});

// ---------- Backfill ----------

test("Sale.sana eski yozuvlar uchun createdAt dan to'ldirildi", async () => {
  // Bu eng nozik joy: `sana` NOT NULL bo'lgani uchun bo'sh qolsa migratsiya
  // yiqilardi; noto'g'ri to'ldirilsa esa hisobotlar jimgina siljib ketardi.
  const rows: any[] = (
    await client.execute(`SELECT "id","sana","createdAt" FROM "Sale" ORDER BY "id"`)
  ).rows;
  assert.equal(rows.length, 2);

  const kun = (v: unknown) => String(v ?? "").slice(0, 10);
  assert.equal(kun(rows[0].sana), "2026-07-12", "S1 sanasi createdAt kuniga mos kelishi kerak");
  assert.equal(kun(rows[1].sana), "2026-07-18", "S2 sanasi createdAt kuniga mos kelishi kerak");
});

// ---------- Yangi sxema ----------

test("yangi ustunlar qo'shildi", async () => {
  const sale = await ustunlar("Sale");
  for (const u of ["sana", "deletedAt", "cancelledBy", "cancelReason", "contactId"]) {
    assert.ok(sale.includes(u), `Sale.${u} yo'q`);
  }
  assert.ok((await ustunlar("Transaction")).includes("accountId"), "Transaction.accountId yo'q");
  assert.ok((await ustunlar("Debt")).includes("contactId"), "Debt.contactId yo'q");
  assert.ok((await ustunlar("Contact")).includes("qarzLimit"), "Contact.qarzLimit yo'q");
  assert.ok((await ustunlar("AuditLog")).includes("tenantId"), "AuditLog.tenantId yo'q");

  const product = await ustunlar("Product");
  for (const u of ["sku", "birlik", "minQoldiq"]) {
    assert.ok(product.includes(u), `Product.${u} yo'q`);
  }
});

test("yangi jadvallar yaratildi", async () => {
  const jadvallar: string[] = (
    await client.execute("SELECT name FROM sqlite_master WHERE type='table'")
  ).rows.map((r: any) => String(r.name));

  for (const j of [
    "BotConversation", "AiConversation", "Account", "AccountTransfer", "StockAdjustment",
    "Supplier", "PurchaseOrder", "PurchaseOrderItem", "ApprovalRule", "ApprovalRequest",
    "Employee", "Attendance", "Payroll", "PayrollAdvance", "Contract", "Attachment",
  ]) {
    assert.ok(jadvallar.includes(j), `${j} jadvali yaratilmadi`);
  }
});

// ---------- Majburiy keyingi qadam ----------

test("kassa migratsiyasi eski tranzaksiyalarni default kassaga bog'laydi", async () => {
  // Bu qadam migratsiyadan KEYIN qo'lda ishga tushiriladi. Busiz kassa
  // qoldig'i haqiqiy pulni ko'rsatmaydi — shuning uchun u ham sinaladi.
  const oldin = await son(`SELECT COUNT(*) n FROM "Transaction" WHERE "accountId" IS NULL`);
  assert.equal(oldin, 26, "migratsiyadan keyin barcha eski yozuvlar kassasiz bo'ladi");

  const res = spawnSync(process.execPath, ["-r", "ts-node/register", "scripts/kassa-migratsiya.ts"], {
    env: { ...process.env, DATABASE_URL: URL },
    encoding: "utf8",
  });
  assert.equal(res.status, 0, `kassa:migratsiya yiqildi:\n${res.stdout}\n${res.stderr}`);

  const qolgan = await son(`SELECT COUNT(*) n FROM "Transaction" WHERE "accountId" IS NULL`);
  assert.equal(qolgan, 0, "hech bir tranzaksiya kassasiz qolmasligi kerak");

  // Har biznesga o'z kassasi ochiladi va yozuvlar aynan o'shanga bog'lanadi.
  const kassalar: any[] = (
    await client.execute(`SELECT "id","businessId" FROM "Account" ORDER BY "businessId"`)
  ).rows;
  assert.equal(kassalar.length, 2, "ikkala biznesga ham kassa ochilishi kerak");

  for (const k of kassalar) {
    const notogri = await son(
      `SELECT COUNT(*) n FROM "Transaction" t
       JOIN "Account" a ON a."id" = t."accountId"
       WHERE t."businessId" = '${String(k.businessId)}' AND a."businessId" <> t."businessId"`
    );
    assert.equal(notogri, 0, "tranzaksiya BOSHQA biznesning kassasiga bog'lanmasligi kerak");
  }
});

test("kassa migratsiyasi ikkinchi marta ishga tushirilsa hech narsa buzmaydi", async () => {
  // Idempotentlik: qo'llanmada "ishonchingiz komil bo'lmasa qayta ishga
  // tushiring" deyilgan, shuning uchun bu haqiqatan xavfsiz bo'lishi kerak.
  const kassaOldin = await son(`SELECT COUNT(*) n FROM "Account"`);

  const res = spawnSync(process.execPath, ["-r", "ts-node/register", "scripts/kassa-migratsiya.ts"], {
    env: { ...process.env, DATABASE_URL: URL },
    encoding: "utf8",
  });
  assert.equal(res.status, 0, `ikkinchi urinish yiqildi:\n${res.stdout}\n${res.stderr}`);

  assert.equal(await son(`SELECT COUNT(*) n FROM "Account"`), kassaOldin, "takroriy kassa ochilmasligi kerak");
  assert.equal(await son(`SELECT COUNT(*) n FROM "Transaction" WHERE "accountId" IS NULL`), 0);
  assert.equal(await son(`SELECT SUM("summa") n FROM "Transaction"`), 33_000_000, "summalar o'zgarmasligi kerak");
});

// ---------- Checksum himoyasi (H-5) ----------

test("qo'llangan migratsiya fayli o'zgargan bo'lsa skript to'xtaydi", async () => {
  // Alohida toza baza: bu suite asosiy bazaga migratsiyalarni to'g'ridan-to'g'ri
  // SQL bilan qo'llagan (_applied_migrations yo'q), checksum esa db-migrate.mjs
  // ning o'z jadvalida yashaydi.
  const CDB = "prisma/test-zanjir-checksum.db";
  rmSync(CDB, { force: true });
  const env = { ...process.env, DATABASE_URL: `file:./${CDB}` };

  const birinchi = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env, encoding: "utf8" });
  assert.equal(birinchi.status, 0, birinchi.stderr);

  const { createClient } = await import("@libsql/client");
  const c2 = createClient({ url: `file:./${CDB}` });
  try {
    const qator = await c2.execute("SELECT name FROM _applied_migrations ORDER BY name DESC LIMIT 1");
    const nom = String(qator.rows[0].name);

    // Fayl o'zgarishini taqlid qilamiz: bazadagi checksum boshqacha —
    // skript uchun bu "fayl bir xil nomda, boshqa mazmunda".
    await c2.execute({
      sql: "UPDATE _applied_migrations SET checksum = 'soxta-hash' WHERE name = ?",
      args: [nom],
    });
    const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env, encoding: "utf8" });
    assert.notEqual(res.status, 0, "checksum mos kelmasa skript yiqilishi shart");
    assert.match(res.stdout + res.stderr, /O'ZGARGAN/i);

    // NULL checksum (checksum'gacha qo'llangan eski yozuv) — backfill qilinadi.
    await c2.execute({
      sql: "UPDATE _applied_migrations SET checksum = NULL WHERE name = ?",
      args: [nom],
    });
    const qayta = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env, encoding: "utf8" });
    assert.equal(qayta.status, 0, qayta.stderr);
    assert.match(qayta.stdout, /checksum yozildi/);
  } finally {
    await c2.close?.();
    rmSync(CDB, { force: true });
  }
});
