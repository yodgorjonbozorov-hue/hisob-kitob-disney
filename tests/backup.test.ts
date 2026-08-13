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

    // FK'ga boy fikstura: mijozga BOG'LANGAN sotuv va qarz, shartnoma va ilova.
    // Bularsiz round-trip testi tiklash TARTIBIDAGI xatoni sezmasdi — aynan
    // shunday xato bir marta o'tib ketgan edi (`contact` `sale` dan keyin turardi).
    const mijoz = await rawPrisma.contact.create({
      data: { businessId: tA.business.id, ism: "Zaxira mijozi", createdBy: tA.user.id, qarzLimit: 5_000_000 },
    });
    const mahsulot = await rawPrisma.product.create({
      data: { businessId: tA.business.id, nomi: "Zaxira tovari", kelganNarx: 1_000, sotuvNarx: 2_000, miqdor: 10 },
    });
    const sotuv = await rawPrisma.sale.create({
      data: {
        businessId: tA.business.id, productId: mahsulot.id, contactId: mijoz.id,
        miqdor: 2, birlikNarx: 2_000, tannarx: 1_000, jamiSumma: 4_000,
        tolovTuri: "qarz", sana: new Date("2026-08-01T00:00:00.000Z"), userId: tA.user.id,
      },
    });
    await rawPrisma.debt.create({
      data: {
        businessId: tA.business.id, turi: "olinadigan", saleId: sotuv.id, productId: mahsulot.id,
        contactId: mijoz.id, mijozNomi: "Zaxira mijozi", jamiSumma: 4_000, userId: tA.user.id,
      },
    });
    const taminotchi = await rawPrisma.supplier.create({
      data: { businessId: tA.business.id, nomi: "Zaxira ta'minotchisi" },
    });
    const shartnoma = await rawPrisma.contract.create({
      data: {
        businessId: tA.business.id, raqam: "ZX-1", nomi: "Zaxira shartnomasi",
        turi: "taminotchi", supplierId: taminotchi.id,
        boshlanish: new Date("2026-01-01T00:00:00.000Z"), userId: tA.user.id,
      },
    });
    await rawPrisma.attachment.create({
      data: {
        businessId: tA.business.id, entity: "contract", entityId: shartnoma.id,
        nomi: "Skan", url: "https://example.com/skan.pdf", userId: tA.user.id,
      },
    });
    const xodim = await rawPrisma.employee.create({
      data: { businessId: tA.business.id, ism: "Zaxira xodimi", stavka: 1_000_000 },
    });
    await rawPrisma.payroll.create({
      data: {
        businessId: tA.business.id, employeeId: xodim.id, oy: "2026-07",
        hisoblangan: 1_000_000, tolanadigan: 1_000_000, userId: tA.user.id,
      },
    });
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
  await maqsadPrisma?.$disconnect();
});

test("ZAXIRA_JADVALLARI schema'dagi BARCHA modellarni qamrab oladi", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const modellar = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);
  const kutilgan = modellar
    .map((m) => m[0].toLowerCase() + m.slice(1))
    // Vaqtinchalik holat jadvallari ataylab zaxiraga kirmaydi (dump.ts da ro'yxat bor).
    .filter((m) => !backup.ZAXIRASIZ_JADVALLAR.includes(m));

  const yoq = kutilgan.filter((m) => !backup.ZAXIRA_JADVALLARI.includes(m));
  assert.deepEqual(
    yoq,
    [],
    `Bu modellar zaxiraga tushmaydi — src/lib/backup/dump.ts dagi ZAXIRA_JADVALLARI ga qo'shing: ${yoq.join(", ")}`
  );
  assert.equal(backup.ZAXIRA_JADVALLARI.length + backup.ZAXIRASIZ_JADVALLAR.length, modellar.length);
});

test("ZAXIRA_JADVALLARI bog'liqlik tartibida — har jadval FK'laridan KEYIN", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  // Har model blokidagi FK-EGASI bo'lgan relatsiyalar: `@relation(fields: [...])`
  // yozilgan tomon. Ikkinchi (teskari) tomonda FK yo'q, shuning uchun u
  // tartibga ta'sir qilmaydi.
  const bloklar = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];
  const kichik = (m: string) => m[0].toLowerCase() + m.slice(1);

  const xatolar: string[] = [];
  for (const [, model, tana] of bloklar) {
    const jadval = kichik(model);
    const oz = backup.ZAXIRA_JADVALLARI.indexOf(jadval);
    if (oz === -1) continue; // zaxirasiz jadval

    for (const satr of tana.split("\n")) {
      const rel = satr.match(/^\s*\w+\s+(\w+)\??\s+@relation\(.*fields:/);
      if (!rel) continue;
      const bogliq = kichik(rel[1]);
      if (bogliq === jadval) continue; // o'ziga havola

      const uning = backup.ZAXIRA_JADVALLARI.indexOf(bogliq);
      if (uning === -1) continue;
      if (uning > oz) {
        xatolar.push(`${jadval} -> ${bogliq} (${jadval} ${oz}-o'rinda, ${bogliq} ${uning}-o'rinda)`);
      }
    }
  }

  assert.deepEqual(
    xatolar,
    [],
    "Tiklash tartibi buzilgan — quyidagi jadvallar o'z FK'laridan OLDIN yoziladi va " +
      `tiklash "Foreign key constraint violated" bilan to'xtaydi:\n  ${xatolar.join("\n  ")}`
  );
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

// ---------- Shifrlash (H-6) ----------

test("zaxira shifrlanadi va faqat to'g'ri kalit bilan ochiladi", async () => {
  const shifr = await import("@/lib/backup/shifr");
  const eski = process.env.BACKUP_ENCRYPTION_KEY;
  try {
    process.env.BACKUP_ENCRYPTION_KEY = "juda-maxfiy-parol-ibora";
    const asl = Buffer.from(JSON.stringify({ maxfiy: "moliyaviy ma'lumot", summa: 123 }));

    const shifrlangan = shifr.shifrla(asl);
    assert.equal(shifr.shifrlanganmi(shifrlangan), true);
    assert.ok(!shifrlangan.includes(Buffer.from("moliyaviy")), "mazmun ochiq ko'rinmasin");
    assert.deepEqual(shifr.deshifrla(shifrlangan), asl, "aylanish yo'qotishsiz");

    // Noto'g'ri kalit — aniq xato (GCM auth tag ushlaydi).
    process.env.BACKUP_ENCRYPTION_KEY = "boshqa-kalit";
    assert.throws(() => shifr.deshifrla(shifrlangan), /kalit noto'g'ri|buzilgan/);

    // Oddiy fayl shifrlangan deb tanilmaydi.
    assert.equal(shifr.shifrlanganmi(asl), false);
  } finally {
    if (eski === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = eski;
  }
});

// ---------- Oqimli dump (H-6) ----------

test("oqimli dump createDump bilan BIR XIL ma'lumotni chiqaradi", async () => {
  const bolaklar: string[] = [];
  const natija = await backup.dumpNiOqimgaYoz((s: string) => {
    bolaklar.push(s);
  });

  const oqimdan = JSON.parse(bolaklar.join(""));
  const oddiy = await backup.createDump();

  assert.equal(oqimdan.version, oddiy.version);
  assert.deepEqual(oqimdan.counts, oddiy.counts, "counts mos kelishi kerak");
  assert.equal(natija.jami, backup.jamiYozuvlar(oddiy));
  // Ma'lumot ham mos (JSON orqali — Date'lar ISO string bo'lib tenglashadi).
  assert.deepEqual(oqimdan.data, JSON.parse(JSON.stringify(oddiy.data)));
});

// ---------- Retention (sof funksiya) ----------

test("retention: 30 kunlik va oy boshi nusxalari qoladi, qolgani o'chadi", async () => {
  const { retentionOchiriladiganlar } = await import("@/lib/backup/send");
  const bugun = new Date("2026-08-13T03:00:00.000Z");

  const kalitlar = [
    "zaxira/balansa-zaxira-2026-08-12.json.gz.enc", // 1 kun — qoladi
    "zaxira/balansa-zaxira-2026-07-20.json.gz.enc", // 24 kun — qoladi
    "zaxira/balansa-zaxira-2026-07-01.json.gz.enc", // 43 kun, lekin oy boshi — qoladi
    "zaxira/balansa-zaxira-2026-06-15.json.gz.enc", // 59 kun — O'CHADI
    "zaxira/balansa-zaxira-2026-01-01.json.gz.enc", // oy boshi, 224 kun — qoladi
    "zaxira/balansa-zaxira-2025-05-01.json.gz.enc", // oy boshi, lekin 1 yildan eski — O'CHADI
    "zaxira/qolda-qoyilgan-fayl.bin", // sanasiz — tegilmaydi
  ];

  assert.deepEqual(retentionOchiriladiganlar(kalitlar, bugun).sort(), [
    "zaxira/balansa-zaxira-2025-05-01.json.gz.enc",
    "zaxira/balansa-zaxira-2026-06-15.json.gz.enc",
  ]);
});

// ---------- Tiklash mashqi: shifrlangan fayl + restore skripti ----------

test("shifrlangan gzip zaxira restore skripti bilan bo'sh bazaga tiklanadi", async () => {
  const { gzipSync } = await import("node:zlib");
  const { writeFileSync } = await import("node:fs");
  const shifr = await import("@/lib/backup/shifr");

  const RESTORE_DB = "prisma/test-backup-restore.db";
  rmSync(RESTORE_DB, { force: true });
  migratsiya(`file:./${RESTORE_DB}`);

  const eski = process.env.BACKUP_ENCRYPTION_KEY;
  const fayl = "prisma/test-backup-shifrlangan.enc";
  try {
    process.env.BACKUP_ENCRYPTION_KEY = "tiklash-mashqi-kaliti";

    const dump = await backup.createDump();
    writeFileSync(fayl, shifr.shifrla(gzipSync(Buffer.from(JSON.stringify(dump)))));

    const res = spawnSync(
      process.execPath,
      ["-r", "ts-node/register", "scripts/restore.ts", fayl, "--confirm"],
      {
        env: {
          ...process.env,
          DATABASE_URL: `file:./${RESTORE_DB}`,
          BACKUP_ENCRYPTION_KEY: "tiklash-mashqi-kaliti",
        },
        encoding: "utf8",
      }
    );
    assert.equal(res.status, 0, `restore yiqildi:\n${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, /Tiklandi/, "yaxlitlik hisoboti chiqishi kerak");

    // Noto'g'ri kalit bilan tiklash aniq xato bilan yiqiladi.
    const notogri = spawnSync(
      process.execPath,
      ["-r", "ts-node/register", "scripts/restore.ts", fayl, "--confirm"],
      {
        env: {
          ...process.env,
          DATABASE_URL: `file:./${RESTORE_DB}`,
          BACKUP_ENCRYPTION_KEY: "boshqa-kalit",
        },
        encoding: "utf8",
      }
    );
    assert.notEqual(notogri.status, 0);
    assert.match(notogri.stdout + notogri.stderr, /kalit noto'g'ri|buzilgan/);
  } finally {
    if (eski === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
    else process.env.BACKUP_ENCRYPTION_KEY = eski;
    rmSync(fayl, { force: true });
    rmSync(RESTORE_DB, { force: true });
  }
});
