/**
 * SIGNUP TESTLARI (FAZA 3).
 * createTenantWithOwner: bitta tranzaksiyada Tenant(TRIAL,14 kun) + OWNER +
 * default Business + boshlang'ich kategoriyalar; ikki yangi kompaniya bir-biridan izolyatsiyada.
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

let tenantA: any, tenantB: any;

before(async () => {
  rmSync("prisma/test-signup.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner, slugify, STARTER_KIRIM, STARTER_CHIQIM } = await import("@/lib/services/signup"));

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

test("tenant TRIAL statusi va ~14 kunlik muddat bilan yaratiladi", () => {
  assert.equal(tenantA.tenant.status, "TRIAL");
  const kunlar = (tenantA.tenant.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  assert.ok(kunlar > 13.9 && kunlar <= 14.01, `trialEndsAt ~14 kun bo'lishi kerak, hozir: ${kunlar}`);
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

test("slugify o'zbekcha apostroflarni to'g'ri qayta ishlaydi", () => {
  assert.equal(slugify("G'ijduvon Savdo"), "gijduvon-savdo");
  assert.equal(slugify("O'rikzor mevalari"), "orikzor-mevalari");
  assert.equal(slugify("!!!"), "kompaniya");
});
