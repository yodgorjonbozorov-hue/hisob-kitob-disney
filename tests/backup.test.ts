/**
 * ZAXIRA TESTLARI: to'liq dump -> JSON -> BOSHQA bazaga tiklash (round-trip).
 * Bu "server ko'chirish" stsenariysining aynan o'zi — sinalmagan zaxira zaxira emas.
 * Ishga tushirish: npm run test:backup
 */
process.env.DATABASE_URL = "file:./prisma/test-backup.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

const MAQSAD_DB = "file:./prisma/test-backup-maqsad.db";

let rawPrisma: any;
let maqsadPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let createTransactionSvc: any;
let backup: any;

let tA: any;
let tranzaksiyaId: string;

function migratsiya(dbUrl: string) {
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi (${dbUrl}):\n${res.stdout}\n${res.stderr}`);
}

before(async () => {
  rmSync("prisma/test-backup.db", { force: true });
  rmSync("prisma/test-backup-maqsad.db", { force: true });
  migratsiya("file:./prisma/test-backup.db");
  migratsiya(MAQSAD_DB);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction: createTransactionSvc } = await import("@/lib/services/transactionService"));
  backup = await import("@/lib/backup/dump");

  // Maqsad baza uchun alohida client (ko'chirishda "yangi server" rolini o'ynaydi).
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
  const { createClient } = await import("@libsql/client");
  maqsadPrisma = new PrismaClient({
    adapter: new PrismaLibSQL(createClient({ url: MAQSAD_DB })),
  });

  // Ikkita tenant + real tranzaksiya — zaxira tenantlar bo'ylab olinishi kerak.
  tA = await createTenantWithOwner({
    kompaniyaNomi: "Zaxira A",
    ism: "A egasi",
    login: "+998977777801",
    parol: "parol12345",
  });
  await createTenantWithOwner({
    kompaniyaNomi: "Zaxira B",
    ism: "B egasi",
    login: "+998977777802",
    parol: "parol12345",
  });

  await runWithTenant(tA.tenant.id, async () => {
    const cat = await rawPrisma.category.findFirst({
      where: { businessId: tA.business.id, turi: "kirim" },
    });
    const tr = await createTransactionSvc(tA.user.id, tA.business.id, {
      turi: "kirim",
      categoryId: cat.id,
      summa: 7_350_000,
      sana: "2026-08-01",
      izoh: "Zaxira sinovi",
    });
    tranzaksiyaId = tr.id;
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
  await maqsadPrisma?.$disconnect();
});

test("ZAXIRA_JADVALLARI schema'dagi BARCHA modellarni qamrab oladi", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modellar = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  const kutilgan = modellar.map((m) => m[0].toLowerCase() + m.slice(1));

  const yoq = kutilgan.filter((m) => !backup.ZAXIRA_JADVALLARI.includes(m));
  assert.deepEqual(
    yoq,
    [],
    `Bu modellar zaxiraga tushmaydi — src/lib/backup/dump.ts dagi ZAXIRA_JADVALLARI ga qo'shing: ${yoq.join(", ")}`
  );
  assert.equal(backup.ZAXIRA_JADVALLARI.length, modellar.length);
});

test("createDump: barcha tenantlar ma'lumotini oladi", async () => {
  const zaxira = await backup.createDump();

  assert.equal(zaxira.version, backup.BACKUP_VERSION);
  assert.equal(zaxira.counts.tenant, 2, "ikkala tenant ham zaxirada bo'lishi kerak");
  assert.equal(zaxira.counts.transaction, 1);
  assert.ok(backup.jamiYozuvlar(zaxira) > 5);
  // Har jadval uchun kalit bor (bo'sh bo'lsa ham) — tiklashda "yo'q jadval" bo'lmasligi uchun.
  for (const jadval of backup.ZAXIRA_JADVALLARI) {
    assert.ok(Array.isArray(zaxira.data[jadval]), `${jadval} massiv bo'lishi kerak`);
  }
});

test("round-trip: JSON orqali BOSHQA bazaga to'liq tiklanadi", async () => {
  const zaxira = await backup.createDump();
  // Aynan fayldagidek: JSON'ga aylantirib, qaytadan o'qiymiz (Date -> ISO satr bo'ladi).
  const fayldan = JSON.parse(JSON.stringify(zaxira));

  const yozilgan = await backup.restoreDump(fayldan, maqsadPrisma);

  for (const [jadval, soni] of Object.entries(zaxira.counts as Record<string, number>)) {
    assert.equal(yozilgan[jadval], soni, `${jadval} soni mos kelmadi`);
  }

  // Ma'lumot buzilmaganini tekshiramiz — summa, sana, bog'lanishlar.
  const tr = await maqsadPrisma.transaction.findUnique({
    where: { id: tranzaksiyaId },
    include: { category: true, business: true, user: true },
  });
  assert.ok(tr, "tranzaksiya tiklanishi kerak");
  assert.equal(tr.summa, 7_350_000);
  assert.equal(tr.izoh, "Zaxira sinovi");
  assert.equal(tr.sana.toISOString().slice(0, 10), "2026-08-01");
  assert.equal(tr.business.nomi, tA.business.nomi);
  assert.equal(tr.user.id, tA.user.id);

  // Ikkinchi tenant ham to'liq ko'chgan.
  const tenantlar = await maqsadPrisma.tenant.findMany({ orderBy: { name: "asc" } });
  assert.deepEqual(tenantlar.map((t: any) => t.name), ["Zaxira A", "Zaxira B"]);
});

test("restoreDump: bo'sh bo'lmagan bazaga force'siz yozmaydi", async () => {
  const zaxira = await backup.createDump();
  await assert.rejects(
    () => backup.restoreDump(zaxira, maqsadPrisma),
    /bo'sh emas/,
    "to'la bazaga tasodifan yozib yuborilmasligi kerak"
  );
});

test("restoreDump: versiya mos kelmasa rad etadi", async () => {
  const zaxira = await backup.createDump();
  await assert.rejects(
    () => backup.restoreDump({ ...zaxira, version: 999 }, maqsadPrisma),
    /versiyasi mos emas/
  );
});
