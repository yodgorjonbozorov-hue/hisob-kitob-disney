/**
 * ZAXIRA SHIFRLASH — XAVFSIZLIK/REGRESSIYA TESTI (audit: Critical #2).
 *
 * Muammo: kunlik zaxira butun bazani — barcha tenantlarning moliyaviy
 * ma'lumoti, mijoz ismlari, telefonlari va foydalanuvchilarning parol
 * hashlari bilan — Telegram kanaliga OCHIQ (faqat gzip) yuborardi.
 * Kanalga kirgan yoki bot tokenini qo'lga kiritgan odam hammasini o'qiy
 * olardi.
 *
 * Bu test uchta narsani qo'riqlaydi:
 *   1. Telegramga ketadigan bayt oqimi shifrlangan — ochiq matn TOPILMAYDI.
 *   2. Kalit yo'q bo'lsa HECH NARSA yuborilmaydi (fail-closed).
 *   3. Parol hashlari zaxira tanasida umuman yo'q, tiklash esa ishlaydi.
 *
 * Ishga tushirish: npm run test:zaxira-shifr
 *
 * Alohida test bazasi ishlatiladi (prisma/test-zaxira-shifr.db) — dev/prod
 * bazaga tegmaydi. Telegram HAQIQATAN chaqirilmaydi: `fetch` shu jarayonda
 * almashtiriladi va yuborilgan bayt oqimi tekshiriladi.
 */
process.env.DATABASE_URL = "file:./prisma/test-zaxira-shifr.db";

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { randomBytes } from "node:crypto";

let rawPrisma: any;
let maqsadPrisma: any;
let crypto_: any;
let backup: any;
let send: any;

const MAQSAD_DB = "file:./prisma/test-zaxira-shifr-maqsad.db";

const KALIT = randomBytes(32).toString("hex");
const BOSHQA_KALIT = randomBytes(32).toString("hex");

const TENANT = "t_zs";
const BIZ = "biz_zs";
const USER = "u_zs";
// Zaxira ichida qidiriladigan "maxfiy" qiymatlar.
const MIJOZ_ISMI = "Maxfiy Mijoz Ismi";
const PAROL_HASH = "$2a$10$MAXFIYPAROLHASHIMAXFIYPAROLHASHIMAXFIYPAROLHASHIMAXFIYxx";

function migratsiya(dbUrl: string) {
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi (${dbUrl}):\n${res.stdout}\n${res.stderr}`);
}

/** Telegramga yuborilgan hujjatni ushlab qoladigan soxta `fetch`. */
function fetchniUshla() {
  const asl = globalThis.fetch;
  const chaqiruvlar: { url: string; hujjat: Buffer; nom: string; caption: string }[] = [];

  globalThis.fetch = (async (url: any, init: any) => {
    const form = init?.body as FormData;
    const doc = form.get("document") as any;
    chaqiruvlar.push({
      url: String(url),
      hujjat: Buffer.from(await doc.arrayBuffer()),
      nom: doc.name ?? "",
      caption: String(form.get("caption") ?? ""),
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as any;

  return { chaqiruvlar, tikla: () => { globalThis.fetch = asl; } };
}

before(async () => {
  rmSync("prisma/test-zaxira-shifr.db", { force: true });
  rmSync("prisma/test-zaxira-shifr-maqsad.db", { force: true });
  migratsiya("file:./prisma/test-zaxira-shifr.db");
  migratsiya(MAQSAD_DB);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  crypto_ = await import("@/lib/backup/crypto");
  backup = await import("@/lib/backup/dump");
  send = await import("@/lib/backup/send");

  const { PrismaClient } = await import("@prisma/client");
  const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
  const { createClient } = await import("@libsql/client");
  maqsadPrisma = new PrismaClient({
    adapter: new PrismaLibSQL(createClient({ url: MAQSAD_DB })),
  });

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "Shifr tenant", slug: "shifr-tenant", status: "ACTIVE" },
  });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "Shifr biznes", tenantId: TENANT } });
  await rawPrisma.user.create({
    data: {
      id: USER,
      ism: "Shifr direktori",
      login: "shifr_owner",
      parolHash: PAROL_HASH,
      rol: "OWNER",
      tenantId: TENANT,
      businessId: BIZ,
    },
  });
  await rawPrisma.contact.create({
    data: { id: "c_zs", businessId: BIZ, ism: MIJOZ_ISMI, createdBy: USER },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
  await maqsadPrisma?.$disconnect();
});

beforeEach(() => {
  process.env.BACKUP_ENCRYPTION_KEY = KALIT;
  process.env.BACKUP_CHAT_ID = "-1000000000001";
  process.env.BACKUP_BOT_TOKEN = "sinov:token";
});

// ─────────────────────────── Shifrlash primitivi ───────────────────────────

test("shifrla/deshifrla: aylanma yo'l ma'lumotni saqlaydi", () => {
  const ochiq = Buffer.from("maxfiy ma'lumot — o'zbekcha matn ham");
  const shifr = crypto_.shifrla(ochiq);

  assert.ok(!shifr.includes(ochiq), "shifrda ochiq matn bo'lmasligi kerak");
  assert.deepEqual(crypto_.deshifrla(shifr), ochiq);
});

test("shifrlash har safar boshqa natija beradi (IV takrorlanmaydi)", () => {
  const ochiq = Buffer.from("bir xil kirish");
  assert.notDeepEqual(crypto_.shifrla(ochiq), crypto_.shifrla(ochiq));
});

test("GCM butunligi: bitta bayt o'zgarsa deshifrlash RAD etadi", () => {
  const shifr = crypto_.shifrla(Buffer.from("zaxira tanasi"));
  // Oxirgi bayt — shifrlangan tananing bir qismi.
  shifr[shifr.length - 1] ^= 0xff;
  assert.throws(() => crypto_.deshifrla(shifr), /o'zgartirilgan|ochib bo'lmadi/);
});

test("boshqa kalit bilan ochib bo'lmaydi", () => {
  const shifr = crypto_.shifrla(Buffer.from("zaxira tanasi"));
  process.env.BACKUP_ENCRYPTION_KEY = BOSHQA_KALIT;
  assert.throws(() => crypto_.deshifrla(shifr), /ochib bo'lmadi/);
});

test("kalit yo'q yoki noto'g'ri uzunlikda bo'lsa shifrlash RAD etadi", () => {
  delete process.env.BACKUP_ENCRYPTION_KEY;
  assert.equal(crypto_.kalitBormi(), false);
  assert.throws(() => crypto_.shifrla(Buffer.from("x")), /BACKUP_ENCRYPTION_KEY/);

  process.env.BACKUP_ENCRYPTION_KEY = "qisqa-kalit";
  assert.equal(crypto_.kalitBormi(), false);
  assert.throws(() => crypto_.shifrla(Buffer.from("x")), /bayt bo'lishi shart|BACKUP_ENCRYPTION_KEY/);
});

// ───────────────── Telegramga ketadigan oqim (asosiy regressiya) ─────────────────

test("Telegramga SHIFRLANGAN fayl ketadi — ochiq ma'lumot topilmaydi", async () => {
  const t = fetchniUshla();
  try {
    const natija = await send.sendBackupToTelegram();
    assert.equal(natija.holat, "yuborildi");
    assert.equal(t.chaqiruvlar.length, 1);

    const { hujjat, nom } = t.chaqiruvlar[0];

    // 1. Fayl shifrlangan formatda (sarlavha bor).
    assert.ok(crypto_.shifrlanganmi(hujjat), "yuborilgan fayl shifrlangan bo'lishi kerak");
    assert.match(nom, /\.enc$/, "fayl nomi .enc bilan tugashi kerak");

    // 2. Xom baytlarda maxfiy qiymatlar YO'Q. Aynan shu tekshiruv eski
    //    kodda (gzip + ochiq JSON) yiqilardi.
    const xom = hujjat.toString("latin1");
    assert.ok(!xom.includes(MIJOZ_ISMI), "mijoz ismi ochiq ko'rinmasligi kerak");
    assert.ok(!xom.includes(PAROL_HASH), "parol hashi ochiq ko'rinmasligi kerak");
    assert.ok(!xom.includes("Shifr biznes"), "biznes nomi ochiq ko'rinmasligi kerak");
    // Gzip bo'lib qolmaganini ham tekshiramiz (0x1f 0x8b).
    assert.ok(!(hujjat[0] === 0x1f && hujjat[1] === 0x8b), "fayl faqat gzip bo'lib qolmasligi kerak");

    // 3. Kalit bilan ochilganda esa haqiqiy zaxira chiqadi.
    const ochilgan = JSON.parse(gunzipSync(crypto_.deshifrla(hujjat)).toString("utf8"));
    assert.equal(ochilgan.version, backup.BACKUP_VERSION);
    assert.equal(ochilgan.counts.tenant, 1);
    assert.equal(ochilgan.data.contact[0].ism, MIJOZ_ISMI);
  } finally {
    t.tikla();
  }
});

test("FAIL-CLOSED: kalit yo'q bo'lsa Telegramga UMUMAN murojaat qilinmaydi", async () => {
  delete process.env.BACKUP_ENCRYPTION_KEY;
  const t = fetchniUshla();
  try {
    const natija = await send.sendBackupToTelegram();
    assert.equal(natija.holat, "kalitsiz");
    assert.equal(t.chaqiruvlar.length, 0, "kalitsiz holatda hech narsa yuborilmasligi kerak");
  } finally {
    t.tikla();
  }
});

test("FAIL-CLOSED: kalit yaroqsiz bo'lsa ham yuborilmaydi", async () => {
  process.env.BACKUP_ENCRYPTION_KEY = "AAAA"; // 32 baytdan qisqa
  const t = fetchniUshla();
  try {
    const natija = await send.sendBackupToTelegram();
    assert.equal(natija.holat, "kalitsiz");
    assert.equal(t.chaqiruvlar.length, 0);
  } finally {
    t.tikla();
  }
});

test("chat id/token yo'q bo'lsa avvalgidek 'sozlanmagan' qaytadi", async () => {
  delete process.env.BACKUP_CHAT_ID;
  delete process.env.BACKUP_BOT_TOKEN;
  const asl = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;
  const t = fetchniUshla();
  try {
    const natija = await send.sendBackupToTelegram();
    assert.equal(natija.holat, "sozlanmagan");
    assert.equal(t.chaqiruvlar.length, 0);
  } finally {
    t.tikla();
    if (asl !== undefined) process.env.TELEGRAM_BOT_TOKEN = asl;
  }
});

// ─────────────────────────── Parol hashlari ───────────────────────────

test("parolHash zaxira TANASIDA yo'q (kalit bor bo'lsa ham)", async () => {
  const zaxira = await backup.createDump();

  for (const u of zaxira.data.user) {
    assert.ok(!("parolHash" in u), "user qatorida parolHash bo'lmasligi kerak");
  }
  // Butun tana bo'ylab ham qidiramiz — boshqa jadvalga sizib ketmaganiga ishonch.
  assert.ok(
    !JSON.stringify(zaxira.data).includes(PAROL_HASH),
    "parol hashi zaxira tanasining hech qayerida bo'lmasligi kerak"
  );
  assert.ok(zaxira.sirlar, "kalit bor — hashlar shifrlangan blokda bo'lishi kerak");
  assert.ok(!zaxira.sirlar.includes(PAROL_HASH), "sirlar bloki ham ochiq bo'lmasligi kerak");
});

test("kalitsiz zaxirada parol hashlari UMUMAN bo'lmaydi", async () => {
  delete process.env.BACKUP_ENCRYPTION_KEY;
  const zaxira = await backup.createDump();

  assert.equal(zaxira.sirlar, undefined, "kalitsiz holatda sirlar bloki bo'lmasligi kerak");
  assert.ok(!JSON.stringify(zaxira).includes(PAROL_HASH), "hash hech qayerda bo'lmasligi kerak");
});

test("tiklash: kalit bilan parol hashi AYNAN tiklanadi", async () => {
  const zaxira = await backup.createDump();
  const fayldan = JSON.parse(JSON.stringify(zaxira)); // fayl orqali o'tgandek

  await backup.restoreDump(fayldan, maqsadPrisma);

  const u = await maqsadPrisma.user.findUnique({ where: { id: USER } });
  assert.ok(u, "foydalanuvchi tiklanishi kerak");
  assert.equal(u.parolHash, PAROL_HASH, "parol hashi asl holida tiklanishi kerak");
  assert.equal(u.mustChangePassword, false);
});

test("tiklash: parolsiz zaxirada kirib bo'lmaydigan qiymat qo'yiladi", async () => {
  const zaxira = await backup.createDump();
  // `sirlar` siz zaxira (kalitsiz olingan yoki ataylab tashlangan).
  const parolsiz = JSON.parse(JSON.stringify({ ...zaxira, sirlar: undefined }));

  // Tozalab, qaytadan tiklaymiz.
  await maqsadPrisma.contact.deleteMany({});
  await maqsadPrisma.user.deleteMany({});
  await maqsadPrisma.business.deleteMany({});
  await maqsadPrisma.tenant.deleteMany({});
  await backup.restoreDump(parolsiz, maqsadPrisma);

  const u = await maqsadPrisma.user.findUnique({ where: { id: USER } });
  assert.ok(u);
  assert.notEqual(u.parolHash, PAROL_HASH);
  assert.ok(!u.parolHash.startsWith("$2"), "bcrypt formatida bo'lmasligi kerak — kirib bo'lmaydi");
  assert.equal(u.mustChangePassword, true, "yangi parol so'ralishi kerak");

  const { verifyPassword } = await import("@/lib/auth/password");
  assert.equal(await verifyPassword("parol12345", u.parolHash), false);
  assert.equal(await verifyPassword(PAROL_HASH, u.parolHash), false);
});

test("tiklash: sirlar bor, kalit yo'q — jimgina parolsiz tiklamaydi", async () => {
  const zaxira = await backup.createDump();
  assert.ok(zaxira.sirlar);
  delete process.env.BACKUP_ENCRYPTION_KEY;

  await assert.rejects(
    () => backup.restoreDump(zaxira, maqsadPrisma, { force: true }),
    /BACKUP_ENCRYPTION_KEY/,
    "kalitsiz tiklash ogohlantirishsiz o'tmasligi kerak"
  );
});

test("ESKI format: qator ichida parolHash bo'lsa ham tiklanadi (orqaga moslik)", async () => {
  // Versiya oshirilmagani uchun eski zaxira fayllari ham ishlashda davom etadi.
  const zaxira = await backup.createDump();
  const eski = JSON.parse(JSON.stringify(zaxira));
  delete eski.sirlar;
  eski.data.user = eski.data.user.map((u: any) => ({ ...u, parolHash: PAROL_HASH }));

  await maqsadPrisma.contact.deleteMany({});
  await maqsadPrisma.user.deleteMany({});
  await maqsadPrisma.business.deleteMany({});
  await maqsadPrisma.tenant.deleteMany({});
  await backup.restoreDump(eski, maqsadPrisma);

  const u = await maqsadPrisma.user.findUnique({ where: { id: USER } });
  assert.equal(u.parolHash, PAROL_HASH);
});
