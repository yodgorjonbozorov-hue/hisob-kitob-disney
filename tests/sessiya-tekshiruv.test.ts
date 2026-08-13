/**
 * SESSIYA TEKSHIRUVI (C-1) — kontekst har so'rovda BAZADAN quriladi.
 *
 * Sessiya cookie'si 7 kun yashaydi. Ilgari `rol`, `businessId`, `isActive`
 * cookie'dan olinardi — bo'shatilgan xodim ishlashda davom etar, rol
 * tushirilgan foydalanuvchi eski huquqini saqlar edi. Endi `buildContext`
 * foydalanuvchini har so'rovda bazadan qayta o'qiydi (fail-closed).
 *
 * Ishga tushirish: npm run test:sessiya
 */
process.env.DATABASE_URL = "file:./prisma/test-sessiya.db";
process.env.SESSION_SECRET = "test-sessiya-siri-kamida-32-belgi!!";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let buildContext: any;
let createTenantWithOwner: any;

let t: any;
let kassir: any;

/** Cookie'dagi (ehtimol ESKIRGAN) sessiya — buildContext'ga kiruvchi qiymat. */
function sessiya(u: {
  id: string;
  login: string;
  ism: string;
  rol: string;
  tenantId: string | null;
  businessId?: string | null;
}) {
  return {
    userId: u.id,
    login: u.login,
    ism: u.ism,
    rol: u.rol,
    tenantId: u.tenantId,
    businessId: u.businessId ?? null,
    mustChangePassword: false,
    impersonatedBy: null,
  };
}

before(async () => {
  rmSync("prisma/test-sessiya.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ buildContext } = await import("@/lib/auth/tenant"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Sessiya test",
    ism: "Egasi",
    login: "+998933333501",
    parol: "parol12345",
  });
  kassir = await rawPrisma.user.create({
    data: {
      ism: "Kassir",
      login: "+998933333502",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: t.tenant.id,
      businessId: t.business.id,
    },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("faol foydalanuvchi uchun kontekst bazadagi qiymatlar bilan quriladi", async () => {
  const ctx = await buildContext(sessiya(kassir));
  assert.ok(ctx, "kontekst qurilishi kerak");
  assert.equal(ctx.tenantId, t.tenant.id);
  assert.equal(ctx.session.rol, "CASHIER");
  assert.equal(ctx.session.businessId, t.business.id);
});

test("nofaollashtirilgan foydalanuvchi sessiyasi rad etiladi (fail-closed)", async () => {
  await rawPrisma.user.update({ where: { id: kassir.id }, data: { isActive: false } });
  const ctx = await buildContext(sessiya(kassir));
  assert.equal(ctx, null, "isActive=false — kontekst yo'q, qayta login ham yordam bermaydi");
  await rawPrisma.user.update({ where: { id: kassir.id }, data: { isActive: true } });
});

test("rol bazada o'zgargach eski sessiya YANGI rol bilan ishlaydi", async () => {
  // Cookie'da hali OWNER deb yozilgan, bazada CASHIER'ga tushirilgan.
  const eskiCookie = sessiya({ ...kassir, rol: "OWNER" });
  const ctx = await buildContext(eskiCookie);
  assert.ok(ctx);
  assert.equal(ctx.session.rol, "CASHIER", "huquq cookie'dan emas, bazadan olinadi");
});

test("businessId bazada o'zgargach keyingi so'rovda yangi biznes amal qiladi", async () => {
  const boshqaBiznes = await rawPrisma.business.create({
    data: { nomi: "Ikkinchi filial", tenantId: t.tenant.id },
  });
  await rawPrisma.user.update({ where: { id: kassir.id }, data: { businessId: boshqaBiznes.id } });

  // Cookie'da hali eski biznes yozilgan.
  const ctx = await buildContext(sessiya({ ...kassir, businessId: t.business.id }));
  assert.ok(ctx);
  assert.equal(ctx.session.businessId, boshqaBiznes.id, "biriktiruv bazadan olinadi");
});

test("topilmagan foydalanuvchi va SUPERADMIN uchun tenant konteksti yo'q", async () => {
  const yoq = await buildContext(
    sessiya({ id: "yoq-user", login: "x", ism: "X", rol: "CASHIER", tenantId: t.tenant.id })
  );
  assert.equal(yoq, null);

  const superadmin = await rawPrisma.user.create({
    data: { ism: "Super", login: "+998933333503", parolHash: "x", rol: "SUPERADMIN", tenantId: null },
  });
  const ctx = await buildContext(sessiya({ ...superadmin, tenantId: null }));
  assert.equal(ctx, null, "SUPERADMIN tenant-API kontekstiga ega emas");
});

test("impersonatsiya smoke: maqsad foydalanuvchi konteksti quriladi, impersonatedBy saqlanadi", async () => {
  // Impersonatsiyada sessiya tenant direktoriga yozilgan bo'ladi,
  // impersonatedBy'da esa superadmin id turadi — kontekst buzilmasligi kerak.
  const s = { ...sessiya(t.user), rol: "OWNER", impersonatedBy: "superadmin-id" };
  const ctx = await buildContext(s);
  assert.ok(ctx);
  assert.equal(ctx.session.userId, t.user.id);
  assert.equal(ctx.session.impersonatedBy, "superadmin-id", "impersonatsiya belgisi yo'qolmasin");
});

test("impersonatsiya muddati o'tgach kontekst yopiladi (H-3)", async () => {
  const asos = { ...sessiya(t.user), rol: "OWNER", impersonatedBy: "superadmin-id" };

  // Muddati bor — ishlaydi.
  const faol = await buildContext({ ...asos, impersonateExpiresAt: Date.now() + 60_000 });
  assert.ok(faol, "muddat ichida kontekst ishlashi kerak");

  // Muddat o'tgan — fail-closed.
  const eskirgan = await buildContext({ ...asos, impersonateExpiresAt: Date.now() - 1_000 });
  assert.equal(eskirgan, null, "muddati o'tgan impersonatsiya yopilishi kerak");

  // Oddiy (impersonatsiyasiz) sessiyaga muddat maydoni ta'sir qilmaydi.
  const oddiy = await buildContext({ ...sessiya(t.user), rol: "OWNER" });
  assert.ok(oddiy);
});

test("impersonatsiya aktori audit yozuvida ajratiladi (H-3)", async () => {
  const { runWithTenant } = await import("@/lib/db/tenantContext");
  const { prisma } = await import("@/lib/prisma");

  await runWithTenant(
    t.tenant.id,
    async () => {
      await prisma.category.create({
        data: { businessId: t.business.id, nomi: "Impersonatsiya kategoriyasi", turi: "kirim" },
      });
    },
    { userId: t.user.id, ism: "Egasi", impersonatedBy: "superadmin-777" }
  );

  const log = await rawPrisma.auditLog.findFirst({
    where: { tenantId: t.tenant.id, entity: "category", action: "create" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(log, "audit yozuvi bo'lishi kerak");
  assert.equal(log.impersonatedBy, "superadmin-777", "haqiqiy aktor auditda ko'rinadi");
  assert.equal(log.userId, t.user.id, "amal mijoz nomidan qilinganicha qoladi");
});
