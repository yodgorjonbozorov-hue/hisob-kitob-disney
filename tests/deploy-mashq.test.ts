/**
 * DEPLOY MASHQI — MIGRATSIYA PRODUCTION HOLATIDAGI BAZAGA QO'LLANADI,
 * SO'NG BUTUN SMOKE-TEST RO'YXATI O'SHA BAZADA O'TKAZILADI.
 *
 * ═══ NEGA KERAK ═══
 * Boshqa testlar BO'SH bazadan boshlaydi: ular kodni sinaydi, deploy yo'lini
 * emas. Production'da esa baza TO'LA va migratsiya uning USTIGA qo'llanadi.
 * Bu fayl aynan shu yo'lni bosib o'tadi:
 *
 *   1. Bazani MENING migratsiyamgacha bo'lgan holatda quradi va unga haqiqiy
 *      ma'lumot soladi (biznes, xodim, kassadagi pul, yutilgan zakaz + kirim,
 *      qarz, tarixdagi o'tkazma).
 *   2. `_applied_migrations` ni to'ldiradi — production'dagi hisobot shunday.
 *   3. Migratsiyani AYNAN deploy ishlatadigan skript bilan qo'llaydi
 *      (`scripts/db-migrate.mjs`), qo'lda SQL bilan emas.
 *   4. HECH NARSA yo'qolmaganini tekshiradi (yozuv soni, summalar, FK,
 *      integrity_check) va yangi ustunlar eski qatorlarda NULL ekanini.
 *   5. Migratsiyadan KEYINGI bazada butun smoke-test ro'yxatini bajaradi.
 *
 * Bu test HECH QACHON `migrate reset` yoki `db push --force-reset` ishlatmaydi:
 * migratsiya faqat QO'SHUVCHI (ALTER TABLE ADD COLUMN) va u shu yerda
 * isbotlanadi.
 *
 * Ishga tushirish: npm run test:deploy-mashq
 */
const DB = "prisma/test-deploy-mashq.db";
process.env.DATABASE_URL = `file:./${DB}`;

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

/* eslint-disable @typescript-eslint/no-explicit-any */
const MIGRATSIYALAR = "prisma/migrations";
/** Shu migratsiya deploy paytida qo'llanishi kerak (production'da hali yo'q). */
const YANGI_MIGRATSIYA = "20260905090000_zakaz_yoqotish_sababi_ochirgan";

let client: any;
let prisma: any;
let rawPrisma: any;
let runWithTenant: any;
let transferSvc: any;
let accountsQ: any;
let crm: any;
let yakunlash: any;

/** Migratsiyadan OLDINGI holat — keyin bir-biriga solishtiriladi. */
let oldingiSonlar: Record<string, number> = {};
let oldingiSummalar: Record<string, number> = {};
let qollanganlar: string[] = [];

const iso = (s: string) => new Date(s).toISOString();
const q = (sql: string, args: unknown[] = []) => client.execute({ sql, args });
const son = async (sql: string) => Number((await client.execute(sql)).rows[0].n ?? 0);
const ustunlar = async (jadval: string): Promise<string[]> =>
  (await client.execute(`PRAGMA table_info("${jadval}")`)).rows.map((r: any) => String(r.name));

/*
 * Tenant konteksti + AKTOR.
 *
 * So'rov ATAYLAB shu yerda `await` qilinadi: Prisma promise'i dangasa, ya'ni
 * `runWithTenant("T1", () => prisma...)` ko'rinishida so'rov kontekstdan
 * TASHQARIDA bajarilib, audit yozuvida "kim" bo'sh qolardi
 * (`lib/db/tenantContext.ts` dagi ogohlantirish). Bu yerda audit aktori ham
 * tekshirilgani uchun qoida qat'iy bajariladi.
 */
const A = <R>(fn: () => Promise<R>, aktor?: { userId: string; ism: string }): Promise<R> =>
  runWithTenant("T1", async () => await fn(), aktor ?? { userId: "U1", ism: "Direktor" });

const xodimAktor = { userId: "U2", ism: "Sotuvchi", rol: "SELLER" };
const direktorAktor = { userId: "U1", ism: "Direktor", rol: "OWNER" };

async function qoldiq(accountId: string): Promise<number> {
  const hammasi = await A(() => accountsQ.getAccountBalances("B1"));
  return hammasi.find((k: any) => k.id === accountId)?.qoldiq ?? 0;
}

/** Audit jurnalidagi oxirgi yozuvlar (entity bo'yicha). */
async function auditlar(entity: string, entityId?: string) {
  return A(() =>
    prisma.auditLog.findMany({
      where: { entity, ...(entityId ? { entityId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
  );
}

before(async () => {
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${DB}${s}`, { force: true });

  const { createClient } = await import("@libsql/client");
  client = createClient({ url: `file:./${DB}` });

  const hammasi = readdirSync(MIGRATSIYALAR)
    .filter((d) => existsSync(join(MIGRATSIYALAR, d, "migration.sql")))
    .sort();
  const chegara = hammasi.indexOf(YANGI_MIGRATSIYA);
  assert.ok(chegara >= 0, `${YANGI_MIGRATSIYA} topilmadi`);
  qollanganlar = hammasi.slice(0, chegara);

  // ─── 1. PRODUCTION HOLATI: yangi migratsiyagacha bo'lgan sxema ───
  for (const dir of qollanganlar) {
    await client.executeMultiple(readFileSync(join(MIGRATSIYALAR, dir, "migration.sql"), "utf8"));
  }

  // ─── 2. HAQIQIY MA'LUMOT (deploy buzmasligi kerak bo'lgan narsa) ───
  await q(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","bepul","createdAt","updatedAt")
     VALUES ('T1','Disney Navoiy','disney','ACTIVE','PRO',0,?,?)`,
    [iso("2026-01-10"), iso("2026-01-10")]
  );
  await q(
    `INSERT INTO "Business" ("id","nomi","isActive","omborli","turi","shaxsiyKassa","createdAt","tenantId")
     VALUES ('B1','Disney Navoiy',1,0,'xizmat',1,?,'T1')`,
    [iso("2026-01-10")]
  );
  await q(
    `INSERT INTO "User" ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId","businessId")
     VALUES ('U1','Direktor','+998900000001','h','OWNER',1,?,0,'T1','B1'),
            ('U2','Sotuvchi','+998900000002','h','SELLER',1,?,0,'T1','B1')`,
    [iso("2026-01-10"), iso("2026-01-11")]
  );
  await q(
    `INSERT INTO "Category" ("id","nomi","turi","businessId","isActive","tartib","kgAsosli")
     VALUES ('C1','Bantik','kirim','B1',1,0,0), ('C2','Xarajat','chiqim','B1',1,1,0)`
  );
  await q(
    `INSERT INTO "Stage" ("id","businessId","nomi","turi","tartib")
     VALUES ('S-OPEN','B1','Kutilayotgan zakazlar','OPEN',0),
            ('S-JAR','B1','Jarayonda','OPEN',1),
            ('S-WON','B1','Yutildi','WON',2),
            ('S-LOST','B1','Yo''qotildi','LOST',3)`
  );
  await q(
    `INSERT INTO "Account" ("id","businessId","nomi","turi","userId","isActive","tartib","createdAt")
     VALUES ('K-ASOSIY','B1','Asosiy kassa','naqd',NULL,1,1,?),
            ('K-XODIM','B1','Sotuvchi (shaxsiy)','naqd','U2',1,10,?)`,
    [iso("2026-01-10"), iso("2026-01-11")]
  );
  // Xodim kassasidagi pul. Kirim 6 250 000, undan 100 000 avval topshirilgan
  // (pastdagi AT-ESKI) — qoldiq aynan FINAL FLOW dagi 6 150 000 bo'ladi.
  await q(
    `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","summa","sana","userId","accountId","tolovTuri","createdAt")
     VALUES ('TR-1','kirim','C1','B1',6250000,?,'U2','K-XODIM','naqd',?),
            ('TR-2','kirim','C1','B1',2000000,?,'U1','K-ASOSIY','naqd',?)`,
    [iso("2026-09-01"), iso("2026-09-01"), iso("2026-08-20"), iso("2026-08-20")]
  );
  // Tarixdagi eski zakazlar: biri YUTILDI (kirimga bog'langan), biri YOQOTILDI
  // (yangi ustunlarsiz — migratsiyadan keyin sabab NULL bo'lib qolishi kerak).
  await q(
    `INSERT INTO "Contact" ("id","businessId","ism","tel","createdBy","createdAt")
     VALUES ('CT-1','B1','Eski mijoz','+998901234567','U1',?)`,
    [iso("2026-08-01")]
  );
  await q(
    `INSERT INTO "Deal" ("id","businessId","nomi","summa","stageId","masulId","holat","tolangan","tolovTuri","categoryId","contactId","sana","transactionId","createdAt")
     VALUES ('D-ESKI-WON','B1','Eski yutilgan zakaz',2000000,'S-WON','U1','YUTILDI',2000000,'naqd','C1','CT-1',?,'TR-2',?)`,
    [iso("2026-08-20"), iso("2026-08-20")]
  );
  await q(
    `INSERT INTO "Deal" ("id","businessId","nomi","summa","stageId","masulId","holat","tolangan","categoryId","sana","yopilganAt","createdAt")
     VALUES ('D-ESKI-LOST','B1','Eski yo''qotilgan zakaz',900000,'S-LOST','U1','YOQOTILDI',0,'C1',?,?,?)`,
    [iso("2026-08-15"), iso("2026-08-16"), iso("2026-08-15")]
  );
  await q(
    `INSERT INTO "Debt" ("id","businessId","turi","mijozNomi","jamiSumma","tolangan","isYopilgan","status","userId","sana","createdAt","updatedAt")
     VALUES ('DB-1','B1','olinadigan','Eski qarzdor',450000,150000,0,'PARTIALLY_PAID','U1',?,?,?)`,
    [iso("2026-08-10"), iso("2026-08-10"), iso("2026-08-10")]
  );
  await q(
    `INSERT INTO "AccountTransfer" ("id","businessId","fromAccountId","toAccountId","summa","valyuta","sana","userId","turi","holat","createdAt")
     VALUES ('AT-ESKI','B1','K-XODIM','K-ASOSIY',100000,'UZS',?,'U2','smena','bajarildi',?)`,
    [iso("2026-08-05"), iso("2026-08-05")]
  );

  // ─── 3. `_applied_migrations` — production'dagi hisobot ───
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"
  );
  for (const d of qollanganlar) {
    await q("INSERT INTO _applied_migrations (name) VALUES (?)", [d]);
  }

  // ─── 4. Migratsiyadan OLDINGI surat ───
  const jadvallar = ["Tenant", "Business", "User", "Category", "Stage", "Account", "Transaction", "Deal", "Contact", "Debt", "AccountTransfer"];
  for (const j of jadvallar) {
    oldingiSonlar[j] = await son(`SELECT COUNT(*) n FROM "${j}"`);
  }
  oldingiSummalar.transaction = await son(`SELECT SUM("summa") n FROM "Transaction"`);
  oldingiSummalar.deal = await son(`SELECT SUM("summa") n FROM "Deal"`);
  oldingiSummalar.debt = await son(`SELECT SUM("jamiSumma") n FROM "Debt"`);
  oldingiSummalar.debtTolangan = await son(`SELECT SUM("tolangan") n FROM "Debt"`);
  oldingiSummalar.transfer = await son(`SELECT SUM("summa") n FROM "AccountTransfer"`);

  // ─── 5. DEPLOY YO'LI: aynan build zanjiridagi skript ───
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: `file:./${DB}` },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`db-migrate.mjs yiqildi:\n${res.stdout}\n${res.stderr}`);
  (globalThis as any).__migrateChiqish = res.stdout;

  // ─── 6. Migratsiyadan KEYIN ilova qatlamini yuklaymiz ───
  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  transferSvc = await import("@/lib/services/kassaTransfer");
  accountsQ = await import("@/lib/queries/accounts");
  crm = await import("@/lib/crm/service");
  yakunlash = await import("@/lib/crm/yakunlash");
});

after(async () => {
  await rawPrisma?.$disconnect();
  await client?.close?.();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1-BO'LIM — MIGRATSIYA DEPLOY PAYTIDA QO'LLANDIMI
// ═══════════════════════════════════════════════════════════════════════════

test("db-migrate.mjs faqat KUTAYOTGAN migratsiyani qo'lladi", async () => {
  const chiqish = String((globalThis as any).__migrateChiqish);
  assert.match(chiqish, new RegExp(`qo'llandi: ${YANGI_MIGRATSIYA}`), "yangi migratsiya qo'llanishi kerak");
  // Allaqachon qo'llanganlar QAYTA ishga tushmaydi (idempotentlik).
  assert.match(chiqish, /o'tkazib yuborildi \(allaqachon\)/);
  const qollanganSoni = (chiqish.match(/qo'llandi:/g) ?? []).length;
  assert.equal(qollanganSoni, 1, "faqat bitta yangi migratsiya qo'llanishi kerak");
});

test("hisobot jadvaliga yozildi — qayta deployda takrorlanmaydi", async () => {
  const bor = await son(
    `SELECT COUNT(*) n FROM _applied_migrations WHERE name = '${YANGI_MIGRATSIYA}'`
  );
  assert.equal(bor, 1);

  // Ikkinchi marta ishga tushirish — hech narsa o'zgarmasligi kerak.
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: `file:./${DB}` },
    encoding: "utf8",
  });
  assert.equal(res.status, 0);
  assert.equal((res.stdout.match(/qo'llandi:/g) ?? []).length, 0, "qayta deploy hech narsa qo'llamaydi");
});

// ═══════════════════════════════════════════════════════════════════════════
// 2-BO'LIM — MAVJUD MA'LUMOT BUZILMADI
// ═══════════════════════════════════════════════════════════════════════════

test("barcha jadvallardagi yozuvlar soni O'ZGARMADI", async () => {
  for (const [jadval, kutilgan] of Object.entries(oldingiSonlar)) {
    const hozir = await son(`SELECT COUNT(*) n FROM "${jadval}"`);
    assert.equal(hozir, kutilgan, `${jadval}: ${kutilgan} yozuvdan ${hozir} qoldi`);
  }
});

test("moliyaviy summalar O'ZGARMADI", async () => {
  assert.equal(await son(`SELECT SUM("summa") n FROM "Transaction"`), oldingiSummalar.transaction);
  assert.equal(await son(`SELECT SUM("summa") n FROM "Deal"`), oldingiSummalar.deal);
  assert.equal(await son(`SELECT SUM("jamiSumma") n FROM "Debt"`), oldingiSummalar.debt);
  assert.equal(await son(`SELECT SUM("tolangan") n FROM "Debt"`), oldingiSummalar.debtTolangan);
  assert.equal(await son(`SELECT SUM("summa") n FROM "AccountTransfer"`), oldingiSummalar.transfer);
});

test("eski zakaz, qarz va o'tkazma maydonlari joyida", async () => {
  const won: any = (await client.execute(`SELECT * FROM "Deal" WHERE "id"='D-ESKI-WON'`)).rows[0];
  assert.equal(String(won.holat), "YUTILDI");
  assert.equal(String(won.transactionId), "TR-2", "kirim bog'lanishi saqlanishi kerak");
  assert.equal(Number(won.summa), 2_000_000);
  assert.equal(String(won.contactId), "CT-1");

  const qarz: any = (await client.execute(`SELECT * FROM "Debt" WHERE "id"='DB-1'`)).rows[0];
  assert.equal(Number(qarz.jamiSumma), 450_000);
  assert.equal(Number(qarz.tolangan), 150_000);
  assert.equal(String(qarz.status), "PARTIALLY_PAID");

  const tr: any = (await client.execute(`SELECT * FROM "AccountTransfer" WHERE "id"='AT-ESKI'`)).rows[0];
  assert.equal(String(tr.holat), "bajarildi", "eski topshirish tarixi tegilmaydi");
});

test("baza yaxlitligi va tashqi kalitlar buzilmadi", async () => {
  const fk = await client.execute("PRAGMA foreign_key_check");
  assert.equal(fk.rows.length, 0, `foreign_key_check: ${JSON.stringify(fk.rows.slice(0, 3))}`);
  const it: any = (await client.execute("PRAGMA integrity_check")).rows[0];
  assert.equal(String(it.integrity_check), "ok");
});

test("yangi ustunlar qo'shildi va eski qatorlarda NULL", async () => {
  const deal = await ustunlar("Deal");
  assert.ok(deal.includes("yoqotishSababi"), "Deal.yoqotishSababi yo'q");
  assert.ok(deal.includes("deletedBy"), "Deal.deletedBy yo'q");
  assert.ok((await ustunlar("Transaction")).includes("deletedBy"), "Transaction.deletedBy yo'q");

  // Eski yozuvlarga hech narsa MAJBURLANMAYDI — ular NULL bo'lib qoladi.
  const bosh = await son(
    `SELECT COUNT(*) n FROM "Deal" WHERE "yoqotishSababi" IS NULL AND "deletedBy" IS NULL`
  );
  assert.equal(bosh, oldingiSonlar.Deal, "eski zakazlarda yangi ustunlar NULL bo'lishi kerak");
  assert.equal(
    await son(`SELECT COUNT(*) n FROM "Transaction" WHERE "deletedBy" IS NULL`),
    oldingiSonlar.Transaction
  );
});

test("eski yo'qotilgan zakaz o'chib ketmadi — arxivda sababsiz turadi", async () => {
  const lost = await A(() => prisma.deal.findFirst({ where: { id: "D-ESKI-LOST" } }));
  assert.ok(lost, "eski yo'qotilgan zakaz joyida");
  assert.equal(lost.holat, "YOQOTILDI");
  assert.equal(lost.yoqotishSababi, null, "eski yozuvga sabab to'qib qo'yilmaydi");
  assert.equal(lost.deletedAt, null);
});

// ═══════════════════════════════════════════════════════════════════════════
// 3-BO'LIM — SMOKE: KASSA TOPSHIRISH OQIMI
// ═══════════════════════════════════════════════════════════════════════════

let topshiriqId = "";

test("SMOKE 1: xodim kassasida pul bor", async () => {
  assert.equal(await qoldiq("K-XODIM"), 6_150_000);
  assert.equal(await qoldiq("K-ASOSIY"), 2_100_000, "2 000 000 kirim + 100 000 eski topshirish");
});

test("SMOKE 2: 'Kassa topshirish' bosilgach pul DARHOL 0 bo'lmaydi", async () => {
  const tr = await A(
    () =>
      transferSvc.kassaTransferYarat("B1", xodimAktor, {
        toAccountId: "K-ASOSIY",
        summa: 6_150_000,
        turi: "smena",
      }),
    { userId: "U2", ism: "Sotuvchi" }
  );
  topshiriqId = tr.id;

  assert.equal(tr.holat, "kutilmoqda", "holat 'Qabul kutilmoqda' bo'lishi kerak");
  assert.equal(await qoldiq("K-XODIM"), 6_150_000, "pul hali xodim kassasida");
  assert.equal(await qoldiq("K-ASOSIY"), 2_100_000, "direktor kassasiga hali tushmagan");
});

test("SMOKE 3: direktorda 'Qabul kutilmoqda' ro'yxatida chiqadi", async () => {
  const royxat = await A(() => accountsQ.listTopshirishlar("B1", ["kutilmoqda"], 50));
  assert.equal(royxat.length, 1);
  assert.equal(royxat[0].id, topshiriqId);
  assert.equal(royxat[0].summa, 6_150_000);
  assert.equal(royxat[0].fromUserIsm, "Sotuvchi", "xodim ismi ko'rinadi");
  assert.equal(royxat[0].fromNomi, "Sotuvchi (shaxsiy)", "qaysi kassa ekani ko'rinadi");
  assert.ok(royxat[0].createdAt, "sana/vaqt ko'rinadi");
  assert.equal(royxat[0].hisoblangan, 6_150_000, "tizim hisobi muzlatilgan");
  assert.equal(royxat[0].farq, 0);
});

test("SMOKE 4: DOUBLE SUBMIT — ikkinchi topshirish o'tmaydi", async () => {
  await assert.rejects(
    () =>
      A(
        () =>
          transferSvc.kassaTransferYarat("B1", xodimAktor, {
            toAccountId: "K-ASOSIY",
            summa: 6_150_000,
            turi: "smena",
          }),
        { userId: "U2", ism: "Sotuvchi" }
      ),
    /yetarli mablag'|kutayotgan smena topshirig'i|allaqachon tasdiq kutmoqda/
  );

  const royxat = await A(() => accountsQ.listTopshirishlar("B1", ["kutilmoqda"], 50));
  assert.equal(royxat.length, 1, "ikkinchi topshiriq bazaga tushmasligi kerak");
  assert.equal(await qoldiq("K-XODIM"), 6_150_000);
});

test("SMOKE 5: direktor 'Qabul qilish' — shundan KEYIN kassa 0 bo'ladi", async () => {
  const jamiOldin =
    (await qoldiq("K-XODIM")) + (await qoldiq("K-ASOSIY"));

  await A(() => transferSvc.kassaTransferQaror("B1", direktorAktor, topshiriqId, { amal: "qabul" }));

  assert.equal(await qoldiq("K-XODIM"), 0, "xodim kassasi endi 0");
  assert.equal(await qoldiq("K-ASOSIY"), 8_250_000, "2 100 000 + 6 150 000");
  assert.equal(
    (await qoldiq("K-XODIM")) + (await qoldiq("K-ASOSIY")),
    jamiOldin,
    "jami pul o'zgarmaydi — faqat joyi"
  );

  const tarix = await A(() => accountsQ.listTopshirishlar("B1", ["bajarildi"], 50));
  assert.equal(tarix.filter((t: any) => t.id === topshiriqId)[0].holat, "bajarildi");
});

test("SMOKE 6: RAD ETISH — pul xodim kassasida qoladi", async () => {
  await A(() =>
    prisma.transaction.create({
      data: {
        id: "TR-RAD",
        turi: "kirim",
        categoryId: "C1",
        businessId: "B1",
        summa: 500_000,
        sana: new Date("2026-09-05"),
        userId: "U2",
        accountId: "K-XODIM",
        tolovTuri: "naqd",
      },
    })
  );
  assert.equal(await qoldiq("K-XODIM"), 500_000);

  const tr = await A(
    () =>
      transferSvc.kassaTransferYarat("B1", xodimAktor, {
        toAccountId: "K-ASOSIY",
        summa: 500_000,
        turi: "smena",
      }),
    { userId: "U2", ism: "Sotuvchi" }
  );
  await A(() => transferSvc.kassaTransferQaror("B1", direktorAktor, tr.id, { amal: "rad" }));

  assert.equal(await qoldiq("K-XODIM"), 500_000, "rad — pul joyida");
  assert.equal(await qoldiq("K-ASOSIY"), 8_250_000, "asosiy kassa o'zgarmadi");
});

// ═══════════════════════════════════════════════════════════════════════════
// 4-BO'LIM — SMOKE: CRM
// ═══════════════════════════════════════════════════════════════════════════

let yoqotilganId = "";
let yutilganId = "";

const zakazYarat = (nomi: string, opts: any = {}) =>
  A(() =>
    crm.createDeal({
      businessId: "B1",
      nomi,
      categoryId: "C1",
      summa: opts.summa ?? 0,
      tolangan: opts.tolangan ?? 0,
      tolovTuri: opts.tolovTuri === undefined ? "naqd" : opts.tolovTuri,
      sana: "2026-09-05",
      kontaktIsm: `Mijoz ${nomi}`,
      userId: "U1",
    })
  );

test("SMOKE 7: zakazni 'Yo'qotildi' qilish — sabab yoziladi", async () => {
  const d = await zakazYarat("Yo'qotiladigan zakaz", { summa: 800_000, tolangan: 0, tolovTuri: null });
  yoqotilganId = d.id;

  await A(() =>
    crm.holatniOzgartirish({
      businessId: "B1",
      dealId: d.id,
      holat: "YOQOTILDI",
      userId: "U1",
      yoqotishSababi: "Narx kelishmadi",
    })
  );

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.holat, "YOQOTILDI");
  assert.equal(keyin.yoqotishSababi, "Narx kelishmadi", "sabab saqlanadi");
  assert.ok(keyin.yopilganAt, "yo'qotilgan sana yoziladi");
  assert.equal(keyin.deletedAt, null, "zakaz o'chmaydi");
});

test("SMOKE 8: direktor doskasida 'Yo'qotildi' ustuni to'ladi", async () => {
  const pipeline = await import("@/lib/crm/pipeline");
  assert.ok(pipeline.USTUNLAR.includes("YOQOTILDI"), "ustun ro'yxatida bo'lishi kerak");

  const sahifa = await A(() =>
    crm.ustunSahifasi("B1", "YOQOTILDI", {}, { bugun: "2026-09-05" })
  );
  const idlar = sahifa.deals.map((d: any) => d.id);
  assert.ok(idlar.includes(yoqotilganId), "yangi yo'qotilgan zakaz ustunda");
  assert.ok(idlar.includes("D-ESKI-LOST"), "eski yo'qotilgan zakaz ham ko'rinadi");
  assert.equal(sahifa.jami, 2);
});

test("SMOKE 9: yo'qotilgan zakazni 'Jarayonda' ga qaytarish — sabab tozalanadi", async () => {
  await A(() =>
    crm.holatniOzgartirish({
      businessId: "B1",
      dealId: yoqotilganId,
      holat: "JARAYONDA",
      userId: "U1",
      boshqaruvchi: true,
    })
  );
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: yoqotilganId } }));
  assert.equal(keyin.holat, "JARAYONDA");
  assert.equal(keyin.yoqotishSababi, null, "sabab osilib qolmaydi");
  assert.equal(keyin.yopilganAt, null);
});

test("SMOKE 10: 'Yutildi' zakazni qaytarish — kirim o'chadi, kassa tiklanadi", async () => {
  const d = await zakazYarat("Yutiladigan zakaz", { summa: 1_200_000, tolangan: 1_200_000 });
  yutilganId = d.id;
  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: "B1", dealId: d.id, userId: "U1" }));
  assert.equal(n.kirimSumma, 1_200_000);

  const kassaYutilgach = await qoldiq("K-ASOSIY");

  await A(() =>
    crm.holatniOzgartirish({
      businessId: "B1",
      dealId: d.id,
      holat: "JARAYONDA",
      userId: "U1",
      boshqaruvchi: true,
    })
  );

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.holat, "JARAYONDA");
  assert.equal(keyin.transactionId, null);

  const kirim = await A(() => prisma.transaction.findFirst({ where: { id: n.transactionId } }));
  assert.ok(kirim.deletedAt, "kirim YUMSHOQ o'chadi — savatda qoladi");
  assert.equal(kirim.deletedBy, "U1", "kim o'chirgani yozuvda");
  assert.ok((await qoldiq("K-ASOSIY")) < kassaYutilgach, "pul kassadan chiqdi");
});

test("SMOKE 11: direktor nom, mijoz, telefon, sana va mas'ulni tahrirlaydi", async () => {
  await A(() =>
    prisma.deal.update({
      where: { id: yutilganId },
      data: { nomi: "Tuzatilgan nom", sana: new Date("2026-09-07"), masulId: "U2" },
    })
  );
  await A(() =>
    crm.zakazMijoziniOzgartirish({
      businessId: "B1",
      dealId: yutilganId,
      userId: "U1",
      kontaktIsm: "Tuzatilgan Mijoz",
      kontaktTel: "+998907776655",
    })
  );

  const keyin = await A(() =>
    prisma.deal.findFirst({ where: { id: yutilganId }, include: { contact: true } })
  );
  assert.equal(keyin.nomi, "Tuzatilgan nom");
  assert.equal(keyin.masulId, "U2");
  assert.equal(keyin.sana.toISOString().slice(0, 10), "2026-09-07");
  assert.equal(keyin.contact.ism, "Tuzatilgan Mijoz");
  assert.equal(keyin.contact.tel, "+998907776655");
});

test("SMOKE 12: moliyaga o'tgan zakaz o'chirilmaydi, qaytarilgach o'chadi (soft)", async () => {
  // Moliyaga o'tgan zakaz — himoya ishlaydi.
  await assert.rejects(
    () => A(() => crm.zakazniOchirish({ businessId: "B1", dealId: "D-ESKI-WON", userId: "U1" })),
    /Moliyaga o'tgan zakaz o'chirilmaydi/
  );
  const esli = await A(() => prisma.deal.findFirst({ where: { id: "D-ESKI-WON" } }));
  assert.equal(esli.deletedAt, null, "eski zakaz tegilmadi");

  // Qaytarilgan zakaz — o'chadi, lekin YUMSHOQ.
  await A(() => crm.zakazniOchirish({ businessId: "B1", dealId: yutilganId, userId: "U1" }));
  const ochirilgan = await A(() => prisma.deal.findFirst({ where: { id: yutilganId } }));
  assert.ok(ochirilgan, "yozuv bazadan yo'qolmaydi");
  assert.ok(ochirilgan.deletedAt);
  assert.equal(ochirilgan.deletedBy, "U1");
});

// ═══════════════════════════════════════════════════════════════════════════
// 5-BO'LIM — SMOKE: AUDIT JURNALI
// ═══════════════════════════════════════════════════════════════════════════

test("SMOKE 13: kassa qabul qilish auditga tushdi", async () => {
  const yozuvlar = await auditlar("accountTransfer", topshiriqId);
  const qabul = yozuvlar.find((a: any) => JSON.parse(a.after ?? "{}").amal === "qabul");
  assert.ok(qabul, "qabul qilish audit yozuvi bo'lishi kerak");
  const after = JSON.parse(qabul.after);
  assert.equal(after.holat, "bajarildi");
  assert.equal(after.summa, 6_150_000);
  assert.equal(after.qaror, "Direktor", "kim qabul qilgani yoziladi");
});

test("SMOKE 14: yo'qotildi va qaytarish auditga tushdi", async () => {
  // Holat o'zgarishi avtomatik audit (tenantDb extension) orqali yoziladi.
  const yozuvlar = await auditlar("deal", yoqotilganId);
  const holatlar = yozuvlar
    .map((a: any) => JSON.parse(a.after ?? "{}").holat)
    .filter(Boolean);
  assert.ok(holatlar.includes("YOQOTILDI"), `yo'qotish yozilmadi: ${JSON.stringify(holatlar)}`);
  assert.ok(holatlar.includes("JARAYONDA"), "qaytarish yozilmadi");

  const sabablar = yozuvlar.map((a: any) => JSON.parse(a.after ?? "{}").yoqotishSababi);
  assert.ok(sabablar.includes("Narx kelishmadi"), "sabab ham auditda");
});

test("SMOKE 15: 'Yutildi'dan qaytarish auditda alohida hodisa", async () => {
  const yozuvlar = await auditlar("deal", yutilganId);
  const qaytarish = yozuvlar.find(
    (a: any) => JSON.parse(a.after ?? "{}").amal === "yutildidan-qaytarish"
  );
  assert.ok(qaytarish, "qaytarish audit yozuvi bo'lishi kerak");
  const after = JSON.parse(qaytarish.after);
  assert.equal(after.kirimSumma, 1_200_000);
  assert.equal(after.ochirilganKirimlar.length, 1);
});

test("SMOKE 16: tahrir va o'chirish auditga tushdi", async () => {
  const yozuvlar = await auditlar("deal", yutilganId);

  const tahrir = yozuvlar.find((a: any) => JSON.parse(a.after ?? "{}").nomi === "Tuzatilgan nom");
  assert.ok(tahrir, "nom tahriri auditda");
  assert.equal(tahrir.action, "update");

  // O'chirish BIZNES hodisasi sifatida — aniq `entityId` va "delete" amali
  // bilan (xizmat qatlamida yoziladi, shuning uchun route'dan tashqarida ham).
  const ochirish = yozuvlar.find((a: any) => a.action === "delete");
  assert.ok(ochirish, "o'chirish auditda");
  assert.equal(JSON.parse(ochirish.after).deletedBy, "U1");
  assert.equal(JSON.parse(ochirish.before).nomi, "Tuzatilgan nom", "o'chirilgan yozuvning holati saqlanadi");
  assert.equal(ochirish.userId, "U1", "kim o'chirgani auditda");
});

test("SMOKE 17: audit yozuvlarida kim va qachon bor", async () => {
  const yozuvlar = await auditlar("deal");
  assert.ok(yozuvlar.length > 0);
  for (const a of yozuvlar.slice(0, 5)) {
    assert.ok(a.createdAt, "qachon");
    assert.ok(a.userId, "kim");
    assert.equal(a.tenantId, "T1", "tenant izolyatsiyasi");
  }
});
