/**
 * SESSIYA HUQUQ BEKOR QILISHNI DARHOL KO'RADI (S-1).
 *
 * Xato: `lib/auth/tenant.ts:loadTenant()` sessiyada `tenantId` bo'lsa
 * foydalanuvchini bazadan UMUMAN o'qimasdi. Oqibati — `isActive=false`
 * qilingan xodim cookie muddati (7 kun) tugaguncha ishlashda davom etardi,
 * roli tushirilgan foydalanuvchi esa eski huquqini saqlab qolardi.
 *
 * Tuzatish: `buildContext()` HAR so'rovda foydalanuvchini bazadan o'qiydi
 * (`superadmin.ts:verifySuperadmin()` naqshi), rol va tenant BAZADAN olinadi.
 *
 * Ishga tushirish: npm run test:sessiya-bekor
 */
process.env.DATABASE_URL = "file:./prisma/test-sessiya-bekor.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

// ---------------------------------------------------------------------------
// requestCache ni ishlaydigan holatga keltirish.
//
// `lib/requestCache.ts` React'ning `cache()` funksiyasiga tayanadi, u esa
// faqat Next.js server runtime'ida mavjud (react@18.3 ning oddiy build'ida
// `React.cache` — undefined, ts-node'da ham shunday). Shu bois bu yerda unga
// TENG ma'noli memoizer qo'yiladi: shunda "bir so'rov ichida layout ham,
// sahifa ham kontekst quradi" holatini haqiqiy ravishda sinash mumkin.
//
// MUHIM: bu tenant.ts import qilinishidan OLDIN o'rnatilishi shart — o'ram
// modul yuklanganda bir marta qo'llanadi.
// ---------------------------------------------------------------------------
const React = require("react");

/** Kesh urinmagan (ya'ni haqiqatan bajarilgan) chaqiruvlar soni. */
let keshdanOtganChaqiruv = 0;
const keshlar: Map<string, unknown>[] = [];

React.cache = (fn: (...a: unknown[]) => unknown) => {
  const kesh = new Map<string, unknown>();
  keshlar.push(kesh);
  return (...a: unknown[]) => {
    const kalit = JSON.stringify(a);
    if (!kesh.has(kalit)) {
      keshdanOtganChaqiruv++;
      kesh.set(kalit, fn(...a));
    }
    return kesh.get(kalit);
  };
};

/** Yangi so'rov boshlanishini taqlid qiladi (React keshi so'rovdan so'rovga saqlanmaydi). */
function yangiSorov() {
  for (const k of keshlar) k.clear();
  keshdanOtganChaqiruv = 0;
}

let rawPrisma: any;
let requireTenantApi: any;
let ForbiddenError: any;
let forbidSeller: any;
let sessionMod: any;

const T1 = "t_sb_1";
const T2 = "t_sb_2";
const U_FAOL = "u_sb_faol";
const U_BLOK = "u_sb_blok";
const U_ROL = "u_sb_rol";
const U_KOCHGAN = "u_sb_kochgan";
const U_OCHIRILGAN = "u_sb_ochirilgan";

/**
 * Sessiya cookie'sini taqlid qiladi. `getCurrentUser()` o'rniga shu qaytadi —
 * ya'ni testdagi holat: foydalanuvchida AMAL QILAYOTGAN cookie bor.
 */
function sessiya(userId: string, ustiga: Record<string, unknown> = {}) {
  return {
    userId,
    login: "login_" + userId,
    ism: "Ism " + userId,
    rol: "CASHIER",
    tenantId: T1,
    businessId: null,
    mustChangePassword: false,
    impersonatedBy: null,
    ...ustiga,
  };
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
  ({ requireTenantApi } = await import("@/lib/auth/tenant"));
  ({ ForbiddenError, forbidSeller } = await import("@/lib/auth/guard"));
  sessionMod = require("../src/lib/auth/session.ts");

  await rawPrisma.tenant.create({ data: { id: T1, name: "Tenant Bir", slug: "tenant-bir", status: "ACTIVE" } });
  await rawPrisma.tenant.create({ data: { id: T2, name: "Tenant Ikki", slug: "tenant-ikki", status: "ACTIVE" } });

  const user = (id: string, ustiga: Record<string, unknown> = {}) => ({
    id,
    ism: "Ism " + id,
    login: "login_" + id,
    parolHash: "x",
    rol: "CASHIER",
    tenantId: T1,
    ...ustiga,
  });

  await rawPrisma.user.create({ data: user(U_FAOL) });
  await rawPrisma.user.create({ data: user(U_BLOK) });
  await rawPrisma.user.create({ data: user(U_ROL) });
  await rawPrisma.user.create({ data: user(U_KOCHGAN) });
  await rawPrisma.user.create({ data: user(U_OCHIRILGAN) });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

/** `getCurrentUser()` ni berilgan sessiya bilan almashtiradi va kontekst quradi. */
async function kontekst(sessiyaObyekti: Record<string, unknown>) {
  yangiSorov();
  sessionMod.getCurrentUser = async () => sessiyaObyekti;
  return requireTenantApi();
}

// ---------- Regressiya: normal holat buzilmagan ----------

test("faol foydalanuvchi — kontekst quriladi", async () => {
  const ctx = await kontekst(sessiya(U_FAOL));
  assert.equal(ctx.tenantId, T1);
  assert.equal(ctx.tenant.name, "Tenant Bir");
  assert.equal(ctx.session.rol, "CASHIER");
});

// ---------- S-1 ning o'zi ----------

test("isActive=false qilingan foydalanuvchi — DARHOL rad etiladi", async () => {
  await rawPrisma.user.update({ where: { id: U_BLOK }, data: { isActive: false } });

  // Sessiyada tenantId BOR — aynan shu holatda eski kod bazaga umuman
  // murojaat qilmasdi va foydalanuvchini o'tkazib yuborardi.
  await assert.rejects(() => kontekst(sessiya(U_BLOK)), (e: unknown) => e instanceof ForbiddenError);
});

test("roli CASHIER dan SELLER ga tushirilgan — yangi rol amal qiladi", async () => {
  const oldin = await kontekst(sessiya(U_ROL));
  assert.equal(oldin.session.rol, "CASHIER");

  await rawPrisma.user.update({ where: { id: U_ROL }, data: { rol: "SELLER" } });

  // Sessiya cookie'sida hamon eski rol yozilgan.
  const keyin = await kontekst(sessiya(U_ROL, { rol: "CASHIER" }));
  assert.equal(keyin.session.rol, "SELLER", "rol bazadan olinishi kerak");

  // Guard'lar aynan `ctx.session.rol` ga qaraydi — ya'ni cheklov ham kuchga kiradi.
  assert.throws(() => forbidSeller(keyin.session.rol), (e: unknown) => e instanceof ForbiddenError);
});

test("eski rol nomi bazada bo'lsa normallashtiriladi (kassir -> CASHIER)", async () => {
  await rawPrisma.user.update({ where: { id: U_ROL }, data: { rol: "kassir" } });
  const ctx = await kontekst(sessiya(U_ROL, { rol: "SELLER" }));
  assert.equal(ctx.session.rol, "CASHIER");

  await rawPrisma.user.update({ where: { id: U_ROL }, data: { rol: "CASHIER" } });
});

test("boshqa tenantga ko'chirilgan foydalanuvchi — YANGI tenant amal qiladi", async () => {
  await rawPrisma.user.update({ where: { id: U_KOCHGAN }, data: { tenantId: T2 } });

  // Sessiyada eski tenant (T1) yozilgan — baza ustun turishi kerak.
  const ctx = await kontekst(sessiya(U_KOCHGAN, { tenantId: T1 }));
  assert.equal(ctx.tenantId, T2, "tenant bazadan olinishi kerak");
  assert.equal(ctx.tenant.name, "Tenant Ikki");
  assert.equal(ctx.session.tenantId, T2, "sessiya obyekti ham sinxronlanadi");
});

test("o'chirilgan foydalanuvchi — rad etiladi (fail-closed)", async () => {
  await rawPrisma.user.delete({ where: { id: U_OCHIRILGAN } });
  await assert.rejects(() => kontekst(sessiya(U_OCHIRILGAN)), (e: unknown) => e instanceof ForbiddenError);
});

test("tenantsiz foydalanuvchi (SUPERADMIN) — tenant API'siga kirmaydi", async () => {
  const id = "u_sb_superadmin";
  await rawPrisma.user.create({
    data: { id, ism: "Super", login: "login_" + id, parolHash: "x", rol: "SUPERADMIN", tenantId: null },
  });
  await assert.rejects(
    () => kontekst(sessiya(id, { rol: "SUPERADMIN", tenantId: null })),
    (e: unknown) => e instanceof ForbiddenError
  );
});

// ---------- Unumdorlik: requestCache dedupe ----------

test("bir so'rovda layout + sahifa — foydalanuvchi BIR marta o'qiladi", async () => {
  yangiSorov();
  sessionMod.getCurrentUser = async () => sessiya(U_FAOL);

  await requireTenantApi(); // layout
  const oldin = keshdanOtganChaqiruv;
  await requireTenantApi(); // sahifa (ayni so'rov ichida)
  await requireTenantApi(); // yana bir komponent

  assert.equal(oldin, 2, "bitta kontekst qurilishi = 2 lookup (user + tenant)");
  assert.equal(
    keshdanOtganChaqiruv,
    2,
    "takroriy chaqiruvlar keshdan olinishi kerak — qo'shimcha DB so'rovi bo'lmasligi shart"
  );

  // Yangi so'rov — kesh bo'shaydi, ya'ni yangi holat o'qiladi (eskirmaydi).
  yangiSorov();
  await requireTenantApi();
  assert.equal(keshdanOtganChaqiruv, 2, "yangi so'rovda baza qaytadan o'qiladi");
});
