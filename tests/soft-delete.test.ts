/**
 * SOFT-DELETE FILTRI TESTLARI (C-1).
 *
 * Qoida: o'chirilgan (deletedAt != null) tranzaksiya HECH QANDAY moliyaviy
 * raqamga kirmasligi kerak — dashboard, trend, kunlik dinamika, kategoriya
 * taqsimoti, oylik hisobot (PDF/Excel/AI shu manbadan oladi), budjet,
 * smena yakuni va yozuvlar ro'yxati bir xil summani ko'rsatishi shart.
 *
 * Ishga tushirish: npm run test:soft-delete
 * Alohida test bazasi (prisma/test-soft-delete.db) — dev/prod bazaga tegmaydi.
 */
process.env.DATABASE_URL = "file:./prisma/test-soft-delete.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: <T>(tenantId: string, fn: () => T) => T;
let dashboard: any;
let report: any;
let budget: any;
let shift: any;
let transactions: any;

const TENANT = "t_sd";
const BIZ = "biz_sd";
const CAT_KIRIM = "cat_sd_kirim";
const CAT_CHIQIM = "cat_sd_chiqim";
const USER = "u_sd_owner";

const OY = "2026-07";
const KUN = "2026-07-10";
const SANA = new Date("2026-07-10T00:00:00Z");

// Kirim: 10 mln (aktiv) + 2 mln (o'chirilgan). Chiqim: 3 mln (aktiv) + 1 mln (o'chirilgan).
const KIRIM_AKTIV = 10_000_000;
const KIRIM_OCHIRILGAN = 2_000_000;
const CHIQIM_AKTIV = 3_000_000;
const CHIQIM_OCHIRILGAN = 1_000_000;

before(async () => {
  rmSync("prisma/test-soft-delete.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  dashboard = await import("@/lib/queries/dashboard");
  report = await import("@/lib/queries/report");
  budget = await import("@/lib/queries/budget");
  shift = await import("@/lib/queries/shift");
  transactions = await import("@/lib/queries/transactions");

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "SD tenant", slug: "sd-tenant", status: "ACTIVE" },
  });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "SD biznes", tenantId: TENANT } });
  await rawPrisma.user.create({
    data: { id: USER, ism: "Direktor", login: "sd_owner", parolHash: "x", rol: "OWNER", tenantId: TENANT, businessId: BIZ },
  });
  await rawPrisma.category.create({ data: { id: CAT_KIRIM, nomi: "Sotuv", turi: "kirim", businessId: BIZ } });
  await rawPrisma.category.create({ data: { id: CAT_CHIQIM, nomi: "Xarajat", turi: "chiqim", businessId: BIZ } });

  const yoz = (id: string, turi: "kirim" | "chiqim", summa: number, ochirilgan: boolean) =>
    rawPrisma.transaction.create({
      data: {
        id,
        turi,
        categoryId: turi === "kirim" ? CAT_KIRIM : CAT_CHIQIM,
        businessId: BIZ,
        summa,
        sana: SANA,
        userId: USER,
        deletedAt: ochirilgan ? new Date() : null,
      },
    });

  await yoz("tx_sd_1", "kirim", KIRIM_AKTIV, false);
  await yoz("tx_sd_2", "kirim", KIRIM_OCHIRILGAN, true);
  await yoz("tx_sd_3", "chiqim", CHIQIM_AKTIV, false);
  await yoz("tx_sd_4", "chiqim", CHIQIM_OCHIRILGAN, true);
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("getMonthSummary o'chirilgan yozuvlarni hisoblamaydi", async () => {
  const s = await runWithTenant(TENANT, () => dashboard.getMonthSummary(BIZ, OY));
  assert.equal(s.jamiKirim, KIRIM_AKTIV);
  assert.equal(s.jamiChiqim, CHIQIM_AKTIV);
  assert.equal(s.sofFoyda, KIRIM_AKTIV - CHIQIM_AKTIV);
});

test("dashboard summasi yozuvlar ro'yxati summasi bilan bir xil", async () => {
  const [s, royxat] = await Promise.all([
    runWithTenant(TENANT, () => dashboard.getMonthSummary(BIZ, OY)),
    runWithTenant(TENANT, () =>
      transactions.listTransactions({ businessId: BIZ, from: "2026-07-01", to: "2026-07-31" })
    ),
  ]);
  // Aynan shu nomuvofiqlik mijoz ishonchini yo'qotardi — ikkalasi teng bo'lishi shart.
  assert.equal(s.jamiKirim, royxat.totals.jamiKirim);
  assert.equal(s.jamiChiqim, royxat.totals.jamiChiqim);
});

test("getCategoryBreakdown o'chirilgan yozuvlarni hisoblamaydi", async () => {
  const kirim = await runWithTenant(TENANT, () => dashboard.getCategoryBreakdown(BIZ, OY, "kirim"));
  assert.equal(kirim.length, 1);
  assert.equal(kirim[0].summa, KIRIM_AKTIV);

  const chiqim = await runWithTenant(TENANT, () => dashboard.getCategoryBreakdown(BIZ, OY, "chiqim"));
  assert.equal(chiqim[0].summa, CHIQIM_AKTIV);
});

test("getDailyDynamics o'chirilgan yozuvlarni hisoblamaydi", async () => {
  const kunlar = await runWithTenant(TENANT, () => dashboard.getDailyDynamics(BIZ, OY));
  const kun = kunlar.find((k: any) => k.date === KUN);
  assert.ok(kun, "kunlik nuqta topilmadi");
  assert.equal(kun.kirim, KIRIM_AKTIV);
  assert.equal(kun.chiqim, CHIQIM_AKTIV);
});

test("getTrend o'chirilgan yozuvlarni hisoblamaydi", async () => {
  const trend = await runWithTenant(TENANT, () => dashboard.getTrend(BIZ, 3, OY));
  const nuqta = trend.find((t: any) => t.month === OY);
  assert.ok(nuqta, "oy trendda topilmadi");
  assert.equal(nuqta.jamiKirim, KIRIM_AKTIV);
  assert.equal(nuqta.jamiChiqim, CHIQIM_AKTIV);
});

test("oylik hisobot (PDF/Excel/AI manbai) o'chirilgan yozuvlarni hisoblamaydi", async () => {
  const r = await runWithTenant(TENANT, () => report.getMonthlyReport(BIZ, OY));
  assert.equal(r.jamiKirim, KIRIM_AKTIV);
  assert.equal(r.jamiChiqim, CHIQIM_AKTIV);
  assert.equal(r.sofFoyda, KIRIM_AKTIV - CHIQIM_AKTIV);
  assert.equal(r.chiqimByCategory.reduce((a: number, c: any) => a + c.summa, 0), CHIQIM_AKTIV);
});

test("budjet sarfi va smena yakuni ham o'chirilganlarni hisoblamaydi", async () => {
  const qatorlar = await runWithTenant(TENANT, () => budget.getBudgetsWithSpend(BIZ, OY));
  const xarajat = qatorlar.find((q: any) => q.categoryId === CAT_CHIQIM);
  assert.equal(xarajat.sarflangan, CHIQIM_AKTIV);

  const naqd = await runWithTenant(TENANT, () => shift.getExpectedCash(BIZ, KUN));
  assert.equal(naqd, KIRIM_AKTIV);
});

test("o'chirilganlar savati esa aynan o'chirilgan yozuvlarni ko'rsatadi", async () => {
  const savat = await runWithTenant(TENANT, () => transactions.listDeletedTransactions(BIZ));
  assert.equal(savat.length, 2);
  const summalar = savat.map((t: any) => t.summa).sort((a: number, b: number) => a - b);
  assert.deepEqual(summalar, [CHIQIM_OCHIRILGAN, KIRIM_OCHIRILGAN]);
});
