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
let bcrypt: any;
let PLANLAR: any;
let TRIAL_KUNLARI: number;
let SETUP_FEE_USD: number;

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
  bcrypt = await import("bcryptjs");
  ({ PLANLAR } = await import("@/lib/billing/plans"));
  ({ TRIAL_KUNLARI, SETUP_FEE_USD } = await import("@/lib/billing/constants"));

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
  assert.equal(m.mrr, PLANLAR.find((p: any) => p.code === "STANDARD").oylikNarx); // 1 faol obuna x STANDARD narxi
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

test("logSuperadminAction: audit jurnalga [SUPERADMIN] belgisi bilan yoziladi", async () => {
  await svc.logSuperadminAction({
    superadminId: "sa1",
    superadminIsm: "Egasi",
    action: "impersonate",
    entity: "tenant",
    entityId: tB.tenant.id,
    detail: { tenantName: "Faol B" },
  });
  const log = await rawPrisma.auditLog.findFirst({
    where: { action: "impersonate", entityId: tB.tenant.id },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(log);
  assert.equal(log.userIsm, "[SUPERADMIN] Egasi");
  assert.ok(log.after.includes("Faol B"));
  assert.equal(log.businessId, null);
});

// --- BOS-6: qo'lda kompaniya yaratish ---

test("createTenantBySuperadmin: to'liq to'plam + 7 kunlik TRIAL yaratiladi", async () => {
  const r = await svc.createTenantBySuperadmin({
    kompaniyaNomi: "Qo'lda Ochilgan",
    direktorIsmi: "Direktor D",
    login: "+998911111300",
    plan: "PRO",
    trialKunlari: TRIAL_KUNLARI,
  });

  assert.equal(r.tenant.status, "TRIAL");
  assert.equal(r.tenant.plan, "PRO");
  const kunlar = (r.tenant.trialEndsAt.getTime() - Date.now()) / KUN_MS;
  assert.ok(
    kunlar > TRIAL_KUNLARI - 0.1 && kunlar <= TRIAL_KUNLARI + 0.01,
    `trialEndsAt ~${TRIAL_KUNLARI} kun bo'lishi kerak, hozir: ${kunlar}`
  );

  // OWNER + default biznes + boshlang'ich kategoriyalar
  assert.equal(r.user.rol, "OWNER");
  assert.equal(r.user.tenantId, r.tenant.id);
  assert.equal(r.business.tenantId, r.tenant.id);
  const cats = await rawPrisma.category.count({ where: { businessId: r.business.id } });
  assert.ok(cats > 0, "boshlang'ich kategoriyalar yaratilishi kerak");
});

test("vaqtinchalik parol: faqat hash saqlanadi, mustChangePassword yoqiladi", async () => {
  const r = await svc.createTenantBySuperadmin({
    kompaniyaNomi: "Parol Sinovi",
    direktorIsmi: "Direktor P",
    login: "+998911111400",
    plan: "STANDARD",
    trialKunlari: TRIAL_KUNLARI,
  });

  assert.equal(r.vaqtinchalikParol.length, 10);
  // Chalkash belgilar bo'lmasin: 0/O va 1/l/I.
  assert.ok(!/[0O1lI]/.test(r.vaqtinchalikParol), `chalkash belgi bor: ${r.vaqtinchalikParol}`);

  const user = await rawPrisma.user.findUnique({ where: { id: r.user.id } });
  assert.equal(user.mustChangePassword, true);
  assert.notEqual(user.parolHash, r.vaqtinchalikParol);
  assert.ok(user.parolHash.startsWith("$2"), "bcrypt hash bo'lishi kerak");
  assert.ok(bcrypt.compareSync(r.vaqtinchalikParol, user.parolHash));

  // Ochiq parol bazaning hech bir matn maydonida qolmasin (audit ham).
  const loglar = await rawPrisma.auditLog.findMany();
  for (const l of loglar) {
    assert.ok(!(l.after ?? "").includes(r.vaqtinchalikParol), "parol audit jurnalida qolmasligi kerak");
    assert.ok(!(l.before ?? "").includes(r.vaqtinchalikParol));
  }
});

test("createTenantBySuperadmin: band telefon bilan yaratib bo'lmaydi", async () => {
  await assert.rejects(
    () =>
      svc.createTenantBySuperadmin({
        kompaniyaNomi: "Takror",
        direktorIsmi: "Takror",
        login: "+998911111300", // yuqorida band qilingan
        plan: "STANDARD",
        trialKunlari: TRIAL_KUNLARI,
      }),
    /mavjud/i
  );
});

test("guard: SUPERADMIN bo'lmagan foydalanuvchi o'tmaydi (sessiyaga ishonilmaydi)", async () => {
  const { verifySuperadmin } = await import("@/lib/auth/superadmin");

  // Oddiy OWNER — o'tmaydi.
  assert.equal(await verifySuperadmin({ userId: tA.user.id, rol: "OWNER" } as any), false);
  // Sessiyada rol soxtalashtirilgan bo'lsa ham bazada OWNER — baribir o'tmaydi.
  assert.equal(await verifySuperadmin({ userId: tA.user.id, rol: "SUPERADMIN" } as any), false);

  // Haqiqiy superadmin o'tadi.
  const sa = await rawPrisma.user.create({
    data: { ism: "Egasi", login: "+998900000001", parolHash: "x", rol: "SUPERADMIN" },
  });
  assert.equal(await verifySuperadmin({ userId: sa.id, rol: "SUPERADMIN" } as any), true);

  // Nofaol qilingan superadmin — darhol yopiladi.
  await rawPrisma.user.update({ where: { id: sa.id }, data: { isActive: false } });
  assert.equal(await verifySuperadmin({ userId: sa.id, rol: "SUPERADMIN" } as any), false);
});

// Eslatma: bu testda konsolga "cookies was called outside a request scope"
// xatosi chiqadi — bu KUTILGAN holat: guard sessiyani o'qiy olmay fail-closed ishlaydi.
test("kompaniya yaratish endpoint'i sessiyasiz kompaniya ochmaydi (fail-closed)", async () => {
  const { POST } = await import("@/app/api/superadmin/tenants/route");
  const oldin = await rawPrisma.tenant.count();

  const req: any = {
    json: async () => ({
      kompaniyaNomi: "Ruxsatsiz",
      direktorIsmi: "Hacker",
      telefon: "+998911119999",
      plan: "STANDARD",
      trialKunlari: TRIAL_KUNLARI,
    }),
  };
  const res = await POST(req, undefined as any);
  assert.notEqual(res.status, 201);
  assert.equal(await rawPrisma.tenant.count(), oldin);
});

test("o'rnatish to'lovi: yaratishda va keyin belgilash", async () => {
  const r = await svc.createTenantBySuperadmin({
    kompaniyaNomi: "To'lov Bilan",
    direktorIsmi: "Direktor T",
    login: "+998911111500",
    plan: "STANDARD",
    trialKunlari: TRIAL_KUNLARI,
    setupFeeAmountUsd: SETUP_FEE_USD,
  });
  assert.equal(r.tenant.setupFeeAmountUsd, SETUP_FEE_USD);
  assert.ok(r.tenant.setupFeePaidAt);

  // Belgini olib tashlash va qayta qo'yish.
  const bekor = await svc.setSetupFee(r.tenant.id, false);
  assert.equal(bekor.setupFeePaidAt, null);
  const qayta = await svc.setSetupFee(r.tenant.id, true, 200);
  assert.equal(qayta.setupFeeAmountUsd, 200);
  assert.ok(qayta.setupFeePaidAt);
});
