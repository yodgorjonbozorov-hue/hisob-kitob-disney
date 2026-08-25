/**
 * LEGACY KUNLIK TUSHUM → HAQIQIY KIRIM YOZUVI MIGRATSIYASI TESTLARI.
 *
 * ENG MUHIM INVARIANTLAR:
 *   1. Yetim tushum (`transactionId = null`) Kirim/Chiqimga tushadi —
 *      bog'langan `Transaction` yaraladi va Jami Kirim / to'lov taqsimotida
 *      ko'rinadi;
 *   2. KASSA QOLDIG'I O'ZGARMAYDI — yaratiladigan yozuvlarda accountId null,
 *      chunki legacy pul ledgerga hech qachon tushmagan (aks holda pul
 *      yaratilgan bo'lardi);
 *   3. Kunlik hisobot jamlari o'zgarmaydi (faqat transactionId to'ldiriladi);
 *   4. Idempotent — ikkinchi ishga tushirish hech narsa qo'shmaydi.
 *
 * Ishga tushirish: npm run test:kunlik-tushum-migratsiya
 */
process.env.DATABASE_URL = "file:./prisma/test-kunlik-tushum-migratsiya.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let accountsQ: any;
let txQueries: any;
let migratsiyaBajar: any;
let createTenantWithOwner: any;
let addKunlikTushum: any;
let dateOnlyStringToUTCDate: any;

let T: any;
let legacyReport: any;
let legacyCash: any;
let legacyClick: any;
let legacyDebt: any;
let legacyDeleted: any;
let legacyUserYoq: any;

/** Migratsiyadan OLDIN olingan suratlar — sverka uchun. */
let oldingiKesim: { id: string; qoldiq: number }[] = [];
let oldingiMoliya: { kirim: number; naqd: number; click: number; qarz: number; soni: number };

function A<T2>(fn: () => Promise<T2>): Promise<T2> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

async function kesim() {
  const q = await A(async () => accountsQ.getAccountBalances(T.business.id));
  return q
    .map((k: any) => ({ id: k.id, qoldiq: k.qoldiq }))
    .sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
}

async function moliya() {
  return A(async () => {
    const r = await txQueries.listTransactions({ businessId: T.business.id });
    return {
      kirim: r.totals.jamiKirim,
      naqd: r.totals.naqdKirim,
      click: r.totals.clickKirim,
      qarz: r.totals.qarzKirim,
      soni: r.total,
    };
  });
}

before(async () => {
  rmSync("prisma/test-kunlik-tushum-migratsiya.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  accountsQ = await import("@/lib/queries/accounts");
  txQueries = await import("@/lib/queries/transactions");
  ({ migratsiyaBajar } = await import("../scripts/kunlik-tushum-migratsiya"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ addKunlikTushum } = await import("@/lib/services/kunlik"));
  ({ dateOnlyStringToUTCDate } = await import("@/lib/date"));

  T = await createTenantWithOwner({
    kompaniyaNomi: "Kunlik Tushum Test",
    ism: "Direktor",
    login: "+998910200077",
    parol: "parol12345",
  });

  // ── LEGACY MA'LUMOT: eski kod yozgan ko'rinishda (Transaction'siz) ──────
  // Tasdiqlangan (CONFIRMED) kun ataylab tanlangan — migratsiya yopiq kunga
  // ham tegishi (transactionId to'ldirishi), lekin jamlarini buzmasligi kerak.
  legacyReport = await rawPrisma.dailyReport.create({
    data: {
      businessId: T.business.id,
      sana: dateOnlyStringToUTCDate("2026-08-20"),
      holat: "CONFIRMED",
      naqdSumma: 100_000,
      clickSumma: 50_000,
      qarzSumma: 30_000,
      jamiSumma: 180_000,
    },
  });
  const legacyQator = (data: Record<string, unknown>) =>
    rawPrisma.dailyTransaction.create({
      data: {
        businessId: T.business.id,
        reportId: legacyReport.id,
        userId: T.user.id,
        userIsm: "Direktor",
        ...data,
      },
    });
  legacyCash = await legacyQator({ summa: 100_000, tolovTuri: "CASH", izoh: "guldasta" });
  legacyClick = await legacyQator({ summa: 50_000, tolovTuri: "CLICK" });
  legacyDebt = await legacyQator({ summa: 30_000, tolovTuri: "DEBT", izoh: "qarzga" });
  // O'chirilgan legacy tushum — unga TEGILMASLIGI kerak.
  legacyDeleted = await legacyQator({ summa: 999_000, tolovTuri: "CASH", deletedAt: new Date() });
  // Kiritgan foydalanuvchisi bazadan butunlay o'chirilgan tushum —
  // Transaction.userId majburiy FK, shuning uchun o'tkazib yuboriladi.
  legacyUserYoq = await legacyQator({ summa: 7_000, tolovTuri: "CASH", userId: "yoq-user-id" });

  // Yangi kod orqali kiritilgan tushum — allaqachon bog'langan, migratsiya
  // unga ikkinchi yozuv yaratmasligi kerak.
  await A(async () =>
    addKunlikTushum(
      T.business.id,
      { userId: T.user.id, ism: "Direktor", rol: "OWNER" },
      { summa: 40_000, tolovTuri: "CASH" }
    )
  );

  oldingiKesim = await kesim();
  oldingiMoliya = await moliya();
});

after(async () => {
  await rawPrisma.$disconnect();
  rmSync("prisma/test-kunlik-tushum-migratsiya.db", { force: true });
});

test("dry-run: hech narsa yozilmaydi, faqat sanaydi", async () => {
  const h = await migratsiyaBajar({ dryRun: true });
  assert.equal(h.topildi, 4); // CASH, CLICK, DEBT, user-yo'q (o'chirilgani emas)
  assert.equal(h.boglandi, 3);
  assert.equal(h.otkazildi, 1);
  assert.equal(h.xato, 0);
  assert.deepEqual(await moliya(), oldingiMoliya);
  const hamonYetim = await rawPrisma.dailyTransaction.count({
    where: { businessId: T.business.id, transactionId: null, deletedAt: null },
  });
  assert.equal(hamonYetim, 4);
});

test("migratsiya: yetim tushumlar kirim yozuviga bog'lanadi", async () => {
  const h = await migratsiyaBajar({ dryRun: false });
  assert.equal(h.boglandi, 3);
  assert.equal(h.otkazildi, 1);
  assert.equal(h.xato, 0);
  assert.equal(h.farq, 0);

  for (const [qator, tolovTuri] of [
    [legacyCash, "naqd"],
    [legacyClick, "click"],
    [legacyDebt, "qarz"],
  ] as const) {
    const yangi = await rawPrisma.dailyTransaction.findUnique({ where: { id: qator.id } });
    assert.ok(yangi.transactionId, `${tolovTuri} tushumi bog'lanmadi`);
    const yozuv = await rawPrisma.transaction.findUnique({
      where: { id: yangi.transactionId },
      include: { category: true },
    });
    assert.equal(yozuv.turi, "kirim");
    assert.equal(yozuv.summa, qator.summa);
    assert.equal(yozuv.tolovTuri, tolovTuri);
    assert.equal(yozuv.izoh, qator.izoh);
    assert.equal(yozuv.userId, T.user.id);
    // KASSA QOLDIG'IGA TA'SIR QILMASIN — accountId har doim null.
    assert.equal(yozuv.accountId, null);
    // Yozuv o'z hisobotining kuniga tegishli.
    assert.equal(yozuv.sana.getTime(), dateOnlyStringToUTCDate("2026-08-20").getTime());
    assert.equal(yozuv.category.nomi, "Kunlik tushum");
    assert.equal(yozuv.deletedAt, null);
  }
});

test("kassa qoldiqlari bir so'm ham o'zgarmagan", async () => {
  assert.deepEqual(await kesim(), oldingiKesim);
});

test("Kirim/Chiqim jamlari legacy tushumni endi ko'radi", async () => {
  const m = await moliya();
  // Jami Kirim QARZSIZ (real pul): +100k naqd +50k click.
  assert.equal(m.kirim, oldingiMoliya.kirim + 150_000);
  assert.equal(m.naqd, oldingiMoliya.naqd + 100_000);
  assert.equal(m.click, oldingiMoliya.click + 50_000);
  assert.equal(m.qarz, oldingiMoliya.qarz + 30_000);
  // 3 ta yangi yozuv ro'yxatda (o'chirilgani va user-yo'g'i YO'Q).
  assert.equal(m.soni, oldingiMoliya.soni + 3);
});

test("kunlik hisobot jamlari va holati o'zgarmagan", async () => {
  const r = await rawPrisma.dailyReport.findUnique({ where: { id: legacyReport.id } });
  assert.equal(r.holat, "CONFIRMED");
  assert.equal(r.naqdSumma, 100_000);
  assert.equal(r.clickSumma, 50_000);
  assert.equal(r.qarzSumma, 30_000);
  assert.equal(r.jamiSumma, 180_000);
});

test("o'chirilgan va foydalanuvchisiz tushumlarga tegilmagan", async () => {
  const deleted = await rawPrisma.dailyTransaction.findUnique({ where: { id: legacyDeleted.id } });
  assert.equal(deleted.transactionId, null);
  const userYoq = await rawPrisma.dailyTransaction.findUnique({ where: { id: legacyUserYoq.id } });
  assert.equal(userYoq.transactionId, null);
});

test("idempotent: qayta ishga tushirish hech narsa qo'shmaydi", async () => {
  const oldinSoni = await rawPrisma.transaction.count({ where: { businessId: T.business.id } });
  const h = await migratsiyaBajar({ dryRun: false });
  assert.equal(h.topildi, 1); // faqat user-yo'q qator qoladi
  assert.equal(h.boglandi, 0);
  assert.equal(h.otkazildi, 1);
  assert.equal(h.xato, 0);
  const keyinSoni = await rawPrisma.transaction.count({ where: { businessId: T.business.id } });
  assert.equal(keyinSoni, oldinSoni);
  assert.deepEqual(await kesim(), oldingiKesim);
});
