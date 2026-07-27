/**
 * CRM v1 TESTLARI (BOS-2).
 * ensureStages, createDeal (kontakt bilan), moveDeal (WON -> kirim), izolyatsiya,
 * modul-rol matritsasi. Ishga tushirish: npm run test:crm
 */
process.env.DATABASE_URL = "file:./prisma/test-crm.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let crm: any;
let guard: any;
let ForbiddenError: any;

let tA: any;
let tB: any;

before(async () => {
  rmSync("prisma/test-crm.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  crm = await import("@/lib/crm/service");
  guard = await import("@/lib/modules/guard");
  ({ ForbiddenError } = await import("@/lib/auth/guard"));

  tA = await createTenantWithOwner({ kompaniyaNomi: "CRM A", ism: "A", login: "+998944444401", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "CRM B", ism: "B", login: "+998944444402", parol: "parol12345" });
  // Ikkala tenant PRO tarifda (CRM ochiq) — modul yoqilgan.
  for (const t of [tA, tB]) {
    await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
    await rawPrisma.tenantModule.create({ data: { tenantId: t.tenant.id, code: "CRM", isActive: true } });
  }
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("ensureStages: 5 ta standart bosqich yaratiladi (idempotent)", async () => {
  await runWithTenant(tA.tenant.id, () => crm.ensureStages(tA.business.id));
  await runWithTenant(tA.tenant.id, () => crm.ensureStages(tA.business.id));
  const stages = await runWithTenant(tA.tenant.id, () =>
    prisma.stage.findMany({ where: { businessId: tA.business.id }, orderBy: { tartib: "asc" } })
  );
  assert.equal(stages.length, 5);
  assert.equal(stages[0].nomi, "Yangi");
  assert.equal(stages.filter((s: any) => s.turi === "WON").length, 1);
});

test("createDeal: kontakt yaratiladi va bitim birinchi bosqichga tushadi", async () => {
  const deal = await runWithTenant(tA.tenant.id, () =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "50 ta stol",
      summa: 5_000_000,
      kontaktIsm: "Karim aka",
      kontaktTel: "+998901112233",
      userId: tA.user.id,
    })
  );
  assert.equal(deal.contact.ism, "Karim aka");
  const stage = await rawPrisma.stage.findUnique({ where: { id: deal.stageId } });
  assert.equal(stage.nomi, "Yangi");
  // Tizim activity yozildi
  const acts = await runWithTenant(tA.tenant.id, () => prisma.activity.findMany({ where: { dealId: deal.id } }));
  assert.equal(acts.length, 1);
});

test("createDeal: bir xil telefon — kontakt dublikat qilinmaydi", async () => {
  await runWithTenant(tA.tenant.id, () =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "Yana buyurtma",
      kontaktIsm: "Karim aka (2)",
      kontaktTel: "+998901112233",
      userId: tA.user.id,
    })
  );
  const contacts = await runWithTenant(tA.tenant.id, () =>
    prisma.contact.findMany({ where: { tel: "+998901112233" } })
  );
  assert.equal(contacts.length, 1);
});

test("moveDeal WON + kirimYoz: MOLIYA'ga kirim yoziladi", async () => {
  const deal = await runWithTenant(tA.tenant.id, () =>
    crm.createDeal({ businessId: tA.business.id, nomi: "Katta bitim", summa: 2_000_000, userId: tA.user.id })
  );
  const won = await runWithTenant(tA.tenant.id, () =>
    prisma.stage.findFirst({ where: { businessId: tA.business.id, turi: "WON" } })
  );
  await runWithTenant(tA.tenant.id, () =>
    crm.moveDeal({ businessId: tA.business.id, dealId: deal.id, stageId: won.id, kirimYoz: true, userId: tA.user.id })
  );

  const updated = await rawPrisma.deal.findUnique({ where: { id: deal.id } });
  assert.ok(updated.transactionId, "transactionId yozilishi kerak");
  assert.ok(updated.yopilganAt);

  const txn = await rawPrisma.transaction.findUnique({ where: { id: updated.transactionId }, include: { category: true } });
  assert.equal(txn.summa, 2_000_000);
  assert.equal(txn.turi, "kirim");
  assert.equal(txn.category.nomi, "Sotuv");

  // Qayta WON'ga o'tkazishda ikkinchi kirim yozilmaydi.
  await runWithTenant(tA.tenant.id, () =>
    crm.moveDeal({ businessId: tA.business.id, dealId: deal.id, stageId: won.id, kirimYoz: true, userId: tA.user.id })
  );
  const soni = await rawPrisma.transaction.count({ where: { businessId: tA.business.id, izoh: { contains: "Katta bitim" } } });
  assert.equal(soni, 1);
});

test("IZOLYATSIYA: A bitimi B kontekstida ko'rinmaydi va ko'chirib bo'lmaydi", async () => {
  const aDeals = await runWithTenant(tA.tenant.id, () => prisma.deal.findMany());
  assert.ok(aDeals.length >= 2);

  const bDeals = await runWithTenant(tB.tenant.id, () => prisma.deal.findMany());
  assert.equal(bDeals.length, 0);

  const bStageYaratish = runWithTenant(tB.tenant.id, async () => {
    await crm.ensureStages(tB.business.id);
    const stage = await prisma.stage.findFirst({ where: { businessId: tB.business.id } });
    return crm.moveDeal({ businessId: tB.business.id, dealId: aDeals[0].id, stageId: stage.id, userId: tB.user.id });
  });
  await assert.rejects(bStageYaratish, ForbiddenError);
});

test("modul-rol: SELLER CRM'ga kiradi, CASHIER kirmaydi", async () => {
  const ctx = (rol: string) => ({ session: { rol }, tenantId: tA.tenant.id, tenant: { ...tA.tenant, plan: "PRO" }, access: { mode: "FULL" } });
  await runWithTenant(tA.tenant.id, () => guard.requireModule(ctx("SELLER"), "CRM"));
  await assert.rejects(
    async () => runWithTenant(tA.tenant.id, () => guard.requireModule(ctx("CASHIER"), "CRM")),
    ForbiddenError
  );
});

test("STANDARD tarifda CRM yoqilgan bo'lsa ham ochilmaydi", async () => {
  await rawPrisma.tenant.update({ where: { id: tB.tenant.id }, data: { plan: "STANDARD" } });
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tB.tenant.id } });
  const ctx = { session: { rol: "OWNER" }, tenantId: tB.tenant.id, tenant, access: { mode: "FULL" } };
  await assert.rejects(
    async () => runWithTenant(tB.tenant.id, () => guard.requireModule(ctx, "CRM")),
    ForbiddenError
  );
});
