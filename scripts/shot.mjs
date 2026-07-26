// Playwright screenshot skripti — login qilib, har route'ni 390px va 1440px'da
// suratga oladi. Ishlatish: node scripts/shot.mjs <outdir> [baseUrl] [login] [parol]
// Masalan: node scripts/shot.mjs .screenshots/phase1 http://localhost:3000
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = process.argv[2] || ".screenshots/current";
const BASE = process.argv[3] || process.env.BASE || "http://localhost:3000";
const LOGIN = process.argv[4] || "admin";
const PAROL = process.argv[5] || "admin123";

// [route, nom, omborliBiznesKerakmi]
const ROUTES = [
  ["/", "01-dashboard", false],
  ["/tranzaksiyalar", "02-yozuvlar", false],
  ["/hisobot", "03-hisobot", false],
  ["/byudjet", "04-byudjet", false],
  ["/bildirishnomalar", "05-bildirishnomalar", false],
  ["/smena", "06-smena", false],
  ["/takroriy", "07-takroriy", false],
  ["/ombor", "08-ombor", true],
  ["/sotuv", "09-sotuv", true],
  ["/qarzlar", "10-qarzlar", true],
  ["/admin/foydalanuvchilar", "11-foydalanuvchilar", false],
];

const WIDTHS = [
  { w: 390, h: 844, tag: "mobile" },
  { w: 1440, h: 900, tag: "desktop" },
];

async function setBusiness(ctx, businessId) {
  await ctx.request.post(`${BASE}/api/me/active-business`, {
    data: { businessId },
    headers: { "Content-Type": "application/json" },
  });
}

const browser = await chromium.launch();
for (const { w, h, tag } of WIDTHS) {
  const dir = join(OUT, tag);
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // Login sahifasi (birinchi kompilyatsiya sekin bo'lishi mumkin)
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(dir, "00-login.png"), fullPage: true });

  // Login (SPA navigatsiya — URL o'zgarishini kutamiz)
  await page.fill('input[type="text"]', LOGIN);
  await page.fill('input[type="password"]', PAROL);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  for (const [route, name, omborli] of ROUTES) {
    if (omborli) await setBusiness(ctx, "biz_salyut");
    else await setBusiness(ctx, "biz_disney_navoiy");
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 40000 });
      await page.waitForTimeout(700);
      await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
      console.log(`  ${tag} ${route} → ${name}.png`);
    } catch (e) {
      console.log(`  ${tag} ${route} XATO: ${e.message}`);
    }
  }
  await ctx.close();
}
await browser.close();
console.log("Screenshotlar tayyor:", OUT);
