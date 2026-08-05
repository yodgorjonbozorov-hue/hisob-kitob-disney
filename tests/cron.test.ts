/**
 * CRON'NI BO'LISH (Faza 5.2).
 *
 * Ikki narsa tekshiriladi:
 *
 *  1. `cronGuard` FAIL-CLOSED. Bu route'lar zaxira oladi, obuna statuslarini
 *     o'zgartiradi va barcha mijozlarga Telegram xabar yuboradi. Sir
 *     sozlanmagan bo'lsa route umuman ochilmasligi kerak (audit: C-5).
 *
 *  2. `tenantlarBoylab` bitta tenantdagi xatoni QAMAB qoladi. Ilgari bitta
 *     buzuq tenant butun cron'ni to'xtatardi va undan keyingi barcha
 *     mijozlar xizmatsiz qolardi (audit: H-12).
 *
 * Ishga tushirish: npm run test:cron
 */
process.env.DATABASE_URL = "file:./prisma/test-cron.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync, existsSync } from "node:fs";

let cronGuard: any;
let tenantlarBoylab: any;
let rawPrisma: any;
let currentTenantId: any;

let t1: any;
let t2: any;
let t3: any;
let eskiSir: string | undefined;

function sorov(auth?: string): Request {
  return new Request("https://balansa.uz/api/cron/backup", {
    headers: auth ? { authorization: auth } : {},
  });
}

before(async () => {
  rmSync("prisma/test-cron.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ cronGuard } = await import("@/lib/cron/guard"));
  ({ tenantlarBoylab } = await import("@/lib/cron/ishlar"));
  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ currentTenantId } = await import("@/lib/db/tenantContext"));
  const { createTenantWithOwner } = await import("@/lib/services/signup");

  eskiSir = process.env.CRON_SECRET;

  t1 = await createTenantWithOwner({
    kompaniyaNomi: "Birinchi", ism: "A", login: "+998922222801", parol: "parol12345",
  });
  t2 = await createTenantWithOwner({
    kompaniyaNomi: "Ikkinchi", ism: "B", login: "+998922222802", parol: "parol12345",
  });
  t3 = await createTenantWithOwner({
    kompaniyaNomi: "Uchinchi", ism: "C", login: "+998922222803", parol: "parol12345",
  });
});

after(async () => {
  if (eskiSir === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = eskiSir;
  await rawPrisma?.$disconnect();
});

// ---------- Guard ----------

test("CRON_SECRET sozlanmagan bo'lsa route 503 qaytaradi (fail-closed)", () => {
  delete process.env.CRON_SECRET;
  const rad = cronGuard(sorov("Bearer nimadir"));
  assert.ok(rad, "sirsiz holatda guard o'tkazmasligi kerak");
  assert.equal(rad.status, 503);
});

test("sir sozlanmagan bo'lsa \"Bearer undefined\" ham o'tmaydi", () => {
  delete process.env.CRON_SECRET;
  // Aynan shu edi eski zaiflik: taqqoslash "Bearer undefined" bilan mos kelardi.
  const rad = cronGuard(sorov("Bearer undefined"));
  assert.equal(rad.status, 503);
});

test("noto'g'ri yoki yo'q sarlavha 401 qaytaradi", () => {
  process.env.CRON_SECRET = "haqiqiy-sir";
  assert.equal(cronGuard(sorov()).status, 401, "sarlavhasiz");
  assert.equal(cronGuard(sorov("Bearer boshqa-sir")).status, 401, "boshqa sir");
  assert.equal(cronGuard(sorov("haqiqiy-sir")).status, 401, "Bearer prefiksisiz");
  assert.equal(cronGuard(sorov("Bearer haqiqiy-sir-uzunroq")).status, 401, "prefiks mos kelgani yetmaydi");
});

test("to'g'ri sir bilan guard o'tkazadi", () => {
  process.env.CRON_SECRET = "haqiqiy-sir";
  assert.equal(cronGuard(sorov("Bearer haqiqiy-sir")), null);
});

// ---------- tenantlarBoylab ----------

test("har tenant O'Z kontekstida ishlaydi", async () => {
  const korilgan: string[] = [];
  const natija = await tenantlarBoylab(async () => {
    // Kontekst haqiqatan o'rnatilganini ichkaridan tekshiramiz.
    korilgan.push(currentTenantId());
    return 1;
  }, "Test");

  assert.equal(natija.jami, 3, "uchala tenant ham bajarilishi kerak");
  assert.equal(natija.xato, 0);
  assert.ok(korilgan.includes(t1.tenant.id));
  assert.ok(korilgan.includes(t2.tenant.id));
  assert.ok(korilgan.includes(t3.tenant.id));
});

test("bitta tenantdagi xato qolganlarini TO'XTATMAYDI", async () => {
  const bajarilgan: string[] = [];
  const natija = await tenantlarBoylab(async (tenantId: string) => {
    if (tenantId === t2.tenant.id) throw new Error("Buzuq ma'lumot");
    bajarilgan.push(tenantId);
    return 5;
  }, "Test");

  assert.equal(natija.xato, 1, "bitta xato sanaladi");
  assert.equal(natija.jami, 10, "qolgan ikkitasi baribir bajariladi");
  assert.equal(bajarilgan.length, 2);
  assert.ok(!bajarilgan.includes(t2.tenant.id));
});

test("hamma tenant yiqilsa ham funksiya xato otmaydi", async () => {
  const natija = await tenantlarBoylab(async () => {
    throw new Error("Hammasi yomon");
  }, "Test");
  assert.equal(natija.jami, 0);
  assert.equal(natija.xato, 3, "cron o'zi yiqilmasligi kerak — sanog'i log uchun qaytadi");
});

// ---------- vercel.json ----------

test("vercel.json da to'rt alohida cron ro'yxatga olingan", () => {
  const conf = JSON.parse(readFileSync("vercel.json", "utf8"));
  const yollar = conf.crons.map((c: any) => c.path).sort();
  assert.deepEqual(yollar, [
    "/api/cron/backup",
    "/api/cron/billing",
    "/api/cron/reports",
    "/api/cron/tasks",
  ]);

  // Vaqtlar ustma-ust tushmasin — bittasi cho'zilsa keyingisiga xalaqit bermaydi.
  const soatlar = conf.crons.map((c: any) => c.schedule);
  assert.equal(new Set(soatlar).size, 4, "har cron o'z vaqtida ishlashi kerak");
});

test("har cron yo'li uchun route fayli mavjud", () => {
  const conf = JSON.parse(readFileSync("vercel.json", "utf8"));
  for (const c of conf.crons) {
    const yol = `src/app${c.path}/route.ts`;
    assert.ok(existsSync(yol), `${yol} topilmadi`);

    const matn = readFileSync(yol, "utf8");
    assert.match(matn, /cronGuard/, `${c.path} guard'siz qolgan`);
    assert.match(matn, /maxDuration = 60/, `${c.path} da maxDuration yo'q`);
  }
});

test("eski yagona cron moslik uchun saqlangan va guard'langan", () => {
  const matn = readFileSync("src/app/api/cron/monthly-report/route.ts", "utf8");
  assert.match(matn, /cronGuard/, "eski route ham himoyalangan bo'lishi kerak");
  assert.match(matn, /eskirgan/, "eskirgani haqida ogohlantirish bo'lsin");
});
