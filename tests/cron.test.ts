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
import { rmSync, readFileSync, existsSync, readdirSync } from "node:fs";

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
//
// TEST QOTIRILGAN RO'YXATNI TEKSHIRMAYDI.
//
// Ilgari bu yerda "aynan to'rtta cron" deb qotirilgan ro'yxat turardi.
// Natijada HR moduli qonuniy `/api/cron/davomat` ni qo'shganda (route,
// ishi va vercel.json yozuvi bitta commitda — `ee224d8`) suita sababsiz
// qizarib qoldi va shu holda qolib ketdi.
//
// Endi tekshiriladigan narsa RO'YXAT emas, QOIDALAR:
//   · majburiy cronlar joyidami (yangisini qo'shish buzmaydi);
//   · har yozuvning shakli, jadvali va yo'li to'g'rimi;
//   · takrorlanish yo'qmi;
//   · cron route'i vercel.json ga yozilmay qolmaganmi.
// Shunda yangi cron qo'shish testni buzmaydi, XATO qo'shish esa buzadi.

/** Bu ishlar bo'lmasa mahsulot jimgina buziladi — ular HAR DOIM bo'lishi shart. */
const MAJBURIY_CRONLAR = [
  "/api/cron/backup",
  "/api/cron/billing",
  "/api/cron/reports",
  "/api/cron/tasks",
];

/**
 * ATAYLAB `vercel.json` DAN TASHQARIDAGI cron route'lari.
 *
 * `monthly-report` — eski yagona cron: u rejalashtiruvchidan emas, faqat
 * qo'lda yoki tashqi chaqiruvdan ishlatiladi (route faylining o'zida
 * izohlangan). Yangi route shu ro'yxatga qo'shilsa — bu ONGLI qaror
 * bo'lishi kerak, unutish emas.
 */
const ROYXATSIZ_CRONLAR = new Set(["monthly-report"]);

interface CronYozuv {
  path: string;
  schedule: string;
}

function cronlar(): CronYozuv[] {
  const conf = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.ok(Array.isArray(conf.crons), "vercel.json da `crons` massivi bo'lishi kerak");
  return conf.crons as CronYozuv[];
}

/**
 * CRON JADVALINI TEKSHIRADI (5 maydonli standart sintaksis).
 *
 * Nega qo'lda: loyihada cron parser kutubxonasi yo'q va bittasini shu
 * tekshiruv uchun qo'shish ortiqcha. Maqsad — "0 3 * * *" kabi to'g'ri
 * yozuvni o'tkazish va quyidagilarni ushlash: maydon yetishmagan
 * ("0 3 * *"), chegaradan tashqari qiymat ("0 99 * * *") va nol qadam
 * (yulduzcha bilan yozilgan qadamning noli).
 *
 * Xato bo'lsa SABABNI qaytaradi, aks holda `null`.
 */
function jadvalXatosi(schedule: string): string | null {
  if (typeof schedule !== "string" || !schedule.trim()) return "jadval bo'sh";
  const maydonlar = schedule.trim().split(/\s+/);
  if (maydonlar.length !== 5) {
    return `5 ta maydon kutilgan, ${maydonlar.length} ta berilgan`;
  }

  const chegara: [number, number][] = [
    [0, 59], // daqiqa
    [0, 23], // soat
    [1, 31], // oyning kuni
    [1, 12], // oy
    [0, 7], // hafta kuni (0 va 7 — yakshanba)
  ];
  const nomlar = ["daqiqa", "soat", "oy kuni", "oy", "hafta kuni"];
  // Oy va hafta kuni nom bilan ham yozilishi mumkin (JAN, MON...).
  const NOMLI = /^[A-Z]{3}$/i;

  for (let i = 0; i < 5; i++) {
    const [min, max] = chegara[i];
    for (const bolak of maydonlar[i].split(",")) {
      if (!bolak) return `${nomlar[i]}: bo'sh bo'lak`;
      const [oraliq, qadamMatn] = bolak.split("/");
      if (bolak.includes("/")) {
        const qadam = Number(qadamMatn);
        if (!Number.isInteger(qadam) || qadam <= 0) {
          return `${nomlar[i]}: qadam noto'g'ri ("${bolak}")`;
        }
      }
      if (oraliq === "*") continue;
      for (const son of oraliq.split("-")) {
        if (NOMLI.test(son) && i >= 3) continue;
        const n = Number(son);
        if (!Number.isInteger(n) || n < min || n > max) {
          return `${nomlar[i]}: "${son}" ${min}-${max} oralig'idan tashqarida`;
        }
      }
    }
  }
  return null;
}

test("majburiy cronlar vercel.json da ro'yxatga olingan", () => {
  const yollar = new Set(cronlar().map((c) => c.path));
  for (const kerak of MAJBURIY_CRONLAR) {
    assert.ok(yollar.has(kerak), `${kerak} vercel.json dan tushib qolgan`);
  }
});

test("har cron yozuvining shakli to'g'ri", () => {
  for (const c of cronlar()) {
    assert.match(
      c.path,
      /^\/api\/cron\/[a-z0-9-]+$/,
      `cron yo'li "/api/cron/<nom>" ko'rinishida bo'lishi kerak: ${c.path}`
    );
    const xato = jadvalXatosi(c.schedule);
    assert.equal(xato, null, `${c.path} jadvali noto'g'ri ("${c.schedule}"): ${xato}`);
  }
});

test("cron jadvali tekshiruvining o'zi ishlaydi", () => {
  // Tekshiruv haqiqiy xatoni ushlashiga ishonch: soxta jadvallar RAD etilsin.
  assert.equal(jadvalXatosi("0 3 * * *"), null);
  assert.equal(jadvalXatosi("*/15 * * * *"), null);
  assert.equal(jadvalXatosi("0 0 1 * MON"), null, "nom bilan yozilgan hafta kuni");
  assert.ok(jadvalXatosi("0 3 * *"), "maydon yetishmasa xato");
  assert.ok(jadvalXatosi("0 99 * * *"), "soat chegaradan tashqarida");
  assert.ok(jadvalXatosi("0 3 0 * *"), "oyning 0-kuni yo'q");
  assert.ok(jadvalXatosi("*/0 * * * *"), "qadam 0 bo'lmaydi");
  assert.ok(jadvalXatosi(""), "bo'sh jadval");
});

test("cron yo'llari takrorlanmaydi", () => {
  const yollar = cronlar().map((c) => c.path);
  const takror = yollar.filter((y, i) => yollar.indexOf(y) !== i);
  assert.deepEqual(takror, [], `takrorlangan cron yo'li: ${takror.join(", ")}`);
});

test("har cron o'z vaqtida ishlaydi — jadvallar ustma-ust tushmaydi", () => {
  // Bittasi cho'zilib ketsa keyingisiga xalaqit bermasligi kerak.
  const jadvallar = cronlar().map((c) => c.schedule);
  const takror = jadvallar.filter((j, i) => jadvallar.indexOf(j) !== i);
  assert.deepEqual(takror, [], `ikki cron bir vaqtda: ${takror.join(", ")}`);
});

test("cron route'i vercel.json ga yozilmay qolmagan", () => {
  // ENG MUHIM TEKSHIRUV: route yozilib, rejalashtiruvchiga qo'shilmasa u
  // hech qachon ishlamaydi va buni hech kim sezmaydi.
  const royxat = new Set(cronlar().map((c) => c.path));
  const papkalar = readdirSync("src/app/api/cron", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const nom of papkalar) {
    if (ROYXATSIZ_CRONLAR.has(nom)) continue;
    assert.ok(
      royxat.has(`/api/cron/${nom}`),
      `src/app/api/cron/${nom} route'i bor, lekin vercel.json da yo'q — ` +
        `qo'shing yoki ataylab bo'lsa ROYXATSIZ_CRONLAR ga yozing`
    );
  }
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
