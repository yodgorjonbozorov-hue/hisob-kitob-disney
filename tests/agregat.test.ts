/**
 * AGREGAT SO'ROVLAR TESTLARI (H-5, H-6, 6.1).
 *
 * Faza 2 da dashboard agregatlari xom SQL'ga (`GROUP BY`) ko'chirildi:
 * 25 ga yaqin so'rov o'rniga bir nechta. Xom SQL tenant extension'idan
 * O'TMAYDI, shuning uchun bu yerda ikki narsa tekshiriladi:
 *   1) natijalar avvalgi (JS'da guruhlaydigan) mantiq bilan bir xil;
 *   2) tenant izolyatsiyasi SQL ichidagi JOIN orqali saqlanadi.
 *
 * Ishga tushirish: npm run test:agregat
 */
process.env.DATABASE_URL = "file:./prisma/test-agregat.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let dashboard: any;
let queries: any;

const TA = "t_ag_a";
const TB = "t_ag_b";
const BIZ_A = "biz_ag_a";
const BIZ_B = "biz_ag_b";
const USER_A = "u_ag_a";
const USER_B = "u_ag_b";

before(async () => {
  rmSync("prisma/test-agregat.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  dashboard = await import("@/lib/queries/dashboard");
  queries = await import("@/lib/queries/inventory");

  for (const [t, biz, user, login] of [
    [TA, BIZ_A, USER_A, "ag_a"],
    [TB, BIZ_B, USER_B, "ag_b"],
  ] as const) {
    await rawPrisma.tenant.create({ data: { id: t, name: t, slug: t, status: "ACTIVE" } });
    await rawPrisma.business.create({ data: { id: biz, nomi: biz, tenantId: t, omborli: true } });
    await rawPrisma.user.create({
      data: { id: user, ism: "U", login, parolHash: "x", rol: "OWNER", tenantId: t, businessId: biz },
    });
    await rawPrisma.category.create({ data: { id: `c_${biz}_k`, nomi: "Sotuv", turi: "kirim", businessId: biz } });
    await rawPrisma.category.create({ data: { id: `c_${biz}_c`, nomi: "Xarajat", turi: "chiqim", businessId: biz } });
  }

  const yoz = (biz: string, user: string, turi: "kirim" | "chiqim", summa: number, sana: string) =>
    rawPrisma.transaction.create({
      data: {
        turi,
        categoryId: turi === "kirim" ? `c_${biz}_k` : `c_${biz}_c`,
        businessId: biz,
        summa,
        sana: new Date(`${sana}T00:00:00.000Z`),
        userId: user,
      },
    });

  // A tenant: may (3+2), iyun yozuvsiz, iyul (10+4, ikki xil kun), bittasi o'chirilgan.
  await yoz(BIZ_A, USER_A, "kirim", 3_000_000, "2026-05-15");
  await yoz(BIZ_A, USER_A, "chiqim", 2_000_000, "2026-05-20");
  await yoz(BIZ_A, USER_A, "kirim", 6_000_000, "2026-07-05");
  await yoz(BIZ_A, USER_A, "kirim", 4_000_000, "2026-07-06");
  await yoz(BIZ_A, USER_A, "chiqim", 4_000_000, "2026-07-06");
  const ochirilgan = await yoz(BIZ_A, USER_A, "kirim", 9_999_999, "2026-07-07");
  await rawPrisma.transaction.update({ where: { id: ochirilgan.id }, data: { deletedAt: new Date() } });

  // B tenant: aynan shu oylarda BOSHQA summalar — izolyatsiya buzilsa darhol ko'rinadi.
  await yoz(BIZ_B, USER_B, "kirim", 777_000_000, "2026-07-05");
  await yoz(BIZ_B, USER_B, "chiqim", 555_000_000, "2026-05-15");

  // Foydalilik uchun: mahsulot + ikkita sotuv + xarajat.
  await rawPrisma.product.create({
    data: { id: "p_ag", businessId: BIZ_A, nomi: "Salyut", kelganNarx: 10_000, sotuvNarx: 25_000, miqdor: 100 },
  });
  await rawPrisma.sale.create({
    data: { businessId: BIZ_A, productId: "p_ag", miqdor: 3, birlikNarx: 25_000, tannarx: 10_000, jamiSumma: 75_000, tolovTuri: "naqd", userId: USER_A },
  });
  await rawPrisma.sale.create({
    data: { businessId: BIZ_A, productId: "p_ag", miqdor: 2, birlikNarx: 20_000, tannarx: 10_000, jamiSumma: 40_000, tolovTuri: "naqd", userId: USER_A },
  });
  await rawPrisma.productExpense.create({
    data: { businessId: BIZ_A, productId: "p_ag", turi: "boshqa", summa: 15_000, userId: USER_A },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- To'g'rilik ----------

test("getMonthSummary joriy va oldingi oyni bitta so'rovda to'g'ri qaytaradi", async () => {
  const s = await runWithTenant(TA, () => dashboard.getMonthSummary(BIZ_A, "2026-07"));
  assert.equal(s.month, "2026-07");
  assert.equal(s.jamiKirim, 10_000_000, "o'chirilgan 9 999 999 kirmasligi kerak");
  assert.equal(s.jamiChiqim, 4_000_000);
  assert.equal(s.sofFoyda, 6_000_000);
  // Iyun bo'sh — oldingi oy nollar bilan qaytadi.
  assert.deepEqual(s.prevMonth, { jamiKirim: 0, jamiChiqim: 0, sofFoyda: 0 });
  assert.equal(s.changePct.kirim, null, "0 dan o'sish foizi aniqlanmaydi");
});

test("getTrend yozuvsiz oylarni ham nuqta sifatida qaytaradi", async () => {
  const trend = await runWithTenant(TA, () => dashboard.getTrend(BIZ_A, 3, "2026-07"));
  assert.deepEqual(
    trend.map((t: any) => t.month),
    ["2026-05", "2026-06", "2026-07"],
    "grafikda uzilish bo'lmasligi uchun har oy nuqtasi bo'lishi kerak"
  );
  assert.equal(trend[0].jamiKirim, 3_000_000);
  assert.equal(trend[0].jamiChiqim, 2_000_000);
  assert.deepEqual(trend[1], { month: "2026-06", jamiKirim: 0, jamiChiqim: 0, sofFoyda: 0 });
  assert.equal(trend[2].sofFoyda, 6_000_000);
});

test("getDailyDynamics kunlar bo'yicha SQL darajasida guruhlaydi", async () => {
  const kunlar = await runWithTenant(TA, () => dashboard.getDailyDynamics(BIZ_A, "2026-07"));
  // O'chirilgan yozuv 07-kunda edi — u kun umuman chiqmasligi kerak.
  assert.deepEqual(
    kunlar.map((k: any) => k.date),
    ["2026-07-05", "2026-07-06"]
  );
  assert.deepEqual(kunlar[0], { date: "2026-07-05", kirim: 6_000_000, chiqim: 0 });
  assert.deepEqual(kunlar[1], { date: "2026-07-06", kirim: 4_000_000, chiqim: 4_000_000 });
});

test("getProductProfitability SQL GROUP BY bilan bir xil natija beradi", async () => {
  const rows = await runWithTenant(TA, () => queries.getProductProfitability(BIZ_A));
  assert.equal(rows.length, 1);
  const p = rows[0];
  assert.equal(p.nomi, "Salyut");
  assert.equal(p.sotilgan, 5, "3 + 2 dona");
  assert.equal(p.daromad, 115_000, "75 000 + 40 000");
  assert.equal(p.tannarx, 50_000, "10 000 × 5");
  assert.equal(p.xarajat, 15_000);
  assert.equal(p.foyda, 50_000, "115 000 − 50 000 − 15 000");
  assert.equal(p.marja, 43);
});

// ---------- Tenant izolyatsiyasi (xom SQL) ----------

test("xom SQL agregati boshqa tenant biznesini KO'RMAYDI", async () => {
  // B tenant kontekstida A ning biznes ID'si so'ralsa — nol qaytishi shart.
  const s = await runWithTenant(TB, () => dashboard.getMonthSummary(BIZ_A, "2026-07"));
  assert.equal(s.jamiKirim, 0, "boshqa tenant ma'lumoti sizib chiqmasligi kerak");
  assert.equal(s.jamiChiqim, 0);

  const trend = await runWithTenant(TB, () => dashboard.getTrend(BIZ_A, 3, "2026-07"));
  assert.equal(
    trend.reduce((a: number, t: any) => a + t.jamiKirim + t.jamiChiqim, 0),
    0
  );

  const kunlar = await runWithTenant(TB, () => dashboard.getDailyDynamics(BIZ_A, "2026-07"));
  assert.equal(kunlar.length, 0);

  const foyda = await runWithTenant(TB, () => queries.getProductProfitability(BIZ_A));
  assert.equal(foyda.length, 0);
});

test("har tenant faqat o'z raqamlarini ko'radi", async () => {
  const a = await runWithTenant(TA, () => dashboard.getMonthSummary(BIZ_A, "2026-07"));
  const b = await runWithTenant(TB, () => dashboard.getMonthSummary(BIZ_B, "2026-07"));
  assert.equal(a.jamiKirim, 10_000_000);
  assert.equal(b.jamiKirim, 777_000_000);
});

test("tenant konteksti yo'q bo'lsa agregat so'rov xato beradi", async () => {
  await assert.rejects(() => dashboard.getMonthSummary(BIZ_A, "2026-07"), /Tenant konteksti/);
});
