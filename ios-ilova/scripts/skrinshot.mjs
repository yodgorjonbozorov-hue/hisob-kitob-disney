/**
 * App Store skrinshotlarini oladi (6.9" — 1320 x 2868).
 *
 *   node ios-ilova/scripts/skrinshot.mjs                  # lokal e2e bazasi bilan
 *   node ios-ilova/scripts/skrinshot.mjs --url https://balansa.uz --login X --parol Y
 *
 * NEGA BRAUZER: ilova ichidagi ekran WKWebView'da render bo'lgan AYNAN shu
 * veb interfeys. Shuning uchun to'g'ri o'lchamdagi brauzer surati App Store
 * talab qiladigan rasm bilan bir xil chiqadi — Mac ham, simulyator ham
 * kerak emas. (Xohlasangiz TestFlight'dan keyin haqiqiy telefonda ham
 * olishingiz mumkin — bu tezroq yo'l.)
 *
 * Natija: ios-ilova/app-store/skrinshot/*.png
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BU = dirname(fileURLToPath(import.meta.url));
const ILDIZ = join(BU, "../..");
const CHIQISH = join(BU, "../app-store/skrinshot");

/** App Store 6.9" (iPhone 16 Pro Max) o'lchami — piksel. */
const EN = 1320;
const BOY = 2868;
/** iPhone mantiqiy kengligi 440pt; 1320/440 = 3. */
const MASSHTAB = 3;

const PORT = 3199;

function arg(nom, standart) {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : standart;
}

const TASHQI_URL = arg("url", null);
const LOGIN = arg("login", "admin");
const PAROL = arg("parol", "admin123");

/** Olinadigan ekranlar: [fayl nomi, yo'l, kutiladigan matn]. */
const EKRANLAR = [
  ["1-asosiy", "/app", null],
  ["2-yozuvlar", "/app/tranzaksiyalar", null],
  ["3-kassalar", "/app/kassa", null],
  ["4-ombor", "/app/ombor", null],
  ["5-qarzlar", "/app/qarzlar", null],
  ["6-sozlamalar", "/app/sozlamalar", null],
];

const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

async function kut(url, soniya) {
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
  throw new Error(`server ko'tarilmadi: ${url}`);
}

let server;

async function serverKotar() {
  if (TASHQI_URL) return TASHQI_URL;

  if (!existsSync(join(ILDIZ, ".next/BUILD_ID"))) {
    throw new Error("`.next` yo'q — avval `npm run build` qiling (yoki --url bering)");
  }
  console.log("E2E bazasi tayyorlanmoqda...");
  const tayyorla = spawnSync(process.execPath, ["scripts/e2e-tayyorla.mjs"], {
    cwd: ILDIZ,
    encoding: "utf8",
  });
  if (tayyorla.status !== 0) {
    throw new Error(`baza tayyorlanmadi:\n${tayyorla.stdout}\n${tayyorla.stderr}`);
  }

  const asos = `http://127.0.0.1:${PORT}`;
  server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: ILDIZ,
    env: {
      ...process.env,
      DATABASE_URL: "file:./prisma/e2e.db",
      DATABASE_AUTH_TOKEN: "",
      SESSION_SECRET: "e2e_sinov_maxfiy_kaliti_kamida_32_belgi_uzunlikda",
      TELEGRAM_BOT_TOKEN: "0:e2e_sinov",
      NEXT_PUBLIC_APP_URL: asos,
    },
    stdio: "ignore",
  });
  await kut(`${asos}/login`, 120);
  return asos;
}

async function main() {
  mkdirSync(CHIQISH, { recursive: true });
  const asos = await serverKotar();
  console.log(`Manba: ${asos}`);

  const { chromium } = await import("playwright");
  const brauzer = await chromium.launch({ executablePath: BRAUZER_YOLI, args: ["--no-sandbox"] });
  const kontekst = await brauzer.newContext({
    baseURL: asos,
    locale: "uz-UZ",
    viewport: { width: EN / MASSHTAB, height: BOY / MASSHTAB },
    deviceScaleFactor: MASSHTAB,
    isMobile: true,
    hasTouch: true,
    // Native ilovadagi bilan BIR XIL User-Agent: to'lov bloklari berkitiladi
    // va surat aynan foydalanuvchi ko'radigan ekranni ko'rsatadi.
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Mobile/15E148 BalansaIOS",
  });

  // "Ilovani o'rnating" banneri — u FAQAT brauzerda chiqadi (native ilovada
  // `window.Capacitor` bor va banner ko'rsatilmaydi). Suratda ko'rinib qolsa
  // ilova o'zini o'rnatishga chaqirayotgandek bo'ladi, shuning uchun
  // brauzerdagi "rad etildi" belgisi oldindan qo'yiladi.
  await kontekst.addInitScript(() => {
    try {
      localStorage.setItem("pwa_rad_vaqti", String(Date.now()));
    } catch {
      /* localStorage yopiq — banner baribir chiqmaydi */
    }
  });

  const page = await kontekst.newPage();
  await page.goto(`${asos}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL(/\/app/, { timeout: 60_000 });

  for (const [nom, yol] of EKRANLAR) {
    await page.goto(`${asos}${yol}`, { waitUntil: "domcontentloaded" });
    // Grafiklar va raqamlar joyiga tushishi uchun qisqa kutish.
    await page.waitForTimeout(1200);
    const fayl = join(CHIQISH, `${nom}.png`);
    await page.screenshot({ path: fayl });
    console.log(`  ${nom}.png`);
  }

  await brauzer.close();
  console.log(`\nTayyor: ${CHIQISH} (${EN}x${BOY})`);
}

main()
  .catch((e) => {
    console.error("XATO:", e.message);
    process.exitCode = 1;
  })
  .finally(() => {
    if (server?.pid) server.kill("SIGTERM");
  });
