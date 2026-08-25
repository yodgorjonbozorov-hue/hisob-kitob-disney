/**
 * BIZNESLAR SAHIFASI — BRAUZER (responsiv) TESTLARI.
 *
 * Unit testlar mantiqni qo'riqlaydi, bu esa KO'RINISHNI: 375px telefonda
 * jadval siqilib qolmaganini, sahifa yon tomonga surilmasligini, "•••"
 * menyusida xavfli amal YO'Qligini va xavfli zona faqat nom yozilgandan
 * keyin ochilishini.
 *
 * Ishga tushirish:
 *   npm run build          (bir marta, .next kerak)
 *   npm run test:bizneslar-brauzer
 *
 * `.next` yo'q bo'lsa testlar o'tkazib yuboriladi (smoke bilan bir xil qoida).
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

/** Tekshiriladigan ekran kengliklari (talab 35). */
const KENGLIKLAR = [1440, 1280, 768, 390, 375];

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

  // UZUN NOM va 20+ BIZNES holatlari uchun qo'shimcha yozuvlar — ro'yxat,
  // qidiruv va sahifalash haqiqiy hajmda sinaladi.
  const seed = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", "scripts/e2e-bizneslar.ts"],
    { encoding: "utf8", env: { ...process.env, DATABASE_URL: "file:./prisma/e2e.db", DATABASE_AUTH_TOKEN: "" } }
  );
  assert.equal(seed.status, 0, `bizneslar ekilmadi:\n${seed.stdout}\n${seed.stderr}`);

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

async function kirganSahifa(kenglik: number): Promise<Page> {
  const kontekst = await browser!.newContext({
    baseURL: ASOS,
    locale: "uz-UZ",
    viewport: { width: kenglik, height: 900 },
  });
  const page = await kontekst.newPage();
  await page.goto(`${ASOS}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL("**/app**", { timeout: 60_000 });
  return page;
}

/** Sahifa YON TOMONGA surilmasligi — mobil uchun asosiy talab. */
async function gorizontalSiljishYoq(page: Page, qayerda: string) {
  const oshdi = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  assert.ok(oshdi <= 1, `${qayerda}: sahifa yon tomonga suriladi (${oshdi}px ortiqcha)`);
}

// ---------- Responsiv ko'rinish ----------
for (const kenglik of KENGLIKLAR) {
  test(`${kenglik}px: ro'yxat ochiladi, gorizontal siljish yo'q`, { skip: sabab }, async () => {
    const page = await kirganSahifa(kenglik);
    await page.goto(`${ASOS}/app/admin/bizneslar`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1");
    assert.equal((await page.locator("h1").first().innerText()).trim(), "Bizneslar");
    await page.waitForSelector("text=Barcha bizneslaringizni bir joydan boshqaring");

    await gorizontalSiljishYoq(page, `${kenglik}px ro'yxat`);

    // <1024px — jadval EMAS, kartochkalar; ≥1024px — jadval.
    const jadvalKorinadi = await page.locator("table").first().isVisible().catch(() => false);
    if (kenglik >= 1024) {
      assert.ok(jadvalKorinadi, "desktopda jadval ko'rinishi kerak");
    } else {
      assert.ok(!jadvalKorinadi, "mobilda jadval ko'rsatilmasligi kerak (kartochka)");
      const kartalar = await page.getByRole("link", { name: "Biznesni ochish" }).count();
      assert.ok(kartalar > 0, "mobilda biznes kartochkalari bo'lishi kerak");
    }
    await page.context().close();
  });
}

test("375px: tafsilot, bo'limlar va xavfli zona siljimaydi", { skip: sabab }, async () => {
  const page = await kirganSahifa(375);
  await page.goto(`${ASOS}/app/admin/bizneslar`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Biznesni ochish" }).first().click();
  await page.waitForSelector("text=Biznesga o'tish");
  await gorizontalSiljishYoq(page, "375px tafsilot");

  // Mobilda bo'limlar tab emas — navigatsiya kartochkalari.
  await page.getByRole("button", { name: /Modullar/ }).first().click();
  await page.waitForSelector("text=Shu biznes uchun");
  await gorizontalSiljishYoq(page, "375px modullar");

  await page.getByRole("button", { name: /Bo'limlar/ }).first().click();
  await page.getByRole("button", { name: /Xavfsizlik/ }).first().click();
  await page.waitForSelector("text=Biznesni butunlay o'chirish");
  await gorizontalSiljishYoq(page, "375px xavfli zona");
  await page.context().close();
});

// ---------- Qidiruv va filtr ----------
test("qidiruv va filtr ro'yxatni to'g'ri qisqartiradi", { skip: sabab }, async () => {
  const page = await kirganSahifa(1440);
  await page.goto(`${ASOS}/app/admin/bizneslar`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("table");

  const boshlangich = await page.locator("tbody tr").count();
  assert.ok(boshlangich >= 10, `20+ biznes stsenariysi uchun kamida 10 qator kutilgan, ${boshlangich}`);

  await page.getByPlaceholder("Biznes nomi bo'yicha qidirish...").fill("Filial 3");
  await page.waitForTimeout(300);
  const topilgan = await page.locator("tbody tr").count();
  assert.ok(topilgan > 0 && topilgan < boshlangich, "qidiruv ro'yxatni qisqartirishi kerak");

  await page.getByPlaceholder("Biznes nomi bo'yicha qidirish...").fill("");
  await page.getByRole("button", { name: /^Nofaol/ }).click();
  await page.waitForTimeout(300);
  const nofaol = await page.locator("tbody tr").count();
  assert.ok(nofaol < boshlangich, "Nofaol filtri faqat nofaol bizneslarni ko'rsatishi kerak");
  await page.context().close();
});

// ---------- "•••" menyusi ----------
test("qatorda xavfli amal YO'Q — faqat 'Ochish' va '•••'", { skip: sabab }, async () => {
  const page = await kirganSahifa(1440);
  await page.goto(`${ASOS}/app/admin/bizneslar`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("table");

  const qator = (await page.locator("tbody tr").first().innerText()).toLowerCase();
  for (const taqiq of ["o'chirish", "tozalash", "omborni yoqish", "kassani yoqish", "avto rejim"]) {
    assert.ok(!qator.includes(taqiq), `qatorda "${taqiq}" turmasligi kerak`);
  }

  await page.getByRole("button", { name: /boshqa amallar/ }).first().click();
  const menyu = page.getByRole("menu");
  await menyu.waitFor();
  const matn = await menyu.innerText();
  for (const kutilgan of ["Sozlamalar", "Modullar", "Xodimlar", "Kassa sozlamalari", "Ombor sozlamalari"]) {
    assert.ok(matn.includes(kutilgan), `menyuda "${kutilgan}" bo'lishi kerak`);
  }
  assert.ok(/Nofaollashtirish|Faollashtirish/.test(matn));
  // Xavfli amalning O'ZI menyuda emas — faqat xavfli zonaga havola.
  assert.ok(!matn.includes("Ma'lumotlarni tozalash"), "tozalash amali menyuda bo'lmasligi kerak");
  await page.context().close();
});

// ---------- Xavfli zona ----------
test("xavfli zona: nom yozilmaguncha o'chirish tugmasi o'chiq", { skip: sabab }, async () => {
  const page = await kirganSahifa(1440);
  await page.goto(`${ASOS}/app/admin/bizneslar`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("table");
  await page.getByRole("link", { name: "Ochish" }).first().click();
  await page.waitForSelector("text=Biznesga o'tish");

  await page.getByRole("tab", { name: "Xavfsizlik" }).click();
  await page.getByRole("button", { name: /^O'chirish…$/ }).click();
  const tugma = page.getByRole("button", { name: "Biznesni butunlay o'chirish" });
  await tugma.waitFor();
  assert.equal(await tugma.isDisabled(), true, "nom yozilmagan holda tugma o'chiq bo'lishi kerak");

  await page.getByPlaceholder(/.+/).last().fill("noto'g'ri nom");
  assert.equal(await tugma.isDisabled(), true, "noto'g'ri nomda ham o'chiq qolishi kerak");
  await page.context().close();
});

// ---------- Setup wizard ----------
test("wizard: qadamlar bo'yicha yangi biznes yaratiladi", { skip: sabab }, async () => {
  const page = await kirganSahifa(390);
  await page.goto(`${ASOS}/app/admin/bizneslar`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");

  await page.getByRole("button", { name: /Yangi/ }).first().click();
  await page.locator("#wiz-nomi").fill("Wizard sinov biznesi");
  await gorizontalSiljishYoq(page, "390px wizard");
  await page.getByRole("button", { name: "Davom etish" }).click();

  await page.waitForSelector("text=Kirim / chiqim va qarzlar");
  await page.getByRole("button", { name: "Davom etish" }).click();

  await page.waitForSelector("text=Boshlang'ich kassa nomi");
  await page.getByRole("button", { name: "Biznesni yaratish" }).click();

  await page.waitForSelector("text=Xodimlar biznes yaratilgandan keyin biriktiriladi", {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Keyin qo'shaman" }).click();
  await page.waitForSelector("text=Biznes tayyor");
  await page.context().close();
});
