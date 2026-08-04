/**
 * BOSHQARUV PANELI AGREGATLARI TESTI (tezlik optimizatsiyasi regressiyasi).
 *
 * Panel so'rovlari ko'p sonli `aggregate`/`groupBy` chaqiruvlaridan bitta guruhlangan
 * SQL so'roviga ko'chirildi. Bu test yangi natijalar ESKI mantiq bilan bir xilligini
 * tekshiradi — sanaladigan qiymatlar o'zgarib ketmasligi uchun.
 *
 * Alohida: xom SQL tenant kengaytmasidan o'tmaydi, shuning uchun tenant izolyatsiyasi
 * ham tekshiriladi (boshqa kompaniyaning businessId'si bo'sh natija berishi kerak).
 *
 * Ishga tushirish: npm run test:dashboard
 */
process.env.DATABASE_URL = "file:./prisma/test-dashboard.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let dashboard: any;

let tA: any;
let tB: any;
let catKirim: string;
let catKirim2: string;
let catChiqim: string;

/** Testlarda ishlatiladigan oylar — "bugun"ga bog'lanmagan, barqaror. */
const OY = "2026-05";
const OTGAN_OY = "2026-04";

async function tranzaksiya(
  businessId: string,
  userId: string,
  categoryId: string,
  turi: string,
  summa: number,
  sana: string,
  deletedAt: Date | null = null
) {
  await rawPrisma.transaction.create({
    data: {
      businessId,
      userId,
      categoryId,
      turi,
      summa,
      sana: new Date(`${sana}T00:00:00.000Z`),
      deletedAt,
    },
  });
}

before(async () => {
  rmSync("prisma/test-dashboard.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  dashboard = await import("@/lib/queries/dashboard");

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Panel A",
    ism: "A",
    login: "+998955555601",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Panel B",
    ism: "B",
    login: "+998955555602",
    parol: "parol12345",
  });

  const kirimlar = await rawPrisma.category.findMany({
    where: { businessId: tA.business.id, turi: "kirim" },
    orderBy: { nomi: "asc" },
  });
  const chiqimlar = await rawPrisma.category.findMany({
    where: { businessId: tA.business.id, turi: "chiqim" },
    orderBy: { nomi: "asc" },
  });
  catKirim = kirimlar[0].id;
  catKirim2 = kirimlar[1]?.id ?? kirimlar[0].id;
  catChiqim = chiqimlar[0].id;

  const uid = tA.user.id;
  const bid = tA.business.id;

  // Joriy oy (2026-05): kirim 100 + 250 + 40, chiqim 70 + 30.
  await tranzaksiya(bid, uid, catKirim, "kirim", 100, `${OY}-03`);
  await tranzaksiya(bid, uid, catKirim, "kirim", 250, `${OY}-03`); // bir kunda ikkita
  await tranzaksiya(bid, uid, catKirim2, "kirim", 40, `${OY}-19`);
  await tranzaksiya(bid, uid, catChiqim, "chiqim", 70, `${OY}-03`);
  await tranzaksiya(bid, uid, catChiqim, "chiqim", 30, `${OY}-28`);

  // O'tgan oy (2026-04): kirim 200, chiqim 50.
  await tranzaksiya(bid, uid, catKirim, "kirim", 200, `${OTGAN_OY}-10`);
  await tranzaksiya(bid, uid, catChiqim, "chiqim", 50, `${OTGAN_OY}-10`);

  // Chegara tekshiruvi: keyingi oyning 1-kuni joriy oyga TUSHMASLIGI kerak.
  await tranzaksiya(bid, uid, catKirim, "kirim", 999, "2026-06-01");

  // Boshqa tenant — hech qaysi natijaga qo'shilmasligi kerak.
  await tranzaksiya(
    tB.business.id,
    tB.user.id,
    (await rawPrisma.category.findFirst({ where: { businessId: tB.business.id, turi: "kirim" } })).id,
    "kirim",
    500_000,
    `${OY}-03`
  );
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Oylik yig'indi ----------

test("getMonthSummary joriy va o'tgan oyni to'g'ri hisoblaydi", async () => {
  const s = await runWithTenant(tA.tenant.id, () => dashboard.getMonthSummary(tA.business.id, OY));

  assert.equal(s.jamiKirim, 390, "kirim 100+250+40 bo'lishi kerak");
  assert.equal(s.jamiChiqim, 100, "chiqim 70+30 bo'lishi kerak");
  assert.equal(s.sofFoyda, 290);
  assert.equal(s.prevMonth.jamiKirim, 200);
  assert.equal(s.prevMonth.jamiChiqim, 50);
  assert.equal(s.prevMonth.sofFoyda, 150);
  assert.equal(s.month, OY);
});

test("getMonthSummary foiz o'zgarishini eski formula bilan bir xil hisoblaydi", async () => {
  const s = await runWithTenant(tA.tenant.id, () => dashboard.getMonthSummary(tA.business.id, OY));
  // (390-200)/200*100 = 95
  assert.equal(Math.round(s.changePct.kirim), 95);
  // (100-50)/50*100 = 100
  assert.equal(Math.round(s.changePct.chiqim), 100);
});

test("getMonthSummary yozuvsiz oyda nol qaytaradi, null emas", async () => {
  const s = await runWithTenant(tA.tenant.id, () => dashboard.getMonthSummary(tA.business.id, "2020-01"));
  assert.equal(s.jamiKirim, 0);
  assert.equal(s.jamiChiqim, 0);
  assert.equal(s.sofFoyda, 0);
  // Ikkalasi ham 0 bo'lsa foiz 0 (avvalgi mantiq).
  assert.equal(s.changePct.kirim, 0);
});

// ---------- Trend ----------

test("getTrend so'ralgan oylar sonini tartib bilan qaytaradi", async () => {
  const trend = await runWithTenant(tA.tenant.id, () => dashboard.getTrend(tA.business.id, 6, OY));

  assert.equal(trend.length, 6);
  assert.deepEqual(
    trend.map((p: any) => p.month),
    ["2025-12", "2026-01", "2026-02", "2026-03", OTGAN_OY, OY]
  );

  const oxirgi = trend[5];
  assert.equal(oxirgi.jamiKirim, 390);
  assert.equal(oxirgi.jamiChiqim, 100);
  assert.equal(oxirgi.sofFoyda, 290);

  const otgan = trend[4];
  assert.equal(otgan.jamiKirim, 200);
  assert.equal(otgan.sofFoyda, 150);

  // Yozuvsiz oylar nol bilan to'ldiriladi (bo'sh qoldirilmaydi).
  assert.equal(trend[0].jamiKirim, 0);
  assert.equal(trend[0].jamiChiqim, 0);
});

// ---------- Kategoriya kesimi ----------

test("getCategoryBreakdown summa bo'yicha kamayish tartibida va foizlari 100 ga teng", async () => {
  const rows = await runWithTenant(tA.tenant.id, () =>
    dashboard.getCategoryBreakdown(tA.business.id, OY, "kirim")
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].summa, 350, "birinchi kategoriya 100+250");
  assert.equal(rows[1].summa, 40);
  assert.ok(rows[0].nomi && rows[0].nomi !== "Noma'lum", "kategoriya nomi JOIN'dan kelishi kerak");

  const foizYigindi = rows.reduce((a: number, r: any) => a + r.foiz, 0);
  assert.ok(Math.abs(foizYigindi - 100) < 0.001, `foizlar yig'indisi 100 bo'lishi kerak, keldi: ${foizYigindi}`);
});

test("getCategoryBreakdown chiqim turini alohida ajratadi", async () => {
  const rows = await runWithTenant(tA.tenant.id, () =>
    dashboard.getCategoryBreakdown(tA.business.id, OY, "chiqim")
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].summa, 100);
  assert.equal(rows[0].foiz, 100);
});

test("getCategoryBreakdown yozuvsiz oyda bo'sh massiv qaytaradi", async () => {
  const rows = await runWithTenant(tA.tenant.id, () =>
    dashboard.getCategoryBreakdown(tA.business.id, "2020-01", "kirim")
  );
  assert.deepEqual(rows, []);
});

// ---------- Kunlik dinamika ----------

test("getDailyDynamics kunlarni bazada guruhlaydi va sana bo'yicha tartiblaydi", async () => {
  const kunlar = await runWithTenant(tA.tenant.id, () =>
    dashboard.getDailyDynamics(tA.business.id, OY)
  );

  assert.deepEqual(
    kunlar.map((k: any) => k.date),
    [`${OY}-03`, `${OY}-19`, `${OY}-28`]
  );

  assert.equal(kunlar[0].kirim, 350, "3-may: 100+250");
  assert.equal(kunlar[0].chiqim, 70);
  assert.equal(kunlar[1].kirim, 40);
  assert.equal(kunlar[1].chiqim, 0);
  assert.equal(kunlar[2].kirim, 0);
  assert.equal(kunlar[2].chiqim, 30);
});

test("getDailyDynamics keyingi oyning 1-kunini qo'shmaydi (oy chegarasi)", async () => {
  const kunlar = await runWithTenant(tA.tenant.id, () =>
    dashboard.getDailyDynamics(tA.business.id, OY)
  );
  assert.ok(!kunlar.some((k: any) => k.date === "2026-06-01"), "keyingi oy kuni tushib qolgan");
});

// ---------- Tenant izolyatsiyasi (xom SQL kengaytmadan o'tmaydi) ----------

test("boshqa tenantning businessId'si bilan panel bo'sh natija beradi", async () => {
  // A tenant konteksti, lekin B tenantning biznes id'si — hech narsa ko'rinmasligi kerak.
  const s = await runWithTenant(tA.tenant.id, () => dashboard.getMonthSummary(tB.business.id, OY));
  assert.equal(s.jamiKirim, 0, "boshqa tenant ma'lumoti sizib chiqdi!");
  assert.equal(s.jamiChiqim, 0);

  const rows = await runWithTenant(tA.tenant.id, () =>
    dashboard.getCategoryBreakdown(tB.business.id, OY, "kirim")
  );
  assert.deepEqual(rows, [], "boshqa tenant kategoriyalari sizib chiqdi!");

  const kunlar = await runWithTenant(tA.tenant.id, () =>
    dashboard.getDailyDynamics(tB.business.id, OY)
  );
  assert.deepEqual(kunlar, [], "boshqa tenant kunlik dinamikasi sizib chiqdi!");

  const trend = await runWithTenant(tA.tenant.id, () => dashboard.getTrend(tB.business.id, 6, OY));
  assert.ok(
    trend.every((p: any) => p.jamiKirim === 0 && p.jamiChiqim === 0),
    "boshqa tenant trendi sizib chiqdi!"
  );
});

test("o'z tenanti kontekstida B biznes o'z ma'lumotini ko'radi", async () => {
  const s = await runWithTenant(tB.tenant.id, () => dashboard.getMonthSummary(tB.business.id, OY));
  assert.equal(s.jamiKirim, 500_000);
});

test("tenant konteksti yo'q bo'lsa xato tashlanadi", async () => {
  await assert.rejects(
    () => dashboard.getMonthSummary(tA.business.id, OY),
    /Tenant konteksti/,
    "kontekstsiz so'rov jimgina bajarilmasligi kerak"
  );
});
