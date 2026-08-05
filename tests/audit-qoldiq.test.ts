/**
 * AUDIT QOLDIQLARI — o'rta darajali topilmalar.
 *
 * Uchta ochiq muammo:
 *
 *  1. `resetUserPassword` parolni `Math.random()` bilan yaratardi. U
 *     kriptografik emas: ichki holati bir necha natijadan tiklanadi, ya'ni
 *     parolni bashorat qilish mumkin. Bu parol esa hisobga to'liq kirish
 *     huquqini beradi. (Telegram bog'lash kodida shu xato allaqachon
 *     tuzatilgan edi — bu yer e'tibordan chetda qolgan.)
 *
 *  2. `tenantClient` keshi chegarasiz `Map` edi va hech qachon tozalanmasdi:
 *     uzoq yashaydigan jarayonda (bot, cron, issiq lambda) xotira monoton
 *     o'sardi. 500+ mijoz maqsadi uchun bu sezilarli.
 *
 *  3. Kodda `Math.random()` maxfiy qiymat uchun QAYTA paydo bo'lmasligi —
 *     statik qo'riqchi.
 *
 * Ishga tushirish: npm run test:audit-qoldiq
 */
process.env.DATABASE_URL = "file:./prisma/test-audit-qoldiq.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

let rawPrisma: any;
let resetUserPassword: any;
let verifyPassword: any;
let tenantClient: any;
let tenantKeshHajmi: any;
let TENANT_KESH_CHEGARASI: number;

let t: any;

before(async () => {
  rmSync("prisma/test-audit-qoldiq.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ resetUserPassword } = await import("@/lib/superadmin/service"));
  ({ verifyPassword } = await import("@/lib/auth/password"));
  ({ tenantClient, tenantKeshHajmi, TENANT_KESH_CHEGARASI } = await import("@/lib/db/tenantDb"));
  const { createTenantWithOwner } = await import("@/lib/services/signup");

  t = await createTenantWithOwner({
    kompaniyaNomi: "Qoldiq test",
    ism: "Egasi",
    login: "+998922222901",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- 1. Parol generatsiyasi ----------

test("tiklangan parol ishlaydi va majburiy almashtirish belgilanadi", async () => {
  const natija = await resetUserPassword(t.user.id);
  assert.equal(natija.login, t.user.login);
  assert.equal(natija.yangiParol.length, 10);

  const user = await rawPrisma.user.findUnique({ where: { id: t.user.id } });
  assert.ok(await verifyPassword(natija.yangiParol, user.parolHash), "yangi parol mos kelishi kerak");
  assert.equal(user.mustChangePassword, true);
});

test("parol chalkashadigan belgilarsiz alifbodan olinadi", async () => {
  const natija = await resetUserPassword(t.user.id);
  // 0/O, 1/l/I — telefon orqali aytilganda chalkashadi, shuning uchun alifboda yo'q.
  assert.match(natija.yangiParol, /^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
});

test("parollar takrorlanmaydi va bitta belgiga yopishib qolmaydi", async () => {
  const parollar = new Set<string>();
  const belgilar = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const { yangiParol } = await resetUserPassword(t.user.id);
    parollar.add(yangiParol);
    for (const ch of yangiParol) belgilar.add(ch);
  }
  assert.equal(parollar.size, 30, "30 ta chaqiruvda 30 xil parol bo'lishi kerak");
  // Tasodifiy generator alifboni qamrab olsin (300 belgida 31 tadan ko'pi chiqadi).
  assert.ok(belgilar.size >= 20, `alifbo qamrovi juda tor: ${belgilar.size} ta belgi`);
});

// ---------- 2. Tenant kesh chegarasi ----------

test("tenant keshi bir xil id uchun BIR XIL clientni qaytaradi", () => {
  const a = tenantClient("kesh-test-1");
  const b = tenantClient("kesh-test-1");
  assert.equal(a, b, "kesh ishlashi kerak — har safar qayta qurilmasin");
});

test("kesh chegaradan oshmaydi (LRU)", () => {
  // Chegaradan ko'p tenant so'raymiz.
  for (let i = 0; i < TENANT_KESH_CHEGARASI + 50; i++) {
    tenantClient(`lru-${i}`);
  }
  assert.ok(
    tenantKeshHajmi() <= TENANT_KESH_CHEGARASI,
    `kesh ${tenantKeshHajmi()} ta yozuvga o'sdi, chegara ${TENANT_KESH_CHEGARASI}`
  );
});

test("yaqinda ishlatilgan tenant keshda qoladi, eng eskisi chiqadi", () => {
  const nom = (i: number) => `lru2-${i}`;
  // Toza boshlash uchun keshni chegaragacha to'ldiramiz.
  for (let i = 0; i < TENANT_KESH_CHEGARASI; i++) tenantClient(nom(i));

  const eng_eski = tenantClient(nom(0));
  // 0-ni QAYTA ishlatamiz — u endi "eng yangi ishlatilgan" bo'ladi.
  assert.equal(tenantClient(nom(0)), eng_eski);

  // Yangi tenant qo'shamiz: chiqarilishi kerak bo'lgan 0 EMAS, 1 bo'lishi kerak.
  tenantClient("lru2-yangi");
  assert.equal(tenantClient(nom(0)), eng_eski, "yaqinda ishlatilgan client saqlanishi kerak");
});

// ---------- 3. Statik qo'riqchi ----------

test("maxfiy qiymatlar Math.random() bilan yaratilmaydi", () => {
  // Parol, kod, token — bularning hammasi kriptografik generator talab qiladi.
  const shubhali: string[] = [];
  const fayllar = [
    "src/lib/superadmin/service.ts",
    "src/app/api/me/telegram-link-code/route.ts",
    "src/lib/auth/password.ts",
  ];
  for (const f of fayllar) {
    const matn = readFileSync(f, "utf8");
    // Aynan CHAQIRUV qidiriladi: izohlarda `Math.random` nomi ataylab
    // eslatiladi ("bu kriptografik emas"), u xato hisoblanmasligi kerak.
    if (/Math\.random\s*\(/.test(matn)) shubhali.push(f);
  }
  assert.deepEqual(
    shubhali,
    [],
    `Maxfiy qiymat yaratadigan fayllarda Math.random topildi — crypto.randomInt ishlating: ${shubhali.join(", ")}`
  );
});

test("Modal fokus qamovi va fokusni qaytarish o'z joyida", () => {
  const matn = readFileSync("src/components/ui/Modal.tsx", "utf8");
  assert.match(matn, /Tab/, "Tab tugmasi ushlanishi kerak");
  assert.match(matn, /shiftKey/, "Shift+Tab teskari yo'nalish uchun kerak");
  assert.match(matn, /oldingiFokus/, "yopilgach fokus qaytarilishi kerak");
  assert.match(matn, /aria-modal="true"/);
});
