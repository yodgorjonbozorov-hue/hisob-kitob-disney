/**
 * TENANT IZOLYATSIYASI TESTLARI (FAZA 2).
 *
 * Ikki tenant (A va B) fixture'da yaratiladi; testlar Tenant A kontekstidan turib
 * Tenant B ma'lumotiga yetib bo'lmasligini tasdiqlaydi. Ishga tushirish:
 *   npm run test:isolation
 *
 * Alohida test bazasi ishlatiladi (prisma/test-isolation.db) — dev/prod bazaga tegmaydi.
 */
process.env.DATABASE_URL = "file:./prisma/test-isolation.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

// Prisma bilan bog'liq modullar env o'rnatilgandan KEYIN dinamik yuklanadi.
let rawPrisma: any;
let prisma: any;
let runWithTenant: <T>(tenantId: string, fn: () => T) => T;
let ForbiddenError: any;
let forbidSeller: any;
let requireManager: any;
let getMonthlyReport: any;
let listAuditLogs: any;

// Fixture identifikatorlari
const T_A = "t_test_a";
const T_B = "t_test_b";
const BIZ_A1 = "biz_test_a1";
const BIZ_A2 = "biz_test_a2";
const BIZ_B1 = "biz_test_b1";
const CAT_A = "cat_test_a";
const CAT_B = "cat_test_b";
const TX_A = "tx_test_a";
const TX_B = "tx_test_b";

before(async () => {
  rmSync("prisma/test-isolation.db", { force: true });

  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) {
    throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);
  }

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ ForbiddenError, forbidSeller, requireManager } = await import("@/lib/auth/guard"));
  ({ getMonthlyReport } = await import("@/lib/queries/report"));
  ({ listAuditLogs } = await import("@/lib/queries/audit"));

  // ---- Fixture: ikkita tenant, bizneslar, foydalanuvchilar, tranzaksiyalar ----
  await rawPrisma.tenant.create({ data: { id: T_A, name: "Tenant A", slug: "tenant-a", status: "ACTIVE" } });
  await rawPrisma.tenant.create({ data: { id: T_B, name: "Tenant B", slug: "tenant-b", status: "ACTIVE" } });

  await rawPrisma.business.create({ data: { id: BIZ_A1, nomi: "A1 biznes", tenantId: T_A } });
  await rawPrisma.business.create({ data: { id: BIZ_A2, nomi: "A2 biznes", tenantId: T_A, omborli: true } });
  await rawPrisma.business.create({ data: { id: BIZ_B1, nomi: "B1 biznes", tenantId: T_B } });

  await rawPrisma.user.create({
    data: { id: "u_owner_a", ism: "Direktor A", login: "owner_a", parolHash: "x", rol: "OWNER", tenantId: T_A },
  });
  await rawPrisma.user.create({
    data: { id: "u_kassir_a", ism: "Kassir A", login: "kassir_a", parolHash: "x", rol: "CASHIER", tenantId: T_A, businessId: BIZ_A1 },
  });
  await rawPrisma.user.create({
    data: { id: "u_owner_b", ism: "Direktor B", login: "owner_b", parolHash: "x", rol: "OWNER", tenantId: T_B },
  });

  await rawPrisma.category.create({ data: { id: CAT_A, nomi: "Kirim A", turi: "kirim", businessId: BIZ_A1 } });
  await rawPrisma.category.create({ data: { id: CAT_B, nomi: "Kirim B", turi: "kirim", businessId: BIZ_B1 } });

  await rawPrisma.transaction.create({
    data: { id: TX_A, turi: "kirim", categoryId: CAT_A, businessId: BIZ_A1, summa: 1000, sana: new Date("2026-07-01"), userId: "u_owner_a" },
  });
  await rawPrisma.transaction.create({
    data: { id: TX_B, turi: "kirim", categoryId: CAT_B, businessId: BIZ_B1, summa: 9999, sana: new Date("2026-07-01"), userId: "u_owner_b" },
  });

  await rawPrisma.auditLog.create({ data: { businessId: BIZ_A1, action: "create", entity: "transaction", entityId: TX_A } });
  await rawPrisma.auditLog.create({ data: { businessId: BIZ_B1, action: "create", entity: "transaction", entityId: TX_B } });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- 1. Kontekstsiz so'rov — xato ----------
test("kontekstsiz prisma so'rovi xato tashlaydi (scope berilmasa — xato)", async () => {
  await assert.rejects(
    async () => prisma.transaction.findMany(),
    /Tenant konteksti yo'q/
  );
});

// ---------- 2. O'qish izolyatsiyasi ----------
test("Tenant A faqat o'z bizneslarini ko'radi", async () => {
  const rows = await runWithTenant(T_A, () => prisma.business.findMany());
  const ids = rows.map((b: any) => b.id).sort();
  assert.deepEqual(ids, [BIZ_A1, BIZ_A2]);
});

test("Tenant A faqat o'z foydalanuvchilarini ko'radi", async () => {
  const rows = await runWithTenant(T_A, () => prisma.user.findMany());
  const logins = rows.map((u: any) => u.login).sort();
  assert.deepEqual(logins, ["kassir_a", "owner_a"]);
});

test("Tenant A faqat o'z tranzaksiyalarini ko'radi", async () => {
  const rows = await runWithTenant(T_A, () => prisma.transaction.findMany());
  assert.deepEqual(rows.map((t: any) => t.id), [TX_A]);
});

test("count/aggregate ham tenant bo'yicha cheklanadi", async () => {
  const count = await runWithTenant(T_A, () => prisma.transaction.count());
  assert.equal(count, 1);
  const agg = await runWithTenant(T_A, () => prisma.transaction.aggregate({ _sum: { summa: true } }));
  assert.equal(agg._sum.summa, 1000); // B'ning 9999 kirmaydi
});

// ---------- 3. IDOR: boshqa tenant yozuvi id orqali ochilmaydi ----------
test("Tenant A dan B tranzaksiyasini findUnique — null (404)", async () => {
  const row = await runWithTenant(T_A, () => prisma.transaction.findUnique({ where: { id: TX_B } }));
  assert.equal(row, null);
});

test("Tenant A dan B tranzaksiyasini update — ForbiddenError (403)", async () => {
  await assert.rejects(
    async () => runWithTenant(T_A, () => prisma.transaction.update({ where: { id: TX_B }, data: { summa: 1 } })),
    ForbiddenError
  );
});

test("Tenant A dan B tranzaksiyasini delete — ForbiddenError (403)", async () => {
  await assert.rejects(
    async () => runWithTenant(T_A, () => prisma.transaction.delete({ where: { id: TX_B } })),
    ForbiddenError
  );
});

test("Tenant A dan B biznesini update — ForbiddenError (403)", async () => {
  await assert.rejects(
    async () => runWithTenant(T_A, () => prisma.business.update({ where: { id: BIZ_B1 }, data: { nomi: "hack" } })),
    ForbiddenError
  );
});

// ---------- 4. businessId'ni qo'lda almashtirish (forma/API orqali) ----------
test("Tenant A kontekstida B businessId bilan tranzaksiya yaratish — ForbiddenError", async () => {
  await assert.rejects(
    async () =>
      runWithTenant(T_A, () =>
        prisma.transaction.create({
          data: { turi: "kirim", categoryId: CAT_B, businessId: BIZ_B1, summa: 5, sana: new Date(), userId: "u_owner_a" },
        })
      ),
    ForbiddenError
  );
});

test("active_business cookie'ga B biznes id yozilsa — scoped qidiruv null (fallback ishlaydi)", async () => {
  // resolveActiveBusinessId aynan shu so'rov bilan cookie'ni tekshiradi.
  const biz = await runWithTenant(T_A, () =>
    prisma.business.findFirst({ where: { id: BIZ_B1, isActive: true }, select: { id: true } })
  );
  assert.equal(biz, null);
});

test("kassirni boshqa tenant biznesiga biriktirib bo'lmaydi (user update data.businessId)", async () => {
  await assert.rejects(
    async () =>
      runWithTenant(T_A, () => prisma.user.update({ where: { id: "u_kassir_a" }, data: { businessId: BIZ_B1 } })),
    ForbiddenError
  );
});

// ---------- 5. Create'da tenantId majburlanadi ----------
test("user.create'da tenantId har doim joriy tenant bilan yoziladi", async () => {
  const created = await runWithTenant(T_A, () =>
    prisma.user.create({
      // Ataylab B tenantini berishga urinamiz — extension ustidan yozadi.
      data: { ism: "Test", login: "test_force_tenant", parolHash: "x", rol: "SELLER", tenantId: T_B },
    })
  );
  assert.equal(created.tenantId, T_A);
  await rawPrisma.user.delete({ where: { id: created.id } });
});

// ---------- 6. Hisobot / eksport izolyatsiyasi ----------
test("getMonthlyReport B biznesi uchun A kontekstida bo'sh chiqadi", async () => {
  const report = await runWithTenant(T_A, () => getMonthlyReport(BIZ_B1, "2026-07"));
  assert.equal(report.jamiKirim, 0);
  assert.equal(report.jamiChiqim, 0);
});

test("getMonthlyReport o'z biznesi uchun to'g'ri ishlaydi", async () => {
  const report = await runWithTenant(T_A, () => getMonthlyReport(BIZ_A1, "2026-07"));
  assert.equal(report.jamiKirim, 1000);
});

// ---------- 7. Audit jurnali ----------
test("listAuditLogs faqat berilgan biznes yozuvlarini qaytaradi", async () => {
  const { items } = await runWithTenant(T_A, () => listAuditLogs({ businessId: BIZ_A1 }));
  assert.equal(items.length, 1);
  assert.equal(items[0].entityId, TX_A);
});

test("AuditLog o'qish tenant bo'yicha ham cheklanadi (extension)", async () => {
  const rows = await runWithTenant(T_A, () => prisma.auditLog.findMany());
  assert.deepEqual(rows.map((r: any) => r.entityId), [TX_A]);
});

// ---------- 8. Rol guard'lari ----------
test("forbidSeller: SELLER uchun ForbiddenError, boshqalarga yo'q", () => {
  assert.throws(() => forbidSeller("SELLER"), ForbiddenError);
  assert.doesNotThrow(() => forbidSeller("CASHIER"));
  assert.doesNotThrow(() => forbidSeller("OWNER"));
});

test("requireManager: faqat OWNER/ADMIN o'tadi", () => {
  assert.doesNotThrow(() => requireManager("OWNER"));
  assert.doesNotThrow(() => requireManager("ADMIN"));
  assert.throws(() => requireManager("CASHIER"), ForbiddenError);
  assert.throws(() => requireManager("SELLER"), ForbiddenError);
});

// ---------- 9. Xavfli amallar bloklanadi ----------
test("compound unique orqali amal tenant rejimida bloklanadi", async () => {
  await assert.rejects(
    async () =>
      runWithTenant(T_A, () =>
        prisma.budget.upsert({
          where: { categoryId_oy: { categoryId: CAT_A, oy: "2026-07" } },
          update: { limitSumma: 1 },
          create: { businessId: BIZ_A1, categoryId: CAT_A, oy: "2026-07", limitSumma: 1 },
        })
      ),
    /faqat 'id' orqali/
  );
});

test("Tenant modelida boshqa tenantni o'qib bo'lmaydi", async () => {
  const rows = await runWithTenant(T_A, () => prisma.tenant.findMany());
  assert.deepEqual(rows.map((t: any) => t.id), [T_A]);
});
