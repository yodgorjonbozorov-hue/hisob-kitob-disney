/**
 * PAROLNI TIKLASH (H-7) — Telegram kod oqimi.
 *
 * Kod yuborish qismi Telegram API'ga bog'liq (testda chaqirilmaydi);
 * bu yerda kodni TEKSHIRISH qatlami sinovdan o'tadi: hash saqlash, muddat,
 * bir martalik, noto'g'ri kod va enumeration yopiqligi.
 *
 * Ishga tushirish: npm run test:parol-tiklash
 */
process.env.DATABASE_URL = "file:./prisma/test-parol-tiklash.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createHash } from "node:crypto";

let rawPrisma: any;
let parolTiklash: any;
let verifyPassword: any;
let t: any;

const LOGIN = "+998977777801";

function kodHash(kod: string): string {
  return createHash("sha256").update(kod, "utf8").digest("hex");
}

/** Foydalanuvchiga tiklash kodini "yuborilgan" holatga keltiradi (bot chetlab). */
async function kodniOrnat(kod: string, muddatMs = 10 * 60 * 1000) {
  await rawPrisma.user.update({
    where: { login: LOGIN },
    data: { resetCodeHash: kodHash(kod), resetCodeExpiresAt: new Date(Date.now() + muddatMs) },
  });
}

before(async () => {
  rmSync("prisma/test-parol-tiklash.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  parolTiklash = await import("@/lib/auth/parolTiklash");
  ({ verifyPassword } = await import("@/lib/auth/password"));
  const { createTenantWithOwner } = await import("@/lib/services/signup");

  t = await createTenantWithOwner({
    kompaniyaNomi: "Tiklash test",
    ism: "Egasi",
    login: LOGIN,
    parol: "eskiparol123",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("Telegram ulanmagan foydalanuvchiga kod yuborilmaydi va bazada iz qolmaydi", async () => {
  const natija = await parolTiklash.tiklashKodiniYubor(LOGIN);
  assert.equal(natija.yuborildi, false);
  const user = await rawPrisma.user.findUnique({ where: { login: LOGIN } });
  assert.equal(user.resetCodeHash, null, "Telegram'siz kod yaratilmasin");
});

test("mavjud bo'lmagan login ham xatosiz, bir xil natija (enumeration yopiq)", async () => {
  const natija = await parolTiklash.tiklashKodiniYubor("+998900000000");
  assert.equal(natija.yuborildi, false);
});

test("to'g'ri kod bilan parol yangilanadi, kod bir martalik", async () => {
  await kodniOrnat("123456");

  const ok = await parolTiklash.tiklashniTasdiqla(LOGIN, "123456", "yangiparol123");
  assert.equal(ok, true);

  const user = await rawPrisma.user.findUnique({ where: { login: LOGIN } });
  assert.equal(await verifyPassword("yangiparol123", user.parolHash), true, "yangi parol amal qiladi");
  assert.equal(await verifyPassword("eskiparol123", user.parolHash), false, "eski parol bekor");
  assert.equal(user.resetCodeHash, null, "kod tozalanadi");
  assert.equal(user.mustChangePassword, false);

  // Xuddi shu kod bilan ikkinchi urinish — rad (bir martalik).
  const qayta = await parolTiklash.tiklashniTasdiqla(LOGIN, "123456", "boshqaparol123");
  assert.equal(qayta, false);
});

test("noto'g'ri kod rad etiladi va bazadagi kod saqlanib qoladi", async () => {
  await kodniOrnat("654321");
  const ok = await parolTiklash.tiklashniTasdiqla(LOGIN, "111111", "hujumparol123");
  assert.equal(ok, false);
  const user = await rawPrisma.user.findUnique({ where: { login: LOGIN } });
  assert.ok(user.resetCodeHash, "noto'g'ri urinish kodni o'chirmasin (rate limit himoya qiladi)");
});

test("muddati o'tgan kod rad etiladi", async () => {
  await kodniOrnat("777777", -1000); // 1 soniya oldin tugagan
  const ok = await parolTiklash.tiklashniTasdiqla(LOGIN, "777777", "kechikkanparol1");
  assert.equal(ok, false);
});

test("nofaol foydalanuvchi kodi ishlamaydi (fail-closed)", async () => {
  await kodniOrnat("999999");
  await rawPrisma.user.update({ where: { login: LOGIN }, data: { isActive: false } });
  const ok = await parolTiklash.tiklashniTasdiqla(LOGIN, "999999", "nofaolparol123");
  assert.equal(ok, false);
  await rawPrisma.user.update({ where: { login: LOGIN }, data: { isActive: true } });
});

test("kod bazada faqat hash ko'rinishida saqlanadi", async () => {
  await kodniOrnat("222333");
  const user = await rawPrisma.user.findUnique({ where: { login: LOGIN } });
  assert.notEqual(user.resetCodeHash, "222333", "ochiq matn saqlanmasin");
  assert.equal(user.resetCodeHash, kodHash("222333"));
});
