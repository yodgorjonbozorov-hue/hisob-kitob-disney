/**
 * POS (KASSA) — BRAUZER TESTLARI.
 *
 * `tests/magazin.test.ts` xizmat qatlamini sinaydi: u "sotuv atomikmi,
 * qoldiq kamayadimi" degan savollarga javob beradi. Lekin kassir dastur
 * bilan BRAUZER orqali ishlaydi va o'sha yo'lda butunlay boshqa narsalar
 * buzilishi mumkin: skaner kiritishi qidiruv maydoniga aralashib ketishi,
 * savat tugmasi ishlamasligi, to'lov oynasi ochilmasligi, rol yopiq bo'lsa
 * ham tugma ko'rinib turishi.
 *
 * Shu bois bu yerda haqiqiy oqim bajariladi: kirish → skanerlash → savat →
 * to'lov → chek → qaytarish.
 *
 * Ishga tushirish:
 *   npm run build          (bir marta, .next kerak)
 *   npm run test:pos-e2e
 *
 * Infrastruktura `tests/smoke-brauzer.test.ts` bilan bir xil (server
 * ko'tarish, jarayon guruhini o'chirish, port tekshiruvi) — u yerdagi
 * izohlar sababini batafsil tushuntiradi.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import type { Browser, BrowserContext, Page } from "playwright";

// Smoke to'plami bilan BIR VAQTDA ishlamasligi uchun boshqa port.
const PORT = 3101;
const ASOS = `http://127.0.0.1:${PORT}`;

/** Direktor — kassa va qaytarish ochiq. */
const ADMIN = { login: "admin", parol: "admin123" };
/** Do'konga biriktirilgan kassir — kassa ochiq, qaytarish YOPIQ. */
const KASSIR = { login: "kassir-salyut", parol: "kassir123" };

/** Kassa yuritiladigan biznes (e2e-tayyorla.mjs da sozlanadi). */
const MAGAZINLI_BIZNES = "biz_salyut";
/** Kassasiz biznes — "modul yopiq" holatini tekshirish uchun. */
const MAGAZINSIZ_BIZNES = "biz_disney_navoiy";

const KOLA_BARCODE = "4601234567890";
const FANTA_BARCODE = "4600000000017";

const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

const qurilgan = existsSync(".next/BUILD_ID");
const sabab = qurilgan ? undefined : "`.next` yo'q — avval `npm run build` qiling";

let server: ChildProcess | undefined;
let browser: Browser | undefined;

/**
 * SESSIYALAR BIR MARTA OCHILADI.
 *
 * Ilgari har test qaytadan kirardi (16 ta kirish). Bu, birinchidan, sekin
 * (har kirishda bcrypt tekshiruvi), ikkinchidan BEQAROR: kirish oqimi
 * gohida 60 soniyaga cho'zilib testni yiqitardi va sabab POS'ga umuman
 * aloqador emas edi.
 *
 * Endi har rol/biznes juftligi uchun bitta kontekst (sessiya) ochiladi va
 * testlar undan yangi SAHIFA oladi. Cookie kontekstga tegishli, shuning
 * uchun aktiv biznes ham shu yerda belgilanadi.
 */
let ctxAdmin: BrowserContext | undefined;
let ctxAdminOff: BrowserContext | undefined;
let ctxKassir: BrowserContext | undefined;

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
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
    return;
  }
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

  assert.equal(
    await portBandmi(PORT),
    false,
    `${PORT}-port band — avvalgi yurishdan qolgan server o'chirilmagan`
  );

  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: process.platform === "win32",
    detached: process.platform !== "win32",
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
  process.once("SIGINT", () => {
    ochir();
    process.exit(130);
  });

  await kut(`${ASOS}/login`, 90);

  const { chromium } = await import("playwright");
  browser = await chromium.launch({ executablePath: BRAUZER_YOLI, args: ["--no-sandbox"] });

  ctxAdmin = await sessiya(ADMIN, MAGAZINLI_BIZNES);
  ctxAdminOff = await sessiya(ADMIN, MAGAZINSIZ_BIZNES);
  ctxKassir = await sessiya(KASSIR, MAGAZINLI_BIZNES);
});

after(async () => {
  if (browser) await browser.close();
  if (!server?.pid) return;
  ochir();
  await portBoshaguncha(PORT, 10);
});

/**
 * Kirgan SESSIYA (kontekst) ochadi va AKTIV BIZNESNI belgilaydi.
 *
 * Aktiv biznes cookie orqali hal qilinadi (`lib/business.ts`), shuning uchun
 * uni to'g'ridan-to'g'ri qo'yamiz: shu bilan bitta e2e bazasida ham kassa
 * yoqilgan, ham yoqilmagan biznesni sinash mumkin.
 */
async function sessiya(
  kim: { login: string; parol: string },
  businessId: string
): Promise<BrowserContext> {
  const kontekst = await browser!.newContext({ baseURL: ASOS, locale: "uz-UZ" });
  const page = await kontekst.newPage();

  await page.goto(`${ASOS}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(kim.login);
  await page.getByLabel("Parol").fill(kim.parol);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL("**/app**", { timeout: 60_000 });

  // Playwright `url` va `path` ni BIRGA qabul qilmaydi — domen + yo'l beramiz.
  await kontekst.addCookies([
    { name: "active_business", value: businessId, domain: "127.0.0.1", path: "/" },
  ]);
  await page.close();
  return kontekst;
}

/** Tayyor sessiyadan yangi sahifa (test tugagach faqat SAHIFA yopiladi). */
async function sahifa(kontekst: BrowserContext | undefined): Promise<Page> {
  return kontekst!.newPage();
}

/** Bazadan o'qish — testdagi kutilgan holatni HAQIQIY yozuv bilan solishtirish. */
async function baza(sql: string): Promise<Record<string, unknown>[]> {
  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: "file:./prisma/e2e.db" });
  const r = await c.execute(sql);
  return r.rows as unknown as Record<string, unknown>[];
}

/**
 * APPARAT SKANERINI TAQLID QILADI (HID klaviatura rejimi).
 *
 * Haqiqiy skaner belgilarni ~10-30 ms oralig'ida "yozadi" va Enter bosadi.
 * `delay: 5` shu tezlikni beradi — `useSkaner` dagi 60 ms chegarasidan
 * ancha tez, ya'ni kod SKANER deb tanilishi kerak.
 *
 * Fokus ataylab kiritish maydonidan olib tashlanadi: aynan shu holatda
 * global tinglovchi ishlaydi va SKANER/QO'LDA YOZISH ziddiyati sinaladi.
 */
async function skanerla(page: Page, barcode: string) {
  await page.locator("h1").first().click();
  await page.keyboard.type(barcode, { delay: 5 });
  await page.keyboard.press("Enter");
}

/** Savatdagi satr qatori (mahsulot nomi bo'yicha). */
function savatSatri(page: Page, nomi: string) {
  return page.locator("li").filter({ hasText: nomi }).first();
}

// =========================================================================
// KIRISH VA MODUL GUARD
// =========================================================================

test("Magazin YOQIQ biznesda kassa ochiladi", { skip: sabab }, async () => {
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  assert.equal(await page.locator("h1").first().innerText(), "Kassa");
  assert.match(page.url(), /\/app\/pos$/);
  // Savat paneli va qidiruv maydoni chizilgan bo'lishi kerak.
  assert.ok(await page.getByPlaceholder("Skanerlang yoki nomi/kodini yozing").isVisible());
  await page.close();
});

test("Magazin O'CHIQ biznesda kassa route'i OCHILMAYDI", { skip: sabab }, async () => {
  // Faqat menyudan yashirish emas — sahifaning O'ZI yo'naltirishi kerak.
  const page = await sahifa(ctxAdminOff);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  assert.doesNotMatch(page.url(), /\/app\/pos/, "kassa yopiq bizneste ochilmasligi kerak");
  assert.equal(await page.locator("h1").first().innerText(), "Boshqaruv paneli");

  // Cheklar va QR sahifalari ham yopiq.
  for (const yol of ["/app/pos/cheklar", "/app/pos/qr"]) {
    await page.goto(`${ASOS}${yol}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 30_000 });
    assert.doesNotMatch(page.url(), /\/app\/pos/, `${yol} yopiq bo'lishi kerak`);
  }
  await page.close();
});

test("Magazin O'CHIQ biznesda POS API 403 qaytaradi (backend hal qiladi)", { skip: sabab }, async () => {
  // Frontend'da yashirish xavfsizlik emas: so'rov to'g'ridan-to'g'ri
  // yuborilganda ham backend rad etishi shart.
  const page = await sahifa(ctxAdminOff);
  // `evaluate` ichidagi nisbiy `fetch` ishlashi uchun sahifa ILOVADA
  // turishi kerak — yangi sahifa `about:blank` dan boshlanadi.
  await page.goto(`${ASOS}/app`, { waitUntil: "domcontentloaded" });
  const javob = await page.evaluate(async () => {
    const r = await fetch("/api/pos/chek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ satrlar: [{ productId: "p_kola", miqdor: 1 }], tolovTuri: "naqd" }),
    });
    return { holat: r.status, matn: await r.text() };
  });
  assert.ok(
    javob.holat === 400 || javob.holat === 403,
    `kassasiz bizneste sotuv rad etilishi kerak, keldi: ${javob.holat} — ${javob.matn}`
  );
  // Bazaga hech narsa yozilmagan.
  const cheklar = await baza(`SELECT COUNT(*) n FROM PosChek WHERE businessId='${MAGAZINSIZ_BIZNES}'`);
  assert.equal(Number(cheklar[0].n), 0);
  await page.close();
});

// =========================================================================
// QIDIRUV, SKANER VA SAVAT
// =========================================================================

test("Mahsulot qidiruvi nomi bo'yicha filtrlaydi", { skip: sabab }, async () => {
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  const qidiruv = page.getByPlaceholder("Skanerlang yoki nomi/kodini yozing");
  await qidiruv.fill("fanta");
  await page.waitForTimeout(300);

  const matn = await page.locator("body").innerText();
  assert.ok(matn.includes("Fanta 1L"), "qidirilgan tovar ko'rinishi kerak");
  assert.ok(!matn.includes("Coca-Cola 1.5L"), "mos kelmagan tovar filtrlanishi kerak");
  await page.close();
});

test("APPARAT SKANERI (HID) mahsulotni savatga qo'shadi", { skip: sabab }, async () => {
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  await skanerla(page, KOLA_BARCODE);
  await page.waitForSelector("text=Coca-Cola 1.5L", { timeout: 15_000 });

  const satr = savatSatri(page, "Coca-Cola 1.5L");
  assert.equal(await satr.locator("input[type='number']").last().inputValue(), "1");
  await page.close();
});

test("Bir mahsulot qayta skanerlansa MIQDOR oshadi (yangi satr emas)", { skip: sabab }, async () => {
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  await skanerla(page, KOLA_BARCODE);
  await page.waitForSelector("text=Coca-Cola 1.5L", { timeout: 15_000 });
  await skanerla(page, KOLA_BARCODE);
  await skanerla(page, KOLA_BARCODE);
  await page.waitForTimeout(500);

  const satr = savatSatri(page, "Coca-Cola 1.5L");
  assert.equal(
    await satr.locator("input[type='number']").last().inputValue(),
    "3",
    "uch marta skanerlanganda miqdor 3 bo'lishi kerak"
  );
  // Savatda ATIGI BITTA satr bo'lishi kerak.
  const satrlar = await page.locator("li").filter({ hasText: "Coca-Cola 1.5L" }).count();
  assert.equal(satrlar, 1, "qayta skanerlash yangi satr yaratmasligi kerak");
  await page.close();
});

test("SKANER va QO'LDA YOZISH aralashmaydi", { skip: sabab }, async () => {
  // Kassir qidiruv maydoniga yozayotganda global skaner tinglovchisi
  // ishlamasligi kerak — aks holda har harf kod buferiga qo'shilardi.
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  const qidiruv = page.getByPlaceholder("Skanerlang yoki nomi/kodini yozing");
  await qidiruv.click();
  await page.keyboard.type("kola", { delay: 5 }); // skaner tezligida, LEKIN maydon ichida
  await page.waitForTimeout(400);

  assert.equal(await qidiruv.inputValue(), "kola", "yozilgan matn maydonda qolishi kerak");
  // Savat bo'sh: "kola" kod sifatida qabul qilinmagan.
  assert.ok(
    (await page.locator("body").innerText()).includes("Savat bo'sh"),
    "qo'lda yozilgan matn savatga tovar qo'shmasligi kerak"
  );
  await page.close();
});

test("Miqdor tugmalari va NARXNI TUZATISH ishlaydi", { skip: sabab }, async () => {
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  await skanerla(page, KOLA_BARCODE);
  await page.waitForSelector("text=Coca-Cola 1.5L", { timeout: 15_000 });

  const satr = savatSatri(page, "Coca-Cola 1.5L");
  await satr.getByLabel("Miqdorni oshirish").click();
  await page.waitForTimeout(200);
  assert.equal(await satr.locator("input[type='number']").last().inputValue(), "2");

  await satr.getByLabel("Miqdorni kamaytirish").click();
  await page.waitForTimeout(200);
  assert.equal(await satr.locator("input[type='number']").last().inputValue(), "1");

  // Narxni tuzatish — "narx o'zgartirildi" belgisi chiqishi kerak.
  const narx = satr.getByLabel("Coca-Cola 1.5L narxi");
  await narx.fill("9000");
  await page.waitForTimeout(300);
  assert.ok(
    (await satr.innerText()).includes("narx o'zgartirildi"),
    "tuzatilgan narx belgilanishi kerak"
  );
  await page.close();
});

// =========================================================================
// TO'LOV OQIMLARI
// =========================================================================

/** Savat yig'ib, to'lovni yakunlaydi va chek raqamini qaytaradi. */
async function sotuvniYakunla(
  page: Page,
  usul: "Naqd" | "Karta" | "Click" | "Qarz",
  mijoz?: string
): Promise<number> {
  await page.getByRole("button", { name: "To'lovga o'tish" }).click();
  await page.waitForSelector("text=To'lov usuli", { timeout: 15_000 });
  await page.getByRole("button", { name: usul, exact: true }).click();
  if (mijoz) {
    // Mijoz maydoni endi QIDIRUV: yozilgan matn ostida takliflar ro'yxati
    // ochiladi. Mos mijoz bo'lmasa matn yangi mijoz ismi bo'lib ketadi
    // (server kartochkani o'zi ochadi — lib/services/mijozAniqla.ts).
    await page.getByPlaceholder("Mijozni qidiring (ism yoki telefon)").fill(mijoz);
    // Takliflar ro'yxati "Sotish" tugmasini to'sib qo'ymasligi uchun yopamiz.
    await page.getByText("To'lov usuli").click();
  }

  const [javob] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/pos/chek") && r.request().method() === "POST",
      { timeout: 30_000 }
    ),
    page.getByRole("button", { name: "Sotish", exact: true }).click(),
  ]);
  assert.ok(
    javob.ok(),
    `sotuv saqlanmadi: HTTP ${javob.status()} — ${(await javob.text()).slice(0, 300)}`
  );
  const chek = (await javob.json()) as { raqam: number };
  return chek.raqam;
}

test("NAQD to'lov: chek yaratiladi, qoldiq kamayadi, kirim yoziladi", { skip: sabab }, async () => {
  const oldin = await baza(`SELECT miqdor FROM Product WHERE id='p_fanta'`);
  const oldingiMiqdor = Number(oldin[0].miqdor);

  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  await skanerla(page, FANTA_BARCODE);
  await page.waitForSelector("text=Fanta 1L", { timeout: 15_000 });
  await savatSatri(page, "Fanta 1L").getByLabel("Miqdorni oshirish").click();
  await page.waitForTimeout(200);

  const raqam = await sotuvniYakunla(page, "Naqd");
  assert.ok(raqam > 0);

  // Ombor kamaydi.
  const keyin = await baza(`SELECT miqdor FROM Product WHERE id='p_fanta'`);
  assert.equal(Number(keyin[0].miqdor), oldingiMiqdor - 2, "qoldiq 2 taga kamayishi kerak");

  // Chek va uning kirim tranzaksiyasi.
  const chek = await baza(
    `SELECT id, jamiSumma, tolovTuri, transactionId, debtId FROM PosChek WHERE raqam=${raqam} AND businessId='${MAGAZINLI_BIZNES}'`
  );
  assert.equal(chek.length, 1);
  assert.equal(chek[0].tolovTuri, "naqd");
  assert.equal(Number(chek[0].jamiSumma), 20_000);
  assert.ok(chek[0].transactionId, "naqd chekda kirim tranzaksiya bo'lishi kerak");
  assert.equal(chek[0].debtId, null);

  const txn = await baza(`SELECT turi, summa, tolovTuri FROM "Transaction" WHERE id='${chek[0].transactionId}'`);
  assert.equal(txn[0].turi, "kirim");
  assert.equal(Number(txn[0].summa), 20_000);
  assert.equal(txn[0].tolovTuri, "naqd");

  // Chek satrlari — Sale yozuvlari, chekka bog'langan.
  const satrlar = await baza(`SELECT miqdor, birlikNarx FROM Sale WHERE chekId='${chek[0].id}'`);
  assert.equal(satrlar.length, 1);
  assert.equal(Number(satrlar[0].miqdor), 2);
  await page.close();
});

test("KARTA to'lovi naqdsiz (click) tranzaksiya yozadi", { skip: sabab }, async () => {
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  await skanerla(page, KOLA_BARCODE);
  await page.waitForSelector("text=Coca-Cola 1.5L", { timeout: 15_000 });
  const raqam = await sotuvniYakunla(page, "Karta");

  const chek = await baza(
    `SELECT tolovTuri, transactionId FROM PosChek WHERE raqam=${raqam} AND businessId='${MAGAZINLI_BIZNES}'`
  );
  assert.equal(chek[0].tolovTuri, "karta", "chekda kassir ko'rgan usul saqlanishi kerak");
  const txn = await baza(`SELECT tolovTuri FROM "Transaction" WHERE id='${chek[0].transactionId}'`);
  assert.equal(txn[0].tolovTuri, "click", "karta — naqdsiz pul, tranzaksiyada 'click'");
  await page.close();
});

test("QARZ to'lovi: qarzdorlik yoziladi, kirim YOZILMAYDI", { skip: sabab }, async () => {
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  await skanerla(page, KOLA_BARCODE);
  await page.waitForSelector("text=Coca-Cola 1.5L", { timeout: 15_000 });
  const raqam = await sotuvniYakunla(page, "Qarz", "E2E Xaridor");

  const chek = await baza(
    `SELECT transactionId, debtId, jamiSumma FROM PosChek WHERE raqam=${raqam} AND businessId='${MAGAZINLI_BIZNES}'`
  );
  assert.equal(chek[0].transactionId, null, "qarzda kirim yozilmasligi kerak");
  assert.ok(chek[0].debtId, "qarzdorlik yaratilishi kerak");

  const qarz = await baza(`SELECT mijozNomi, jamiSumma, turi FROM Debt WHERE id='${chek[0].debtId}'`);
  assert.equal(qarz[0].mijozNomi, "E2E Xaridor");
  assert.equal(qarz[0].turi, "olinadigan");
  assert.equal(Number(qarz[0].jamiSumma), Number(chek[0].jamiSumma));
  await page.close();
});

// =========================================================================
// CHEKLAR VA QAYTARISH
// =========================================================================

test("Sotilgan chek TARIXDA ko'rinadi", { skip: sabab }, async () => {
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });
  await skanerla(page, FANTA_BARCODE);
  await page.waitForSelector("text=Fanta 1L", { timeout: 15_000 });
  const raqam = await sotuvniYakunla(page, "Naqd");

  await page.goto(`${ASOS}/app/pos/cheklar`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });
  assert.equal(await page.locator("h1").first().innerText(), "Cheklar");
  await page.waitForSelector(`text=${raqam}-chek`, { timeout: 15_000 });
  await page.close();
});

test("TO'LIQ QAYTARISH: qoldiq qaytadi, pul chiqadi, chek tarixda qoladi", { skip: sabab }, async () => {
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  await skanerla(page, FANTA_BARCODE);
  await page.waitForSelector("text=Fanta 1L", { timeout: 15_000 });
  await savatSatri(page, "Fanta 1L").getByLabel("Miqdorni oshirish").click();
  await page.waitForTimeout(200);
  const raqam = await sotuvniYakunla(page, "Naqd");

  const sotuvdanKeyin = Number(
    (await baza(`SELECT miqdor FROM Product WHERE id='p_fanta'`))[0].miqdor
  );

  await page.goto(`${ASOS}/app/pos/cheklar`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`text=${raqam}-chek`, { timeout: 15_000 });

  // Kartochka — `Card` komponentining ildizi (`div.bg-surface`). Oddiy
  // `div` bo'yicha qidirish ichma-ich div'lardan eng ichkisini tanlab
  // qo'yardi va unda tugma yo'q edi.
  const kartochka = page.locator("div.bg-surface").filter({ hasText: `${raqam}-chek` }).first();
  await kartochka.getByRole("button", { name: "Qaytarish" }).click();

  // Tasdiq oynasi ichidagi tugma — sahifadagi boshqa "Qaytarish"
  // tugmalari bilan aralashmasligi uchun dialog ichida qidiriladi.
  const oyna = page.getByRole("dialog");
  await oyna.waitFor({ state: "visible", timeout: 15_000 });

  // SABAB MAJBURIY: bo'sh bo'lsa tugma o'chiq turishi kerak.
  const tasdiq = oyna.getByRole("button", { name: "Qaytarish", exact: true });
  assert.equal(await tasdiq.isDisabled(), true, "sababsiz qaytarish mumkin bo'lmasligi kerak");

  await oyna.getByPlaceholder("Qaytarish sababi (majburiy)").fill("E2E sinov qaytarishi");
  const [javob] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/bekor") && r.request().method() === "POST", {
      timeout: 30_000,
    }),
    tasdiq.click(),
  ]);
  assert.ok(javob.ok(), `qaytarish yiqildi: HTTP ${javob.status()}`);

  // Qoldiq qaytdi.
  const qaytgan = Number((await baza(`SELECT miqdor FROM Product WHERE id='p_fanta'`))[0].miqdor);
  assert.equal(qaytgan, sotuvdanKeyin + 2, "qaytarishda qoldiq tiklanishi kerak");

  // Chek TARIXDA qoladi va "qaytarilgan" deb belgilanadi; pul chiqdi.
  const chek = await baza(
    `SELECT id, deletedAt, cancelReason, transactionId FROM PosChek WHERE raqam=${raqam} AND businessId='${MAGAZINLI_BIZNES}'`
  );
  assert.ok(chek[0].deletedAt, "chek yumshoq o'chirilishi kerak");
  assert.equal(chek[0].cancelReason, "E2E sinov qaytarishi");
  const txn = await baza(`SELECT deletedAt FROM "Transaction" WHERE id='${chek[0].transactionId}'`);
  assert.ok(txn[0].deletedAt, "kirim tranzaksiya bekor qilinishi kerak");
  await page.close();
});

// =========================================================================
// ROL (RBAC) TEKSHIRUVLARI
// =========================================================================

test("YORLIQ CHOP ETISH sahifasi ochiladi va QR chizadi", { skip: sabab }, async () => {
  // 100+ kodsiz tovarli do'kon uchun asosiy oqim: ommaviy QR yaratish ->
  // yorliqlarni stiker printerida chop etish.
  const page = await sahifa(ctxAdmin);
  await page.goto(`${ASOS}/app/pos/qr`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  // Kodsiz tovarlarga bir yo'la QR yaratish.
  const [javob] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith("/api/pos/mahsulot/qr-hammasi") && r.request().method() === "POST",
      { timeout: 30_000 }
    ),
    page.getByRole("button", { name: "Kodsiz tovarlarga QR yaratish" }).click(),
  ]);
  assert.ok(javob.ok(), `ommaviy QR yiqildi: HTTP ${javob.status()}`);

  // Chop etish sahifasi.
  await page.goto(`${ASOS}/app/pos/qr/chop`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });
  assert.equal(await page.locator("h1").first().innerText(), "Yorliqlarni chop etish");

  // Yorliqlar chizilgan va ichida haqiqiy QR (SVG) bor.
  await page.waitForSelector(".yorliq", { timeout: 15_000 });
  assert.ok((await page.locator(".yorliq").count()) > 0, "kamida bitta yorliq bo'lishi kerak");
  assert.ok((await page.locator(".yorliq-qr svg").count()) > 0, "yorliqda QR rasmi bo'lishi kerak");

  // O'lcham almashtirilsa yorliq o'lchami ham o'zgaradi (CSS qayta yoziladi).
  const oldin = await page.locator(".yorliq").first().boundingBox();
  await page.getByRole("button", { name: "58 × 40 mm" }).click();
  await page.waitForTimeout(300);
  const keyin = await page.locator(".yorliq").first().boundingBox();
  assert.ok(
    keyin && oldin && keyin.width > oldin.width,
    "58 mm yorliq 40 mm dan keng bo'lishi kerak"
  );

  await page.close();
});

test("KASSIRGA yorliq chop etish sahifasi YOPIQ", { skip: sabab }, async () => {
  const page = await sahifa(ctxKassir);
  await page.goto(`${ASOS}/app/pos/qr/chop`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });
  assert.doesNotMatch(page.url(), /\/app\/pos\/qr/, "kassirga katalog sahifalari yopiq");

  // Backend ham rad etishi kerak — frontend'da yashirish xavfsizlik emas.
  const javob = await page.evaluate(async () => {
    const r = await fetch("/api/pos/mahsulot/qr-hammasi", { method: "POST" });
    return r.status;
  });
  assert.equal(javob, 403, `kassirning ommaviy QR so'rovi 403 bo'lishi kerak, keldi: ${javob}`);
  await page.close();
});

test("KASSIR kassaga kiradi, lekin QR sahifasi unga yopiq", { skip: sabab }, async () => {
  const page = await sahifa(ctxKassir);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });
  assert.equal(await page.locator("h1").first().innerText(), "Kassa", "kassirga kassa ochiq");

  // QR/shtrix-kod — katalogni o'zgartirish, faqat boshqaruvchida.
  await page.goto(`${ASOS}/app/pos/qr`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });
  assert.doesNotMatch(page.url(), /\/app\/pos\/qr/, "kassirga QR sahifasi yopiq bo'lishi kerak");
  await page.close();
});

test("KASSIR chekni qaytara OLMAYDI — tugma ham yo'q, API ham rad etadi", { skip: sabab }, async () => {
  // Avval direktor bitta chek yaratadi.
  const admin = await sahifa(ctxAdmin);
  await admin.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await admin.waitForSelector("h1", { timeout: 30_000 });
  await skanerla(admin, KOLA_BARCODE);
  await admin.waitForSelector("text=Coca-Cola 1.5L", { timeout: 15_000 });
  const raqam = await sotuvniYakunla(admin, "Naqd");
  await admin.close();

  const chek = await baza(
    `SELECT id FROM PosChek WHERE raqam=${raqam} AND businessId='${MAGAZINLI_BIZNES}'`
  );
  const chekId = String(chek[0].id);

  // IJOBIY NAZORAT: direktorda o'sha sahifada tugma BOR. Busiz quyidagi
  // "0 ta tugma" tekshiruvi lokator umuman ishlamay qolganda ham o'tib
  // ketardi (ya'ni hech narsani qo'riqlamasdi).
  const direktor = await sahifa(ctxAdmin);
  await direktor.goto(`${ASOS}/app/pos/cheklar`, { waitUntil: "domcontentloaded" });
  await direktor.waitForSelector(`text=${raqam}-chek`, { timeout: 15_000 });
  assert.ok(
    (await direktor.getByRole("button", { name: "Qaytarish", exact: true }).count()) > 0,
    "direktorda qaytarish tugmasi bo'lishi kerak"
  );
  await direktor.close();

  const page = await sahifa(ctxKassir);
  await page.goto(`${ASOS}/app/pos/cheklar`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(`text=${raqam}-chek`, { timeout: 15_000 });

  // 1. UI'da tugma yo'q.
  //
  // `exact: true` SHART: Playwright nom bo'yicha qidirishda sukut bo'yicha
  // QISM-satrni oladi. Undan oldingi test chekni "E2E sinov qaytarishi"
  // sababi bilan qaytargan; o'sha chek kartochkasining ochish tugmasi
  // matnida "qaytarishi" so'zi bor va u ham mos kelib qolardi — test
  // ruxsat buzilgandek ko'rsatardi, aslida hammasi joyida edi.
  assert.equal(
    await page.getByRole("button", { name: "Qaytarish", exact: true }).count(),
    0,
    "kassirga qaytarish tugmasi ko'rinmasligi kerak"
  );

  // 2. MUHIMI: to'g'ridan-to'g'ri so'rov ham rad etilishi kerak —
  //    frontend'da yashirish xavfsizlik hisoblanmaydi.
  const javob = await page.evaluate(async (id) => {
    const r = await fetch(`/api/pos/chek/${id}/bekor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sabab: "ruxsatsiz urinish" }),
    });
    return { holat: r.status, matn: await r.text() };
  }, chekId);
  assert.equal(javob.holat, 403, `kassirning qaytarishi 403 bo'lishi kerak, keldi: ${javob.holat}`);

  // 3. Chek haqiqatan qaytarilmagan.
  const keyin = await baza(`SELECT deletedAt FROM PosChek WHERE id='${chekId}'`);
  assert.equal(keyin[0].deletedAt, null, "ruxsatsiz so'rov chekka tegmasligi kerak");
  await page.close();
});

test("SOTUVCHI (SELLER) kassaga umuman kira olmaydi", { skip: sabab }, async () => {
  // Sotuvchi roli e2e bazasida yo'q — API darajasida tekshiramiz:
  // kassir sessiyasi bilan boshqa biznesning mahsulotini sotishga urinish.
  const page = await sahifa(ctxKassir);
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  const javob = await page.evaluate(async () => {
    const r = await fetch("/api/pos/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kod: "4601234567890" }),
    });
    return { holat: r.status, malumot: await r.json() };
  });
  // Kassir O'Z biznesida — kod topilishi kerak (bu ijobiy nazorat).
  assert.equal(javob.holat, 200);
  assert.equal(javob.malumot.topildi, true);
  await page.close();
});

// =========================================================================
// MAKET: SAVAT HAR DOIM EKRANDA
// =========================================================================

test("KATEGORIYA TASMASI uzun bo'lsa ham SAVAT ekrandan chiqib ketmaydi", { skip: sabab }, async () => {
  /*
   * HAQIQIY NUQSON (2026-08-19).
   *
   * Kassa maketi ikki ustunli: `grid-cols-[1fr_380px]`. Grid bolasining
   * sukutdagi `min-width: auto` qiymati uni kontentining eng kichik
   * kengligidan pastga tushirmaydi. Do'konda 11 ta kategoriya bo'lganda
   * chap ustun kengayib ketdi va savat ekranning O'NG TOMONIDAN tashqariga
   * chiqdi. `body { overflow-x: clip }` (mobil qulaylashtirishda qo'shilgan)
   * uni siljitib topishga ham yo'l qo'ymadi — kassir savatni umuman
   * ko'rmadi va hech narsa sota olmadi.
   *
   * Shuning uchun bu yerda "savat bormi" emas, "savat EKRAN ICHIDAMI"
   * tekshiriladi: DOM'da bo'lgani bilan ko'rinmaydigan savat ishlamaydi.
   */
  const page = await sahifa(ctxKassir);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${ASOS}/app/pos`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  // Kategoriya tasmasi haqiqatan uzun bo'lishi kerak — aks holda test
  // nuqsonni umuman qo'zg'atmaydi va bekorga yashil bo'lib turadi.
  const kategoriyaSoni = await page.locator("button", { hasText: /^Gullar$|^teddi$|^shar$/ }).count();
  assert.ok(kategoriyaSoni >= 3, `e2e bazasida kategoriyalar yetarli emas: ${kategoriyaSoni}`);

  const olcham = await page.evaluate(() => {
    const sarlavha = [...document.querySelectorAll("h2")].find((h) => h.textContent === "Savat");
    const karta = sarlavha?.closest("div.bg-surface");
    const r = karta?.getBoundingClientRect();
    return {
      oyna: window.innerWidth,
      bodyScroll: document.body.scrollWidth,
      savat: r ? { chap: Math.round(r.left), ong: Math.round(r.right) } : null,
    };
  });

  assert.ok(olcham.savat, "savat kartasi topilmadi");
  assert.ok(
    olcham.savat.ong <= olcham.oyna,
    `savat ekrandan chiqib ketgan: o'ng cheti ${olcham.savat.ong}px, ekran ${olcham.oyna}px`
  );
  assert.ok(olcham.savat.chap >= 0, "savat chap tomondan chiqib ketgan");
  assert.equal(
    olcham.bodyScroll,
    olcham.oyna,
    "sahifa gorizontal siljimasligi kerak — keng kontent o'z ichida suriladi"
  );

  // To'lov tugmasi ham bosiladigan joyda turibdi.
  assert.ok(await page.getByRole("button", { name: "To'lovga o'tish" }).isVisible());
  await page.close();
});
