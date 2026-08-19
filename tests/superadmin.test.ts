/**
 * SUPERADMIN XIZMATLARI TESTLARI (FAZA 5).
 * Bloklash/blokdan chiqarish, parol tiklash, metrikalar (MRR), impersonatsiya
 * nishoni, audit log yozilishi. Ishga tushirish: npm run test:superadmin
 */
process.env.DATABASE_URL = "file:./prisma/test-superadmin.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let createTenantWithOwner: any;
let manualProvider: any;
let confirmPayment: any;
let runWithTenant: any;
let svc: any;
let newClient: any;
let audit: any;
let bcrypt: any;

const KUN_MS = 24 * 60 * 60 * 1000;
let tA: any; // TRIAL tenant
let tB: any; // ACTIVE tenant (to'lov tasdiqlangan)

before(async () => {
  rmSync("prisma/test-superadmin.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ manualProvider } = await import("@/lib/billing/provider"));
  ({ confirmPayment } = await import("@/lib/billing/subscribe"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  svc = await import("@/lib/superadmin/service");
  newClient = await import("@/lib/superadmin/newClient");
  audit = await import("@/lib/superadmin/audit");
  bcrypt = await import("bcryptjs");

  tA = await createTenantWithOwner({ kompaniyaNomi: "Sinov A", ism: "A", login: "+998911111100", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "Faol B", ism: "B", login: "+998911111200", parol: "parol12345" });
  const { paymentId } = await runWithTenant(tB.tenant.id, () => manualProvider.initiateCheckout({ planCode: "STANDARD" }));
  await confirmPayment(paymentId);
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("resolveUnblockStatus: sanalarga qarab to'g'ri status", () => {
  const now = new Date();
  const kelajak = new Date(now.getTime() + 5 * KUN_MS);
  const otgan = new Date(now.getTime() - 5 * KUN_MS);
  assert.equal(svc.resolveUnblockStatus({ trialEndsAt: kelajak, currentPeriodEnd: null }, now), "TRIAL");
  assert.equal(svc.resolveUnblockStatus({ trialEndsAt: otgan, currentPeriodEnd: kelajak }, now), "ACTIVE");
  assert.equal(svc.resolveUnblockStatus({ trialEndsAt: otgan, currentPeriodEnd: otgan }, now), "PAST_DUE");
  assert.equal(svc.resolveUnblockStatus({ trialEndsAt: null, currentPeriodEnd: null }, now), "PAST_DUE");
});

test("blockTenant/unblockTenant: BLOCKED -> sanaga mos status tiklanadi", async () => {
  const blocked = await svc.blockTenant(tA.tenant.id);
  assert.equal(blocked.status, "BLOCKED");
  // tA hali TRIAL muddati ichida — blokdan chiqarilganda TRIAL qaytadi.
  const unblocked = await svc.unblockTenant(tA.tenant.id);
  assert.equal(unblocked.status, "TRIAL");
});

test("getMetrics: hisob va MRR to'g'ri", async () => {
  const m = await svc.getMetrics();
  assert.equal(m.jamiTenant, 2);
  assert.equal(m.faolObuna, 1); // faqat tB
  assert.equal(m.sinovda, 1); // tA
  assert.equal(m.mrr, 199_000); // 1 faol obuna x STANDARD narxi
});

test("listTenantsOverview: user soni, muddat va kutilayotgan to'lovlar", async () => {
  await runWithTenant(tA.tenant.id, () => manualProvider.initiateCheckout({ planCode: "STANDARD" }));
  const list = await svc.listTenantsOverview();
  const a = list.find((x: any) => x.id === tA.tenant.id);
  const b = list.find((x: any) => x.id === tB.tenant.id);
  assert.equal(a.userCount, 1);
  assert.equal(a.pendingPayments, 1);
  assert.equal(a.accessMode, "FULL");
  assert.equal(b.status, "ACTIVE");
  assert.ok(b.deadline);
});

test("resetUserPassword: yangi parol ishlaydi va mustChangePassword yoqiladi", async () => {
  const { login, yangiParol } = await svc.resetUserPassword(tA.user.id);
  assert.equal(login, "+998911111100");
  assert.equal(yangiParol.length, 10);
  const user = await rawPrisma.user.findUnique({ where: { id: tA.user.id } });
  assert.equal(user.mustChangePassword, true);
  assert.ok(bcrypt.compareSync(yangiParol, user.parolHash));
});

test("findImpersonationTarget: birinchi faol OWNER topiladi", async () => {
  const target = await svc.findImpersonationTarget(tB.tenant.id);
  assert.equal(target.id, tB.user.id);
  assert.equal(target.rol, "OWNER");
});

test("superadminAudit: WHO/WHAT/WHERE/REASON to'liq yoziladi", async () => {
  // Superadmin 2.0: `logSuperadminAction` o'rniga `superadminAudit` — u
  // IP, qurilma satri, oldingi/keyingi holat va SABABni ham saqlaydi.
  await audit.superadminAudit({
    sa: {
      session: { userId: "sa1", ism: "Egasi", login: "egasi", rol: "SUPERADMIN" },
      superRol: "ROOT",
      ip: "203.0.113.7",
      userAgent: "SinovBrauzer/1.0",
    },
    amal: audit.SA_AMAL.IMPERSONATION_START,
    entity: "tenant",
    entityId: tB.tenant.id,
    tenantId: tB.tenant.id,
    before: { status: "ACTIVE" },
    after: { tenantName: "Faol B" },
    sabab: "Mijoz hisobotdagi xatoni ko'rsatishni so'radi",
  });

  const log = await rawPrisma.auditLog.findFirst({
    where: { action: "IMPERSONATION_START", entityId: tB.tenant.id },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(log);
  assert.equal(log.userIsm, "[SUPERADMIN:ROOT] Egasi");
  assert.equal(log.tenantId, tB.tenant.id);
  assert.equal(log.ip, "203.0.113.7");
  assert.equal(log.userAgent, "SinovBrauzer/1.0");
  assert.ok(log.sabab.includes("hisobotdagi xatoni"));
  assert.ok(log.before.includes("ACTIVE"));
  assert.ok(log.after.includes("Faol B"));
  assert.equal(log.businessId, null);
});

test("superadminAudit: parol kabi sirlar jurnalga tushmaydi", async () => {
  await audit.superadminAudit({
    sa: {
      session: { userId: "sa1", ism: "Egasi", login: "egasi", rol: "SUPERADMIN" },
      superRol: "ROOT",
      ip: null,
      userAgent: null,
    },
    amal: audit.SA_AMAL.USER_PASSWORD_RESET,
    entity: "user",
    entityId: "sinov-user",
    after: { login: "mijoz", yangiParol: "juda-maxfiy-parol" },
  });

  const log = await rawPrisma.auditLog.findFirst({
    where: { entityId: "sinov-user" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(log);
  assert.ok(!log.after.includes("juda-maxfiy-parol"), "parol jurnalga tushmasligi kerak");
  assert.ok(log.after.includes("***"));
});

// ---------- Yangi mijoz yaratish (panel + skript uchun umumiy servis) ----------

test("createClientTenant: mijoz ACTIVE obuna, avto rejim va OWNER bilan yaratiladi", async () => {
  const r = await newClient.createClientTenant({
    nom: "Sinov Avto",
    login: "SinovAvto",
    parol: "sinovparol1",
    tarif: "AVTO",
    turi: "avto",
    kunlar: 30,
  });

  assert.equal(r.tenant.status, "ACTIVE");
  assert.equal(r.tenant.plan, "AVTO");
  assert.equal(r.plan.oylikNarx, 200_000);
  assert.ok(r.periodEnd && r.periodEnd.getTime() > Date.now());
  assert.equal(r.user.rol, "OWNER");
  assert.equal(r.user.login, "SinovAvto");
  assert.equal(r.business.turi, "avto");
  assert.equal(r.business.omborli, true);

  // Obuna tarixi yozuvi ham yaratiladi (MRR/hisobot uchun).
  const sub = await rawPrisma.subscription.findFirst({ where: { tenantId: r.tenant.id } });
  assert.ok(sub);
  assert.equal(sub.amount, 200_000);

  // Parol hash'lanadi — ochiq matnda saqlanmaydi.
  const user = await rawPrisma.user.findUnique({ where: { id: r.user.id } });
  assert.notEqual(user.parolHash, "sinovparol1");
  assert.ok(await bcrypt.compare("sinovparol1", user.parolHash));
});

test("createClientTenant: band login va qisqa parol rad etiladi", async () => {
  await assert.rejects(
    () =>
      newClient.createClientTenant({
        nom: "Takror",
        login: "SinovAvto",
        parol: "boshqaparol1",
        tarif: "STANDARD",
        turi: "umumiy",
        kunlar: 30,
      }),
    /band/
  );

  await assert.rejects(
    () =>
      newClient.createClientTenant({
        nom: "Qisqa parol",
        login: "QisqaParol",
        parol: "1234",
        tarif: "STANDARD",
        turi: "umumiy",
        kunlar: 0,
      }),
    /8 belgi/
  );
});

test("createClientTenant: kunlar 0 bo'lsa TRIAL holida qoladi", async () => {
  const r = await newClient.createClientTenant({
    nom: "Sinovdagi Mijoz",
    login: "SinovTrial",
    parol: "sinovparol1",
    tarif: "STANDARD",
    turi: "umumiy",
    kunlar: 0,
  });
  assert.equal(r.tenant.status, "TRIAL");
  assert.equal(r.periodEnd, null);
  assert.ok(r.tenant.trialEndsAt);
});
