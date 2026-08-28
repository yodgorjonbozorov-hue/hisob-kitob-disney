/**
 * AI COPILOT — BRAUZER (RESPONSIVE) TESTLARI.
 *
 * Suhbat ekrani boshqa sahifalardan farq qiladi: u to'liq balandlikni
 * egallaydi va SAHIFANING O'ZI siljimasligi kerak (suriladigan yagona joy —
 * xabarlar lentasi). Bunday maketni faqat haqiqiy brauzerda tekshirish
 * mumkin, shuning uchun alohida to'plam.
 *
 * Tekshiriladigan kengliklar: 1440, 1280, 768, 390, 375.
 *
 * Ishga tushirish:
 *   npm run build        (bir marta, `.next` kerak)
 *   npm run test:ai-e2e
 *
 * `.next` yo'q bo'lsa testlar o'tkazib yuboriladi (smoke to'plami bilan
 * bir xil qoida).
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

/** Mobil (390 va 375) va desktop (1440, 1280, 768) kengliklari. */
const EKRANLAR = [
  { nomi: "desktop-1440", width: 1440, height: 900 },
  { nomi: "desktop-1280", width: 1280, height: 800 },
  { nomi: "planshet-768", width: 768, height: 1024 },
  { nomi: "iphone-390", width: 390, height: 844 },
  { nomi: "iphone-375", width: 375, height: 667 },
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
  assert.equal(await portBandmi(PORT), false, `${PORT}-port band — avvalgi yurishdan qolgan server o'chirilmagan`);

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
      // Soxta kalit: sahifa "AI ulangan" rejimida chiziladi. Modelning O'ZI
      // hech qachon chaqirilmaydi — `/api/ai/chat` so'rovi brauzer darajasida
      // ushlab qolinadi (`page.route`), ya'ni test tarmoqqa bog'liq emas.
      ANTHROPIC_API_KEY: "e2e-soxta-kalit",
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

async function aiSahifasi(width: number, height: number): Promise<Page> {
  const kontekst = await browser!.newContext({
    baseURL: ASOS,
    locale: "uz-UZ",
    viewport: { width, height },
    hasTouch: width < 768,
  });
  const page = await kontekst.newPage();
  await page.goto(`${ASOS}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL("**/app**", { timeout: 60_000 });
  await page.goto(`${ASOS}/app/ai`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Balansa AI", exact: true }).first().waitFor({ timeout: 30_000 });
  return page;
}

for (const ekran of EKRANLAR) {
  test(`${ekran.nomi}: AI suhbati ochiladi va sahifa gorizontal siljimaydi`, { skip: sabab }, async () => {
    const page = await aiSahifasi(ekran.width, ekran.height);

    // 1. Gorizontal siljish MUTLAQO bo'lmasligi kerak.
    const kenglik = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    assert.ok(
      kenglik.scroll <= kenglik.client + 1,
      `${ekran.nomi}: gorizontal siljish bor (${kenglik.scroll} > ${kenglik.client})`
    );

    // 2. Kiritish maydoni ko'rinib turishi kerak (ekran ostiga tushib ketmasin).
    const kompozer = page.getByLabel("Savolingizni yozing");
    await kompozer.waitFor({ state: "visible" });
    const quti = await kompozer.boundingBox();
    assert.ok(quti, "kiritish maydoni topilmadi");
    assert.ok(
      quti!.y + quti!.height <= ekran.height,
      `${ekran.nomi}: kiritish maydoni ekran ostida qolgan (${quti!.y + quti!.height} > ${ekran.height})`
    );

    // 3. Mobil pastki tab-bar bilan ustma-ust tushmasligi kerak.
    if (ekran.width < 1024) {
      const nav = await page.locator("nav.fixed.bottom-0").first().boundingBox();
      assert.ok(nav, "pastki tab-bar topilmadi");
      assert.ok(
        quti!.y + quti!.height <= nav!.y + 1,
        `${ekran.nomi}: kiritish maydoni pastki menyu bilan ustma-ust`
      );
    }

    // 4. Bosh ekran elementlari: tayyor savollar va davr tanlagichi.
    assert.ok(
      await page.getByRole("button", { name: "Bugun nima bo'ldi?" }).first().isVisible(),
      "tayyor savol chipi ko'rinmayapti"
    );
    const davr = ekran.width < 1024 ? page.getByLabel("Davr") : page.getByRole("tab", { name: "Bu oy" });
    assert.ok(await davr.first().isVisible(), "davr tanlagichi ko'rinmayapti");

    // 5. Teginish zonalari kamida 44px (mobil talab).
    if (ekran.width < 768) {
      const chip = await page.getByRole("button", { name: "Bugun nima bo'ldi?" }).first().boundingBox();
      assert.ok(chip && chip.height >= 44, `tayyor savol tugmasi juda past: ${chip?.height}px`);
    }

    await page.context().close();
  });
}

/** `/api/ai/chat` javobini brauzerda almashtiradi (model chaqirilmaydi). */
async function javobniQalbakilashtir(page: Page, javob: unknown, status = 200) {
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(javob) })
  );
}

test("375px: AI javobi metrik qatorlar, havola va chiplar bilan chiziladi", { skip: sabab }, async () => {
  const page = await aiSahifasi(375, 667);
  await javobniQalbakilashtir(page, {
    javob:
      "Avgust holati:\nKirim: 138,3 mln so'm\nChiqim: 100,8 mln so'm\nSof natija: 37,5 mln so'm\n" +
      "• Eng katta chiqim: Yodgor — 18,03 mln so'm",
    havolalar: [{ yorliq: "Tranzaksiyalarni ko'rish", href: "/app/tranzaksiyalar?turi=chiqim" }],
    takliflar: ["O'tgan oy bilan solishtir", "Eng katta chiqimlar qaysi?"],
    suhbatId: "s_e2e",
    sarlavha: "Bu oy qanday o'tyapti?",
    qoldi: 49,
  });

  await page.getByLabel("Savolingizni yozing").fill("Bu oy biznesim qanday ishladi?");
  await page.getByRole("button", { name: "Yuborish" }).click();

  await page.getByText("Sof natija", { exact: false }).first().waitFor({ timeout: 30_000 });
  const matn = await page.locator("body").innerText();
  assert.ok(matn.includes("138,3 mln so'm"), "moliyaviy raqam ko'rinishi kerak");
  assert.ok(matn.includes("Bu oy biznesim qanday ishladi?"), "savol lentada qoladi");

  // Drill-down havolasi — haqiqiy ilova sahifasiga.
  const havola = page.getByRole("link", { name: "Tranzaksiyalarni ko'rish" });
  assert.ok(await havola.isVisible());
  assert.match((await havola.getAttribute("href")) ?? "", /^\/app\/tranzaksiyalar/);

  // Keyingi qadam chiplari.
  assert.ok(await page.getByRole("button", { name: "O'tgan oy bilan solishtir" }).isVisible());

  // Uzun javob ekran chetidan chiqib ketmasin.
  const kenglik = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  assert.ok(kenglik.scroll <= kenglik.client + 1, "javob chizilgach gorizontal siljish paydo bo'ldi");

  await page.context().close();
});

test("375px: xatolik tushunarli ko'rsatiladi va qayta urinish taklif qilinadi", { skip: sabab }, async () => {
  const page = await aiSahifasi(375, 667);
  await javobniQalbakilashtir(page, { error: "Ma'lumotlarni tahlil qilishda xatolik yuz berdi." }, 502);

  await page.getByLabel("Savolingizni yozing").fill("Bu oy foyda qancha?");
  await page.getByRole("button", { name: "Yuborish" }).click();

  await page.getByText("Ma'lumotlarni tahlil qilishda xatolik", { exact: false }).first().waitFor({ timeout: 30_000 });
  assert.ok(await page.getByRole("button", { name: "Qayta urinish" }).first().isVisible());

  const matn = await page.locator("body").innerText();
  assert.ok(!/stack|Error:|at async/i.test(matn), "texnik tafsilot ekranga chiqmasligi kerak");
  assert.ok(matn.includes("Bu oy foyda qancha?"), "savol yo'qolmasligi kerak");

  await page.context().close();
});

test("390px: suhbatlar tarixi drawer sifatida ochiladi va yopiladi", { skip: sabab }, async () => {
  const page = await aiSahifasi(390, 844);

  await page.getByRole("button", { name: "Suhbatlar tarixi" }).click();
  const drawer = page.getByRole("dialog", { name: "Suhbatlar tarixi" });
  await drawer.waitFor({ timeout: 10_000 });
  assert.ok(await drawer.getByRole("button", { name: "Yangi suhbat" }).isVisible());

  await drawer.getByRole("button", { name: "Yopish" }).click();
  await drawer.waitFor({ state: "hidden", timeout: 10_000 });

  await page.context().close();
});
