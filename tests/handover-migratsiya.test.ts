/**
 * LEGACY `CashHandover` → ACCOUNT LEDGER MIGRATSIYASI TESTLARI.
 *
 * ENG MUHIM INVARIANT: migratsiya PUL HARAKATI EMAS, TARIX ko'chirish.
 * Legacy tizim ledgerga ataylab tegmagan, shuning uchun uni "qayta o'ynatish"
 * pul yaratish bo'lardi. Har ko'chirilgan qator `holat = "arxiv"` va
 * `fromAccountId = toAccountId` — ya'ni qoldiqqa ta'siri IKKI QAVAT NOL.
 *
 * Ishga tushirish: npm run test:handover-migratsiya
 */
process.env.DATABASE_URL = "file:./prisma/test-handover-migratsiya.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let accountsQ: any;
let txQueries: any;
let migratsiyaBajar: any;
let createTenantWithOwner: any;
let createTransaction: any;

let T: any;
let murod: any;
let javlon: any;
let umumiyKassa: string;
let kirimCat: any;

/** Migratsiyadan OLDIN olingan surat — sverka uchun. */
let oldingiKesim: { id: string; qoldiq: number }[] = [];
let oldingiMoliya: { kirim: number; chiqim: number; soni: number };

function A<T2>(fn: () => Promise<T2>): Promise<T2> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

async function kesim() {
  const q = await A(async () => accountsQ.getAccountBalances(T.business.id));
  return q.map((k: any) => ({ id: k.id, qoldiq: k.qoldiq })).sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
}

async function jami() {
  return A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));
}

async function moliya() {
  return A(async () => {
    const r = await txQueries.listTransactions({ businessId: T.business.id });
    return { kirim: r.totals.jamiKirim, chiqim: r.totals.jamiChiqim, soni: r.total };
  });
}

before(async () => {
  rmSync("prisma/test-handover-migratsiya.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  accountsQ = await import("@/lib/queries/accounts");
  txQueries = await import("@/lib/queries/transactions");
  ({ migratsiyaBajar } = await import("../scripts/kassa-handover-migratsiya"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));

  T = await createTenantWithOwner({
    kompaniyaNomi: "Handover Test",
    ism: "Direktor",
    login: "+998910200001",
    parol: "parol12345",
  });

  murod = await rawPrisma.user.create({
    data: {
      ism: "Murod",
      login: "+998910200010",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: T.tenant.id,
      businessId: T.business.id,
    },
  });
  javlon = await rawPrisma.user.create({
    data: {
      ism: "Javlon",
      login: "+998910200011",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: T.tenant.id,
      businessId: T.business.id,
    },
  });

  kirimCat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: T.business.id, turi: "kirim" } })
  );
  umumiyKassa = (
    await A(async () => prisma.account.findFirst({ where: { businessId: T.business.id } }))
  ).id;

  // ESKI DUNYO: kassirlar naqd yozuv kiritgan (pul UMUMIY kassaga tushgan,
  // chunki shaxsiy kassa rejimi hali yo'q edi).
  await A(async () =>
    createTransaction(murod.id, T.business.id, {
      turi: "kirim",
      categoryId: kirimCat.id,
      summa: 6_200_000,
      sana: "2026-08-16",
      tolovTuri: "naqd",
    })
  );
  await A(async () =>
    createTransaction(javlon.id, T.business.id, {
      turi: "kirim",
      categoryId: kirimCat.id,
      summa: 8_500_000,
      sana: "2026-08-16",
      tolovTuri: "naqd",
    })
  );

  // ESKI TOPSHIRIQLAR — to'g'ridan-to'g'ri legacy jadvalga (oqim endi yopiq).
  const handover = (data: any) =>
    rawPrisma.cashHandover.create({ data: { businessId: T.business.id, ...data } });

  await handover({
    turi: "topshirish",
    kassirId: javlon.id,
    kassirIsm: "Javlon",
    qabulId: T.user.id,
    qabulIsm: "Direktor",
    hisoblangan: 8_500_000,
    topshirilgan: 8_500_000,
    farq: 0,
    holat: "qabul",
    izoh: "Kechki smena",
    qabulAt: new Date("2026-08-16T15:45:00Z"),
  });
  await handover({
    turi: "topshirish",
    kassirId: murod.id,
    kassirIsm: "Murod",
    qabulId: T.user.id,
    qabulIsm: "Direktor",
    hisoblangan: 6_200_000,
    topshirilgan: 6_000_000,
    farq: -200_000,
    holat: "qabul",
    farqYopildi: true,
    izoh: "Kamomad — qaytim",
    qabulAt: new Date("2026-08-16T16:10:00Z"),
  });
  await handover({
    turi: "berish",
    kassirId: murod.id,
    kassirIsm: "Murod",
    qabulId: T.user.id,
    qabulIsm: "Direktor",
    hisoblangan: 0,
    topshirilgan: 500_000,
    farq: 0,
    holat: "qabul",
    izoh: "Qaytim uchun",
  });
  // Ochiq (tasdiq kutayotgan) topshiriq — u ham ko'chirilishi kerak.
  await handover({
    turi: "topshirish",
    kassirId: javlon.id,
    kassirIsm: "Javlon",
    hisoblangan: 300_000,
    topshirilgan: 300_000,
    farq: 0,
    holat: "kutilmoqda",
  });

  oldingiKesim = await kesim();
  oldingiMoliya = await moliya();
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// TEST 1 — migratsiya
// ---------------------------------------------------------------------------

test("TEST 1: legacy handoverlar arxiv sifatida ko'chiriladi", async () => {
  const h = await migratsiyaBajar({ dryRun: false });

  assert.equal(h.topildi, 4);
  assert.equal(h.kochirildi, 4);
  assert.equal(h.otkazildi, 0);
  assert.equal(h.xato, 0, `xatolar: ${h.ogohlantirishlar.join("; ")}`);

  const arxiv = await A(async () =>
    prisma.accountTransfer.findMany({ where: { businessId: T.business.id, holat: "arxiv" } })
  );
  assert.equal(arxiv.length, 4);

  // Har qatorda kim kimga topshirgani saqlangan.
  const javlonniki = arxiv.find((a: any) => a.fromUserIsm === "Javlon" && a.summa === 8_500_000);
  assert.ok(javlonniki, "Javlonning topshirig'i ko'chishi kerak");
  assert.equal(javlonniki.toUserIsm, "Direktor");
  assert.equal(javlonniki.turi, "smena");
  assert.ok(javlonniki.izoh.includes("Kechki smena"));
  assert.ok(javlonniki.legacyCashHandoverId);

  // "berish" — yo'nalish TESKARI: direktordan kassirga.
  const berish = arxiv.find((a: any) => a.summa === 500_000);
  assert.equal(berish.fromUserIsm, "Direktor");
  assert.equal(berish.toUserIsm, "Murod");
  assert.equal(berish.turi, "transfer");
});

test("arxiv qatorlari IKKI QAVAT xavfsiz: holat=arxiv va from=to", async () => {
  const arxiv = await A(async () =>
    prisma.accountTransfer.findMany({ where: { businessId: T.business.id, holat: "arxiv" } })
  );
  for (const a of arxiv) {
    assert.equal(a.holat, "arxiv");
    assert.equal(a.fromAccountId, a.toAccountId, "arxiv qatori pul ko'chirmasligi kerak");
  }
});

// ---------------------------------------------------------------------------
// TEST 3 — balans invarianti
// ---------------------------------------------------------------------------

test("TEST 3: before/after balans — farq 0 (har kassa va jami)", async () => {
  const keyingi = await kesim();
  assert.deepEqual(keyingi, oldingiKesim, "hech bir kassaning qoldig'i o'zgarmasligi kerak");
  assert.equal(await jami(), 14_700_000);
});

// ---------------------------------------------------------------------------
// TEST 2 — idempotentlik
// ---------------------------------------------------------------------------

test("TEST 2: ikkinchi marta ishga tushirish dublikat yaratmaydi", async () => {
  const h = await migratsiyaBajar({ dryRun: false });

  assert.equal(h.topildi, 4);
  assert.equal(h.kochirildi, 0, "hech nima qayta ko'chirilmasligi kerak");
  assert.equal(h.otkazildi, 4, "hammasi SKIP bo'lishi kerak");
  assert.equal(h.farq, 0);

  const arxiv = await A(async () =>
    prisma.accountTransfer.count({ where: { businessId: T.business.id, holat: "arxiv" } })
  );
  assert.equal(arxiv, 4, "arxiv qatorlari soni oshmasligi kerak");
  assert.deepEqual(await kesim(), oldingiKesim);
});

test("dry-run hech nima yozmaydi", async () => {
  // Yangi legacy yozuv qo'shamiz va dry-run qilamiz.
  await rawPrisma.cashHandover.create({
    data: {
      businessId: T.business.id,
      turi: "topshirish",
      kassirId: murod.id,
      kassirIsm: "Murod",
      hisoblangan: 10_000,
      topshirilgan: 10_000,
      farq: 0,
      holat: "kutilmoqda",
    },
  });

  const h = await migratsiyaBajar({ dryRun: true });
  assert.equal(h.kochirildi, 1, "dry-run ko'chiriladiganlarni SANAYDI");
  assert.equal(h.farq, 0);

  const arxiv = await A(async () =>
    prisma.accountTransfer.count({ where: { businessId: T.business.id, holat: "arxiv" } })
  );
  assert.equal(arxiv, 4, "dry-run bazaga yozmasligi kerak");

  // Endi haqiqiy migratsiya — yangi yozuv ham ko'chsin.
  const haqiqiy = await migratsiyaBajar({ dryRun: false });
  assert.equal(haqiqiy.kochirildi, 1);
  assert.equal(haqiqiy.otkazildi, 4);
});

// ---------------------------------------------------------------------------
// TEST 9 — legacy tarix ledger tarixida ko'rinadi
// ---------------------------------------------------------------------------

test("TEST 9: legacy tarix yagona 'Kassa harakatlari' ro'yxatida ko'rinadi", async () => {
  const royxat = await A(async () => accountsQ.listTransfers(T.business.id, 50));
  const arxivlar = royxat.filter((t: any) => t.holat === "arxiv");
  assert.equal(arxivlar.length, 5);

  const javlonniki = arxivlar.find((t: any) => t.summa === 8_500_000);
  assert.equal(javlonniki.fromUserIsm, "Javlon");
  assert.equal(javlonniki.toUserIsm, "Direktor");
  assert.equal(javlonniki.turi, "smena");
});

// ---------------------------------------------------------------------------
// TEST 6 — legacy tarix O'CHIRILMAYDI
// ---------------------------------------------------------------------------

test("TEST 6: CashHandover jadvali tegilmaydi — tarix zaxirada qoladi", async () => {
  const legacy = await A(async () =>
    prisma.cashHandover.findMany({ where: { businessId: T.business.id } })
  );
  assert.equal(legacy.length, 5, "birorta legacy yozuv o'chirilmasligi kerak");
  assert.ok(legacy.some((l: any) => l.holat === "kutilmoqda"));
  assert.ok(legacy.some((l: any) => l.farq === -200_000));
});

// ---------------------------------------------------------------------------
// TEST 11 — mavjud moliyaviy raqamlar o'zgarmaydi
// ---------------------------------------------------------------------------

test("TEST 11: kirim/chiqim/yozuvlar soni o'zgarmaydi", async () => {
  assert.deepEqual(await moliya(), oldingiMoliya);
});

// ---------------------------------------------------------------------------
// Legacy qoldiqlar hisobotda ko'rinadi (yo'qolmaydi)
// ---------------------------------------------------------------------------

test("legacy kassir qoldiqlari hisobotda qayd etiladi", async () => {
  const h = await migratsiyaBajar({ dryRun: true });
  // Javlon: 8 500 000 kirim − 8 500 000 topshirdi − 300 000 (hali kutilmoqda,
  // qoldiqqa kirmaydi) = 0. Murod: 6 200 000 − (6 000 000 − (−200 000)) + 500 000.
  const murodniki = h.legacyQoldiqlar.find((q: any) => q.kassirIsm === "Murod");
  assert.ok(murodniki, "Murodning nol bo'lmagan legacy qoldig'i hisobotga tushishi kerak");
  assert.equal(murodniki.qoldiq, 500_000);
});

// ---------------------------------------------------------------------------
// TEST 10 — direktor panelida ikkinchi (parallel) oqim qolmasligi
// ---------------------------------------------------------------------------

test("TEST 10: Kassalar sahifasida eski 'Kassa topshiriqlari' oqimi yo'q", async () => {
  const { readFileSync } = await import("node:fs");
  // Sahifa server qismi + client orkestratori: nazorat markazi redizaynidan
  // keyin tasdiq paneli `KassaClient` ichida ko'rsatiladi (nomi ham
  // `KutilayotganPanel` ga o'zgardi). Test tekshirayotgan QOIDA o'sha:
  // legacy ikkinchi oqim yo'q, yangi tasdiq paneli bor.
  const sahifa =
    readFileSync("src/app/app/kassa/page.tsx", "utf8") +
    readFileSync("src/app/app/kassa/KassaClient.tsx", "utf8");

  for (const eski of ["TopshiriqlarPaneli", "KassirlarPaneli", "listKassirQoldiqlari"]) {
    assert.ok(
      !sahifa.includes(eski),
      `Kassalar sahifasida legacy blok qolib ketgan: ${eski}`
    );
  }
  assert.ok(sahifa.includes("KutilayotganPanel"), "yangi tasdiq paneli bo'lishi kerak");
});

test("legacy yozish API'si 410 qaytaradi (ikkinchi oqim yopiq)", async () => {
  const { readFileSync } = await import("node:fs");
  const royxat = readFileSync("src/app/api/kassa-topshirish/route.ts", "utf8");
  const qaror = readFileSync("src/app/api/kassa-topshirish/[id]/route.ts", "utf8");

  assert.ok(royxat.includes("status: 410"), "POST 410 qaytarishi kerak");
  assert.ok(qaror.includes("status: 410"), "PATCH 410 qaytarishi kerak");
  // Yozish xizmatlari endi chaqirilmaydi.
  assert.ok(!royxat.includes("topshiriqYarat"));
  assert.ok(!qaror.includes("topshiriqQaror"));
});
