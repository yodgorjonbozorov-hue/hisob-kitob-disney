/**
 * SMOKE (BRAUZER) — sahifalar haqiqatan ochiladimi.
 *
 * Loyihadagi qolgan 37 to'plam mantiqni tekshiradi va ularning HAMMASI kod
 * darajasida ishlaydi. "Foydalanuvchi kirib, chiqim qo'shib, hisobotni
 * ochsa ishlaydimi" degan savol shu paytgacha umuman sinalmagan edi.
 * Server komponentining yiqilishi, yo'q sahifa, yoqilgan bo'lsa ham
 * ochilmaydigan modul — bularning birortasi unit testda ko'rinmaydi.
 *
 * Ishga tushirish:
 *   npm run build          (bir marta, .next kerak)
 *   npm run test:smoke
 *
 * `.next` yo'q bo'lsa testlar o'tkazib yuboriladi — build qilinmagan
 * mashinada to'plam qizil bo'lib qolmasligi uchun.
 *
 * NEGA `node:test` (Playwright runner emas): loyihada `@playwright/test`
 * yo'q, faqat `playwright` kutubxonasi bor. Yangi runner va uning
 * konfiguratsiyasini olib kirish o'rniga mavjud uslub saqlandi — barcha
 * boshqa testlar ham `node:test` da.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import type { Browser, Page } from "playwright";

const PORT = 3100;
const ASOS = `http://127.0.0.1:${PORT}`;
const LOGIN = "admin";
const PAROL = "admin123";

/**
 * Muhitda oldindan o'rnatilgan Chromium. `playwright` paketi o'zining
 * revizyasini kutadi (bu mashinada boshqasi turibdi), shuning uchun yo'l
 * ochiq beriladi — brauzer yuklab olinmaydi.
 */
// Yo'l topilmasa (masalan Windows) — Playwright o'zi o'rnatgan Chromium ishlatiladi.
const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

const qurilgan = existsSync(".next/BUILD_ID");
const sabab = qurilgan ? undefined : "`.next` yo'q — avval `npm run build` qiling";

let server: ChildProcess | undefined;
let browser: Browser | undefined;

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

before(async () => {
  if (!qurilgan) return;

  // Har yurishda toza baza: testlar oldingi yurishdan qolgan yozuvga
  // tayanib qolmasligi kerak.
  const tayyorla = spawnSync(process.execPath, ["scripts/e2e-tayyorla.mjs"], {
    encoding: "utf8",
  });
  assert.equal(tayyorla.status, 0, `baza tayyorlanmadi:\n${tayyorla.stdout}\n${tayyorla.stderr}`);

  // Windows'da `npx` bajariladigan fayl emas (`npx.cmd`) — shell orqali topiladi.
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    shell: process.platform === "win32",
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

  await kut(`${ASOS}/login`, 90);

  const { chromium } = await import("playwright");
  browser = await chromium.launch({
    executablePath: BRAUZER_YOLI,
    args: ["--no-sandbox"],
  });
});

after(async () => {
  if (browser) await browser.close();
  if (server?.pid) {
    if (process.platform === "win32") {
      // shell:true bilan spawn qilinganda kill() faqat qobiq (shell)ni o'ldiradi,
      // next server bolasi tirik qoladi — butun daraxtni taskkill o'chiradi.
      spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"]);
    } else {
      server.kill("SIGTERM");
    }
  }
});

/** Yangi, sessiyasiz sahifa. */
async function yangiSahifa(): Promise<Page> {
  const kontekst = await browser!.newContext({ baseURL: ASOS, locale: "uz-UZ" });
  return kontekst.newPage();
}

/**
 * Sahifani ochadi va javobni qaytaradi.
 *
 * Qayta urinish BOR: Next.js klient routeri fon prefetch'i bilan navigatsiyani
 * bekor qilishi mumkin (`net::ERR_ABORTED`) — bu ilovaning nosozligi emas,
 * lekin testni beqaror qiladi. Uch marta urinib ham ochilmasa — bu haqiqiy
 * muammo va xato sifatida qaytadi.
 */
async function och(page: Page, yol: string) {
  let oxirgi: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      return await page.goto(`${ASOS}${yol}`, { waitUntil: "domcontentloaded" });
    } catch (e) {
      oxirgi = e;
      await page.waitForTimeout(700);
    }
  }
  throw oxirgi;
}

/** Sahifada Next.js xato ekrani yo'qligini tekshiradi. */
async function xatosiz(page: Page) {
  const matn = (await page.locator("body").innerText()).slice(0, 4000);
  assert.ok(!matn.includes("Application error"), "sahifa Application error ko'rsatdi");
  assert.ok(!matn.includes("Nimadir noto'g'ri ketdi"), "sahifa xato holatiga tushdi");
}

async function kir(page: Page) {
  await och(page, "/login");
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  // 60s: sekin mashinalarda (Windows, antivirus ostida) login ba'zan 20s dan oshadi.
  await page.waitForURL("**/app**", { timeout: 60_000 });
  // Sahifa chizilib bo'lguncha kutamiz — aks holda keyingi navigatsiya
  // yarim yuklangan sahifani uzib qo'yadi.
  await page.waitForSelector("h1", { timeout: 60_000 });
}

// ---------- Kirish ----------

test("noto'g'ri parol rad etiladi va sessiya berilmaydi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await page.goto(`${ASOS}/login`);
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill("butunlay-notogri-parol");
  await page.getByRole("button", { name: "Kirish" }).click();

  await page.waitForTimeout(1500);
  assert.match(page.url(), /\/login/, "login sahifasida qolishi kerak");

  const cookies = await page.context().cookies();
  assert.equal(
    cookies.find((c) => c.name === "balansa_session"),
    undefined,
    "muvaffaqiyatsiz kirishda sessiya cookie'si berilmasligi kerak"
  );
  await page.context().close();
});

test("to'g'ri parol bilan kiriladi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await kir(page);
  await page.waitForSelector("h1");
  assert.equal(await page.locator("h1").first().innerText(), "Boshqaruv paneli");
  await xatosiz(page);
  await page.context().close();
});

test("kirmasdan ichki sahifa ochilmaydi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await och(page, "/app/tranzaksiyalar");
  assert.match(page.url(), /\/login/, "sessiyasiz foydalanuvchi login'ga yo'naltirilishi kerak");
  await page.context().close();
});

// ---------- Modul sahifalari ----------

test("registry'dagi HAR bir nav havolasi ochiladi", { skip: sabab }, async () => {
  // Havolalar ro'yxati QO'LDA yozilmaydi — `MODULLAR` registry'sidan olinadi.
  // Sababi: sidebar, BottomNav va CommandPalette ham o'sha manbadan
  // generatsiya qilinadi, ya'ni bu yerdagi har bir yo'l foydalanuvchi
  // haqiqatan bosadigan havola. Yangi modul qo'shilsa test o'zi qamrab
  // oladi — ro'yxatni yangilash esdan chiqmaydi.
  const { MODULLAR } = (await import("../src/lib/modules/registry")) as typeof import("../src/lib/modules/registry");
  const yollar = [...new Set(MODULLAR.flatMap((m) => m.nav.map((n) => n.href)))].sort();
  assert.ok(yollar.length >= 20, `registry'da atigi ${yollar.length} havola — kutilmagan`);

  const page = await yangiSahifa();
  await kir(page);

  const xatolar: string[] = [];
  for (const yol of yollar) {
    try {
      const javob = await och(page, yol);
      const holat = javob?.status() ?? 0;
      if (holat >= 400) {
        xatolar.push(`${yol}: HTTP ${holat}`);
        continue;
      }
      await xatosiz(page);
    } catch (e) {
      xatolar.push(`${yol}: ${(e as Error).message.split("\n")[0]}`);
    }
  }

  await page.context().close();
  assert.deepEqual(
    xatolar,
    [],
    `${xatolar.length}/${yollar.length} havola ochilmadi:\n  ${xatolar.join("\n  ")}`
  );
});

test("yangi modul sahifalari to'g'ri sarlavha bilan ochiladi", { skip: sabab }, async () => {
  // Bular endigina ishga tushgan modullar — sahifalari shu paytgacha
  // brauzerda umuman ochilmagan edi. Sarlavha tekshiruvi "sahifa ochildi,
  // lekin bo'sh" holatini ushlaydi.
  const SAHIFALAR: Array<[string, string]> = [
    ["/app", "Boshqaruv paneli"],
    ["/app/tranzaksiyalar", "Tranzaksiyalar"],
    ["/app/hisobot", "Oylik hisobot"],
    ["/app/xarid", "Xarid"],
    ["/app/tasdiqlash", "Tasdiqlash"],
    ["/app/mijozlar", "Mijozlar"],
    ["/app/hr", "Xodimlar"],
    ["/app/hujjatlar", "Shartnomalar"],
  ];

  const page = await yangiSahifa();
  await kir(page);

  const xatolar: string[] = [];
  for (const [yol, sarlavha] of SAHIFALAR) {
    try {
      await och(page, yol);
      await page.waitForSelector("h1", { timeout: 10_000 });
      const bor = (await page.locator("h1").first().innerText()).trim();
      if (bor !== sarlavha) xatolar.push(`${yol}: "${bor}" (kutilgan "${sarlavha}")`);
    } catch (e) {
      xatolar.push(`${yol}: ${(e as Error).message.split("\n")[0]}`);
    }
  }

  await page.context().close();
  assert.deepEqual(xatolar, [], `sarlavhalar mos kelmadi:\n  ${xatolar.join("\n  ")}`);
});

// ---------- Yozish oqimi ----------

test("kirim qo'shiladi va ro'yxatda ko'rinadi", { skip: sabab }, async () => {
  const page = await yangiSahifa();
  await kir(page);
  await och(page, "/app/tranzaksiyalar");

  const izoh = `E2E sinov ${Math.floor(Date.now() / 1000)}`;

  await page.getByRole("button", { name: "Kirim", exact: true }).click();

  // Kategoriyalar serverdan keladi — birinchi haqiqiy variantni olamiz.
  const kategoriya = page.locator("form select").first();
  const qiymat = await kategoriya.locator("option:not([value=''])").first().getAttribute("value");
  assert.ok(qiymat, "kategoriya ro'yxati bo'sh — seed ishlamagan");
  await kategoriya.selectOption(qiymat);

  await page.locator("form input[placeholder='0']").first().fill("125000");
  await page.locator("form input[type='text']").last().fill(izoh);
  await page.getByRole("button", { name: "Qo'shish" }).click();

  await page.waitForSelector(`text=${izoh}`, { timeout: 20_000 });
  await xatosiz(page);
  await page.context().close();
});

// ---------- Sozlamalar ----------

test("modullar sozlamalarda ko'rinadi", { skip: sabab }, async () => {
  // Agar yangi modul shu ro'yxatda bo'lmasa, mijoz uni yoqa olmaydi va
  // butun modul ko'rinmay qoladi — kod to'g'ri bo'lsa ham.
  const page = await yangiSahifa();
  await kir(page);
  const javob = await och(page, "/app/sozlamalar/modullar");
  assert.ok((javob?.status() ?? 0) < 400, `modullar sahifasi ochilmadi: HTTP ${javob?.status()}`);

  const matn = await page.locator("body").innerText();
  for (const nomi of ["Xarid", "Tasdiqlash", "Mijozlar", "Hujjatlar"]) {
    assert.ok(matn.includes(nomi), `"${nomi}" moduli sozlamalarda ko'rinmadi`);
  }
  await xatosiz(page);
  await page.context().close();
});
