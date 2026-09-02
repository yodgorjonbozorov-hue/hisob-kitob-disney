/**
 * KIRIM/CHIQIM KO'RINUVCHANLIGI TESTLARI.
 *
 * Qoida: xodim (CASHIER/SELLER) faqat O'ZI kiritgan yozuvlarni ko'radi,
 * direktor (OWNER/ADMIN) — biznesdagi barchasini. Ishga tushirish:
 *   npm run test:visibility
 *
 * 6-bo'lim (2026-09 xavfsizlik tuzatishi): PUL AGREGATLARI. Kunlik sof
 * natija, chiqim jami va butun-biznes sotuv ro'yxati `hisobot.korish`
 * huquqiga bog'landi — ilgari ular xodimga ochiq edi va oylik hisobotdagi
 * cheklovni aylanib o'tardi.
 *
 * Alohida test bazasi ishlatiladi (prisma/test-visibility.db) — dev/prod bazaga tegmaydi.
 */
process.env.DATABASE_URL = "file:./prisma/test-visibility.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

// Prisma bilan bog'liq modullar env o'rnatilgandan KEYIN dinamik yuklanadi.
let rawPrisma: any;
let runWithTenant: <T>(tenantId: string, fn: () => T) => T;
let transactionScopeUserId: any;
let listTransactions: any;
let listAllTransactions: any;
let getTodayTotals: any;
let getExpectedCash: any;
let getKunlikReport: any;
let listRecentSales: any;
let effektivHuquqlar: any;

const TENANT = "t_vis";
const BIZ = "biz_vis";
const CAT_KIRIM = "cat_vis_kirim";
const CAT_CHIQIM = "cat_vis_chiqim";

const OWNER = { userId: "u_vis_owner", rol: "OWNER" as const, ism: "Direktor", login: "vis_owner" };
const KASSIR = { userId: "u_vis_kassir", rol: "CASHIER" as const, ism: "Kassir", login: "vis_kassir" };
const SOTUVCHI = { userId: "u_vis_sotuvchi", rol: "SELLER" as const, ism: "Sotuvchi", login: "vis_sotuvchi" };

const KUN = "2026-07-01";
const SANA = new Date("2026-07-01T00:00:00Z");

before(async () => {
  rmSync("prisma/test-visibility.db", { force: true });

  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) {
    throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);
  }

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ transactionScopeUserId } = await import("@/lib/auth/visibility"));
  ({ listTransactions, listAllTransactions } = await import("@/lib/queries/transactions"));
  ({ getTodayTotals, getExpectedCash } = await import("@/lib/queries/shift"));
  ({ getKunlikReport } = await import("@/lib/queries/kunlik"));
  ({ listRecentSales } = await import("@/lib/queries/inventory"));
  ({ effektivHuquqlar } = await import("@/lib/permissions/tekshir"));

  // ---- Fixture: bitta tenant/biznes, uchta foydalanuvchi, har birida yozuvlar ----
  await rawPrisma.tenant.create({ data: { id: TENANT, name: "Vis tenant", slug: "vis-tenant", status: "ACTIVE" } });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "Vis biznes", tenantId: TENANT } });

  for (const u of [OWNER, KASSIR, SOTUVCHI]) {
    await rawPrisma.user.create({
      data: { id: u.userId, ism: u.ism, login: u.login, parolHash: "x", rol: u.rol, tenantId: TENANT, businessId: BIZ },
    });
  }

  await rawPrisma.category.create({ data: { id: CAT_KIRIM, nomi: "Sotuv", turi: "kirim", businessId: BIZ } });
  await rawPrisma.category.create({ data: { id: CAT_CHIQIM, nomi: "Xarajat", turi: "chiqim", businessId: BIZ } });

  const tx = (id: string, userId: string, turi: "kirim" | "chiqim", summa: number) =>
    rawPrisma.transaction.create({
      data: {
        id,
        turi,
        categoryId: turi === "kirim" ? CAT_KIRIM : CAT_CHIQIM,
        businessId: BIZ,
        summa,
        sana: SANA,
        userId,
      },
    });

  await tx("tx_vis_owner_kirim", OWNER.userId, "kirim", 1000);
  await tx("tx_vis_kassir_kirim", KASSIR.userId, "kirim", 200);
  await tx("tx_vis_kassir_chiqim", KASSIR.userId, "chiqim", 50);
  await tx("tx_vis_sotuvchi_kirim", SOTUVCHI.userId, "kirim", 300);
  // KUNLIK HISOBOT — kun tushumi (kassir topshiradigan raqam).
  await rawPrisma.dailyReport.create({
    data: { id: "dr_vis", businessId: BIZ, sana: SANA, naqdSumma: 300, jamiSumma: 300 },
  });

  // SOTUVLAR — biri kassirniki, biri direktorniki.
  await rawPrisma.product.create({
    data: { id: "prod_vis", businessId: BIZ, nomi: "Vis mahsulot", sotuvNarx: 100 },
  });
  const sotuv = (id: string, userId: string, summa: number) =>
    rawPrisma.sale.create({
      data: {
        id,
        businessId: BIZ,
        productId: "prod_vis",
        miqdor: 1,
        birlikNarx: summa,
        tannarx: 0,
        jamiSumma: summa,
        tolovTuri: "naqd",
        userId,
        sana: SANA,
      },
    });
  await sotuv("sale_vis_kassir", KASSIR.userId, 500);
  await sotuv("sale_vis_owner", OWNER.userId, 900);

  // O'chirilgan yozuv — hech kimga ko'rinmaydi.
  await rawPrisma.transaction.create({
    data: {
      id: "tx_vis_kassir_ochirilgan",
      turi: "kirim",
      categoryId: CAT_KIRIM,
      businessId: BIZ,
      summa: 777,
      sana: SANA,
      userId: KASSIR.userId,
      deletedAt: new Date(),
    },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- 1. Qoidaning o'zi ----------
test("transactionScopeUserId: direktor/administrator — cheklovsiz", () => {
  assert.equal(transactionScopeUserId(OWNER), null);
  assert.equal(transactionScopeUserId({ userId: "u_x", rol: "ADMIN" }), null);
});

test("transactionScopeUserId: kassir/sotuvchi — faqat o'z userId'si", () => {
  assert.equal(transactionScopeUserId(KASSIR), KASSIR.userId);
  assert.equal(transactionScopeUserId(SOTUVCHI), SOTUVCHI.userId);
});

// ---------- 2. Ro'yxat ----------
test("kassir ro'yxatda faqat o'zi kiritgan yozuvlarni ko'radi", async () => {
  const res = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(KASSIR) })
  );
  const ids = res.items.map((t: any) => t.id).sort();
  assert.deepEqual(ids, ["tx_vis_kassir_chiqim", "tx_vis_kassir_kirim"]);
  assert.equal(res.total, 2);
});

test("sotuvchi boshqa xodim yozuvini ko'rmaydi", async () => {
  const res = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(SOTUVCHI) })
  );
  assert.deepEqual(res.items.map((t: any) => t.id), ["tx_vis_sotuvchi_kirim"]);
});

test("direktor biznesdagi barcha yozuvlarni ko'radi", async () => {
  const res = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(OWNER) })
  );
  assert.equal(res.total, 4); // o'chirilgani kirmaydi
  const userIds = new Set(res.items.map((t: any) => t.userId));
  assert.deepEqual([...userIds].sort(), [OWNER.userId, KASSIR.userId, SOTUVCHI.userId].sort());
});

// ---------- 3. Jamlanmalar ----------
test("jami kirim/chiqim ham xodim ko'rgan yozuvlar bo'yicha hisoblanadi", async () => {
  const kassir = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(KASSIR) })
  );
  // Kassasiz (accountId null) va tolovTuri'siz yozuvlar naqd bo'limiga tushadi.
  assert.deepEqual(kassir.totals, {
    jamiKirim: 200,
    jamiChiqim: 50,
    sof: 150,
    naqdKirim: 200,
    clickKirim: 0,
    qarzKirim: 0,
  });

  const owner = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(OWNER) })
  );
  assert.deepEqual(owner.totals, {
    jamiKirim: 1500,
    jamiChiqim: 50,
    sof: 1450,
    naqdKirim: 1500,
    clickKirim: 0,
    qarzKirim: 0,
  });
});

test("filtrlar ko'rinuvchanlik chegarasi bilan birga ishlaydi", async () => {
  const res = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(KASSIR), turi: "kirim" })
  );
  assert.deepEqual(res.items.map((t: any) => t.id), ["tx_vis_kassir_kirim"]);
});

// ---------- 4. Eksport ----------
test("Excel eksporti ham xodim uchun faqat o'z yozuvlarini beradi", async () => {
  const rows = await runWithTenant(TENANT, () =>
    listAllTransactions({ businessId: BIZ, userId: transactionScopeUserId(KASSIR) })
  );
  assert.deepEqual(rows.map((t: any) => t.id).sort(), ["tx_vis_kassir_chiqim", "tx_vis_kassir_kirim"]);

  const hammasi = await runWithTenant(TENANT, () =>
    listAllTransactions({ businessId: BIZ, userId: transactionScopeUserId(OWNER) })
  );
  assert.equal(hammasi.length, 4);
});

// ---------- 5. Kassa ekrani va kun yakuni ----------
test("bugungi jami — kassirga o'ziniki, direktorga hammasi", async () => {
  const kassir = await runWithTenant(TENANT, () => getTodayTotals(BIZ, KUN, transactionScopeUserId(KASSIR)));
  assert.deepEqual(kassir, { kirim: 200, chiqim: 50 });

  const owner = await runWithTenant(TENANT, () => getTodayTotals(BIZ, KUN, transactionScopeUserId(OWNER)));
  assert.deepEqual(owner, { kirim: 1500, chiqim: 50 });
});

test("kun yakunidagi kutilgan naqd — kassirning o'z kirimlari", async () => {
  const kassir = await runWithTenant(TENANT, () => getExpectedCash(BIZ, KUN, transactionScopeUserId(KASSIR)));
  assert.equal(kassir, 200);

  const owner = await runWithTenant(TENANT, () => getExpectedCash(BIZ, KUN, transactionScopeUserId(OWNER)));
  assert.equal(owner, 1500);
});

// ---------- 6. PUL AGREGATLARI (`hisobot.korish` huquqi) ----------

const huquqlar = (rol: string) => effektivHuquqlar({ rol });

test("hisobot.korish — direktorda bor, kassir va sotuvchida yo'q", () => {
  assert.ok(huquqlar("OWNER").has("hisobot.korish"), "OWNER");
  assert.ok(huquqlar("ADMIN").has("hisobot.korish"), "ADMIN");
  assert.ok(!huquqlar("CASHIER").has("hisobot.korish"), "CASHIER");
  assert.ok(!huquqlar("SELLER").has("hisobot.korish"), "SELLER");
});

test("kunlik hisobot: huquqsiz xodimga chiqim va sof natija BERILMAYDI", async () => {
  const xodim = await runWithTenant(TENANT, () => getKunlikReport(BIZ, KUN, false));
  assert.equal(xodim.chiqimSumma, null, "chiqim yopiq");
  assert.equal(xodim.sofSumma, null, "sof natija yopiq");
  // O'z tushumi qoladi — kassa topshirig'i aynan shu raqam ustida yuritiladi.
  assert.equal(xodim.jamiSumma, 300);
  assert.equal(xodim.naqdSumma, 300);
});

test("kunlik hisobot: huquqli boshqaruvchi to'liq raqamni ko'radi", async () => {
  const rahbar = await runWithTenant(TENANT, () => getKunlikReport(BIZ, KUN, true));
  assert.equal(rahbar.chiqimSumma, 50, "kunning chiqimi");
  assert.equal(rahbar.sofSumma, 250, "300 − 50");
});

test("kunlik hisobot: hisobot OCHILMAGAN kunda ham yopiq qoladi", async () => {
  const bosh = await runWithTenant(TENANT, () => getKunlikReport(BIZ, "2026-07-02", false));
  assert.equal(bosh.chiqimSumma, null);
  assert.equal(bosh.sofSumma, null);
  assert.equal(bosh.jamiSumma, 0);
});

test("sotuvlar ro'yxati: huquqsiz xodim faqat O'ZI rasmiylashtirganini ko'radi", async () => {
  const kassir = await runWithTenant(TENANT, () => listRecentSales(BIZ, 20, KASSIR.userId));
  assert.deepEqual(
    kassir.map((s: any) => s.id),
    ["sale_vis_kassir"]
  );
  const hammasi = await runWithTenant(TENANT, () => listRecentSales(BIZ, 20, null));
  assert.equal(hammasi.length, 2, "huquqli boshqaruvchi — biznesdagi hammasi");
});

// ---------- 7. ROUTE ULANISHI — himoya chaqirilmay qolib ketmasin ----------

test("api/sales/statistika hisobot.korish talab qiladi (forbidSeller yetarli emas)", () => {
  const route = readFileSync("src/app/api/sales/statistika/route.ts", "utf8");
  assert.match(route, /requirePermission\(user\.userId, "hisobot\.korish"\)/);
  assert.ok(!route.includes("forbidSeller("), "eski, bo'sh cheklov olib tashlangan");
});

test("api/sales GET ro'yxatni huquqsiz xodim uchun kesadi", () => {
  const route = readFileSync("src/app/api/sales/route.ts", "utf8");
  assert.match(route, /hasPermission\(user\.userId, "hisobot\.korish"\)/);
  assert.match(route, /listRecentSales\(businessId, 20, hammasi \? null : user\.userId\)/);
});

test("api/kunlik/hisobot moliyaviy kesimni huquqqa bog'laydi", () => {
  const route = readFileSync("src/app/api/kunlik/hisobot/route.ts", "utf8");
  assert.match(route, /hasPermission\(user\.userId, "hisobot\.korish"\)/);
  assert.match(route, /getKunlikReport\(businessId, sana, moliyaKorinadi\)/);
});

test("sahifalar API bilan BIR XIL shartda ishlaydi (UI/API ajralib qolmasin)", () => {
  const tranzaksiyalar = readFileSync("src/app/app/tranzaksiyalar/page.tsx", "utf8");
  assert.ok(
    !tranzaksiyalar.includes('session.rol !== "SELLER"'),
    "sotuv statistikasi bloki endi rolga emas, huquqqa bog'langan"
  );
  const kunlik = readFileSync("src/app/app/kunlik/page.tsx", "utf8");
  assert.match(kunlik, /hasPermission\(session\.userId, "hisobot\.korish"\)/);
  const sotuv = readFileSync("src/app/app/sotuv/page.tsx", "utf8");
  assert.match(sotuv, /hasPermission\(session\.userId, "hisobot\.korish"\)/);
});

test("getKunlikReport huquq parametrini MAJBURIY talab qiladi", () => {
  // Default qiymat qo'yilsa, uni unutgan yangi chaqiruv jimgina moliyani
  // ochib yuborardi. Bu yerda unutish kompilyatsiya xatosi bo'lishi kerak.
  const manba = readFileSync("src/lib/queries/kunlik.ts", "utf8");
  assert.ok(
    /moliyaKorinadi: boolean\s*\): Promise<KunlikReportDTO>/.test(manba),
    "parametr default qiymatsiz (majburiy) bo'lishi kerak"
  );
});
