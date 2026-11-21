/**
 * TELEFON BILAN KIRISH — standartlar (E.164 saqlash, E.123 ko'rsatish).
 *
 * Ro'yxatdan o'tish ilgari raqamni yozilgan ko'rinishida saqlardi
 * (`+998901234567` / `998901234567` / `901234567`), kirish esa matnni AYNAN
 * solishtirardi: "90 123 45 67" deb yozgan odam kira olmasdi, bitta raqam
 * ikki formatda ikki akkaunt ochardi, limit esa formatni almashtirib
 * chetlab o'tilardi. Bu to'plam uchalasini qotiradi.
 *
 *   npm run test:telefon-login
 *
 * Alohida baza: prisma/test-telefon-login.db.
 */
process.env.DATABASE_URL = "file:./prisma/test-telefon-login.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";
import { telE164, telgaOxshaydi, telLoginKorinishlari, telKorinish } from "@/lib/tel";

type Mod = typeof import("@/lib/auth/loginTop");
let rawPrisma: typeof import("@/lib/db/rawPrisma").rawPrisma;
let findUserByLogin: Mod["findUserByLogin"];
let loginLimitKaliti: Mod["loginLimitKaliti"];
let telefonBandmi: Mod["telefonBandmi"];

const T = "t_tel";

before(async () => {
  rmSync("prisma/test-telefon-login.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ findUserByLogin, loginLimitKaliti, telefonBandmi } = await import("@/lib/auth/loginTop"));

  await rawPrisma.tenant.create({ data: { id: T, name: "Tel", slug: "tel", status: "ACTIVE" } });
  const u = (id: string, login: string) =>
    rawPrisma.user.create({ data: { id, ism: id, login, parolHash: "x", rol: "OWNER", tenantId: T } });
  await u("u_e164", "+998901112233"); // yangi format
  await u("u_plyussiz", "998902223344"); // eski: + siz
  await u("u_mahalliy", "903334455"); // eski: 9 raqam
  await u("u_admin", "admin");
  await u("u_xorij", "+79161234567");
  // Bitta raqam ikki formatda (eski dublikat) — hech biri tanlanmasligi kerak.
  await u("u_dub1", "+998935556677");
  await u("u_dub2", "935556677");
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- lib/tel.ts — sof funksiyalar ----------

test("telE164: O'zbekiston raqami har qanday yozuvda +998XXXXXXXXX", () => {
  for (const x of ["90 123 45 67", "(90) 123-45-67", "998901234567", "+998 90 123 45 67", "+998.90.123.45.67"]) {
    assert.equal(telE164(x), "+998901234567", x);
  }
});

test("telE164: chet el raqami faqat + bilan; noaniq yoki yaroqsiz — null", () => {
  assert.equal(telE164("+7 916 123-45-67"), "+79161234567");
  assert.equal(telE164("79161234567"), null, "+ siz chet el raqami noaniq");
  assert.equal(telE164("+0123456789"), null, "E.164: davlat kodi 0 bilan boshlanmaydi");
  assert.equal(telE164("+1234567"), null, "8 raqamdan kam");
  assert.equal(telE164("+1234567890123456"), null, "15 raqamdan ko'p");
  assert.equal(telE164("90 123 45"), null);
  assert.equal(telE164(""), null);
});

test("telgaOxshaydi: harfli login hech qachon telefon emas", () => {
  assert.equal(telgaOxshaydi("admin"), false);
  assert.equal(telgaOxshaydi("kassir1"), false);
  assert.equal(telgaOxshaydi("90a1234567"), false);
  assert.equal(telgaOxshaydi("12345678"), false, "9 raqamdan kam");
  assert.equal(telgaOxshaydi("+998 (90) 123-45-67"), true);
});

test("telLoginKorinishlari: E.164 birinchi, eski ko'rinishlar ham", () => {
  assert.deepEqual(telLoginKorinishlari("90 123 45 67"), ["+998901234567", "998901234567", "901234567"]);
  assert.deepEqual(telLoginKorinishlari("+7 916 123 45 67"), ["+79161234567", "79161234567"]);
  assert.deepEqual(telLoginKorinishlari("admin"), []);
  assert.equal(telKorinish("+998901234567"), "+998 90 123 45 67", "E.123 ko'rinishi");
});

// ---------- findUserByLogin ----------

test("aynan moslik avvalgidek ishlaydi", async () => {
  assert.equal((await findUserByLogin("+998901112233"))?.id, "u_e164");
  assert.equal((await findUserByLogin("admin"))?.id, "u_admin");
  assert.equal((await findUserByLogin("903334455"))?.id, "u_mahalliy");
});

test("raqam har qanday yozilsa ham o'sha akkaunt topiladi", async () => {
  for (const x of ["90 111 22 33", "+998 (90) 111-22-33", "998901112233", "901112233"]) {
    assert.equal((await findUserByLogin(x))?.id, "u_e164", x);
  }
});

test("eski formatda saqlangan akkauntlar ham yangi yozuvda topiladi", async () => {
  assert.equal((await findUserByLogin("+998 90 222 33 44"))?.id, "u_plyussiz");
  assert.equal((await findUserByLogin("+998903334455"))?.id, "u_mahalliy");
  assert.equal((await findUserByLogin("90-333-44-55"))?.id, "u_mahalliy");
});

test("chet el raqami + bilan topiladi", async () => {
  assert.equal((await findUserByLogin("+7 916 123 45 67"))?.id, "u_xorij");
});

test("XAVFSIZLIK: bitta raqam ikki akkauntda bo'lsa — hech biri tanlanmaydi", async () => {
  assert.equal(await findUserByLogin("93 555 66 77"), null);
  assert.equal(await findUserByLogin("998935556677"), null);
  // Aynan yozilgan login esa o'z egasiga olib boradi (mavjud xulq).
  assert.equal((await findUserByLogin("935556677"))?.id, "u_dub2");
});

test("registrsiz moslik saqlangan; noma'lum login — null", async () => {
  assert.equal((await findUserByLogin("Admin"))?.id, "u_admin");
  assert.equal(await findUserByLogin("90 999 99 99"), null);
  assert.equal(await findUserByLogin("yoq"), null);
});

// ---------- Rate limit kaliti ----------

test("limit kaliti: bitta raqamning har xil yozuvi BITTA kalit", () => {
  const k = loginLimitKaliti("+998901112233");
  for (const x of ["90 111 22 33", "998901112233", "901112233", "+998 (90) 111-22-33"]) {
    assert.equal(loginLimitKaliti(x), k, x);
  }
  assert.equal(loginLimitKaliti("Admin"), "login:l:admin", "harfli login avvalgidek");
});

// ---------- Ro'yxatdan o'tish ----------

test("telefonBandmi: eski formatdagi akkaunt ham band hisoblanadi", async () => {
  assert.equal(await telefonBandmi("+998901112233"), true);
  assert.equal(await telefonBandmi("+998902223344"), true, "998... ko'rinishida saqlangan");
  assert.equal(await telefonBandmi("+998903334455"), true, "9 raqam ko'rinishida saqlangan");
  assert.equal(await telefonBandmi("+998909999999"), false);
});

test("signup route: login E.164 da saqlanadi va dublikat barcha ko'rinishda tekshiriladi", () => {
  const src = readFileSync("src/app/api/auth/signup/route.ts", "utf8");
  assert.match(src, /const login = telE164\(parsed\.data\.telefon\)/);
  assert.match(src, /telefonBandmi\(login\)/);
  assert.doesNotMatch(src, /normalizePhone/, "ikkinchi normalizatsiya mantig'i qaytmasin");
});
