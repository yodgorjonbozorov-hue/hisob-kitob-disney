/**
 * KOMPANIYA YARATISH TESTLARI (FAZA 3, BOS-6 da yangilandi).
 *
 * createTenantWithOwner: bitta tranzaksiyada Tenant(TRIAL, TRIAL_KUNLARI) + OWNER +
 * default Business + boshlang'ich kategoriyalar; ikki yangi kompaniya bir-biridan izolyatsiyada.
 *
 * BOS-6 dan keyin bu funksiyani mijoz EMAS, faqat superadmin paneli chaqiradi
 * (self-signup yopilgan) — shu sababli demo so'rovi oqimi ham shu yerda tekshiriladi.
 * Ishga tushirish: npm run test:signup
 */
process.env.DATABASE_URL = "file:./prisma/test-signup.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: <T>(tenantId: string, fn: () => T) => T;
let createTenantWithOwner: any;
let slugify: any;
let STARTER_KIRIM: string[];
let STARTER_CHIQIM: string[];
let TRIAL_KUNLARI: number;
let createDemoRequest: any;
let signupRoute: any;

let tenantA: any, tenantB: any;

before(async () => {
  rmSync("prisma/test-signup.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner, slugify, STARTER_KIRIM, STARTER_CHIQIM } = await import("@/lib/services/signup"));
  ({ TRIAL_KUNLARI } = await import("@/lib/billing/constants"));
  ({ createDemoRequest } = await import("@/lib/services/demoRequest"));
  signupRoute = await import("@/app/api/auth/signup/route");

  tenantA = await createTenantWithOwner({
    kompaniyaNomi: "Baraka Market",
    ism: "Ali Valiyev",
    login: "+998901111111",
    parol: "parol12345",
  });
  tenantB = await createTenantWithOwner({
    kompaniyaNomi: "Baraka Market", // ataylab bir xil nom — slug to'qnashuvi testi
    ism: "Olim Karimov",
    login: "+998902222222",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("tenant TRIAL statusi va TRIAL_KUNLARI muddati bilan yaratiladi", () => {
  assert.equal(tenantA.tenant.status, "TRIAL");
  const kunlar = (tenantA.tenant.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(
    kunlar > TRIAL_KUNLARI - 0.1 && kunlar <= TRIAL_KUNLARI + 0.01,
    `trialEndsAt ~${TRIAL_KUNLARI} kun bo'lishi kerak, hozir: ${kunlar}`
  );
});

test("sinov muddati konstantasi 7 kun", () => {
  assert.equal(TRIAL_KUNLARI, 7);
});

test("OWNER foydalanuvchi va default biznes tenantga bog'langan", () => {
  assert.equal(tenantA.user.rol, "OWNER");
  assert.equal(tenantA.user.tenantId, tenantA.tenant.id);
  assert.equal(tenantA.business.tenantId, tenantA.tenant.id);
  assert.equal(tenantA.business.nomi, "Baraka Market");
});

test("boshlang'ich kategoriyalar yaratiladi", async () => {
  const cats = await runWithTenant(tenantA.tenant.id, () =>
    prisma.category.findMany({ where: { businessId: tenantA.business.id } })
  );
  assert.equal(cats.length, STARTER_KIRIM.length + STARTER_CHIQIM.length);
  assert.ok(cats.some((c: any) => c.turi === "kirim"));
  assert.ok(cats.some((c: any) => c.turi === "chiqim"));
});

test("bir xil kompaniya nomi — slug'lar unique bo'ladi", () => {
  assert.notEqual(tenantA.tenant.slug, tenantB.tenant.slug);
  assert.ok(tenantB.tenant.slug.startsWith(tenantA.tenant.slug));
});

test("yangi kompaniya boshqa kompaniya ma'lumotini KO'RMAYDI", async () => {
  const bBusinesses = await runWithTenant(tenantB.tenant.id, () => prisma.business.findMany());
  assert.deepEqual(bBusinesses.map((b: any) => b.id), [tenantB.business.id]);

  const bUsers = await runWithTenant(tenantB.tenant.id, () => prisma.user.findMany());
  assert.deepEqual(bUsers.map((u: any) => u.login), ["+998902222222"]);

  const aCatsInB = await runWithTenant(tenantB.tenant.id, () =>
    prisma.category.findMany({ where: { businessId: tenantA.business.id } })
  );
  assert.equal(aCatsInB.length, 0);
});

test("parol hash'lanadi (bcrypt) — ochiq saqlanmaydi", () => {
  assert.notEqual(tenantA.user.parolHash, "parol12345");
  assert.ok(tenantA.user.parolHash.startsWith("$2"));
});

// --- BOS-6: self-signup yopilgan, demo so'rovi oqimi ---

test("eski signup endpoint 403 qaytaradi va hech narsa yaratmaydi", async () => {
  const oldinTenant = await rawPrisma.tenant.count();
  const oldinUser = await rawPrisma.user.count();

  const post = await signupRoute.POST();
  assert.equal(post.status, 403);
  const body = await post.json();
  assert.match(body.error, /yopiq/i);

  const get = await signupRoute.GET();
  assert.equal(get.status, 403);

  assert.equal(await rawPrisma.tenant.count(), oldinTenant);
  assert.equal(await rawPrisma.user.count(), oldinUser);
});

test("demo so'rovi saqlanadi, lekin kompaniya yaratmaydi", async () => {
  const oldinTenant = await rawPrisma.tenant.count();
  const soraq = await createDemoRequest({
    ism: "Sardor",
    telefon: "+998901234567",
    biznesTuri: "Do'kon / market",
    izoh: "Excel'da yuritamiz",
  });
  assert.equal(soraq.status, "YANGI");
  assert.equal(soraq.ism, "Sardor");
  assert.equal(await rawPrisma.tenant.count(), oldinTenant);
});

test("DemoRequest tenant rejimida ochilmaydi (platforma modeli)", async () => {
  await assert.rejects(
    () => runWithTenant(tenantA.tenant.id, () => (prisma as any).demoRequest.findMany()),
    /taqiqlangan/i
  );
  await assert.rejects(
    () =>
      runWithTenant(tenantA.tenant.id, () =>
        (prisma as any).demoRequest.create({ data: { ism: "X", telefon: "+998900000000", biznesTuri: "Boshqa" } })
      ),
    /taqiqlangan/i
  );
});

test("slugify o'zbekcha apostroflarni to'g'ri qayta ishlaydi", () => {
  assert.equal(slugify("G'ijduvon Savdo"), "gijduvon-savdo");
  assert.equal(slugify("O'rikzor mevalari"), "orikzor-mevalari");
  assert.equal(slugify("!!!"), "kompaniya");
});
