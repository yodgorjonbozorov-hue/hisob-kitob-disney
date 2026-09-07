/**
 * DEMO REJIMI TESTLARI.
 *
 * Nimani qo'riqlaydi:
 *   1. demo tenant boshqa tenant ma'lumotini KO'RMAYDI (va aksincha);
 *   2. demo'da o'qish ochiq, YOZISH esa har qanday yo'l bilan bloklangan —
 *      obuna (`billing: true`) va `readonlyOk` istisnolari ham qutqarmaydi;
 *   3. `withTenant` dan TASHQARIDAGI xavfli route'lar (parol almashtirish,
 *      Telegram bog'lash) ham qulflangan, va bu ro'yxat jimgina o'smaydi;
 *   4. demo mehmon superadmin bo'la olmaydi;
 *   5. haqiqiy mijozlarda hech narsa o'zgarmagan (trial/signup/yozish);
 *   6. demo raqamlari matematik jihatdan mos (kirim/chiqim/qarz/ombor).
 *
 * Ishga tushirish: npm run test:demo
 */
process.env.DATABASE_URL = "file:./prisma/test-demo.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let rawPrisma: any;
let prisma: any;
let runWithTenant: <T>(tenantId: string, fn: () => T) => T;
let demoQulfi: (demo: boolean, method: string, izin?: boolean) => boolean;
let demoFoydalanuvchimi: (userId: string) => Promise<boolean>;
let demoTenantniOl: any;
let computeAccess: any;
let createTenantWithOwner: any;
let demoDatasetYarat: any;
let demoReja: any;
let demoJamlar: any;
let MAHSULOTLAR: any[];
let DEMO_TENANT_ID: string;
let DEMO_USER_ID: string;
let DEMO_BUSINESS_ID: string;

/** Haqiqiy (demo bo'lmagan) mijoz — regressiya uchun. */
let mijoz: any;
let ekish: any;

/** Bugungi sana (UTC yarim tun) — "bugungi kirim" tekshiruvi uchun. */
function bugunUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

before(async () => {
  rmSync("prisma/test-demo.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ demoQulfi, demoFoydalanuvchimi, demoTenantniOl, DEMO_TENANT_ID, DEMO_USER_ID, DEMO_BUSINESS_ID } =
    await import("@/lib/auth/demo"));
  ({ computeAccess } = await import("@/lib/billing/access"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ demoDatasetYarat } = await import("@/lib/demo/dataset"));
  ({ demoReja, demoJamlar, MAHSULOTLAR } = await import("@/lib/demo/reja"));

  // Haqiqiy mijoz — demo bilan yonma-yon turadi.
  mijoz = await createTenantWithOwner({
    kompaniyaNomi: "Haqiqiy Mijoz",
    ism: "Direktor",
    login: "+998901234567",
    parol: "parol12345",
  });

  ekish = await demoDatasetYarat(rawPrisma);
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ─────────────────────────── 1. QULF (SOF MANTIQ) ───────────────────────────

test("demo'da o'qish ochiq, yozish bloklangan", () => {
  assert.equal(demoQulfi(true, "GET"), false);
  assert.equal(demoQulfi(true, "HEAD"), false);
  assert.equal(demoQulfi(true, "POST"), true);
  assert.equal(demoQulfi(true, "PATCH"), true);
  assert.equal(demoQulfi(true, "PUT"), true);
  assert.equal(demoQulfi(true, "DELETE"), true);
});

test("demo bo'lmagan tenantda qulf umuman ishlamaydi (regressiya)", () => {
  for (const m of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
    assert.equal(demoQulfi(false, m), false, `${m} oddiy mijozda bloklanmasligi kerak`);
  }
});

test("yozish ruxsati faqat ANIQ so'ralganda beriladi (fail-closed)", () => {
  assert.equal(demoQulfi(true, "POST", true), false);
  assert.equal(demoQulfi(true, "POST", false), true);
  assert.equal(demoQulfi(true, "POST", undefined), true);
});

// ─────────────────────── 2. QULF ROUTE'LARGA ULANGANMI ──────────────────────

const oqi = (yol: string) => readFileSync(yol, "utf8");

test("withTenant qulfni obuna istisnolaridan OLDIN qo'llaydi", () => {
  const src = oqi("src/lib/auth/tenant.ts");
  const qulf = src.indexOf("demoQulfi(");
  const billing = src.indexOf("if (!opts.billing)");
  assert.ok(qulf > 0, "withTenant demoQulfi ni chaqirishi shart");
  assert.ok(billing > 0);
  assert.ok(
    qulf < billing,
    "demo qulfi `billing` istisnosidan OLDIN turishi SHART — aks holda " +
      "to'lov route'lari qulfdan o'tib ketadi"
  );
  assert.ok(src.includes("demo: true"), "TenantInfo tanlovida `demo` maydoni bo'lishi kerak");
});

test("to'lov boshlash route'i markaziy qulf ostida", () => {
  const src = oqi("src/app/api/billing/checkout/route.ts");
  assert.ok(src.includes("withTenant("), "checkout withTenant bilan o'ralgan bo'lishi kerak");
  assert.ok(!src.includes("demoYozish"), "checkout demo'da yozishga ruxsat OLMASLIGI kerak");
});

test("guard tashqarisidagi xavfli route'lar qo'lda qulflangan", () => {
  for (const yol of [
    "src/app/api/me/password/route.ts",
    "src/app/api/me/telegram-link-code/route.ts",
  ]) {
    const src = oqi(yol);
    assert.ok(src.includes("demoFoydalanuvchimi"), `${yol} demo qulfini chaqirmayapti`);
    assert.ok(src.includes("demoRadJavobi"), `${yol} rad javobini qaytarmayapti`);
  }
});

test("demo'da yozishga ruxsat FAQAT cookie route'ida", () => {
  const ruxsatli: string[] = [];
  const yur = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) yur(p);
      else if (e.name === "route.ts" && oqi(p).includes("demoYozish: true")) ruxsatli.push(p);
    }
  };
  yur("src/app/api");
  assert.deepEqual(ruxsatli, ["src/app/api/me/active-business/route.ts"]);
});

/**
 * `withTenant`/`withSuperadmin` dan tashqaridagi route'lar ro'yxati — YOPIQ.
 * Yangi route shu ro'yxatga tushsa test qizil bo'ladi va muallif demo
 * qulfini (va tenant guard'ini) ataylab ko'rib chiqishga majbur bo'ladi.
 */
const GUARDSIZ_ROUTELAR = [
  "src/app/api/auth/login/route.ts",
  "src/app/api/auth/logout/route.ts",
  "src/app/api/auth/signup/route.ts",
  "src/app/api/billing/click/complete/route.ts",
  "src/app/api/billing/click/prepare/route.ts",
  "src/app/api/billing/payme/route.ts",
  "src/app/api/cron/backup/route.ts",
  "src/app/api/cron/billing/route.ts",
  "src/app/api/cron/davomat/route.ts",
  "src/app/api/cron/monthly-report/route.ts",
  "src/app/api/cron/reports/route.ts",
  "src/app/api/cron/tasks/route.ts",
  "src/app/api/demo/kirish/route.ts",
  "src/app/api/health/route.ts",
  "src/app/api/me/password/route.ts",
  "src/app/api/me/telegram-link-code/route.ts",
  // Impersonatsiyadan chiqish: o'ram YO'Q, huquq `impersonatedBy` orqali
  // tekshiriladi. Demo sessiyasida bu maydon null — route 400 qaytaradi.
  "src/app/api/superadmin/impersonate/exit/route.ts",
  "src/app/api/telegram/webhook/route.ts",
];

test("tenant guard'idan tashqaridagi route'lar ro'yxati o'smagan", () => {
  const topilgan: string[] = [];
  const yur = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) yur(p);
      else if (e.name === "route.ts") {
        // Izohdagi eslatma emas, HAQIQIY chaqiruv qidiriladi: `withTenant(`
        // yoki `withTenant<...>(` (va superadmin varianti).
        const src = oqi(p);
        if (!/\bwith(Tenant|Superadmin)\s*[(<]/.test(src)) topilgan.push(p);
      }
    }
  };
  yur("src/app/api");
  assert.deepEqual(
    topilgan.sort(),
    [...GUARDSIZ_ROUTELAR].sort(),
    "Yangi route tenant guard'isiz qo'shildi — demo qulfi va tenant izolyatsiyasi qo'lda tekshirilsin"
  );
});

// ──────────────────────── 3. DEMO TENANT VA SESSIYA ─────────────────────────

test("mehmon uchun demo tenant va hisob mavjud (parolsiz kirish nishoni)", async () => {
  const demo = await demoTenantniOl();
  assert.ok(demo, "demoTenantniOl null qaytardi — mehmon demo'ga kira olmaydi");
  assert.equal(demo.tenantId, DEMO_TENANT_ID);
  assert.equal(demo.userId, DEMO_USER_ID);
  assert.equal(demo.rol, "OWNER");
});

test("demo hisobi superadmin emas va paroli bilan kirib bo'lmaydi", async () => {
  const u = await rawPrisma.user.findUnique({ where: { id: DEMO_USER_ID } });
  assert.notEqual(u.rol, "SUPERADMIN");
  assert.equal(u.superadminRol, null);
  assert.equal(u.isActive, true);
  const { verifyPassword } = await import("@/lib/auth/password");
  // Parol tasodifiy: taxmin qilinadigan qiymatlarning birortasi ham to'g'ri emas.
  for (const taxmin of ["demo", "demo1234", "parol12345", "balansa", DEMO_USER_ID]) {
    assert.equal(await verifyPassword(taxmin, u.parolHash), false, `'${taxmin}' ishlamasligi kerak`);
  }
});

test("demo kirish route'i mavjud sessiyani buzmaydi", () => {
  const src = oqi("src/app/api/demo/kirish/route.ts");
  const tekshiruv = src.indexOf("if (session.userId)");
  const yozish = src.indexOf("session.userId = demo.userId");
  assert.ok(tekshiruv > 0, "mavjud sessiya tekshiruvi yo'q");
  assert.ok(yozish > tekshiruv, "sessiya tekshiruvdan OLDIN qayta yozilmasligi kerak");
  assert.ok(src.includes("status: 409"));
});

test("demoFoydalanuvchimi faqat demo hisobiga rost qaytaradi", async () => {
  assert.equal(await demoFoydalanuvchimi(DEMO_USER_ID), true);
  assert.equal(await demoFoydalanuvchimi(mijoz.user.id), false);
});

test("computeAccess: demo — FULL + demo bayrog'i; oddiy mijozda o'zgarish yo'q", () => {
  const demo = computeAccess({
    status: "ACTIVE",
    trialEndsAt: null,
    currentPeriodEnd: null,
    bepul: true,
    demo: true,
  });
  assert.equal(demo.demo, true);
  assert.equal(demo.mode, "FULL");

  const trial = computeAccess({
    status: "TRIAL",
    trialEndsAt: new Date(Date.now() + 10 * 86_400_000),
    currentPeriodEnd: null,
  });
  assert.equal(trial.demo, false);
  assert.equal(trial.mode, "FULL");

  const tugagan = computeAccess({
    status: "TRIAL",
    trialEndsAt: new Date(Date.now() - 86_400_000),
    currentPeriodEnd: null,
  });
  assert.equal(tugagan.mode, "BILLING_ONLY");
  assert.equal(tugagan.demo, false);
});

// ──────────────────────────── 4. IZOLYATSIYA ────────────────────────────────

test("demo tenant boshqa mijoz ma'lumotini ko'rmaydi", async () => {
  const bizneslar = await runWithTenant(DEMO_TENANT_ID, () => prisma.business.findMany());
  assert.equal(bizneslar.length, 1);
  assert.equal(bizneslar[0].id, DEMO_BUSINESS_ID);

  const begonaBiznes = await runWithTenant(DEMO_TENANT_ID, () =>
    prisma.business.findFirst({ where: { id: mijoz.business.id } })
  );
  assert.equal(begonaBiznes, null);

  const begonaYozuv = await runWithTenant(DEMO_TENANT_ID, () =>
    prisma.transaction.findMany({ where: { businessId: mijoz.business.id } })
  );
  assert.equal(begonaYozuv.length, 0);
});

test("haqiqiy mijoz demo ma'lumotini ko'rmaydi", async () => {
  const bizneslar = await runWithTenant(mijoz.tenant.id, () => prisma.business.findMany());
  assert.equal(bizneslar.length, 1);
  assert.equal(bizneslar[0].id, mijoz.business.id);

  const demoMahsulot = await runWithTenant(mijoz.tenant.id, () =>
    prisma.product.findMany({ where: { businessId: DEMO_BUSINESS_ID } })
  );
  assert.equal(demoMahsulot.length, 0);
});

// ───────────────────── 5. HAQIQIY MIJOZLARDA REGRESSIYA ─────────────────────

test("signup avvalgidek: TRIAL, 14 kun, demo emas", async () => {
  assert.equal(mijoz.tenant.status, "TRIAL");
  assert.equal(mijoz.tenant.demo, false);
  const kunlar = (mijoz.tenant.trialEndsAt.getTime() - Date.now()) / 86_400_000;
  assert.ok(kunlar > 13.9 && kunlar <= 14.01);
});

test("oddiy mijoz tenantida yozish oqimi ishlayveradi", async () => {
  const yozildi = await runWithTenant(mijoz.tenant.id, async () => {
    const kat = await prisma.category.findFirst({ where: { businessId: mijoz.business.id, turi: "kirim" } });
    const kassa = await prisma.account.findFirst({ where: { businessId: mijoz.business.id } });
    return prisma.transaction.create({
      data: {
        businessId: mijoz.business.id,
        turi: "kirim",
        categoryId: kat.id,
        accountId: kassa.id,
        tolovTuri: "naqd",
        summa: 150_000,
        sana: bugunUTC(),
        userId: mijoz.user.id,
      },
    });
  });
  assert.equal(yozildi.summa, 150_000);
});

// ───────────────────── 6. DEMO RAQAMLARI MOS KELADIMI ───────────────────────

test("demo dataset ekildi (kassa, mijoz, xodim, zakaz)", async () => {
  const [kassa, mijozlar, xodimlar, zakazlar, bosqichlar] = await Promise.all([
    rawPrisma.account.count({ where: { businessId: DEMO_BUSINESS_ID } }),
    rawPrisma.contact.count({ where: { businessId: DEMO_BUSINESS_ID } }),
    rawPrisma.employee.count({ where: { businessId: DEMO_BUSINESS_ID } }),
    rawPrisma.deal.count({ where: { businessId: DEMO_BUSINESS_ID } }),
    rawPrisma.stage.count({ where: { businessId: DEMO_BUSINESS_ID } }),
  ]);
  assert.equal(kassa, 2, "demo'da ikkita kassa bo'lishi kerak");
  assert.equal(mijozlar, ekish.mijozlar);
  assert.equal(xodimlar, ekish.xodimlar);
  assert.equal(zakazlar, ekish.zakazlar);
  assert.ok(bosqichlar >= 3);
});

test("kirim va chiqim jamlari reja bilan bir xil", async () => {
  const jamlar = demoJamlar(demoReja());
  const [kirim, chiqim] = await Promise.all([
    rawPrisma.transaction.aggregate({
      where: { businessId: DEMO_BUSINESS_ID, turi: "kirim", deletedAt: null },
      _sum: { summa: true },
    }),
    rawPrisma.transaction.aggregate({
      where: { businessId: DEMO_BUSINESS_ID, turi: "chiqim", deletedAt: null },
      _sum: { summa: true },
    }),
  ]);
  assert.equal(kirim._sum.summa, jamlar.kirim);
  assert.equal(chiqim._sum.summa, jamlar.chiqim);
  assert.equal(kirim._sum.summa - chiqim._sum.summa, jamlar.sofFoyda);
});

test("ombor qoldig'i = kirgan − sotilgan (har mahsulot uchun)", async () => {
  for (const m of MAHSULOTLAR) {
    const mahsulot = await rawPrisma.product.findFirst({
      where: { businessId: DEMO_BUSINESS_ID, nomi: m.nomi },
      select: { id: true, miqdor: true },
    });
    const kirgan = await rawPrisma.stockEntry.aggregate({
      where: { productId: mahsulot.id },
      _sum: { miqdor: true },
    });
    const sotilgan = await rawPrisma.sale.aggregate({
      where: { productId: mahsulot.id, deletedAt: null },
      _sum: { miqdor: true },
    });
    assert.equal(
      (kirgan._sum.miqdor ?? 0) - (sotilgan._sum.miqdor ?? 0),
      mahsulot.miqdor,
      `${m.nomi}: ombor qoldig'i harakat bilan mos emas`
    );
    assert.ok(mahsulot.miqdor >= 0);
  }
});

test("qarzdorlik: to'langan qismi kirim bilan, qoldiq reja bilan mos", async () => {
  const jamlar = demoJamlar(demoReja());
  const qarzlar = await rawPrisma.debt.findMany({
    where: { businessId: DEMO_BUSINESS_ID, turi: "olinadigan" },
    select: { id: true, jamiSumma: true, tolangan: true, status: true, isYopilgan: true },
  });
  assert.ok(qarzlar.length > 0, "demo'da qarzdorlik bo'lishi kerak");

  let ochiq = 0;
  for (const q of qarzlar) {
    assert.ok(q.tolangan <= q.jamiSumma, "to'lov qarzdan oshib ketmasligi kerak");
    // `status` va `isYopilgan` har doim sinxron (schema izohi).
    assert.equal(q.isYopilgan, q.status === "PAID" || q.status === "CANCELLED");
    if (q.status === "PAID") assert.equal(q.tolangan, q.jamiSumma);
    ochiq += q.jamiSumma - q.tolangan;
  }
  assert.equal(ochiq, jamlar.qarzQoldiq);

  const tolovlar = await rawPrisma.debtPayment.aggregate({
    where: { businessId: DEMO_BUSINESS_ID },
    _sum: { summa: true },
  });
  const qarzKirimi = await rawPrisma.transaction.aggregate({
    where: { businessId: DEMO_BUSINESS_ID, turi: "kirim", izoh: "Qarz to'lovi qabul qilindi" },
    _sum: { summa: true },
  });
  assert.equal(tolovlar._sum.summa, qarzKirimi._sum.summa);
});

test("kassa qoldiqlari manfiy emas va yig'indisi sof foydaga teng", async () => {
  const jamlar = demoJamlar(demoReja());
  const kassalar = await rawPrisma.account.findMany({ where: { businessId: DEMO_BUSINESS_ID } });
  let jami = 0;
  for (const acc of kassalar) {
    const [kirim, chiqim, kelgan, ketgan] = await Promise.all([
      rawPrisma.transaction.aggregate({
        where: { accountId: acc.id, turi: "kirim", deletedAt: null },
        _sum: { summa: true },
      }),
      rawPrisma.transaction.aggregate({
        where: { accountId: acc.id, turi: "chiqim", deletedAt: null },
        _sum: { summa: true },
      }),
      rawPrisma.accountTransfer.aggregate({ where: { toAccountId: acc.id }, _sum: { summa: true } }),
      rawPrisma.accountTransfer.aggregate({ where: { fromAccountId: acc.id }, _sum: { summa: true } }),
    ]);
    const qoldiq =
      (kirim._sum.summa ?? 0) - (chiqim._sum.summa ?? 0) + (kelgan._sum.summa ?? 0) - (ketgan._sum.summa ?? 0);
    assert.ok(qoldiq >= 0, `${acc.nomi} kassasi manfiy qoldiqda: ${qoldiq}`);
    jami += qoldiq;
  }
  // Kassalararo o'tkazma sof foydaga ta'sir qilmaydi — yig'indi baribir teng.
  assert.equal(jami, jamlar.sofFoyda);
});

test("sof foyda musbat — demo ishlayotgan biznesga o'xshashi kerak", () => {
  const jamlar = demoJamlar(demoReja());
  assert.ok(jamlar.sofFoyda > 0, `sof foyda musbat bo'lishi kerak, hozir: ${jamlar.sofFoyda}`);
  assert.ok(jamlar.qarzQoldiq > 0, "qarzdorlik ekrani bo'sh bo'lmasligi kerak");
  assert.ok(jamlar.omborQiymati > 0);
});

test("bugungi kirim va chiqim bo'sh emas", async () => {
  const bugun = bugunUTC();
  const [kirim, chiqim] = await Promise.all([
    rawPrisma.transaction.count({
      where: { businessId: DEMO_BUSINESS_ID, turi: "kirim", sana: bugun },
    }),
    rawPrisma.transaction.count({
      where: { businessId: DEMO_BUSINESS_ID, turi: "chiqim", sana: bugun },
    }),
  ]);
  assert.ok(kirim > 0, "bugungi kirim bo'lishi kerak — dashboard bo'sh ko'rinmasin");
  assert.ok(chiqim > 0, "bugungi chiqim bo'lishi kerak");
});

test("qayta ekish idempotent — raqamlar ikkilanmaydi", async () => {
  const oldin = await rawPrisma.transaction.count({ where: { businessId: DEMO_BUSINESS_ID } });
  await demoDatasetYarat(rawPrisma);
  const keyin = await rawPrisma.transaction.count({ where: { businessId: DEMO_BUSINESS_ID } });
  assert.equal(keyin, oldin);
  // Haqiqiy mijozning yozuvi qayta ekishdan keyin ham joyida.
  const mijozYozuvi = await rawPrisma.transaction.count({ where: { businessId: mijoz.business.id } });
  assert.equal(mijozYozuvi, 1);
});

test("demo bo'lmagan tenant ustiga ekish RAD etiladi", async () => {
  // Demo bayrog'ini vaqtincha olib tashlaymiz — skript uni "haqiqiy mijoz"
  // deb bilishi va ma'lumotini o'chirmasligi SHART.
  await rawPrisma.tenant.update({ where: { id: DEMO_TENANT_ID }, data: { demo: false } });
  await assert.rejects(() => demoDatasetYarat(rawPrisma), /demo ekish TO'XTATILDI/);
  const saqlanib = await rawPrisma.transaction.count({ where: { businessId: DEMO_BUSINESS_ID } });
  assert.ok(saqlanib > 0, "rad etilgan ekish ma'lumotni o'chirmasligi kerak");
  await rawPrisma.tenant.update({ where: { id: DEMO_TENANT_ID }, data: { demo: true } });
});

// ─────────────────── 7. DEMO METRIKANI IFLOSLANTIRMAYDI ─────────────────────

test("cron, eslatma va superadmin metrikasi demo tenantni chetlab o'tadi", () => {
  assert.ok(
    oqi("src/lib/cron/ishlar.ts").includes("where: { demo: false }"),
    "cron aylanishi demo tenantni chiqarib tashlashi kerak"
  );
  assert.ok(
    oqi("src/lib/billing/notify.ts").includes("where: { demo: false }"),
    "obuna eslatmalari demo tenantga yuborilmasligi kerak"
  );
  const sa = oqi("src/lib/superadmin/dashboard.ts");
  assert.ok(sa.includes("const DEMOSIZ"), "superadmin metrikasida demo filtri yo'q");
  assert.ok(sa.split("DEMOSIZ").length - 1 >= 7, "metrika kesimlarining hammasi filtrlanmagan");
});
