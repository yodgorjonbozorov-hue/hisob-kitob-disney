/**
 * DEPLOY ZAXIRASI — `scripts/deploy-zaxira.mjs`.
 *
 * Bu skript build zanjirining birinchi halqasi va uning yagona vazifasi —
 * ZAXIRASIZ MIGRATSIYA BO'LMASLIGI. Shuning uchun sinaladigan narsa "ishlaydimi"
 * emas, balki "kerak bo'lganda TO'XTATADIMI":
 *
 *  - kutayotgan migratsiya bo'lmasa aralashmasligi (oddiy deploy sekinlashmasin);
 *  - kutayotgan migratsiya bo'lsa-yu zaxirani yuboradigan joy bo'lmasa —
 *    build'ni yiqitishi (jim o'tib ketmasligi);
 *  - yuborilgan fayl HAQIQATAN ham tiklanadigan surat ekani;
 *  - hisobot jadvali yo'q bo'lsa ehtiyot tomonga og'ishi (hammasi kutayotgan);
 *  - build zanjirida migratsiyadan OLDIN turishi.
 *
 * Ishga tushirish: npm run test:deploy-zaxira
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, Server } from "node:http";
import { gunzipSync } from "node:zlib";
import { readdirSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const ESKI_OXIRGI = "20260804073000_bepul_tenant";

const ESKI_DB = "prisma/test-deploy-eski.db";
const YANGI_DB = "prisma/test-deploy-yangi.db";
const HISOBOTSIZ_DB = "prisma/test-deploy-hisobotsiz.db";
const BOSH_DB = "prisma/test-deploy-bosh.db";

const url = (db: string) => `file:./${db}`;

/** Soxta Telegram: kelgan hujjatlarni yig'adi, kerak bo'lsa xato qaytaradi. */
class SoxtaTelegram {
  server!: Server;
  port = 0;
  qabullar: { nom: string; bayt: Buffer; izoh: string }[] = [];
  javobKodi = 200;

  async boshla() {
    this.server = createServer((req, res) => {
      const bolaklar: Buffer[] = [];
      req.on("data", (b) => bolaklar.push(b));
      req.on("end", () => {
        if (this.javobKodi === 200) {
          const chegara = /boundary=(.+)$/.exec(req.headers["content-type"] ?? "")?.[1] ?? "";
          const qismlar = ajrat(Buffer.concat(bolaklar), chegara);
          this.qabullar.push({
            nom: qismlar.nom,
            bayt: qismlar.hujjat,
            izoh: qismlar.izoh,
          });
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(this.javobKodi, { "content-type": "application/json" });
          res.end(JSON.stringify({ ok: false, description: "sinov xatosi" }));
        }
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
  let hujjat: Buffer = Buffer.alloc(0);

  for (const bolak of bolaklar) {
    const bosh = bolak.indexOf("\r\n\r\n");
    if (bosh < 0) continue;
    const sarlavha = bolak.subarray(0, bosh).toString("utf8");
    const tanasi = bolak.subarray(bosh + 4);
    if (sarlavha.includes('name="document"')) {
      nom = /filename="([^"]+)"/.exec(sarlavha)?.[1] ?? "";
      hujjat = tanasi;
    } else if (sarlavha.includes('name="caption"')) {
      izoh = tanasi.toString("utf8");
    }
  }

  return { nom, izoh, hujjat };
}

function migratsiyalar() {
  return readdirSync("prisma/migrations")
    .filter((d) => existsSync(join("prisma/migrations", d, "migration.sql")))
    .sort();
}

/** Berilgan migratsiyagacha (yoki hammasini) qo'llab baza quradi. */
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

/** Eski holatdagi bazaga tekshirib bo'ladigan ma'lumot soladi. */
async function malumotSol(c: { execute: (a: unknown) => Promise<unknown> }) {
  const iso = (s: string) => new Date(s).toISOString();
  const q = (sql: string, args: unknown[]) => c.execute({ sql, args });

  await q(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","createdAt","updatedAt")
     VALUES ('T1','Alfa','alfa','ACTIVE','PRO',?,?)`,
    [iso("2026-07-01"), iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Business" ("id","nomi","isActive","omborli","turi","createdAt","tenantId")
     VALUES ('B1','Alfa do''kon',1,1,'umumiy',?,'T1')`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "User" ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId")
     VALUES ('U1','Egasi','+998901000001','h','OWNER',1,?,0,'T1')`,
    [iso("2026-07-01")]
  );
  await q(
    `INSERT INTO "Category" ("id","nomi","turi","tartib","isActive","createdAt","businessId")
     VALUES ('C1','Sotuv','kirim',0,1,?,'B1')`,
    [iso("2026-07-01")]
  );
  for (let i = 1; i <= 12; i++) {
    await q(
      `INSERT INTO "Transaction" ("id","turi","categoryId","businessId","summa","sana","userId","createdAt")
       VALUES (?,'kirim','C1','B1',?,?,'U1',?)`,
      [`TX${i}`, 100_000 * i, iso("2026-07-10"), iso("2026-07-10")]
    );
  }
}

/**
 * Skriptni berilgan env bilan ishga tushiradi.
 *
 * ATAYLAB ASINXRON: soxta Telegram serveri SHU jarayonda turadi, `spawnSync`
 * esa jarayonni bloklab qo'yadi — server ulanishni qabul qila olmaydi va
 * bola cheksiz kutib qoladi. Kutish faqat asinxron bo'lishi mumkin.
 */
function ishga(
  env: Record<string, string | undefined>
): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const bola = spawn(process.execPath, ["scripts/deploy-zaxira.mjs"], {
    env: {
      ...process.env,
      // Testda haqiqiy Telegramga chiqib ketmasligi uchun standart holat —
      // sozlanmagan kanal. Kerak bo'lgan testlar buni o'zi to'ldiradi.
      BACKUP_CHAT_ID: "",
      BACKUP_BOT_TOKEN: "",
      TELEGRAM_BOT_TOKEN: "",
      TELEGRAM_API_BASE: "",
      ZAXIRASIZ_DAVOM: "",
      ...env,
    },
  });

  let stdout = "";
  let stderr = "";
  bola.stdout.on("data", (d) => (stdout += String(d)));
  bola.stderr.on("data", (d) => (stderr += String(d)));

  return new Promise((resolve) => {
    bola.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

const telegram = new SoxtaTelegram();

before(async () => {
  const eski = await bazaQur(ESKI_DB, ESKI_OXIRGI);
  await malumotSol(eski as never);
  // Hisobotni haqiqatga moslash: shu paytgacha bo'lganlari qo'llangan.
  const belgila = spawnSync(
    process.execPath,
    ["scripts/migratsiya-belgila.mjs", ESKI_OXIRGI, "--tasdiq"],
    { env: { ...process.env, DATABASE_URL: url(ESKI_DB) }, encoding: "utf8" }
  );
  assert.equal(belgila.status, 0, belgila.stderr);

  // To'liq migratsiya qilingan baza — kutayotgani yo'q.
  rmSync(YANGI_DB, { force: true });
  const migrate = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env, DATABASE_URL: url(YANGI_DB) },
    encoding: "utf8",
  });
  assert.equal(migrate.status, 0, migrate.stderr);

  // Hisobot jadvali umuman yo'q baza.
  await bazaQur(HISOBOTSIZ_DB, ESKI_OXIRGI);

  // Bo'sh baza: fayl bor, jadval yo'q.
  rmSync(BOSH_DB, { force: true });
  const { createClient } = await import("@libsql/client");
  await createClient({ url: url(BOSH_DB) }).execute("SELECT 1");

  // Server oxirida ko'tariladi: yuqoridagi `spawnSync` chaqiruvlari jarayonni
  // bloklaydi, ochiq server esa shu vaqt ichida bekorga kutib turadi.
  await telegram.boshla();
});

after(() => {
  telegram.toxtat();
  for (const db of [ESKI_DB, YANGI_DB, HISOBOTSIZ_DB, BOSH_DB]) {
    rmSync(db, { force: true });
    rmSync(`${db}-journal`, { force: true });
  }
});

// ---------- Aralashmaydigan holatlar ----------

test("DATABASE_URL yo'q bo'lsa jimgina o'tkazib yuboriladi", async () => {
  const res = await ishga({ DATABASE_URL: "" });
  assert.equal(res.status, 0);
  assert.match(res.stdout, /o'tkazib yuborildi/);
});

test("kutayotgan migratsiya bo'lmasa zaxira olinmaydi", async () => {
  const oldin = telegram.qabullar.length;
  const res = await ishga({ DATABASE_URL: url(YANGI_DB), TELEGRAM_API_BASE: telegram.manzil() });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Kutayotgan migratsiya yo'q/);
  assert.equal(telegram.qabullar.length, oldin, "keraksiz zaxira yuborilmasligi kerak");
});

// ---------- To'xtatadigan holatlar ----------

test("kutayotgan migratsiya bor, lekin kanal sozlanmagan — build yiqiladi", async () => {
  const res = await ishga({ DATABASE_URL: url(ESKI_DB) });
  assert.notEqual(res.status, 0, "zaxirasiz davom etmasligi kerak");
  assert.match(res.stderr, /Zaxirani saqlaydigan joy yo'q/);
  assert.match(res.stderr, /Baza O'ZGARTIRILMADI/);

  // Eng muhimi: to'xtash bazaga tegmasdan sodir bo'lgan.
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: url(ESKI_DB) });
  const n = await c.execute(`SELECT COUNT(*) n FROM "Transaction"`);
  assert.equal(Number(n.rows[0].n), 12);
  const acc = await c.execute(
    "SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name='Account'"
  );
  assert.equal(Number(acc.rows[0].n), 0, "migratsiya qo'llanmagan bo'lishi kerak");
});

test("Telegram xato qaytarsa ham build yiqiladi", async () => {
  telegram.javobKodi = 500;
  const res = await ishga({
    DATABASE_URL: url(ESKI_DB),
    BACKUP_CHAT_ID: "-100123",
    BACKUP_BOT_TOKEN: "sinov-token",
    TELEGRAM_API_BASE: telegram.manzil(),
  });
  telegram.javobKodi = 200;

  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /Zaxira yuborilmadi/);
  assert.match(res.stderr, /500/);
  assert.doesNotMatch(res.stderr + res.stdout, /sinov-token/, "token log'ga tushmasligi kerak");
});

test("ZAXIRASIZ_DAVOM=ha bilan ataylab chetlab o'tish mumkin", async () => {
  const res = await ishga({ DATABASE_URL: url(ESKI_DB), ZAXIRASIZ_DAVOM: "ha" });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stderr + res.stdout, /zaxirasiz davom etilmoqda/i);
});

// ---------- Muvaffaqiyatli yo'l ----------

test("zaxira yuboriladi va u haqiqiy, tiklanadigan surat", async () => {
  const oldin = telegram.qabullar.length;
  const res = await ishga({
    DATABASE_URL: url(ESKI_DB),
    BACKUP_CHAT_ID: "-100123",
    BACKUP_BOT_TOKEN: "sinov-token",
    TELEGRAM_API_BASE: telegram.manzil(),
  });
  assert.equal(res.status, 0, `${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /Zaxira Telegram kanaliga yuborildi/);
  assert.equal(telegram.qabullar.length, oldin + 1);

  const kelgan = telegram.qabullar[telegram.qabullar.length - 1];
  assert.match(kelgan.nom, /^balansa-migratsiya-oldidan-\d{4}-\d{2}-\d{2}\.json\.gz$/);
  assert.match(kelgan.izoh, /migratsiya oldidan zaxira/);
  assert.match(kelgan.izoh, /Jami yozuv: 16/);

  const surat = JSON.parse(gunzipSync(kelgan.bayt).toString("utf8"));
  assert.equal(surat.versiya, 1);
  assert.equal(surat.jadvallar.Transaction.qatorlar.length, 12);
  assert.equal(surat.jadvallar.Tenant.qatorlar.length, 1);

  // Suratda migratsiyadan OLDINGI sxema turishi kerak — keyingisi emas.
  assert.ok(!("Account" in surat.jadvallar), "surat migratsiyadan oldin olinishi kerak");

  const summa = surat.jadvallar.Transaction.ustunlar.indexOf("summa");
  const jami = surat.jadvallar.Transaction.qatorlar.reduce(
    (s: number, q: number[]) => s + Number(q[summa]),
    0
  );
  assert.equal(jami, 7_800_000, "summalar buzilmasdan suratga tushishi kerak");
});

// ---------- Ehtiyotkorlik va zanjir ----------

test("hisobot bazaga mos kelmasa migratsiyadan OLDIN to'xtaydi", async () => {
  // Jadvallar bor, `_applied_migrations` bo'sh. `db-migrate.mjs` bunday
  // bazada hammasini boshidan qo'llashga urinib O'RTADA yiqilardi.
  const res = await ishga({ DATABASE_URL: url(HISOBOTSIZ_DB) });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /hisoboti baza holatiga mos kelmaydi/);
  assert.match(res.stderr, /migratsiya:belgila/, "yechim ko'rsatilishi kerak");
});

test("hisobot nomuvofiqligini ZAXIRASIZ_DAVOM chetlab o'ta olmaydi", async () => {
  // Bu to'xtash zaxira haqida emas — migratsiyaning o'zi buzuq holatda
  // ishga tushishi haqida. Shuning uchun chetlab o'tish qo'llanmaydi.
  const res = await ishga({ DATABASE_URL: url(HISOBOTSIZ_DB), ZAXIRASIZ_DAVOM: "ha" });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /hisoboti baza holatiga mos kelmaydi/);
});

test("butunlay bo'sh bazada zaxira talab qilinmaydi", async () => {
  // Yangi muhitni birinchi marta ko'tarish: himoya qiladigan ma'lumot yo'q.
  // Aks holda yangi muhit Telegram sozlanmaguncha umuman ko'tarilmasdi.
  const oldin = telegram.qabullar.length;
  const res = await ishga({ DATABASE_URL: url(BOSH_DB) });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /Baza bo'sh/);
  assert.equal(telegram.qabullar.length, oldin);
});

test("build zanjirida zaxira migratsiyadan OLDIN turadi", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const build: string = pkg.scripts.build;

  const zaxira = build.indexOf("deploy-zaxira.mjs");
  const migratsiya = build.indexOf("db-migrate.mjs");

  assert.ok(zaxira >= 0, "build zanjirida deploy-zaxira bo'lishi shart");
  assert.ok(migratsiya >= 0);
  assert.ok(zaxira < migratsiya, "zaxira migratsiyadan oldin bajarilishi shart");
  assert.match(
    build.slice(zaxira, migratsiya),
    /&&/,
    "zaxira yiqilsa migratsiya ishga tushmasligi uchun && bilan bog'lanadi"
  );
});
