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

// ---------- Takroriy ro'yxatdan o'tishdan himoya ----------

test("normalizeKompaniyaNomi: registr, apostrof va bo'shliqni hisobga olmaydi", async () => {
  const { normalizeKompaniyaNomi } = await import("@/lib/services/signup");
  assert.equal(normalizeKompaniyaNomi("RedFlora"), normalizeKompaniyaNomi("redflora"));
  assert.equal(normalizeKompaniyaNomi("Fortex  G'isht"), normalizeKompaniyaNomi("fortex gisht"));
  assert.notEqual(normalizeKompaniyaNomi("RedFlora"), normalizeKompaniyaNomi("Red Flora Plus"));
});

test("findRecentDuplicateTenant: hozirgina ochilgan bir xil nomni topadi", async () => {
  const { findRecentDuplicateTenant } = await import("@/lib/services/signup");
  // tenantA/tenantB shu testda hozirgina yaratilgan.
  const topilgan = await findRecentDuplicateTenant("baraka market");
  assert.ok(topilgan, "bir xil nom topilishi kerak");
  assert.equal(normalize(topilgan.name), "baraka market");

  const yoq = await findRecentDuplicateTenant("Butunlay Boshqa Kompaniya");
  assert.equal(yoq, null);

  function normalize(s: string) {
    return s.toLowerCase();
  }
});

test("findRecentDuplicateTenant: oyna tashqarisidagi eski nom bloklanmaydi", async () => {
  const { findRecentDuplicateTenant } = await import("@/lib/services/signup");
  // 0 daqiqalik oyna — hech narsa "yaqinda" hisoblanmaydi.
  const topilgan = await findRecentDuplicateTenant("Baraka Market", 0);
  assert.equal(topilgan, null, "eski bir xil nomlar haqiqiy mijoz bo'lishi mumkin");
});

test("bo'sh takror tenantni o'chirish mumkin, ma'lumotlisini yo'q", async () => {
  const { deleteEmptyTenant, listTenantsOverview } = await import("@/lib/superadmin/service");

  const royxat = await listTenantsOverview();
  const b = royxat.find((t: any) => t.id === tenantB.tenant.id)!;
  assert.equal(b.takrorMi, true, "bir xil nomli kompaniya 'takror?' deb belgilanishi kerak");
  assert.equal(b.bosh, true, "ma'lumot kiritilmagan tenant bo'sh hisoblanadi");

  // A tenantga tranzaksiya yozamiz — endi u o'chirilmasligi kerak.
  const kategoriya = await rawPrisma.category.findFirst({ where: { businessId: tenantA.business.id } });
  await rawPrisma.transaction.create({
    data: {
      turi: kategoriya.turi,
      categoryId: kategoriya.id,
      businessId: tenantA.business.id,
      summa: 50_000,
      sana: new Date(),
      userId: tenantA.user.id,
    },
  });

  await assert.rejects(() => deleteEmptyTenant(tenantA.tenant.id), /o'chirib bo'lmaydi/i);

  const natija = await deleteEmptyTenant(tenantB.tenant.id);
  assert.equal(natija.name, "Baraka Market");
  const qolgan = await rawPrisma.tenant.findUnique({ where: { id: tenantB.tenant.id } });
  assert.equal(qolgan, null, "bo'sh tenant o'chirilishi kerak");
  const userlar = await rawPrisma.user.findMany({ where: { tenantId: tenantB.tenant.id } });
  assert.equal(userlar.length, 0, "tenant bilan birga userlari ham o'chadi");
});
