import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { createClient } from "@libsql/client";
const OUT = process.env.OUT_DIR; const ASOS = "http://127.0.0.1:3100";
const c = createClient({ url: "file:./prisma/e2e.db" });
const deal = (await c.execute(`SELECT id FROM Deal WHERE nomi='Panda Masha' LIMIT 1`)).rows[0];
const server = spawn("npx", ["next", "start", "-p", "3100"], { detached: true, stdio: "ignore", env: { ...process.env, DATABASE_URL: "file:./prisma/e2e.db", DATABASE_AUTH_TOKEN: "", SESSION_SECRET: "e2e_sinov_maxfiy_kaliti_kamida_32_belgi_uzunlikda", TELEGRAM_BOT_TOKEN: "0:e2e_sinov", NEXT_PUBLIC_APP_URL: ASOS } });
const ochir = () => { try { process.kill(-server.pid, "SIGTERM"); } catch {} };
process.once("exit", ochir);
for (let i = 0; i < 180; i++) { try { const r = await fetch(`${ASOS}/login`); if (r.status < 500) break; } catch {} await new Promise((r) => setTimeout(r, 500)); }
try {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ baseURL: ASOS, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await page.request.post("/api/auth/login", { data: { login: "admin", parol: "admin123" } });
  await page.goto(`/app/crm?buyurtma=${deal.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const sheet = page.locator(".fixed.inset-0").last();
  await sheet.screenshot({ path: `${OUT}/5-tafsilot.png` });
  console.log("jamoa bloki:", await page.getByText("Zakaz jamoasi").count(), "| videochilar:", await page.getByText(/Bekzod, Sardor|Sardor, Bekzod/).count(), "| sotuvchi:", await page.getByText("Zakazni olgan sotuvchi").count());
  // Yutildi → sifat nazorati
  await page.getByRole("button", { name: "Jarayonga o'tkazish" }).click();
  await page.waitForTimeout(1200);
  await page.goto(`/app/crm?buyurtma=${deal.id}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Yutildi" }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/5b-yakunlash.png` });
  const tasdiq = page.getByRole("button", { name: /Tasdiqla|Yutildi/ }).last();
  await tasdiq.click();
  await page.waitForTimeout(1500);
  await page.goto(`/app/crm?buyurtma=${deal.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log("sifat nazorati:", await page.getByText("Sifat nazorati").count());
  const b = page.getByRole("button", { name: "Baholash" });
  if (await b.count()) { await b.click(); await page.getByRole("radio", { name: "9" }).first().click(); await page.locator(".fixed.inset-0").last().screenshot({ path: `${OUT}/5c-baho.png` }); await page.getByRole("button", { name: "Saqlash" }).last().click(); await page.waitForTimeout(1200); console.log("baho saqlandi:", await page.getByText("9/10").count()); }
  await browser.close();
} catch (e) { console.log("XATO", e.message); } finally { ochir(); }
