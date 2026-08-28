/**
 * KASSALAR SAHIFASI — BRAUZERDA VIZUAL VA MOBIL TEKSHIRUV.
 *
 * Mantiqiy testlar (tests/kassa-nazorat.test.ts) raqamlarni tekshiradi, bu
 * yerda esa SAHIFANING O'ZI tekshiriladi: chizildimi, 375px da gorizontal
 * siljish bormi, yopishqoq amal tugmasi pastki navigatsiya bilan
 * urishmaydimi, pastdan chiqadigan varaqlar ochiladimi va kassa farqi
 * kiritilgan zahoti ko'rinadimi.
 *
 * Ishga tushirish:
 *   npm run build          (bir marta, .next kerak)
 *   npm run test:kassa-brauzer
 *
 * `.next` yo'q bo'lsa testlar O'TKAZIB YUBORILADI — build qilinmagan
 * mashinada to'plam qizil bo'lib qolmasligi uchun (smoke testi bilan bir xil
 * uslub). Skrinshotlar `.screenshots/kassa-nazorat/` ga yoziladi.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { connect } from "node:net";
import type { Browser, Page } from "playwright";

const PORT = 3101;
const ASOS = `http://127.0.0.1:${PORT}`;
const BAZA = "prisma/e2e.db";
const LOGIN = "admin";
const PAROL = "admin123";
const SKRIN = ".screenshots/kassa-nazorat";

const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

const qurilgan = existsSync(".next/BUILD_ID");
const sabab = qurilgan ? undefined : "`.next` yo'q — avval `npm run build` qiling";

/** Tekshiriladigan ekranlar (talab 21: responsive). */
const EKRANLAR = [
  { nom: "375", width: 375, height: 812, mobil: true },
  { nom: "390", width: 390, height: 844, mobil: true },
  { nom: "768", width: 768, height: 1024, mobil: false },
  { nom: "1280", width: 1280, height: 900, mobil: false },
  { nom: "1440", width: 1440, height: 900, mobil: false },
];

let server: ChildProcess | undefined;
let browser: Browser | undefined;

function portBandmi(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const soket = connect({ port, host: "127.0.0.1" });
    const tugat = (natija: boolean) => {
      soket.destroy();
      resolve(natija);
    };
    soket.once("connect", () => tugat(true));
    soket.once("error", () => tugat(false));
    soket.setTimeout(1000, () => tugat(false));
  });
}

async function kut(url: string, soniya: number) {
  const chegara = Date.now() + soniya * 1000;
  while (Date.now() < chegara) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* server hali ko'tarilmadi */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server ${soniya} soniyada ko'tarilmadi: ${url}`);
}

/**
 * HAQIQIY MA'LUMOT EKADI (soxta emas — sahifa bazadan o'qiydi).
 *
 * Uchta kassa, bugungi kirim/chiqim yozuvlari, yakunlangan o'tkazma va
 * KAMOMADLI kutilayotgan topshirish. Aynan shu holatda sahifaning barcha
 * bloklari to'la bo'ladi va bo'sh holat maketi bilan adashtirilmaydi.
 */
async function malumotEk() {
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: `file:./${BAZA}` });
  const q = (sql: string, args: unknown[] = []) => c.execute({ sql, args });
  const bir = async (sql: string) => (await c.execute(sql)).rows[0] as Record<string, unknown>;

  const biz = await bir('SELECT id FROM "Business" LIMIT 1');
  const bizId = String(biz.id);
  const egasi = await bir(`SELECT id, ism FROM "User" WHERE "businessId" = '${bizId}' LIMIT 1`);
  const kirimCat = await bir(
    `SELECT id FROM "Category" WHERE "businessId" = '${bizId}' AND turi = 'kirim' LIMIT 1`
  );
  const chiqimCat = await bir(
    `SELECT id FROM "Category" WHERE "businessId" = '${bizId}' AND turi = 'chiqim' LIMIT 1`
  );

  // Kassir xodim — shaxsiy kassa egasi.
  await q(
    `INSERT INTO "User" (id, ism, login, "parolHash", rol, "tenantId", "businessId", "isActive", "createdAt")
     SELECT 'u-fayruza', 'Fayruza', '+998900000777', 'x', 'CASHIER', "tenantId", id, 1, CURRENT_TIMESTAMP
     FROM "Business" WHERE id = ?`,
    [bizId]
  );

  const kassalar: [string, string, string, string | null][] = [
    ["acc-fayruza", "Fayruza kassasi", "naqd", "u-fayruza"],
    ["acc-direktor", "Direktor kassasi", "naqd", String(egasi.id)],
    ["acc-bank", "Bank hisobi", "bank", null],
  ];
  for (const [id, nomi, turi, userId] of kassalar) {
    await q(
      `INSERT INTO "Account" (id, "businessId", nomi, turi, "userId", "isActive", tartib, "createdAt")
       VALUES (?, ?, ?, ?, ?, 1, 10, CURRENT_TIMESTAMP)`,
      [id, bizId, nomi, turi, userId]
    );
  }

  const yozuv = (
    id: string,
    turi: string,
    catId: string,
    accountId: string,
    summa: number,
    izoh: string,
    userId: string
  ) =>
    q(
      `INSERT INTO "Transaction" (id, turi, "categoryId", "businessId", "accountId", "tolovTuri", summa, sana, izoh, "userId", "createdAt")
       VALUES (?, ?, ?, ?, ?, 'naqd', ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)`,
      [id, turi, catId, bizId, accountId, summa, izoh, userId]
    );

  await yozuv("tx-1", "kirim", String(kirimCat.id), "acc-fayruza", 5_500_000, "Kunlik savdo", "u-fayruza");
  await yozuv("tx-2", "chiqim", String(chiqimCat.id), "acc-fayruza", 3_050_000, "Tovar olindi", "u-fayruza");
  await yozuv("tx-3", "kirim", String(kirimCat.id), "acc-direktor", 12_400_000, "Savdo tushumi", String(egasi.id));
  await yozuv("tx-4", "chiqim", String(chiqimCat.id), "acc-direktor", 9_629_000, "Ta'minotchiga to'lov", String(egasi.id));
  await yozuv("tx-5", "kirim", String(kirimCat.id), "acc-bank", 10_000_000, "Pul o'tkazma tushumi", String(egasi.id));

  // Yakunlangan o'tkazma — "Kassa harakatlari" lentasi to'lishi uchun.
  await q(
    `INSERT INTO "AccountTransfer" (id, "businessId", "fromAccountId", "toAccountId", summa, valyuta, sana, izoh, "userId",
       "fromUserId", "fromUserIsm", "toUserId", "toUserIsm", turi, holat, "tasdiqlaganId", "tasdiqlaganIsm", "tasdiqlanganAt", "createdAt")
     VALUES ('tr-1', ?, 'acc-direktor', 'acc-bank', 2000000, 'UZS', CURRENT_TIMESTAMP, 'Bankka topshirildi', ?,
       ?, ?, NULL, NULL, 'transfer', 'bajarildi', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [bizId, String(egasi.id), String(egasi.id), String(egasi.ism), String(egasi.id), String(egasi.ism)]
  );

  // KAMOMADLI kutilayotgan topshirish: tizim 2 450 000, topshirilgan 2 400 000.
  await q(
    `INSERT INTO "AccountTransfer" (id, "businessId", "fromAccountId", "toAccountId", summa, valyuta, sana, izoh, "userId",
       "fromUserId", "fromUserIsm", "toUserId", "toUserIsm", turi, holat, hisoblangan, farq, "createdAt")
     VALUES ('tr-2', ?, 'acc-fayruza', 'acc-direktor', 2400000, 'UZS', CURRENT_TIMESTAMP, 'Mijozga qaytim ortiqcha berildi', 'u-fayruza',
       'u-fayruza', 'Fayruza', ?, ?, 'smena', 'kutilmoqda', 2450000, -50000, CURRENT_TIMESTAMP)`,
    [bizId, String(egasi.id), String(egasi.ism)]
  );

  await q(`UPDATE "Business" SET "shaxsiyKassa" = 1 WHERE id = ?`, [bizId]);
}

before(async () => {
  if (!qurilgan) return;
  mkdirSync(SKRIN, { recursive: true });

  const tayyorla = spawnSync(process.execPath, ["scripts/e2e-tayyorla.mjs"], { encoding: "utf8" });
  assert.equal(tayyorla.status, 0, `baza tayyorlanmadi:\n${tayyorla.stdout}\n${tayyorla.stderr}`);
  await malumotEk();

  assert.equal(await portBandmi(PORT), false, `${PORT}-port band`);
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATABASE_URL: `file:./${BAZA}`,
      DATABASE_AUTH_TOKEN: "",
      SESSION_SECRET: "e2e_sinov_maxfiy_kaliti_kamida_32_belgi_uzunlikda",
      TELEGRAM_BOT_TOKEN: "0:e2e_sinov",
      NEXT_PUBLIC_APP_URL: ASOS,
    },
    stdio: "ignore",
  });
  process.once("exit", ochir);

  await kut(`${ASOS}/login`, 90);
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ executablePath: BRAUZER_YOLI, args: ["--no-sandbox"] });
});

function ochir() {
  if (!server?.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

after(async () => {
  if (browser) await browser.close();
  ochir();
});

/** Kirgan holdagi sahifa — berilgan ekran o'lchamida. */
async function kirganSahifa(width: number, height: number): Promise<Page> {
  const kontekst = await browser!.newContext({
    baseURL: ASOS,
    locale: "uz-UZ",
    viewport: { width, height },
    deviceScaleFactor: 2,
    hasTouch: width < 500,
  });
  const page = await kontekst.newPage();
  await page.goto(`${ASOS}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL("**/app**", { timeout: 60_000 });
  return page;
}

/** Sahifa gorizontal siljiydimi (mobil'da eng ko'p uchraydigan nuqson). */
async function gorizontalSiljish(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
}

for (const ekran of EKRANLAR) {
  test(`Kassalar sahifasi ${ekran.nom}px da to'g'ri chiziladi`, { skip: sabab }, async () => {
    const page = await kirganSahifa(ekran.width, ekran.height);
    await page.goto(`${ASOS}/app/kassa`, { waitUntil: "networkidle" });
    await page.waitForSelector("h1", { timeout: 30_000 });

    // CSS `uppercase` sarlavhalarni katta harfga o'giradi va `innerText`
    // aynan ko'ringan matnni qaytaradi — solishtirish kichik harfda.
    const matn = (await page.locator("body").innerText()).toLowerCase();
    assert.ok(matn.includes("jami qoldiq"), "sarlavha 'Jami qoldiq' bo'lishi kerak");
    assert.ok(!matn.includes("jami kassalar"), "eski 'Jami kassalar' nomi qolmasligi kerak");
    assert.ok(matn.includes("fayruza kassasi"), "kassa kartalari ko'rinishi kerak");
    assert.ok(matn.includes("kutilayotgan topshirishlar"), "topshirish paneli ko'rinishi kerak");
    assert.ok(matn.includes("farq: − 50 000"), "kassa farqi ko'rinishi kerak");
    assert.ok(matn.includes("kassa harakatlari"), "harakatlar lentasi bo'lishi kerak");
    assert.ok(!matn.includes("application error"), "sahifa xato holatiga tushmasligi kerak");

    const siljish = await gorizontalSiljish(page);
    assert.ok(siljish <= 1, `${ekran.nom}px da gorizontal siljish bor: ${siljish}px`);

    await page.screenshot({ path: `${SKRIN}/kassa-${ekran.nom}.png`, fullPage: true });
    await page.context().close();
  });
}

test("375px: yopishqoq amal tugmasi navigatsiya bilan urishmaydi", { skip: sabab }, async () => {
  const page = await kirganSahifa(375, 812);
  await page.goto(`${ASOS}/app/kassa`, { waitUntil: "networkidle" });

  const tugma = page.getByRole("button", { name: "Amal", exact: true });
  await tugma.waitFor({ timeout: 20_000 });
  const t = (await tugma.boundingBox())!;
  const nav = (await page.locator("nav.fixed").first().boundingBox())!;
  assert.ok(t.y + t.height <= nav.y, `amal tugmasi tab-bar ustiga tushib qolgan (${t.y + t.height} > ${nav.y})`);
  // Barmoq zonasi: iOS tavsiyasi 44px.
  assert.ok(t.height >= 44, `amal tugmasi juda past: ${t.height}px`);

  await tugma.click();
  await page.getByRole("dialog").waitFor({ timeout: 10_000 });
  // Varaq pastdan chiqadi (0.22s animatsiya) — skrinshot yarim yo'lda
  // olinmasin, aks holda ortidagi sahifa ko'rinib turadi.
  await page.waitForTimeout(500);
  const varaq = await page.locator("body").innerText();
  assert.ok(varaq.includes("Pul o'tkazish"), "varaqda o'tkazish amali bo'lishi kerak");
  assert.ok(varaq.includes("Kassani topshirish"), "varaqda topshirish amali bo'lishi kerak");
  await page.screenshot({ path: `${SKRIN}/kassa-375-amal-varaq.png` });
  await page.context().close();
});

test("375px: topshirish varag'ida kassa farqi jonli hisoblanadi", { skip: sabab }, async () => {
  const page = await kirganSahifa(375, 812);
  await page.goto(`${ASOS}/app/kassa`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Amal", exact: true }).click();
  await page.getByRole("button", { name: /Kassani topshirish/ }).click();
  await page.getByRole("dialog", { name: "Kassani topshirish" }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);

  const summa = page.locator("#tp-summa");
  const tizimMatn = await page.locator("body").innerText();
  assert.ok(tizimMatn.includes("Tizim bo'yicha"), "tizim qoldig'i ko'rsatilishi kerak");

  await summa.fill("2400000");
  await page.waitForTimeout(200);
  const farqMatn = await page.locator("body").innerText();
  assert.ok(/Farq: −/.test(farqMatn), `kamomad ko'rinishi kerak edi: ${farqMatn.slice(0, 400)}`);
  assert.ok(farqMatn.includes("Kamomad sababi"), "farq bo'lsa sabab so'ralishi kerak");

  await page.screenshot({ path: `${SKRIN}/kassa-375-topshirish.png` });

  const siljish = await gorizontalSiljish(page);
  assert.ok(siljish <= 1, `varaq ochiq holda gorizontal siljish: ${siljish}px`);
  await page.context().close();
});

test("375px: kassa detali va davr filtri ishlaydi", { skip: sabab }, async () => {
  const page = await kirganSahifa(375, 812);
  await page.goto(`${ASOS}/app/kassa/acc-fayruza`, { waitUntil: "networkidle" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  const matn = (await page.locator("body").innerText()).toLowerCase();
  assert.ok(matn.includes("fayruza kassasi"));
  assert.ok(matn.includes("joriy qoldiq"));
  assert.ok(matn.includes("kirim manbai"), "to'lov turi kesimi ko'rinishi kerak");
  assert.ok(matn.includes("topshirishlar") && matn.includes("o'tkazmalar"));

  await page.getByRole("link", { name: "Oy", exact: true }).click();
  await page.waitForURL("**/app/kassa/acc-fayruza?davr=oy", { timeout: 20_000 });
  assert.ok((await page.locator("body").innerText()).toLowerCase().includes("oy kirim"));

  const siljish = await gorizontalSiljish(page);
  assert.ok(siljish <= 1, `detal sahifasida gorizontal siljish: ${siljish}px`);
  await page.screenshot({ path: `${SKRIN}/kassa-375-detal.png`, fullPage: true });
  await page.context().close();
});
