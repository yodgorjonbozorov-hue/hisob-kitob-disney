/**
 * KUNLIK HISOBOT — RESPONSIVE VERIFIKATSIYA (brauzer).
 *
 * Unit testlar pul mantiqini isbotlaydi, lekin "375px telefonda raqam
 * kartadan chiqib ketdimi", "sticky tugma pastki navigatsiya ostida qolib
 * ketdimi", "solishtiruv varag'i klaviatura ochilganda yo'qoldimi" degan
 * savollarga javob bermaydi. Aynan shular kassirning kundalik ishida
 * uchraydigan xatolar.
 *
 * Tekshiriladigan kengliklar: 1440, 1280, 768, 390, 375.
 *
 * Ishga tushirish:
 *   npm run build          (bir marta, .next kerak)
 *   npm run test:kunlik-e2e
 *
 * `.next` yo'q bo'lsa testlar o'tkazib yuboriladi.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import type { Browser, Page } from "playwright";

const PORT = 3101;
const ASOS = `http://127.0.0.1:${PORT}`;
const LOGIN = "admin";
const PAROL = "admin123";

const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

const qurilgan = existsSync(".next/BUILD_ID");
const sabab = qurilgan ? undefined : "`.next` yo'q — avval `npm run build` qiling";

/** Tekshiriladigan ekran kengliklari (§32). */
const KENGLIKLAR: Array<[nomi: string, w: number, h: number]> = [
  ["desktop-1440", 1440, 900],
  ["desktop-1280", 1280, 800],
  ["planshet-768", 768, 1024],
  ["telefon-390", 390, 844],
  ["telefon-375", 375, 667],
];

let server: ChildProcess | undefined;
let browser: Browser | undefined;

function portBandmi(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const soket = connect({ port, host: "127.0.0.1" });
    const tugat = (n: boolean) => {
      soket.destroy();
      resolve(n);
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

/** Serverni butun jarayon daraxti bilan o'chiradi (smoke to'plami bilan bir xil). */
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
  assert.equal(await portBandmi(PORT), false, `${PORT}-port band`);

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

  await kut(`${ASOS}/login`, 90);
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ executablePath: BRAUZER_YOLI, args: ["--no-sandbox"] });
});

after(async () => {
  if (browser) await browser.close();
  ochir();
});

async function sahifa(w: number, h: number): Promise<Page> {
  const kontekst = await browser!.newContext({
    baseURL: ASOS,
    locale: "uz-UZ",
    viewport: { width: w, height: h },
    // Telefon kengliklarida haqiqiy qurilma nisbati — CSS media so'rovlari
    // desktopdagidek emas, mobil tarmoqda ishlaydi.
    deviceScaleFactor: w <= 430 ? 3 : 1,
    isMobile: w <= 430,
    hasTouch: w <= 430,
  });
  return kontekst.newPage();
}

async function kir(page: Page) {
  await page.goto(`${ASOS}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL("**/app**", { timeout: 60_000 });
  await page.waitForSelector("h1", { timeout: 60_000 });
}

/** Sahifada GORIZONTAL siljish bormi (bo'lmasligi kerak). */
async function gorizontalSiljish(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
}

/** Konteyneridan CHIQIB ketgan elementlar (uzun summa overflow tekshiruvi). */
async function toshganlar(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const chetga: string[] = [];
    const kenglik = document.documentElement.clientWidth;
    document.querySelectorAll<HTMLElement>("main *").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // 1px — brauzer yaxlitlashi uchun bag'rikenglik.
      if (r.right > kenglik + 1 || r.left < -1) {
        chetga.push(`${el.tagName.toLowerCase()}.${el.className}`.slice(0, 90));
      }
    });
    return chetga.slice(0, 5);
  });
}

// ---------------------------------------------------------------------------
// 1. HAR KENGLIKDA: gorizontal siljish yo'q, KPI sig'adi, sarlavha o'qiladi
// ---------------------------------------------------------------------------

for (const [nomi, w, h] of KENGLIKLAR) {
  test(`${nomi}: kunlik hisobot gorizontal siljishsiz ochiladi`, { skip: sabab }, async () => {
    const page = await sahifa(w, h);
    await kir(page);
    await page.goto(`${ASOS}/app/kunlik`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 30_000 });

    const sarlavha = (await page.locator("h1").first().innerText()).trim();
    assert.equal(sarlavha, "Kunlik hisobot", "sahifa sarlavhasi ko'rinishi kerak");

    // Holat belgisi DB holatidan keladi — uchtadan biri bo'lishi shart.
    const matn = await page.locator("main").innerText();
    assert.match(matn, /Ochiq|Direktorga yuborilgan|Tasdiqlangan/, "holat belgisi ko'rinmadi");

    // Xulosa kartalari
    assert.match(matn, /Jami kirim/, "Jami kirim kartasi yo'q");
    assert.match(matn, /Jami chiqim/, "Jami chiqim kartasi yo'q");
    assert.match(matn, /Sof natija/, "Sof natija kartasi yo'q");
    assert.match(matn, /Smena nazorati/, "Smena bloki yo'q");
    assert.match(matn, /Bugungi operatsiyalar/, "Operatsiyalar lentasi yo'q");

    const ortiqcha = await gorizontalSiljish(page);
    assert.ok(ortiqcha <= 1, `${nomi}: gorizontal siljish ${ortiqcha}px (0 bo'lishi kerak)`);

    const chetga = await toshganlar(page);
    assert.deepEqual(chetga, [], `${nomi}: elementlar ekrandan chiqib ketdi`);

    await page.context().close();
  });
}

// ---------------------------------------------------------------------------
// 2. MOBIL STICKY AMAL — pastki navigatsiya bilan ustma-ust tushmasin
// ---------------------------------------------------------------------------

test("375px: sticky amal paneli ko'rinadi va navigatsiyani yopmaydi", { skip: sabab }, async () => {
  const page = await sahifa(375, 667);
  await kir(page);
  await page.goto(`${ASOS}/app/kunlik`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  const tugma = page.getByRole("button", { name: /Direktorga topshirish/ });
  assert.ok(await tugma.count(), "mobil sticky amal tugmasi topilmadi");
  await tugma.first().waitFor({ state: "visible" });

  // Pastgacha suramiz — sticky panel YO'QOLMASLIGI kerak.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  assert.ok(await tugma.first().isVisible(), "scrolldan keyin sticky tugma yo'qoldi");

  // Sticky panel va pastki navigatsiya ustma-ust tushmasin.
  const ustmaUst = await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Direktorga topshirish")
    );
    const nav = document.querySelector("nav.fixed, nav[class*='fixed']");
    if (!t || !nav) return null;
    const a = t.getBoundingClientRect();
    const b = nav.getBoundingClientRect();
    return a.bottom > b.top ? { tugma: a.bottom, nav: b.top } : null;
  });
  assert.equal(ustmaUst, null, `sticky tugma pastki navigatsiya bilan kesishdi: ${JSON.stringify(ustmaUst)}`);

  // Barmoq nishoni ≥ 44px.
  const balandlik = await tugma.first().evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(balandlik >= 44, `sticky tugma balandligi ${balandlik}px (≥44 bo'lishi kerak)`);

  await page.context().close();
});

// ---------------------------------------------------------------------------
// 3. SOLISHTIRUV VARAG'I — raqamli klaviatura va yo'qolmaydigan tugma
// ---------------------------------------------------------------------------

test("375px: topshirish varag'i ochiladi, raqamli klaviatura va farq ishlaydi", { skip: sabab }, async () => {
  const page = await sahifa(375, 667);
  await kir(page);
  await page.goto(`${ASOS}/app/kunlik`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  // `getByRole` faqat ko'rinadigan tugmalarni topadi — desktop varianti
  // (`hidden sm:flex`) hisobga olinmaydi, ya'ni bu aynan sticky tugma.
  await page.getByRole("button", { name: /Direktorga topshirish/ }).first().click();

  // Varaqni SARLAVHA bo'yicha emas, maydon bo'yicha kutamiz: sarlavha matni
  // sahifadagi tugma matni bilan bir xil va `text=` selektori ikkalasiga ham
  // tushardi (yashirin desktop tugmasi ham).
  const maydon = page.locator("#topshirish-real");
  await maydon.waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(
    await maydon.getAttribute("inputMode"),
    "numeric",
    "telefonda raqamli klaviatura ochilishi kerak"
  );
  const kirishBalandligi = await maydon.evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(kirishBalandligi >= 44, `kirish maydoni ${kirishBalandligi}px (≥44 bo'lishi kerak)`);

  // VARAQ formasi — sahifadagi "Tushum kiritish" formasi bilan
  // adashtirmaslik uchun aynan maydon orqali topiladi.
  const varaqForma = page.locator("form").filter({ has: page.locator("#topshirish-real") });

  // Farq JONLI hisoblanadi.
  await maydon.fill("1");
  await page.waitForTimeout(200);
  const varaq = await varaqForma.innerText();
  assert.match(varaq, /Tizim bo'yicha/, "tizim hisobi ko'rsatilishi kerak");
  assert.match(varaq, /Farq/, "farq qatori ko'rsatilishi kerak");
  assert.match(varaq, /Kamomad|Ortiqcha|Farq yo'q/, "farq natijasi ko'rsatilishi kerak");
  assert.match(varaq, /Qabul qiluvchi/, "qabul qiluvchi kassa ko'rsatilishi kerak");

  // Topshirish tugmasi ko'rinishda qolishi kerak (klaviatura ochilganda ham).
  const yubor = varaqForma.locator("button[type='submit']").last();
  assert.ok(await yubor.isVisible(), "varaq ichida Topshirish tugmasi ko'rinmayapti");
  const yuborBalandligi = await yubor.evaluate((el) => el.getBoundingClientRect().height);
  assert.ok(yuborBalandligi >= 44, `Topshirish tugmasi ${yuborBalandligi}px (≥44 bo'lishi kerak)`);

  // Varaq ichida ham gorizontal siljish bo'lmasin.
  const ortiqcha = await gorizontalSiljish(page);
  assert.ok(ortiqcha <= 1, `varaq ochiqda gorizontal siljish ${ortiqcha}px`);

  await page.context().close();
});

// ---------------------------------------------------------------------------
// 4. TARIX — ixcham ro'yxat telefonda ham o'qiladi
// ---------------------------------------------------------------------------

test("375px: tarix sahifasi siljishsiz ochiladi", { skip: sabab }, async () => {
  const page = await sahifa(375, 667);
  await kir(page);
  await page.goto(`${ASOS}/app/kunlik/tarix`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  const ortiqcha = await gorizontalSiljish(page);
  assert.ok(ortiqcha <= 1, `tarix: gorizontal siljish ${ortiqcha}px`);
  assert.deepEqual(await toshganlar(page), [], "tarix: elementlar ekrandan chiqdi");

  await page.context().close();
});
