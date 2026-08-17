/**
 * MOBIL AUTH TESTLARI (native ilova uchun token sessiyasi).
 *
 * Bu XAVFSIZLIK kodi — har da'vo test bilan qo'riqlanadi:
 *  1. token bazada XOM saqlanmaydi (faqat SHA-256 xeshi);
 *  2. access muddati o'tsa ishlamaydi;
 *  3. refresh rotatsiyasi — eskisi darhol o'ladi;
 *  4. ISHLATILGAN refresh qayta kelsa = o'g'irlik → qurilma butunlay yopiladi;
 *  5. chiqish FAQAT o'sha qurilmani yopadi (boshqa telefon ishlayveradi);
 *  6. bloklangan foydalanuvchi tokeni ishlamaydi;
 *  7. tenant izolyatsiyasi — token boshqa tenantga eshik ochmaydi;
 *  8. foydalanuvchi o'chirilsa tokenlar ham ketadi (cascade).
 *
 * Ishga tushirish: npm run test:mobil-auth
 */
process.env.DATABASE_URL = "file:./prisma/test-mobil-auth.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { createHash } from "node:crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let createTenantWithOwner: any;
let mobil: any;

let A: any; // birinchi tenant egasi
let B: any; // ikkinchi tenant egasi

const QURILMA_1 = "device-iphone-0000001";
const QURILMA_2 = "device-ipad-00000002";

before(async () => {
  rmSync("prisma/test-mobil-auth.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  mobil = await import("@/lib/auth/mobil");

  A = await createTenantWithOwner({
    kompaniyaNomi: "Mobil Test A",
    ism: "Ega A",
    login: "+998900000201",
    parol: "parol12345",
  });
  B = await createTenantWithOwner({
    kompaniyaNomi: "Mobil Test B",
    ism: "Ega B",
    login: "+998900000202",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ───────────── 1. Token bazada xom saqlanmaydi ─────────────

test("token bazada XOM saqlanmaydi — faqat SHA-256 xeshi", async () => {
  const j = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1, "iPhone 16");

  // Xom token bilan qidirsak — topilmasligi kerak.
  const xomBilan = await rawPrisma.mobileToken.findUnique({ where: { tokenHash: j.access } });
  assert.equal(xomBilan, null, "xom token bazada bo'lmasligi kerak");

  // Xeshi bilan qidirsak — topiladi.
  const xesh = createHash("sha256").update(j.access).digest("hex");
  const topildi = await rawPrisma.mobileToken.findUnique({ where: { tokenHash: xesh } });
  assert.ok(topildi, "xesh bo'yicha topilishi kerak");
  assert.equal(topildi.turi, "access");

  // Bazadagi hech bir ustunda xom token bo'lmasligi kerak.
  const hammasi = await rawPrisma.mobileToken.findMany();
  const matn = JSON.stringify(hammasi);
  assert.ok(!matn.includes(j.access), "xom access token bazada uchramasligi kerak");
  assert.ok(!matn.includes(j.refresh), "xom refresh token bazada uchramasligi kerak");
});

test("access token sessiyani to'g'ri tiklaydi", async () => {
  const j = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1);
  const s = await mobil.accessTokenSessiya(j.access);
  assert.ok(s);
  assert.equal(s.userId, A.user.id);
  assert.equal(s.tenantId, A.tenant.id);
  assert.equal(s.rol, "OWNER");
  assert.equal(s.deviceId, QURILMA_1);
});

test("refresh tokenni access sifatida ishlatib bo'lmaydi", async () => {
  const j = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1);
  const s = await mobil.accessTokenSessiya(j.refresh);
  assert.equal(s, null, "refresh token access sifatida qabul qilinmasligi kerak");
});

// ───────────── 2. Muddat ─────────────

test("muddati o'tgan access ishlamaydi", async () => {
  const j = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1);
  const xesh = createHash("sha256").update(j.access).digest("hex");
  await rawPrisma.mobileToken.update({
    where: { tokenHash: xesh },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  assert.equal(await mobil.accessTokenSessiya(j.access), null);
});

test("bekor qilingan access ishlamaydi", async () => {
  const j = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1);
  const xesh = createHash("sha256").update(j.access).digest("hex");
  await rawPrisma.mobileToken.update({ where: { tokenHash: xesh }, data: { revokedAt: new Date() } });
  assert.equal(await mobil.accessTokenSessiya(j.access), null);
});

// ───────────── 3. Rotatsiya ─────────────

test("refresh rotatsiyasi: yangi juftlik beriladi, eski access DARHOL o'ladi", async () => {
  const eski = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1);
  assert.ok(await mobil.accessTokenSessiya(eski.access), "eski access dastlab ishlashi kerak");

  const natija = await mobil.tokenYangila(eski.refresh);
  assert.equal(natija.holat, "ok");
  assert.notEqual(natija.juftlik.access, eski.access);
  assert.notEqual(natija.juftlik.refresh, eski.refresh);

  // Eski access endi ishlamasligi kerak — aks holda o'g'irlangan token
  // yana 15 daqiqa yashardi.
  assert.equal(await mobil.accessTokenSessiya(eski.access), null, "eski access o'lishi kerak");
  assert.ok(await mobil.accessTokenSessiya(natija.juftlik.access), "yangi access ishlashi kerak");
});

// ───────────── 4. O'g'irlik aniqlash ─────────────

test("ISHLATILGAN refresh qayta kelsa — o'g'irlik, qurilma butunlay yopiladi", async () => {
  const j1 = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1);
  const j2 = await mobil.tokenYangila(j1.refresh);
  assert.equal(j2.holat, "ok");
  assert.ok(await mobil.accessTokenSessiya(j2.juftlik.access));

  // O'g'ri eski refresh bilan keladi.
  const urinish = await mobil.tokenYangila(j1.refresh);
  assert.equal(urinish.holat, "ogirlik");

  // Haqiqiy klientning YANGI tokeni ham o'lishi kerak — qurilma butunlay yopiladi.
  assert.equal(
    await mobil.accessTokenSessiya(j2.juftlik.access),
    null,
    "o'g'irlikdan keyin qurilmaning barcha tokenlari bekor bo'lishi kerak",
  );
  const yana = await mobil.tokenYangila(j2.juftlik.refresh);
  assert.notEqual(yana.holat, "ok");
});

test("yaroqsiz refresh — 'yaroqsiz', o'g'irlik EMAS", async () => {
  const natija = await mobil.tokenYangila("umuman-mavjud-emas-token");
  assert.equal(natija.holat, "yaroqsiz");
});

// ───────────── 5. Ko'p qurilma ─────────────

test("chiqish FAQAT o'sha qurilmani yopadi", async () => {
  const telefon = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1, "iPhone");
  const planshet = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_2, "iPad");

  await mobil.qurilmaniBekorQil(A.user.id, QURILMA_1);

  assert.equal(await mobil.accessTokenSessiya(telefon.access), null, "telefon yopilishi kerak");
  assert.ok(await mobil.accessTokenSessiya(planshet.access), "planshet ishlashda davom etishi kerak");
});

test("parol o'zgarsa BARCHA qurilmalar yopiladi", async () => {
  const telefon = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1);
  const planshet = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_2);

  await mobil.hammaQurilmalarniBekorQil(A.user.id);

  assert.equal(await mobil.accessTokenSessiya(telefon.access), null);
  assert.equal(await mobil.accessTokenSessiya(planshet.access), null);
});

// ───────────── 6. Bloklangan foydalanuvchi ─────────────

test("bloklangan (isActive=false) foydalanuvchi tokeni ishlamaydi", async () => {
  const j = await mobil.tokenJuftligiYarat(B.user.id, QURILMA_1);
  assert.ok(await mobil.accessTokenSessiya(j.access));

  await rawPrisma.user.update({ where: { id: B.user.id }, data: { isActive: false } });
  assert.equal(await mobil.accessTokenSessiya(j.access), null, "bloklangan user tokeni o'lishi kerak");

  // Refresh ham ishlamasligi kerak.
  const natija = await mobil.tokenYangila(j.refresh);
  assert.equal(natija.holat, "yaroqsiz");

  await rawPrisma.user.update({ where: { id: B.user.id }, data: { isActive: true } });
});

// ───────────── 7. Tenant izolyatsiyasi ─────────────

test("token boshqa tenantga eshik ochmaydi", async () => {
  const jA = await mobil.tokenJuftligiYarat(A.user.id, QURILMA_1);
  const sA = await mobil.accessTokenSessiya(jA.access);
  assert.equal(sA.tenantId, A.tenant.id);
  assert.notEqual(sA.tenantId, B.tenant.id, "A tokeni B tenantini bermasligi kerak");

  const jB = await mobil.tokenJuftligiYarat(B.user.id, QURILMA_1);
  const sB = await mobil.accessTokenSessiya(jB.access);
  assert.equal(sB.tenantId, B.tenant.id);

  // Bir xil deviceId ikki tenantda — bir-biriga ta'sir qilmaydi.
  await mobil.qurilmaniBekorQil(A.user.id, QURILMA_1);
  assert.ok(await mobil.accessTokenSessiya(jB.access), "B tokeni tegilmasligi kerak");
});

// ───────────── 8. Cascade va tozalash ─────────────

test("foydalanuvchi o'chirilsa tokenlar ham ketadi (cascade)", async () => {
  const t = await createTenantWithOwner({
    kompaniyaNomi: "Ochiriladigan",
    ism: "Ega",
    login: "+998900000203",
    parol: "parol12345",
  });
  await mobil.tokenJuftligiYarat(t.user.id, QURILMA_1);
  assert.equal(await rawPrisma.mobileToken.count({ where: { userId: t.user.id } }), 2);

  await rawPrisma.user.delete({ where: { id: t.user.id } });
  assert.equal(
    await rawPrisma.mobileToken.count({ where: { userId: t.user.id } }),
    0,
    "yetim token qolmasligi kerak",
  );
});

test("eskiTokenlarniTozala muddati o'tganlarni o'chiradi, tirikni tegmaydi", async () => {
  const tirik = await mobil.tokenJuftligiYarat(A.user.id, "device-tozalash-001");
  const olik = await mobil.tokenJuftligiYarat(A.user.id, "device-tozalash-002");

  const xesh = createHash("sha256").update(olik.access).digest("hex");
  await rawPrisma.mobileToken.update({
    where: { tokenHash: xesh },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  const n = await mobil.eskiTokenlarniTozala();
  assert.ok(n >= 1, "kamida bitta o'chirilishi kerak");
  assert.ok(await mobil.accessTokenSessiya(tirik.access), "tirik token tegilmasligi kerak");
});

// ───────────── 9. Yordamchi ─────────────

test("bearerToken sarlavhani to'g'ri ajratadi", () => {
  assert.equal(mobil.bearerToken("Bearer abc123"), "abc123");
  assert.equal(mobil.bearerToken("bearer abc123"), "abc123");
  assert.equal(mobil.bearerToken("Basic abc123"), null);
  assert.equal(mobil.bearerToken("abc123"), null);
  assert.equal(mobil.bearerToken(null), null);
  assert.equal(mobil.bearerToken("Bearer "), null);
});

test("har token noyob — takrorlanmaydi", async () => {
  const toplam = new Set<string>();
  for (let i = 0; i < 50; i++) {
    const j = await mobil.tokenJuftligiYarat(A.user.id, `device-noyob-${i}`);
    toplam.add(j.access);
    toplam.add(j.refresh);
  }
  assert.equal(toplam.size, 100, "100 ta token ham noyob bo'lishi kerak");
});
