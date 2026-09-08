/**
 * SOTUV SAVATI VA DIREKTOR HUQUQI — BRAUZER TESTLARI (MOBIL EKRAN).
 *
 * `tests/vazifalar-2026-09.test.ts` xizmat qatlamini sinaydi: savat atomik
 * yoziladimi, qatorlar birlashadimi. Lekin talab AYNAN interfeys haqida:
 * "mijoz tanlangandan keyin oynani qayta-qayta ochmasdan bir nechta
 * mahsulotni belgilash, miqdorini kiritish, ko'rib chiqish va bitta amal
 * bilan sotuvga qo'shish". Server funksiyasining mavjudligi buni
 * ISBOTLAMAYDI — shuning uchun oqim haqiqiy brauzerda, 390×844 (telefon)
 * ekranida bajariladi.
 *
 * Bu yerda savatdan tashqari yana ikki talab INTERFEYS darajasida
 * tekshiriladi: ta'minotchi tanlanganda sabab ro'yxati bitta variantga
 * qisqarishi va qarz tahriri/auditi administratorga ham yopiqligi.
 *
 * Ishga tushirish:
 *   npm run build          (bir marta, .next kerak)
 *   npm run test:sotuv-savat
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import type { Browser, BrowserContext, Page } from "playwright";

// Boshqa brauzer to'plamlari bilan bir vaqtda ishlamasligi uchun alohida port.
const PORT = 3102;
const ASOS = `http://127.0.0.1:${PORT}`;

const DIREKTOR = { login: "admin", parol: "admin123" };
/** Administrator — direktor EMAS: qarz tahriri va auditi unga yopiq. */
const ADMINISTRATOR = { login: "e2e-admin", parol: "admin123" };
/** Omborli biznes (e2e-tayyorla.mjs da sozlanadi). */
const OMBORLI_BIZNES = "biz_salyut";

/** Telefon ekrani — talab aynan mobil interfeys haqida. */
const MOBIL = { width: 390, height: 844 };

const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

const qurilgan = existsSync(".next/BUILD_ID");
const sabab = qurilgan ? undefined : "`.next` yo'q — avval `npm run build` qiling";

let server: ChildProcess | undefined;
let browser: Browser | undefined;
let ctx: BrowserContext | undefined;
let ctxAdmin: BrowserContext | undefined;

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

async function portBoshaguncha(port: number, soniya: number) {
  const chegara = Date.now() + soniya * 1000;
  while (Date.now() < chegara) {
    if (!(await portBandmi(port))) return;
    await new Promise((r) => setTimeout(r, 250));
  }
}

async function kut(url: string, soniya: number) {
  const chegara = Date.now() + soniya * 1000;
  while (Date.now() < chegara) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // server hali ko'tarilmadi
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server ${soniya} soniyada ko'tarilmadi: ${url}`);
}

function ochir() {
  if (!server?.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    server.kill("SIGTERM");
  }
}

before(async () => {
  if (!qurilgan) return;

  const tayyorla = spawnSync(process.execPath, ["scripts/e2e-tayyorla.mjs"], { encoding: "utf8" });
  assert.equal(tayyorla.status, 0, `baza tayyorlanmadi:\n${tayyorla.stdout}\n${tayyorla.stderr}`);
  assert.equal(await portBandmi(PORT), false, `${PORT}-port band`);

  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    detached: true,
    env: {
      ...process.env,
      DATABASE_URL: "file:./prisma/e2e.db",
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

  // ADMINISTRATOR va TA'MINOTCHI — huquq va sabab ro'yxati testlari uchun.
  // E2E bazasiga shu yerda qo'shiladi: umumiy tayyorlash skriptiga tegmaymiz.
  await e2eQoshimcha();

  ctx = await sessiya(DIREKTOR);
  ctxAdmin = await sessiya(ADMINISTRATOR);
});

/** Kirgan mobil sessiya (aktiv biznes cookie bilan). */
async function sessiya(kim: { login: string; parol: string }): Promise<BrowserContext> {
  const kontekst = await browser!.newContext({ baseURL: ASOS, locale: "uz-UZ", viewport: MOBIL });
  const page = await kontekst.newPage();
  await page.goto(`${ASOS}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(kim.login);
  await page.getByLabel("Parol").fill(kim.parol);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL("**/app**", { timeout: 60_000 });
  await kontekst.addCookies([
    { name: "active_business", value: OMBORLI_BIZNES, domain: "127.0.0.1", path: "/" },
  ]);
  await page.close();
  return kontekst;
}

/** E2E bazasiga administrator va ta'minotchi qo'shadi. */
async function e2eQoshimcha() {
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: "file:./prisma/e2e.db" });
  const tenantId = String((await c.execute(`SELECT "id" FROM "Tenant" LIMIT 1`)).rows[0].id);
  // Parol hashi direktornikidan olinadi (admin123) — yangi hash hisoblamaymiz.
  const hash = String(
    (await c.execute(`SELECT "parolHash" h FROM "User" WHERE "login" = 'admin'`)).rows[0].h
  );
  await c.execute({
    sql: `INSERT OR IGNORE INTO "User"
            ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId")
          VALUES ('u_e2e_admin','E2E administrator','e2e-admin',?,'ADMIN',1,?,0,?)`,
    args: [hash, new Date().toISOString(), tenantId],
  });
  await c.execute({
    sql: `INSERT OR IGNORE INTO "Supplier" ("id","businessId","nomi","isActive","createdAt")
          VALUES ('sup_e2e','${OMBORLI_BIZNES}','Toshkent Optom',1,?)`,
    args: [new Date().toISOString()],
  });
  // Qarz — API huquqi testi uchun. E2E bazasida qarz yo'q edi va test
  // "qarz topilmasa o'tkazib yuborish" yo'liga tushib, aslida HECH NARSANI
  // tekshirmasdi. Endi u har doim mavjud.
  const direktorId = String(
    (await c.execute(`SELECT "id" FROM "User" WHERE "login" = 'admin'`)).rows[0].id
  );
  await c.execute({
    sql: `INSERT OR IGNORE INTO "Debt"
            ("id","businessId","turi","mijozNomi","jamiSumma","tolangan","isYopilgan","status","sana","userId","createdAt")
          VALUES ('debt_e2e','${OMBORLI_BIZNES}','olinadigan','E2E qarzdor',1000000,0,0,'OPEN',?,?,?)`,
    args: [new Date().toISOString(), direktorId, new Date().toISOString()],
  });
  c.close?.();
}

after(async () => {
  if (browser) await browser.close();
  if (!server?.pid) return;
  ochir();
  await portBoshaguncha(PORT, 10);
});

async function baza(sql: string): Promise<Record<string, unknown>[]> {
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: "file:./prisma/e2e.db" });
  const r = await c.execute(sql);
  return r.rows as unknown as Record<string, unknown>[];
}

/** Tanlash oynasidagi mahsulot qatori (nomi bo'yicha). */
function tanlovQatori(page: Page, nomi: string) {
  return page.locator(`[data-test="mahsulot-qator"][data-nomi="${nomi}"]`);
}

/**
 * Qatordagi miqdor maydoni.
 *
 * `exact: true` SHART: yorliqlar bir-birining ichida turadi
 * ("Fanta 1L miqdori", "Fanta 1L miqdorini oshirish", "...kamaytirish") va
 * Playwright'ning `getByLabel` i standart holatda QISM matn bo'yicha
 * qidiradi — aniq moslik bo'lmasa uchala element ham topiladi.
 */
function miqdorMaydoni(page: Page, nomi: string) {
  return tanlovQatori(page, nomi).getByLabel(`${nomi} miqdori`, { exact: true });
}

async function sotuvniOch(): Promise<Page> {
  const page = await ctx!.newPage();
  await page.goto(`${ASOS}/app/sotuv`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-test="mahsulot-qoshish"]', { timeout: 30_000 });
  return page;
}

// =========================================================================

test(
  "mobil: bitta oynada uchta mahsulot tanlanadi va bir amalda savatga tushadi",
  { skip: sabab },
  async () => {
    const page = await sotuvniOch();

    // Oyna BIR MARTA ochiladi.
    await page.locator('[data-test="mahsulot-qoshish"]').click();
    await page.waitForSelector('[data-test="mahsulot-royxati"]', { timeout: 15_000 });

    // 1) Uchta mahsulot belgilanadi, har biriga MIQDOR kiritiladi —
    //    oyna oradan yopilmaydi.
    await tanlovQatori(page, "Coca-Cola 1.5L").getByRole("button", { name: /oshirish/ }).click();
    await tanlovQatori(page, "Coca-Cola 1.5L").getByRole("button", { name: /oshirish/ }).click();
    await miqdorMaydoni(page, "Fanta 1L").fill("5");
    await tanlovQatori(page, "Uyda pishirilgan non").getByRole("button", { name: /oshirish/ }).click();

    // 2) TANLANGANLARNI KO'RIB CHIQISH — qo'shishdan oldin ko'rinadi.
    const xulosa = page.locator('[data-test="tanlanganlar"]');
    assert.ok(await xulosa.isVisible(), "tanlanganlar ro'yxati ko'rinishi kerak");
    const xulosaMatn = await xulosa.innerText();
    assert.match(xulosaMatn, /3 ta mahsulot/);
    assert.match(xulosaMatn, /8 birlik/, "2 + 5 + 1");

    // 3) BITTA amal bilan savatga.
    await page.locator('[data-test="savatga-qoshish"]').click();
    await page.waitForSelector('[data-test="savat-qator"]', { timeout: 15_000 });

    const qatorlar = page.locator('[data-test="savat-qator"]');
    assert.equal(await qatorlar.count(), 3, "uchala mahsulot savatda");
    // Oyna yopilgan — ro'yxat endi ko'rinmaydi.
    assert.equal(await page.locator('[data-test="mahsulot-royxati"]').count(), 0);

    await page.close();
  }
);

test(
  "mobil: takror tanlangan mahsulot yangi qator ochmaydi — miqdori oshadi",
  { skip: sabab },
  async () => {
    const page = await sotuvniOch();

    await page.locator('[data-test="mahsulot-qoshish"]').click();
    await miqdorMaydoni(page, "Coca-Cola 1.5L").fill("2");
    await page.locator('[data-test="savatga-qoshish"]').click();
    await page.waitForSelector('[data-test="savat-qator"]', { timeout: 15_000 });

    // AYNI mahsulot ikkinchi marta qo'shiladi.
    await page.locator('[data-test="mahsulot-qoshish"]').click();
    await page.waitForSelector('[data-test="mahsulot-royxati"]', { timeout: 15_000 });
    // Oyna savatdagi miqdorni ko'rsatadi va chegarani shundan hisoblaydi.
    assert.match(await tanlovQatori(page, "Coca-Cola 1.5L").innerText(), /savatda 2/);
    await miqdorMaydoni(page, "Coca-Cola 1.5L").fill("3");
    await page.locator('[data-test="savatga-qoshish"]').click();
    await page.waitForTimeout(300);

    const qatorlar = page.locator('[data-test="savat-qator"]');
    assert.equal(await qatorlar.count(), 1, "yangi qator ochilmaydi");
    // Savat qatoridagi birinchi maydon — miqdor (ikkinchisi birlik narx).
    const miqdor = await qatorlar.first().locator("input").first().inputValue();
    assert.equal(miqdor, "5", "2 + 3 = 5");

    await page.close();
  }
);

test("mobil: qoldiqdan ortiq tanlab bo'lmaydi", { skip: sabab }, async () => {
  const page = await sotuvniOch();
  await page.locator('[data-test="mahsulot-qoshish"]').click();
  await page.waitForSelector('[data-test="mahsulot-royxati"]', { timeout: 15_000 });

  // Fanta qoldig'i 50 — undan ortig'i kiritilsa 50 ga qisqartiriladi.
  const qator = tanlovQatori(page, "Fanta 1L");
  await miqdorMaydoni(page, "Fanta 1L").fill("999");
  assert.equal(await miqdorMaydoni(page, "Fanta 1L").inputValue(), "50");
  // Chegaraga yetgach "+" o'chadi.
  assert.equal(await qator.getByRole("button", { name: /oshirish/ }).isDisabled(), true);

  await page.close();
});

test("mobil: tugagan mahsulot 'Qolmadi' bilan va tanlanmaydi", { skip: sabab }, async () => {
  // Qoldig'i 0 bo'lgan mahsulot — seed'dagi narxsiz salyutlardan biri.
  const page = await sotuvniOch();
  await page.locator('[data-test="mahsulot-qoshish"]').click();
  await page.waitForSelector('[data-test="mahsulot-royxati"]', { timeout: 15_000 });

  const qatorlar = page.locator('[data-test="mahsulot-qator"]');
  const soni = await qatorlar.count();
  const oxirgi = qatorlar.nth(soni - 1);
  // TARTIB: tugaganlar eng pastda.
  assert.match(await oxirgi.innerText(), /Qolmadi/);
  // Tanlash tugmasi umuman yo'q.
  assert.equal(await oxirgi.getByRole("button", { name: /oshirish/ }).count(), 0);

  await page.close();
});

test(
  "mobil: savat bitta so'rovda sotiladi — uchta Sale yoziladi",
  { skip: sabab },
  async () => {
    const oldin = Number(
      (await baza(`SELECT COUNT(*) n FROM "Sale" WHERE "businessId" = 'biz_salyut'`))[0].n
    );

    const page = await sotuvniOch();
    await page.locator('[data-test="mahsulot-qoshish"]').click();
    await page.waitForSelector('[data-test="mahsulot-royxati"]', { timeout: 15_000 });
    await miqdorMaydoni(page, "Coca-Cola 1.5L").fill("1");
    await miqdorMaydoni(page, "Fanta 1L").fill("2");
    await miqdorMaydoni(page, "Uyda pishirilgan non").fill("3");
    await page.locator('[data-test="savatga-qoshish"]').click();
    await page.waitForSelector('[data-test="savat-qator"]', { timeout: 15_000 });

    await page.getByRole("button", { name: "Sotuvni yakunlash" }).click();
    await page.waitForSelector("text=/Sotildi:/", { timeout: 30_000 });

    const keyin = Number(
      (await baza(`SELECT COUNT(*) n FROM "Sale" WHERE "businessId" = 'biz_salyut'`))[0].n
    );
    assert.equal(keyin - oldin, 3, "har mahsulot uchun bitta sotuv yozuvi");

    // Savat tozalandi — keyingi sotuvga tayyor.
    assert.equal(await page.locator('[data-test="savat-qator"]').count(), 0);

    await page.close();
  }
);

// =========================================================================
// 1-TALAB — TA'MINOTCHIDA SABAB RO'YXATI (interfeys darajasida)
// =========================================================================

test(
  "mobil: ta'minotchi tanlanganda 'Nima uchun?' da FAQAT bitta variant",
  { skip: sabab },
  async () => {
    const page = await ctx!.newPage();
    await page.goto(`${ASOS}/app/moliya`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=PUL BERDIM", { timeout: 30_000 });

    await page.getByRole("button", { name: /PUL BERDIM/ }).click();
    // "− Pul berdim" oynasida tomon sifatida ta'minotchi standart tanlangan.
    await page.getByRole("button", { name: "Ta'minotchi", exact: true }).click();

    // Sabab tanlovi — maxsus combobox (native <select> emas).
    await page.locator("#moliya-sabab").click();
    const variantlar = page.getByRole("option");
    await variantlar.first().waitFor({ timeout: 10_000 });

    assert.equal(await variantlar.count(), 1, "ta'minotchida aynan bitta variant");
    assert.equal(await variantlar.first().innerText(), "Ta'minotchiga pul berish");
    await page.close();
  }
);

test(
  "mobil: mijozda ro'yxat qisqartirilmaydi (talab faqat ta'minotchiga tegishli)",
  { skip: sabab },
  async () => {
    const page = await ctx!.newPage();
    await page.goto(`${ASOS}/app/moliya`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=PUL BERDIM", { timeout: 30_000 });

    await page.getByRole("button", { name: /PUL BERDIM/ }).click();
    await page.getByRole("button", { name: "Mijoz", exact: true }).click();
    await page.locator("#moliya-sabab").click();
    const variantlar = page.getByRole("option");
    await variantlar.first().waitFor({ timeout: 10_000 });

    assert.ok(await variantlar.count() > 1, "mijozda bir nechta sabab qoladi");
    const matn = await variantlar.allInnerTexts();
    assert.ok(matn.includes("Xarajat"), "umumiy sabab mijozda saqlanadi");
    await page.close();
  }
);

// =========================================================================
// 2-TALAB — QARZ TAHRIRI VA AUDITI FAQAT DIREKTORGA
// =========================================================================

test("mobil: direktor qarz auditi sahifasini ochadi", { skip: sabab }, async () => {
  const page = await ctx!.newPage();
  await page.goto(`${ASOS}/app/qarzlar/audit`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  assert.match(page.url(), /\/app\/qarzlar\/audit/);
  assert.equal(await page.locator("h1").first().innerText(), "Qarz audit tarixi");
  await page.close();
});

test(
  "mobil: ADMINISTRATOR audit sahifasini OCHA OLMAYDI (URL qo'lda terilsa ham)",
  { skip: sabab },
  async () => {
    const page = await ctxAdmin!.newPage();
    await page.goto(`${ASOS}/app/qarzlar/audit`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 30_000 });

    assert.doesNotMatch(page.url(), /audit/, "administrator qarzlar sahifasiga qaytariladi");
    await page.close();
  }
);

test(
  "mobil: ADMINISTRATOR uchun API ham 403 qaytaradi",
  { skip: sabab },
  async () => {
    // Tugmani yashirish himoya emas — API to'g'ridan-to'g'ri chaqiriladi.
    const qarz = (
      await baza(`SELECT "id" FROM "Debt" WHERE "businessId" = '${OMBORLI_BIZNES}' LIMIT 1`)
    )[0];
    assert.ok(qarz, "tayyorlashda qarz yaratilgan bo'lishi kerak");

    const page = await ctxAdmin!.newPage();
    await page.goto(`${ASOS}/app/qarzlar`, { waitUntil: "domcontentloaded" });

    for (const usul of ["PATCH", "DELETE"]) {
      const javob = await page.evaluate(
        async ([id, method]) => {
          const r = await fetch(`/api/debts/${id}`, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jamiSumma: 1, sabab: "ruxsatsiz urinish" }),
          });
          return r.status;
        },
        [String(qarz.id), usul]
      );
      assert.equal(javob, 403, `${usul} administrator uchun 403 bo'lishi kerak`);
    }
    await page.close();
  }
);
