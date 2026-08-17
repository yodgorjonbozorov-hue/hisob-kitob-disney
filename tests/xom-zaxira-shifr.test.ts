/**
 * DEPLOY ZAXIRASINI SHIFRLASH — XAVFSIZLIK/REGRESSIYA TESTI (audit: Critical #2).
 *
 * Muammo: `src/lib/backup/send.ts` shifrlangandan keyin ham IKKINCHI zaxira
 * yo'li ochiq qolgan edi. `scripts/deploy-zaxira.mjs` migratsiyadan oldin
 * butun SQLite bazasini xom surat qilib oladi (`SELECT *` — parol hashlari
 * bilan birga) va `scripts/lib/telegram.mjs` orqali Telegramga FAQAT gzip
 * qilib yuborardi. Ya'ni kanalda ochiq baza yotardi.
 *
 * Bu test to'rt narsani qo'riqlaydi:
 *   1. Skript tomonidagi shifr ilova tomonidagisi bilan BIR XIL
 *      (biri shifrlaganini ikkinchisi ocha oladi) — format ajralib ketmasin.
 *   2. Telegramga ketgan bayt oqimida ochiq ma'lumot YO'Q.
 *   3. Kalit yo'q bo'lsa build TO'XTAYDI va hech narsa yuborilmaydi.
 *   4. Kanaldan olingan fayl `npm run zaxira:xom -- --tikla` bilan tiklanadi.
 *
 * Ishga tushirish: npm run test:xom-zaxira-shifr
 *
 * Haqiqiy Telegramga chiqilmaydi: `TELEGRAM_API_BASE` shu jarayondagi soxta
 * serverga yo'naltiriladi (mavjud `tests/deploy-zaxira.test.ts` uslubi).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, Server } from "node:http";
import { gunzipSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ESKI_OXIRGI = "20260804073000_bepul_tenant";

const ESKI_DB = "prisma/test-xzs-eski.db";
const MAQSAD_DB = "prisma/test-xzs-maqsad.db";
const FAYL = "prisma/backups/test-xzs-surat.json.gz.enc";

const KALIT = randomBytes(32).toString("hex");

/** Suratda qidiriladigan "maxfiy" qiymatlar. */
const PAROL_HASH = "$2a$10$XOMZAXIRAMAXFIYPAROLHASHIXOMZAXIRAMAXFIYPAROLHASHIxx";
const BIZNES_NOMI = "Maxfiy Xom Biznes";

const url = (db: string) => `file:./${db}`;

let crypto_: any; // src/lib/backup/crypto.ts (ilova tomoni)
let asos: any; // src/lib/backup/shifr-asos.cjs (skript tomoni)

/** Soxta Telegram: kelgan hujjatlarni yig'adi. */
class SoxtaTelegram {
  server!: Server;
  port = 0;
  qabullar: { nom: string; bayt: Buffer; izoh: string }[] = [];

  async boshla() {
    this.server = createServer((req, res) => {
      const bolaklar: Buffer[] = [];
      req.on("data", (b) => bolaklar.push(b));
      req.on("end", () => {
        const chegara = /boundary=(.+)$/.exec(req.headers["content-type"] ?? "")?.[1] ?? "";
        this.qabullar.push(ajrat(Buffer.concat(bolaklar), chegara));
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    this.port = (this.server.address() as { port: number }).port;
  }

  manzil() {
    return `http://127.0.0.1:${this.port}`;
  }

  toxtat() {
    this.server.close();
  }
}

/** multipart/form-data ni eng zarur qismlarga ajratadi. */
function ajrat(tana: Buffer, chegara: string) {
  const ajratgich = Buffer.from(`--${chegara}`);
  const bolaklar: Buffer[] = [];
  let joy = tana.indexOf(ajratgich);
  while (joy >= 0) {
    const keyingi = tana.indexOf(ajratgich, joy + ajratgich.length);
    if (keyingi < 0) break;
    bolaklar.push(tana.subarray(joy + ajratgich.length + 2, keyingi - 2));
    joy = keyingi;
  }

  let nom = "";
  let izoh = "";
  let bayt: Buffer = Buffer.alloc(0);

  for (const bolak of bolaklar) {
    const bosh = bolak.indexOf("\r\n\r\n");
    if (bosh < 0) continue;
    const sarlavha = bolak.subarray(0, bosh).toString("utf8");
    const tanasi = bolak.subarray(bosh + 4);
    if (sarlavha.includes('name="document"')) {
      nom = /filename="([^"]+)"/.exec(sarlavha)?.[1] ?? "";
      bayt = tanasi;
    } else if (sarlavha.includes('name="caption"')) {
      izoh = tanasi.toString("utf8");
    }
  }

  return { nom, izoh, bayt };
}

function migratsiyalar() {
  return readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
}

/** Berilgan migratsiyagacha qo'llab baza quradi. */
async function bazaQur(db: string, oxirgi: string | null) {
  rmSync(db, { force: true });
  rmSync(`${db}-journal`, { force: true });

  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: url(db) });

  const hammasi = migratsiyalar();
  const chegara = oxirgi ? hammasi.indexOf(oxirgi) + 1 : hammasi.length;
  for (const d of hammasi.slice(0, chegara)) {
    await c.executeMultiple(readFileSync(join("prisma/migrations", d, "migration.sql"), "utf8"));
  }
  return c;
}

/** Tekshirib bo'ladigan maxfiy ma'lumot soladi. */
async function malumotSol(c: any) {
  const iso = (s: string) => new Date(s).toISOString();
  await c.execute({
    sql: `INSERT INTO "Tenant" ("id","name","slug","status","plan","createdAt","updatedAt")
          VALUES ('T1','Alfa','alfa','ACTIVE','PRO',?,?)`,
    args: [iso("2026-07-01"), iso("2026-07-01")],
  });
  await c.execute({
    sql: `INSERT INTO "Business" ("id","nomi","isActive","omborli","turi","createdAt","tenantId")
          VALUES ('B1',?,1,1,'umumiy',?,'T1')`,
    args: [BIZNES_NOMI, iso("2026-07-01")],
  });
  await c.execute({
    sql: `INSERT INTO "User" ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId")
          VALUES ('U1','Egasi','+998901000009',?,'OWNER',1,?,0,'T1')`,
    args: [PAROL_HASH, iso("2026-07-01")],
  });
}

/** `deploy-zaxira.mjs` ni berilgan env bilan ishga tushiradi (asinxron — soxta server shu jarayonda). */
function ishga(env: Record<string, string | undefined>) {
  const bola = spawn(process.execPath, ["scripts/deploy-zaxira.mjs"], {
    env: {
      ...process.env,
      BACKUP_CHAT_ID: "",
      BACKUP_BOT_TOKEN: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_API_BASE: "",
      ZAXIRASIZ_DAVOM: "",
      BACKUP_ENCRYPTION_KEY: "",
      ...env,
    },
  });

  let stdout = "";
  let stderr = "";
  bola.stdout.on("data", (d) => (stdout += String(d)));
  bola.stderr.on("data", (d) => (stderr += String(d)));

  return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    bola.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

const telegram = new SoxtaTelegram();

before(async () => {
  const eski = await bazaQur(ESKI_DB, ESKI_OXIRGI);
  await malumotSol(eski);

  const belgila = spawnSync(
    process.execPath,
    ["scripts/migratsiya-belgila.mjs", ESKI_OXIRGI, "--tasdiq"],
    { env: { ...process.env, DATABASE_URL: url(ESKI_DB) }, encoding: "utf8" }
  );
  assert.equal(belgila.status, 0, belgila.stderr);

  // Tiklash uchun maqsad baza — aynan shu sxema holatida.
  await bazaQur(MAQSAD_DB, ESKI_OXIRGI);

  crypto_ = await import("@/lib/backup/crypto");
  asos = await import("../src/lib/backup/shifr-asos.cjs");

  await telegram.boshla();
});

after(() => {
  telegram.toxtat();
  for (const db of [ESKI_DB, MAQSAD_DB]) {
    rmSync(db, { force: true });
    rmSync(`${db}-journal`, { force: true });
  }
  rmSync(FAYL, { force: true });
});

// ───────────── 1. Ikki tomon bitta formatni ishlatadi ─────────────

test("skript va ilova tomoni bir-birining faylini ocha oladi", () => {
  process.env.BACKUP_ENCRYPTION_KEY = KALIT;
  const ochiq = Buffer.from("bir xil format bo'lishi shart");

  // Ilova (crypto.ts) shifrladi -> skript (shifr-asos.cjs) ochdi.
  assert.deepEqual(asos.deshifrla(crypto_.shifrla(ochiq)), ochiq);
  // Va teskarisi.
  assert.deepEqual(crypto_.deshifrla(asos.shifrla(ochiq)), ochiq);

  // Sarlavha ham bir xil — fayl turi ikkala tomondan bir xil aniqlanadi.
  assert.deepEqual(asos.SARLAVHA, crypto_.SARLAVHA);
  assert.equal(asos.KALIT_ENV, crypto_.KALIT_ENV);
});

// ───────────── 2. Telegramga ochiq baza chiqmaydi ─────────────

test("deploy zaxirasi SHIFRLANGAN ketadi — xom ma'lumot topilmaydi", async () => {
  const oldin = telegram.qabullar.length;
  const res = await ishga({
    DATABASE_URL: url(ESKI_DB),
    BACKUP_CHAT_ID: "-100123",
    BACKUP_BOT_TOKEN: "sinov-token",
    TELEGRAM_API_BASE: telegram.manzil(),
    BACKUP_ENCRYPTION_KEY: KALIT,
  });

  assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  assert.equal(telegram.qabullar.length, oldin + 1);

  const kelgan = telegram.qabullar[telegram.qabullar.length - 1];

  // Fayl shifrlangan va nomi buni aytib turadi.
  assert.ok(asos.shifrlanganmi(kelgan.bayt), "yuborilgan fayl shifrlangan bo'lishi kerak");
  assert.match(kelgan.nom, /^balansa-migratsiya-oldidan-\d{4}-\d{2}-\d{2}\.json\.gz\.enc$/);

  // Xom baytlarda maxfiy qiymatlar YO'Q — eski kodda aynan shu yiqilardi.
  const xom = kelgan.bayt.toString("latin1");
  assert.ok(!xom.includes(PAROL_HASH), "parol hashi ochiq ko'rinmasligi kerak");
  assert.ok(!xom.includes(BIZNES_NOMI), "biznes nomi ochiq ko'rinmasligi kerak");
  assert.ok(!xom.includes("Transaction"), "jadval nomlari ham ko'rinmasligi kerak");
  assert.ok(!(kelgan.bayt[0] === 0x1f && kelgan.bayt[1] === 0x8b), "faqat gzip bo'lib qolmasligi kerak");

  // Kalit bilan ochilganda esa haqiqiy surat chiqadi.
  const surat = JSON.parse(gunzipSync(asos.deshifrla(kelgan.bayt)).toString("utf8"));
  assert.equal(surat.versiya, 1);
  assert.equal(surat.jadvallar.Tenant.qatorlar.length, 1);
  assert.ok(!("Account" in surat.jadvallar), "surat migratsiyadan OLDIN olinishi kerak");

  // Keyingi test uchun faylni saqlab qo'yamiz (kanaldan yuklab olingandek).
  mkdirSync("prisma/backups", { recursive: true });
  writeFileSync(FAYL, kelgan.bayt);
});

// ───────────── 3. Kalitsiz — fail-closed ─────────────

test("FAIL-CLOSED: kalit yo'q bo'lsa build to'xtaydi va hech narsa yuborilmaydi", async () => {
  const oldin = telegram.qabullar.length;
  const res = await ishga({
    DATABASE_URL: url(ESKI_DB),
    BACKUP_CHAT_ID: "-100123",
    BACKUP_BOT_TOKEN: "sinov-token",
    TELEGRAM_API_BASE: telegram.manzil(),
    // BACKUP_ENCRYPTION_KEY ataylab bo'sh
  });

  assert.notEqual(res.status, 0, "kalitsiz davom etmasligi kerak");
  assert.match(res.stderr, /shifrlab bo'lmaydi/i);
  assert.match(res.stderr, /BACKUP_ENCRYPTION_KEY/);
  assert.match(res.stderr, /Baza O'ZGARTIRILMADI/);
  assert.equal(telegram.qabullar.length, oldin, "kalitsiz holatda hech narsa yuborilmasligi kerak");
});

test("FAIL-CLOSED: kalit yaroqsiz (qisqa) bo'lsa ham yuborilmaydi", async () => {
  const oldin = telegram.qabullar.length;
  const res = await ishga({
    DATABASE_URL: url(ESKI_DB),
    BACKUP_CHAT_ID: "-100123",
    BACKUP_BOT_TOKEN: "sinov-token",
    TELEGRAM_API_BASE: telegram.manzil(),
    BACKUP_ENCRYPTION_KEY: "qisqa",
  });

  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /shifrlab bo'lmaydi/i);
  assert.equal(telegram.qabullar.length, oldin);
});

test("kalitsizlikni ZAXIRASIZ_DAVOM bilan ataylab chetlab o'tish mumkin", async () => {
  // Chetlab o'tilganda ham OCHIQ zaxira yuborilmaydi — zaxira umuman olinmaydi.
  const oldin = telegram.qabullar.length;
  const res = await ishga({
    DATABASE_URL: url(ESKI_DB),
    BACKUP_CHAT_ID: "-100123",
    BACKUP_BOT_TOKEN: "sinov-token",
    TELEGRAM_API_BASE: telegram.manzil(),
    ZAXIRASIZ_DAVOM: "ha",
  });

  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr + res.stdout, /zaxirasiz davom etilmoqda/i);
  assert.equal(telegram.qabullar.length, oldin, "chetlab o'tishda ham ochiq fayl chiqmasligi kerak");
});

test("hujjatYubor: kalitsiz chaqirilsa xato tashlaydi (yagona chiqish himoyalangan)", () => {
  // Skript tomonining O'ZIDA ham himoya bor — `deploy-zaxira.mjs` dagi erta
  // tekshiruv olib tashlansa ham ochiq fayl tarmoqqa chiqa olmaydi.
  //
  // Alohida jarayonda ishga tushiriladi: bu test fayli ts-node orqali
  // CommonJS'ga aylanadi va `.mjs` modulni to'g'ridan-to'g'ri import qila olmaydi.
  const kod = `
    const { hujjatYubor } = await import("./scripts/lib/telegram.mjs");
    // Yuborish urinishini ham ushlaymiz: fetch chaqirilsa test yiqilsin.
    globalThis.fetch = () => { throw new Error("FETCH-CHAQIRILDI"); };
    try {
      await hujjatYubor({ token: "t", chatId: "-1", bayt: Buffer.from("ochiq"), nom: "x.json.gz", izoh: "i" });
      console.log("XATO-YO'Q");
    } catch (e) {
      console.log(e.message);
    }
  `;
  const res = spawnSync(process.execPath, ["--input-type=module", "-e", kod], {
    env: { ...process.env, BACKUP_ENCRYPTION_KEY: "" },
    encoding: "utf8",
  });

  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /BACKUP_ENCRYPTION_KEY/, "kalitsiz yuborish rad etilishi kerak");
  assert.doesNotMatch(res.stdout, /FETCH-CHAQIRILDI/, "tarmoqqa umuman chiqilmasligi kerak");
});

// ───────────── 4. Restore bilan moslik ─────────────

test("kanaldagi shifrlangan fayl `zaxira:xom --tikla` bilan tiklanadi", async () => {
  assert.ok(existsSync(FAYL), "oldingi test faylni saqlagan bo'lishi kerak");

  const res = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", "--tikla", FAYL], {
    env: { ...process.env, DATABASE_URL: url(MAQSAD_DB), BACKUP_ENCRYPTION_KEY: KALIT },
    encoding: "utf8",
  });
  assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /Shifrlangan zaxira ochildi/);
  assert.match(res.stdout, /tashqi kalitlar toza/);

  // Ma'lumot haqiqatan tiklandi.
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: url(MAQSAD_DB) });
  const biz = await c.execute(`SELECT "nomi" FROM "Business" WHERE id='B1'`);
  assert.equal(String(biz.rows[0].nomi), BIZNES_NOMI);
  const u = await c.execute(`SELECT "parolHash" FROM "User" WHERE id='U1'`);
  assert.equal(String(u.rows[0].parolHash), PAROL_HASH, "parol hashi aynan tiklanishi kerak");
});

test("kalitsiz tiklash: fayl ochilmaydi va aniq xato beriladi", () => {
  const res = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", "--tikla", FAYL], {
    env: { ...process.env, DATABASE_URL: url(MAQSAD_DB), BACKUP_ENCRYPTION_KEY: "" },
    encoding: "utf8",
  });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /BACKUP_ENCRYPTION_KEY/);
});

test("boshqa kalit bilan tiklash: GCM butunligi to'xtatadi", () => {
  const res = spawnSync(process.execPath, ["scripts/xom-zaxira.mjs", "--tikla", FAYL], {
    env: {
      ...process.env,
      DATABASE_URL: url(MAQSAD_DB),
      BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    },
    encoding: "utf8",
  });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /ochib bo'lmadi/);
});
