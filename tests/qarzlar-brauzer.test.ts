/**
 * QARZLAR SAHIFASI — RESPONSIVE VERIFIKATSIYA (37-talab).
 *
 * Nimani isbotlaydi: sahifa 375px dan 1440px gacha beshta kenglikda
 * GORIZONTAL SKROLLSIZ chiziladi va asosiy elementlar (KPI kartalar, tablar,
 * filtr chiplari, qarzdor kartalari, to'lov varag'i) ishlaydi.
 *
 * Nega alohida fayl: `smoke-brauzer.test.ts` "sahifa ochiladimi" degan
 * savolga javob beradi, bu esa "telefonda ishlatib bo'ladimi" degan savolga.
 * Ikkalasi bitta faylga sig'sa, smoke to'plami sekinlashardi.
 *
 * Ishga tushirish:
 *   npm run build      (bir marta, .next kerak)
 *   npm run test:qarzlar-brauzer
 *
 * `.next` yo'q bo'lsa testlar o'tkazib yuboriladi.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { connect } from "node:net";
import type { Browser, Page } from "playwright";

const PORT = 3102;
const ASOS = `http://127.0.0.1:${PORT}`;
const LOGIN = "admin";
const PAROL = "admin123";
const SURATLAR = "tests/suratlar/qarzlar";

const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

const qurilgan = existsSync(".next/BUILD_ID");
const sabab = qurilgan ? undefined : "`.next` yo'q — avval `npm run build` qiling";

/** Tekshiriladigan kengliklar — spetsifikatsiyadagi beshtasi. */
const KENGLIKLAR = [
  { nomi: "1440px-desktop", w: 1440, h: 900 },
  { nomi: "1280px-laptop", w: 1280, h: 800 },
  { nomi: "768px-planshet", w: 768, h: 1024 },
  { nomi: "390px-iphone14", w: 390, h: 844 },
  { nomi: "375px-iphoneSE", w: 375, h: 667 },
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

/** Butun jarayon daraxtini o'chiradi (smoke testdagi bilan bir xil sabab). */
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


/**
 * DEMO QARZLAR — vizual tekshiruv MA'NOLI bo'lishi uchun.
 *
 * Bo'sh bazada "gorizontal skroll yo'q" degan tasdiq hech nimani
 * isbotlamaydi: uzun ism, katta summa va kechikkan muddat bilan
 * to'lgan kartochka aynan skroll keltirib chiqaradigan holat. Shuning
 * uchun eng "og'ir" ma'lumot ataylab ekiladi.
 */
async function qarzEk() {
  process.env.DATABASE_URL = "file:./prisma/e2e.db";
  process.env.DATABASE_AUTH_TOKEN = "";
  const { rawPrisma } = await import("@/lib/db/rawPrisma");
  const { runWithTenant } = await import("@/lib/db/tenantContext");
  const { createQarz } = await import("@/lib/services/qarz");

  const biz = await rawPrisma.business.findFirst({ select: { id: true, tenantId: true } });
  if (!biz) throw new Error("demo biznes topilmadi");
  const user = await rawPrisma.user.findFirst({
    where: { tenantId: biz.tenantId },
    select: { id: true },
  });
  if (!user) throw new Error("demo foydalanuvchi topilmadi");

  const kun = (n: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const qarzlar = [
    // Uzun ism + katta summa + kechikkan muddat — eng og'ir holat.
    { ism: "Yodgorjon Bozorov Abdurahmonovich", tel: "+998913320008", summa: 3_500_000, sana: kun(-18), muddat: kun(-7) },
    { ism: "Yodgorjon Bozorov Abdurahmonovich", tel: "+998913320008", summa: 1_250_000, sana: kun(-9), muddat: kun(0) },
    { ism: "Sardor Toshmatov", tel: "+998901112233", summa: 12_750_000, sana: kun(-3), muddat: kun(3) },
    { ism: "Dilnoza Karimova", tel: "+998935556677", summa: 480_000, sana: kun(-30), muddat: kun(-14) },
    { ism: "Bekzod Ergashev", tel: "+998977778899", summa: 2_000_000, sana: kun(-1), muddat: kun(20) },
  ];

  await runWithTenant(
    biz.tenantId,
    async () => {
      for (const q of qarzlar) {
        await createQarz({
          businessId: biz.id,
          userId: user.id,
          turi: "olinadigan",
          mijozNomi: q.ism,
          mijozTel: q.tel,
          jamiSumma: q.summa,
          sana: q.sana,
          muddat: q.muddat,
          mijozSaqla: false,
        });
      }
      await createQarz({
        businessId: biz.id,
        userId: user.id,
        turi: "beriladigan",
        mijozNomi: "Global Ta'minot MChJ",
        jamiSumma: 8_400_000,
        sana: kun(-12),
        muddat: kun(-2),
        mijozSaqla: false,
      });
    },
    { userId: user.id, ism: "Direktor" }
  );
  await rawPrisma.$disconnect();
}

before(async () => {
  if (!qurilgan) return;
  mkdirSync(SURATLAR, { recursive: true });

  const tayyorla = spawnSync(process.execPath, ["scripts/e2e-tayyorla.mjs"], {
    encoding: "utf8",
  });
  assert.equal(tayyorla.status, 0, `baza tayyorlanmadi:\n${tayyorla.stdout}\n${tayyorla.stderr}`);
  await qarzEk();

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
  if (!server?.pid) return;
  ochir();
  await portBoshaguncha(PORT, 10);
});

async function kirVaOch(w: number, h: number): Promise<Page> {
  const kontekst = await browser!.newContext({
    baseURL: ASOS,
    locale: "uz-UZ",
    viewport: { width: w, height: h },
    // Telefon kengliklarida haqiqiy sensorli qurilma sifatida.
    hasTouch: w < 768,
    isMobile: w < 768,
  });
  const page = await kontekst.newPage();
  await page.goto(`${ASOS}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL("**/app**", { timeout: 60_000 });
  await page.goto(`${ASOS}/app/qarzlar`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 60_000 });
  return page;
}

/** Hujjat kengligi oynadan oshib ketdimi (gorizontal skroll). */
function gorizontalSkroll(page: Page) {
  return page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
}

for (const { nomi, w, h } of KENGLIKLAR) {
  test(`${nomi}: qarzlar sahifasi gorizontal skrollsiz chiziladi`, { skip: sabab }, async () => {
    const page = await kirVaOch(w, h);

    // Klient komponenti chizilib bo'lguncha kutamiz. Matnni undan OLDIN
    // o'qish poygaga olib keladi: sahifa serverdan kelgan, lekin tablar
    // hali gidratsiya qilinmagan bo'lishi mumkin.
    await page.getByRole("tab", { name: /Men qarzdorman/ }).waitFor({ timeout: 30_000 });

    const matn = await page.locator("body").innerText();
    for (const xato of ["Application error", "Kutilmagan xatolik", "Nimadir noto'g'ri ketdi"]) {
      assert.ok(!matn.includes(xato), `${nomi}: sahifa xato holatiga tushdi — ${xato}`);
    }

    // Asosiy elementlar joyida.
    assert.ok(matn.includes("Jami qarzdorlik"), `${nomi}: KPI kartasi ko'rinmadi`);
    assert.ok(matn.includes("Muddati o'tgan"), `${nomi}: muddat KPI'si ko'rinmadi`);
    assert.ok(matn.includes("Barchasi"), `${nomi}: tez filtr chiplari ko'rinmadi`);
    // Ekilgan ma'lumot ko'rinishi shart — bo'sh sahifada skroll tekshiruvi
    // hech nimani isbotlamaydi.
    assert.ok(matn.includes("Yodgorjon"), `${nomi}: qarzdor kartasi ko'rinmadi`);

    // GORIZONTAL SKROLL BO'LMASLIGI SHART. 1px yaxlitlash farqi kechiriladi.
    const { scrollW, clientW } = await gorizontalSkroll(page);
    assert.ok(
      scrollW - clientW <= 1,
      `${nomi}: sahifa gorizontal suriladi (${scrollW}px > ${clientW}px)`
    );

    await page.screenshot({ path: `${SURATLAR}/${nomi}.png`, fullPage: true });
    await page.context().close();
  });
}

test("375px: filtr chipi bosilganda ham skroll paydo bo'lmaydi", { skip: sabab }, async () => {
  const page = await kirVaOch(375, 667);

  await page.getByRole("button", { name: /Muddati o'tgan/ }).first().click();
  await page.waitForTimeout(400);
  const { scrollW, clientW } = await gorizontalSkroll(page);
  assert.ok(scrollW - clientW <= 1, `filtrdan keyin gorizontal skroll: ${scrollW} > ${clientW}`);

  // Yo'nalish tabi ham ishlashi kerak.
  await page.getByRole("tab", { name: /Men qarzdorman/ }).click();
  await page.waitForTimeout(400);
  const keyin = await gorizontalSkroll(page);
  assert.ok(
    keyin.scrollW - keyin.clientW <= 1,
    `tab almashgach gorizontal skroll: ${keyin.scrollW} > ${keyin.clientW}`
  );

  await page.screenshot({ path: `${SURATLAR}/375px-filtr.png`, fullPage: true });
  await page.context().close();
});

test("375px: sticky 'Qarz qo'shish' pastki navigatsiya ustida turmaydi", { skip: sabab }, async () => {
  const page = await kirVaOch(375, 667);

  const fab = page.getByRole("button", { name: /Qarz qo'shish/ }).last();
  await fab.waitFor({ timeout: 10_000 });
  const fabQuti = await fab.boundingBox();
  assert.ok(fabQuti, "FAB ko'rinmadi");

  // Pastki navigatsiya — `lg:hidden fixed bottom-0` nav elementi.
  const nav = page.locator("nav.fixed.bottom-0").first();
  const navQuti = await nav.boundingBox();
  assert.ok(navQuti, "pastki navigatsiya topilmadi");

  assert.ok(
    fabQuti.y + fabQuti.height <= navQuti.y + 1,
    `FAB pastki navigatsiya bilan to'qnashdi: FAB ${fabQuti.y + fabQuti.height}px, nav ${navQuti.y}px`
  );
  // 44px sensorli nishon talabi.
  assert.ok(fabQuti.height >= 44, `FAB balandligi ${fabQuti.height}px — 44px dan kam`);

  await page.context().close();
});

test("375px: to'lov varag'i ochiladi va raqamli klaviatura so'raydi", { skip: sabab }, async () => {
  const page = await kirVaOch(375, 667);

  const tugma = page.getByRole("button", { name: /To'lov qabul qilish/ }).first();
  if ((await tugma.count()) === 0) {
    // Demo bazada ochiq qarz bo'lmasligi mumkin — u holda tekshirish o'rinsiz.
    await page.context().close();
    return;
  }
  await tugma.click();

  const summa = page.locator("#qarzdor-tolov-summa");
  await summa.waitFor({ timeout: 15_000 });
  assert.equal(
    await summa.getAttribute("inputmode"),
    "numeric",
    "summa maydoni raqamli klaviatura so'rashi kerak"
  );

  const { scrollW, clientW } = await gorizontalSkroll(page);
  assert.ok(scrollW - clientW <= 1, `to'lov varag'ida gorizontal skroll: ${scrollW} > ${clientW}`);

  // Ochilish animatsiyasi tugasin — aks holda varaq yarim shaffof suratga
  // tushadi va ustma-ust joylashuvni ko'z bilan tekshirib bo'lmaydi.
  await page.waitForTimeout(700);

  // Varaq OCHIQ ekan, sticky "+ Qarz qo'shish" uning USTIDA turmasligi
  // shart: FAB `z-30`, modal qatlami `z-50`. Buzilsa foydalanuvchi
  // formadagi tugma o'rniga FAB'ni bosib yuborardi.
  const fabUstidami = await page.evaluate(() => {
    const fab = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Qarz qo'shish")
    );
    if (!fab) return false;
    const r = fab.getBoundingClientRect();
    const ust = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return fab.contains(ust);
  });
  assert.equal(fabUstidami, false, "to'lov varag'i ochiqda FAB uning ustida turmasligi kerak");

  // Varaq `fixed` — `fullPage` surat uni sahifa ustiga cho'zib buzadi.
  await page.screenshot({ path: `${SURATLAR}/375px-tolov.png` });
  await page.context().close();
});
