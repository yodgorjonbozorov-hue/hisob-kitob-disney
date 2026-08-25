/**
 * FOYDALANUVCHILAR SAHIFASI — BRAUZERDA RESPONSIV TEKSHIRUV.
 *
 * Bu sahifaning eng qat'iy talabi: TELEFONDA JADVAL BO'LMASIN. 375px
 * ekranda 7 ustunli jadval gorizontal siljishga aylanadi va "Holati" bilan
 * "Amal" ustunlari umuman ko'rinmay qoladi — ya'ni xodimni boshqarib
 * bo'lmaydi. Buni kod o'qib tekshirib bo'lmaydi, faqat haqiqiy brauzerda.
 *
 * Ishga tushirish:
 *   npm run build           (bir marta, .next kerak)
 *   npm run test:foydalanuvchilar-e2e
 *
 * `.next` yo'q bo'lsa testlar o'tkazib yuboriladi (smoke to'plamidagidek).
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { connect } from "node:net";
import type { Browser, Page } from "playwright";

const PORT = 3102;
const ASOS = `http://127.0.0.1:${PORT}`;
const LOGIN = "admin";
const PAROL = "admin123";
const YOL = "/app/admin/foydalanuvchilar";

const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

const qurilgan = existsSync(".next/BUILD_ID");
const sabab = qurilgan ? undefined : "`.next` yo'q — avval `npm run build` qiling";

let server: ChildProcess | undefined;
let browser: Browser | undefined;

/** Tekshiriladigan ekran kengliklari — desktopdan eng tor telefongacha. */
const KENGLIKLAR = [1440, 1280, 768, 390, 375];
/** Tailwind `lg` chegarasi — jadval faqat shundan kengda ko'rinadi. */
const JADVAL_CHEGARASI = 1024;

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

/** Serverni butun jarayon daraxti bilan o'chiradi (smoke to'plamidagi izohga qarang). */
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
  if (!server?.pid) return;
  ochir();
  await portBoshaguncha(PORT, 10);
});

/** Kirgan holda, berilgan kenglikdagi sahifani ochadi. */
async function sahifa(kenglik: number, balandlik = 800): Promise<Page> {
  const kontekst = await browser!.newContext({
    baseURL: ASOS,
    locale: "uz-UZ",
    viewport: { width: kenglik, height: balandlik },
    // 375px — iPhone SE/mini; barmoq bilan ishlash rejimi.
    hasTouch: kenglik < 768,
  });
  const page = await kontekst.newPage();
  await page.goto(`${ASOS}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL("**/app**", { timeout: 60_000 });

  // Next.js yon menyudagi havolalarni fonda oldindan yuklaydi; darhol
  // navigatsiya qilish o'sha so'rovlarni bekor qiladi va sahifa `error.tsx`
  // ga tushishi mumkin. Smoke to'plamidagidek — uch urinish.
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(`${ASOS}${YOL}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("h1", { timeout: 30_000 });
      if ((await page.locator("h1").first().innerText()).trim() !== "Tizim yangilandi") return page;
    } catch {
      // qayta urinamiz
    }
    await page.waitForTimeout(700);
  }
  throw new Error(`${YOL} uch urinishda ham ochilmadi (${kenglik}px)`);
}

// ---------------------------------------------------------------------------
// 1. RESPONSIV: gorizontal siljish yo'q, telefonda jadval yo'q
// ---------------------------------------------------------------------------

for (const kenglik of KENGLIKLAR) {
  test(`${kenglik}px — sahifa yon tomonga surilmaydi`, { skip: sabab }, async () => {
    const page = await sahifa(kenglik);
    const olcham = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    assert.ok(
      olcham.scroll <= olcham.client + 1,
      `${kenglik}px: sahifa gorizontal suriladi (${olcham.scroll} > ${olcham.client})`
    );
    await page.context().close();
  });

  test(`${kenglik}px — jadval faqat keng ekranda`, { skip: sabab }, async () => {
    const page = await sahifa(kenglik);
    const jadval = page.locator("table");
    const kartochkalar = page.locator("ul.lg\\:hidden > li");

    if (kenglik >= JADVAL_CHEGARASI) {
      await jadval.first().waitFor({ state: "visible", timeout: 15_000 });
      assert.equal(await kartochkalar.count() > 0 && (await kartochkalar.first().isVisible()), false,
        "keng ekranda kartochkalar ko'rinmasligi kerak");
    } else {
      // Jadval DOM'da qolishi mumkin (`hidden lg:block`), lekin KO'RINMASLIGI
      // shart — ko'rinsa 375px da gorizontal siljish paydo bo'ladi.
      const korinadi = (await jadval.count()) > 0 && (await jadval.first().isVisible());
      assert.equal(korinadi, false, "telefonda jadval ko'rinmasligi kerak");
      assert.ok((await kartochkalar.count()) > 0, "telefonda kartochka ro'yxati bo'lishi kerak");
    }
    await page.context().close();
  });
}

// ---------------------------------------------------------------------------
// 2. 375px — barmoq nishonlari va asosiy oqim
// ---------------------------------------------------------------------------

test("375px — qidiruv va amal tugmalari kamida 44px", { skip: sabab }, async () => {
  const page = await sahifa(375);
  const qidiruv = await page.getByLabel("Xodimlarni qidirish").boundingBox();
  assert.ok((qidiruv?.height ?? 0) >= 44, `qidiruv maydoni past: ${qidiruv?.height}`);

  const menyu = await page.getByRole("button", { name: /amallar$/ }).first().boundingBox();
  assert.ok((menyu?.height ?? 0) >= 44, `"•••" tugmasi past: ${menyu?.height}`);
  assert.ok((menyu?.width ?? 0) >= 44, `"•••" tugmasi tor: ${menyu?.width}`);
  await page.context().close();
});

test("375px — kartochka bosilganda tafsilot varag'i ochiladi", { skip: sabab }, async () => {
  const page = await sahifa(375);
  await page.locator("ul.lg\\:hidden > li button").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 15_000 });
  const matn = await dialog.innerText();
  for (const bolim of ["Login", "Rol", "Bizneslar", "Oxirgi kirish"]) {
    assert.ok(matn.includes(bolim), `tafsilotda "${bolim}" bo'lishi kerak`);
  }
  assert.ok(matn.includes("Tahrirlash"), "tafsilotda Tahrirlash tugmasi bo'lishi kerak");
  await page.context().close();
});

test("375px — «•••» menyusida barcha amallar bor", { skip: sabab }, async () => {
  const page = await sahifa(375);
  await page.getByRole("button", { name: /amallar$/ }).first().click();
  const menyu = page.getByRole("menu");
  await menyu.waitFor({ state: "visible", timeout: 15_000 });
  const matn = await menyu.innerText();
  for (const amal of [
    "Tahrirlash",
    "Loginni o'zgartirish",
    "Parolni tiklash",
    "Nofaollashtirish",
    "O'chirish",
  ]) {
    assert.ok(matn.includes(amal), `menyuda "${amal}" bo'lishi kerak`);
  }
  await page.context().close();
});

test("375px — yangi xodim oynasi qadamma-qadam ochiladi", { skip: sabab }, async () => {
  const page = await sahifa(375);
  await page.getByRole("button", { name: "Yangi foydalanuvchi" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 15_000 });
  assert.match(await dialog.innerText(), /1 \/ \d+ — Ism/, "birinchi qadam — Ism");
  // Bir ekranda bitta savol: ism maydonidan boshqa matn maydoni bo'lmasin.
  assert.equal(
    await dialog.locator("input:not([type=checkbox]):not([type=radio])").count(),
    1,
    "bitta qadamda bitta maydon"
  );
  await page.context().close();
});

// ---------------------------------------------------------------------------
// 3. Qidiruv (server tomonda) va desktop ustunlari
// ---------------------------------------------------------------------------

test("qidiruv ro'yxatni toraytiradi", { skip: sabab }, async () => {
  const page = await sahifa(1440);
  const qatorlar = page.locator("table tbody tr");
  const boshida = await qatorlar.count();
  assert.ok(boshida >= 2, "sinov bazasida kamida ikki xodim bo'lishi kerak");

  await page.getByLabel("Xodimlarni qidirish").fill("bunday-xodim-yoq-12345");
  await page.getByText("Hech kim topilmadi").waitFor({ timeout: 15_000 });

  await page.getByLabel("Xodimlarni qidirish").fill("");
  await page.locator("table tbody tr").first().waitFor({ timeout: 15_000 });
  assert.equal(await page.locator("table tbody tr").count(), boshida, "tozalangach qaytadi");
  await page.context().close();
});

test("desktop jadvalda kerakli ustunlar bor, moliya ustunlari yo'q", { skip: sabab }, async () => {
  const page = await sahifa(1440);
  // Sarlavhalar CSS bilan BOSH HARFGA o'giriladi — solishtirish registrsiz.
  const sarlavhalar = (await page.locator("table thead th").allInnerTexts()).map((s) =>
    s.trim().toLowerCase()
  );
  assert.deepEqual(sarlavhalar, [
    "xodim",
    "login",
    "rol",
    "biznes",
    "holati",
    "qo'shilgan",
    "amal",
  ]);
  for (const yoq of ["balans", "qarz", "yozuvlar"]) {
    assert.ok(!sarlavhalar.includes(yoq), `"${yoq}" ustuni bo'lmasligi kerak`);
  }
  await page.context().close();
});

test("rol jadval ichida tanlagich EMAS (tasodifan o'zgarmasin)", { skip: sabab }, async () => {
  const page = await sahifa(1440);
  assert.equal(
    await page.locator("table select").count(),
    0,
    "jadval ichida rol tanlagichi bo'lmasligi kerak"
  );
  await page.context().close();
});
