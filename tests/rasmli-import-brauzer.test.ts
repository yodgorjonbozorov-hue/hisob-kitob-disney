/**
 * RASMLI EXCEL IMPORTI (BRAUZER).
 *
 * Katta/rasmli xlsx endi serverga yuborilmaydi — brauzerning o'zida ochiladi
 * (ExcelJS brauzer bundle'ida). Bu yo'l unit testda sinab bo'lmaydi: ExcelJS
 * klient bo'lagi haqiqatan yuklanadimi, fayl inputidan o'qish ishlaydimi,
 * rasmlar sanaladimi — bularni faqat haqiqiy brauzer ko'rsatadi.
 *
 * E2E muhitida rasm saqlagich (BLOB_READ_WRITE_TOKEN) ATAYLAB yo'q: oqim
 * foydalanuvchini ogohlantirib, tovarlarni rasmsiz import qilishi kerak —
 * saqlagichsiz serverda ham import butunlay to'xtab qolmasligi shart.
 *
 * Ishga tushirish:
 *   npm run build            (bir marta, .next kerak)
 *   npm run test:rasmli-import
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";
import type { Browser, Page } from "playwright";

const PORT = 3103;
const ASOS = `http://127.0.0.1:${PORT}`;
const LOGIN = "admin";
const PAROL = "admin123";

const TAYYOR_CHROMIUM = "/opt/pw-browsers/chromium";
const BRAUZER_YOLI = existsSync(TAYYOR_CHROMIUM) ? TAYYOR_CHROMIUM : undefined;

const qurilgan = existsSync(".next/BUILD_ID");
const sabab = qurilgan ? undefined : "`.next` yo'q — avval `npm run build` qiling";

let server: ChildProcess | undefined;
let browser: Browser | undefined;
let xlsxYol: string;

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

/** Ikki tovar + har biriga katakka joylashtirilgan rasm bo'lgan xlsx yasaydi. */
async function rasmliFaylYasa(): Promise<string> {
  const ExcelJS = (await import("exceljs")).default;
  // 1x1 piksel PNG — rasm mazmuni muhim emas, ANKERI muhim.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Katalog");
  ws.addRow(["Nomi", "Sotuv narxi", "Qoldiq"]);
  ws.addRow(["E2E Rasmli tovar 1", 12000, 5]);
  ws.addRow(["E2E Rasmli tovar 2", 15000, 8]);
  for (const qator of [1, 2]) {
    const id = wb.addImage({ buffer: PNG, extension: "png" });
    ws.addImage(id, { tl: { col: 0, row: qator }, ext: { width: 40, height: 40 } });
  }
  const yol = join(tmpdir(), `balansa-e2e-rasmli-${process.pid}.xlsx`);
  await wb.xlsx.writeFile(yol);
  return yol;
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

  xlsxYol = await rasmliFaylYasa();

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
      // Rasm saqlagich ATAYLAB sozlanmagan (yuqoridagi izoh).
      BLOB_READ_WRITE_TOKEN: "",
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
});

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

after(async () => {
  if (browser) await browser.close();
  ochir();
});

async function kir(page: Page) {
  await page.goto(`${ASOS}/login`, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Login").fill(LOGIN);
  await page.getByLabel("Parol").fill(PAROL);
  await page.getByRole("button", { name: "Kirish" }).click();
  await page.waitForURL("**/app**", { timeout: 60_000 });
  await page.waitForSelector("h1", { timeout: 60_000 });
}

/** Sahifa ichidan API so'rovi (sessiya cookie'si bilan). */
async function sorov(page: Page, yol: string, tana?: unknown) {
  return page.evaluate(
    async ([u, b]) => {
      const res = await fetch(u as string, {
        method: b === null ? "GET" : "POST",
        headers: b === null ? {} : { "Content-Type": "application/json" },
        body: b === null ? undefined : JSON.stringify(b),
      });
      return { ok: res.ok, status: res.status, matn: await res.text() };
    },
    [yol, tana === undefined ? null : tana] as [string, unknown]
  );
}

test("rasmli xlsx brauzerda o'qiladi va import bo'ladi", { skip: sabab }, async () => {
  const kontekst = await browser!.newContext({ baseURL: ASOS, locale: "uz-UZ" });
  const page = await kontekst.newPage();
  await kir(page);

  // Ombor sahifasi omborli biznesnigina qabul qiladi — unga o'tamiz.
  const bizneslar = await sorov(page, "/api/businesses");
  assert.ok(bizneslar.ok, `bizneslar olinmadi: HTTP ${bizneslar.status}`);
  const royxat = JSON.parse(bizneslar.matn) as Array<{ id: string; omborli?: boolean }>;
  const omborli = royxat.find((b) => b.omborli);
  assert.ok(omborli, "omborli biznes topilmadi — e2e seed o'zgarganmi?");
  const almashtir = await sorov(page, "/api/me/active-business", { businessId: omborli.id });
  assert.ok(almashtir.ok, `biznes almashtirilmadi: HTTP ${almashtir.status}`);

  await page.goto(`${ASOS}/app/ombor`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1", { timeout: 30_000 });

  // "•••" menyusidan import oynasi ochiladi.
  await page.getByRole("button", { name: "Boshqa amallar" }).click();
  await page.getByRole("button", { name: /Fayldan yuklash/ }).click();
  const oyna = page.getByRole("dialog", { name: "Katalogni fayldan yuklash" });
  await oyna.waitFor({ timeout: 15_000 });

  // Fayl tanlanadi — ExcelJS brauzer bo'lagi yuklanib, fayl SHU YERDA o'qiladi.
  await oyna.locator("input[type=file]").setInputFiles(xlsxYol);

  // Oldindan ko'rish: 2 tovar, 2 rasm. 30s — ExcelJS bo'lagi birinchi marta
  // yuklanishi ham shu kutishga kiradi.
  await oyna.locator("text=Topildi:").waitFor({ timeout: 30_000 });
  const korish = await oyna.innerText();
  assert.match(korish, /Topildi:\s*2/, `oldindan ko'rishda 2 tovar chiqmadi:\n${korish.slice(0, 600)}`);
  assert.match(korish, /rasm:\s*2/, `oldindan ko'rishda 2 rasm chiqmadi:\n${korish.slice(0, 600)}`);
  // Saqlagich sozlanmagan — foydalanuvchi IMPORTDAN OLDIN ogohlantiriladi.
  assert.match(korish, /saqlagich sozlanmagan/i, "saqlagich ogohlantirishi chiqmadi");

  await oyna.getByRole("button", { name: "2 ta tovarni yuklash" }).click();

  // Yakun: 2 tovar qo'shildi, rasm taqdiri haqidagi izoh ko'rinadi.
  const yakun = page.getByRole("dialog", { name: "Import yakunlandi" });
  await yakun.waitFor({ timeout: 30_000 });
  const yakunMatn = await yakun.innerText();
  assert.match(yakunMatn, /qo'shildi:\s*2/i, `2 tovar qo'shilmadi:\n${yakunMatn}`);
  assert.match(yakunMatn, /saqlagich sozlanmagan/i, "yakunda rasm izohi yo'q");

  // "Yopish" ikkita: burchakdagi "×" (aria-label) va pastki tugma — matn
  // bo'yicha aynan pastkisi olinadi.
  await yakun.getByText("Yopish", { exact: true }).click();

  // Tovarlar haqiqatan bazada — sahifa yangilangach ro'yxatda ko'rinadi.
  await page.goto(`${ASOS}/app/ombor`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=E2E Rasmli tovar 1", { timeout: 30_000 });

  await kontekst.close();
});
