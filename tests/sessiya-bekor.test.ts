/**
 * SESSIYANI BEKOR QILISH — REGRESSIYA TESTI (audit: Critical #1).
 *
 * Muammo: sessiya cookie'si 7 kun yashaydi va `lib/auth/tenant.ts` unga
 * ISHONARDI — sessiyada `tenantId` bo'lsa foydalanuvchi bazadan umuman
 * tekshirilmasdi. Natijada ishdan bo'shatilgan (deaktiv qilingan) yoki
 * akkaunti o'chirilgan xodim cookie muddati tugagunicha tizimda ishlashda
 * davom etardi. `superadmin.ts` da bunday tekshiruv (`verifySuperadmin`)
 * bor edi, oddiy foydalanuvchilarda esa YO'Q edi.
 *
 * Bu test guard'larning bazaviy qarorini — `verifyUser` va
 * `buildTenantContext` ni — to'g'ridan-to'g'ri sinaydi. `requireTenantApi` /
 * `requireTenantPage` ning o'zi Next.js so'rov konteksti (cookie'lar,
 * `redirect()`) talab qiladi, u node testida mavjud emas; ikkala guard ham
 * qarorni shu ikki funksiyadan oladi.
 *
 * Ishga tushirish: npm run test:sessiya-bekor
 *
 * Alohida test bazasi ishlatiladi (prisma/test-sessiya-bekor.db) — dev/prod
 * bazaga tegmaydi.
 */
process.env.DATABASE_URL = "file:./prisma/test-sessiya-bekor.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

// Prisma bilan bog'liq modullar env o'rnatilgandan KEYIN dinamik yuklanadi.
let rawPrisma: any;
let verifyUser: any;
let buildTenantContext: any;
let destroySession: any;

const TENANT = "t_sb";
const TENANT_YOQ = "t_sb_yoq"; // bazada yaratilmaydi — "tenant topilmadi" holati
const BIZ = "biz_sb";

const XODIM = "u_sb_xodim";
const OCHIRILADIGAN = "u_sb_ochiriladigan";
const ESKI_SESSIYA = "u_sb_eski"; // sessiyasida tenantId yo'q (migratsiyagacha)
const SUPERADMIN = "u_sb_superadmin"; // tenantId null

/** Guard'lar kutadigan sessiya shakli (cookie'dan o'qilgani kabi). */
function sessiya(userId: string, tenantId: string | null, rol = "CASHIER") {
  return {
    userId,
    login: `login_${userId}`,
    ism: "Sinov",
    rol,
    tenantId,
    businessId: null,
    mustChangePassword: false,
    impersonatedBy: null,
  } as any;
}

before(async () => {
  rmSync("prisma/test-sessiya-bekor.db", { force: true });

  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) {
    throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);
  }

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ verifyUser, buildTenantContext } = await import("@/lib/auth/tenant"));
  ({ destroySession } = await import("@/lib/auth/session"));

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "SB tenant", slug: "sb-tenant", status: "ACTIVE" },
  });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "SB biznes", tenantId: TENANT } });

  for (const [id, tenantId, rol] of [
    [XODIM, TENANT, "CASHIER"],
    [OCHIRILADIGAN, TENANT, "SELLER"],
    [ESKI_SESSIYA, TENANT, "CASHIER"],
    [SUPERADMIN, null, "SUPERADMIN"],
  ] as [string, string | null, string][]) {
    await rawPrisma.user.create({
      data: {
        id,
        ism: `Sinov ${id}`,
        login: id,
        parolHash: "x",
        rol,
        tenantId,
        isActive: true,
      },
    });
  }
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ─────────────────────────── Boshlang'ich holat ───────────────────────────

test("faol xodim: kontekst quriladi (nazorat)", async () => {
  const ctx = await buildTenantContext(sessiya(XODIM, TENANT));
  assert.ok(ctx, "faol xodim uchun kontekst bo'lishi kerak");
  assert.equal(ctx.tenantId, TENANT);
  assert.equal(ctx.tenant.id, TENANT);
});

test("faol xodim: verifyUser bazadagi tenantni qaytaradi", async () => {
  const u = await verifyUser(XODIM);
  assert.ok(u);
  assert.equal(u.tenantId, TENANT);
});

// ─────────────── Asosiy regressiya: deaktiv qilingan akkaunt ───────────────

test("DEAKTIV xodim: sessiyada tenantId BO'LSA HAM kirish yopiladi", async () => {
  await rawPrisma.user.update({ where: { id: XODIM }, data: { isActive: false } });

  // Aynan shu holat oldin o'tib ketardi: sessiyada tenantId bor edi va
  // baza umuman so'ralmasdi.
  assert.equal(await verifyUser(XODIM), null, "deaktiv xodim verifyUser'dan o'tmasligi kerak");
  assert.equal(
    await buildTenantContext(sessiya(XODIM, TENANT)),
    null,
    "deaktiv xodim uchun kontekst qurilmasligi kerak"
  );
});

test("DEAKTIV xodim: sessiyada tenantId BO'LMASA ham kirish yopiladi", async () => {
  await rawPrisma.user.update({ where: { id: ESKI_SESSIYA }, data: { isActive: false } });

  assert.equal(await buildTenantContext(sessiya(ESKI_SESSIYA, null)), null);
});

test("qayta faollashtirilgan xodim: kirish tiklanadi", async () => {
  await rawPrisma.user.update({ where: { id: XODIM }, data: { isActive: true } });

  const ctx = await buildTenantContext(sessiya(XODIM, TENANT));
  assert.ok(ctx, "qayta faollashtirilgandan keyin kirish ochilishi kerak");
  assert.equal(ctx.tenantId, TENANT);
});

// ─────────────────────── O'chirilgan (mavjud bo'lmagan) ───────────────────────

test("O'CHIRILGAN akkaunt: sessiya yaroqsiz", async () => {
  await rawPrisma.user.delete({ where: { id: OCHIRILADIGAN } });

  assert.equal(await verifyUser(OCHIRILADIGAN), null);
  assert.equal(await buildTenantContext(sessiya(OCHIRILADIGAN, TENANT)), null);
});

test("umuman mavjud bo'lmagan userId: sessiya yaroqsiz", async () => {
  assert.equal(await verifyUser("u_yoq_bunday"), null);
  assert.equal(await buildTenantContext(sessiya("u_yoq_bunday", TENANT)), null);
});

// ───────────────────── Avvalgi xulq saqlanganini tekshirish ─────────────────────

test("tenant topilmasa: kontekst qurilmaydi (avvalgi xulq)", async () => {
  assert.equal(await buildTenantContext(sessiya(XODIM, TENANT_YOQ)), null);
});

test("SUPERADMIN (tenantsiz): tenant konteksti qurilmaydi", async () => {
  // superadmin.ts o'z guard'iga ega — tenant guard'i uni ichkariga kiritmaydi.
  const u = await verifyUser(SUPERADMIN);
  assert.ok(u, "superadmin akkaunti faol");
  assert.equal(u.tenantId, null);
  assert.equal(await buildTenantContext(sessiya(SUPERADMIN, null, "SUPERADMIN")), null);
});

test("deaktiv SUPERADMIN: u ham rad etiladi", async () => {
  await rawPrisma.user.update({ where: { id: SUPERADMIN }, data: { isActive: false } });
  assert.equal(await verifyUser(SUPERADMIN), null);
  await rawPrisma.user.update({ where: { id: SUPERADMIN }, data: { isActive: true } });
});

// ─────────────────────────── Sessiyani bekor qilish ───────────────────────────

test("destroySession: so'rov konteksti bo'lmasa ham xato tashlamaydi", async () => {
  // Guard'lar rad etish yo'lida buni chaqiradi. Server Component'da (va bu
  // testdagidek so'rovsiz muhitda) cookie'ga yozib bo'lmaydi — xato yutiladi,
  // aks holda rad etish redirect o'rniga 500 bo'lib ketardi.
  await assert.doesNotReject(() => destroySession());
});
