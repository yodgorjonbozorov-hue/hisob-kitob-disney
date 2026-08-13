/**
 * SOTUVNI BEKOR QILISH VA SOTUV SANASI (Faza 4.2 — B-1, B-4, B-5).
 *
 * B-4: sotuvni bekor qilish yo'li umuman yo'q edi — kassir xato sotuv kiritsa
 * omborda tovar kam, kassada pul ko'p bo'lib qolardi. Kassa dasturi uchun
 * qabul qilib bo'lmaydigan holat.
 * B-5: `Sale` da faqat `createdAt` bor edi — kechagi sotuv kechagi hisobotga
 * tushmasdi.
 * H-1: kelishilgan narx OMBOR rejimida ham katalog narxini buzardi.
 *
 * Ishga tushirish: npm run test:sotuv-bekor
 */
process.env.DATABASE_URL = "file:./prisma/test-sotuv-bekor.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let inventory: any;
let queries: any;
let dashboard: any;
let report: any;
let createTenantWithOwner: any;

let ombor: any; // umumiy (omborli) biznes
let avto: any;

function O<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(ombor.tenant.id, fn, { userId: ombor.user.id, ism: "Direktor" });
}
function A<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(avto.tenant.id, fn, { userId: avto.user.id, ism: "Avto direktor" });
}

before(async () => {
  rmSync("prisma/test-sotuv-bekor.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  inventory = await import("@/lib/services/inventory");
  queries = await import("@/lib/queries/inventory");
  dashboard = await import("@/lib/queries/dashboard");
  report = await import("@/lib/queries/report");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  ombor = await createTenantWithOwner({
    kompaniyaNomi: "Salyut do'kon",
    ism: "Egasi",
    login: "+998911111101",
    parol: "parol12345",
  });
  await rawPrisma.business.update({ where: { id: ombor.business.id }, data: { omborli: true } });

  avto = await createTenantWithOwner({
    kompaniyaNomi: "Avto bozor",
    ism: "Egasi",
    login: "+998911111102",
    parol: "parol12345",
    biznesTuri: "avto",
    plan: "AVTO",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- B-5: sotuv sanasi ----------

test("orqaga sana bilan kiritilgan sotuv O'SHA oyning hisobotiga tushadi", async () => {
  const p = await rawPrisma.product.create({
    data: { businessId: ombor.business.id, nomi: "Salyut A", kelganNarx: 10_000, sotuvNarx: 25_000, miqdor: 100 },
  });

  await O(async () =>
    inventory.createSale({
      businessId: ombor.business.id, productId: p.id, miqdor: 2,
      tolovTuri: "naqd", sana: "2026-06-15", userId: ombor.user.id,
    })
  );

  const sale = await rawPrisma.sale.findFirst({ where: { productId: p.id } });
  assert.equal(sale.sana.toISOString().slice(0, 10), "2026-06-15");

  // Naqd sotuvning kirim tranzaksiyasi ham O'SHA sanaga yozilishi kerak,
  // aks holda sotuv iyunda, pul iyulda ko'rinardi.
  const txn = await rawPrisma.transaction.findUnique({ where: { id: sale.transactionId } });
  assert.equal(txn.sana.toISOString().slice(0, 10), "2026-06-15");

  const iyun = await O(async () => dashboard.getMonthSummary(ombor.business.id, "2026-06"));
  assert.equal(iyun.jamiKirim, 50_000);
  const iyul = await O(async () => dashboard.getMonthSummary(ombor.business.id, "2026-07"));
  assert.equal(iyul.jamiKirim, 0);
});

test("sana berilmasa bugungi sana qo'yiladi", async () => {
  const p = await rawPrisma.product.create({
    data: { businessId: ombor.business.id, nomi: "Salyut B", kelganNarx: 1000, sotuvNarx: 3000, miqdor: 10 },
  });
  await O(async () =>
    inventory.createSale({
      businessId: ombor.business.id, productId: p.id, miqdor: 1, tolovTuri: "naqd", userId: ombor.user.id,
    })
  );
  const sale = await rawPrisma.sale.findFirst({ where: { productId: p.id } });
  // H-2: "bugun" endi Toshkent kalendari bo'yicha — UTC 19:00 dan keyin
  // UTC-kun bilan farq qiladi, shuning uchun kutilma ham shu funksiyadan.
  const { todayTashkentDateOnlyString } = await import("@/lib/date");
  assert.equal(sale.sana.toISOString().slice(0, 10), todayTashkentDateOnlyString());
});

// ---------- H-1: narx buzilishi ----------

test("OMBOR rejimida kelishilgan narx katalogni BUZMAYDI", async () => {
  const p = await rawPrisma.product.create({
    data: { businessId: ombor.business.id, nomi: "Raketa", kelganNarx: 5_000, sotuvNarx: 12_000, miqdor: 500 },
  });
  // 500 donadan bittasini chegirma bilan sotamiz.
  await O(async () =>
    inventory.createSale({
      businessId: ombor.business.id, productId: p.id, miqdor: 1,
      tolovTuri: "naqd", narx: 9_000, userId: ombor.user.id,
    })
  );
  const keyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(keyin.sotuvNarx, 12_000, "katalog narxi o'zgarmasligi kerak");

  // Sotuvning O'ZIDA esa chegirma narxi saqlanadi.
  const sale = await rawPrisma.sale.findFirst({ where: { productId: p.id } });
  assert.equal(sale.birlikNarx, 9_000);
});

test("AVTO rejimida kelishilgan narx kartochkada saqlanadi", async () => {
  const mashina = await A(async () =>
    inventory.createAvtoMashina({
      businessId: avto.business.id, nomi: "Cobalt", olinganNarx: 120_000_000,
      sotuvNarx: 140_000_000, tolovTuri: "naqd", userId: avto.user.id,
    })
  );
  await A(async () =>
    inventory.createSale({
      businessId: avto.business.id, productId: mashina.id, miqdor: 1,
      tolovTuri: "naqd", narx: 135_000_000, userId: avto.user.id,
    })
  );
  const kartochka = await rawPrisma.product.findUnique({ where: { id: mashina.id } });
  assert.equal(kartochka.sotuvNarx, 135_000_000, "avto rejimida haqiqiy narx yozilishi kerak");
});

// ---------- B-4: bekor qilish ----------

test("naqd sotuvni bekor qilish: qoldiq qaytadi, kirim yo'qoladi", async () => {
  const p = await rawPrisma.product.create({
    data: { businessId: ombor.business.id, nomi: "Fontan", kelganNarx: 2_000, sotuvNarx: 6_000, miqdor: 50 },
  });
  await O(async () =>
    inventory.createSale({
      businessId: ombor.business.id, productId: p.id, miqdor: 5,
      tolovTuri: "naqd", sana: "2026-08-01", userId: ombor.user.id,
    })
  );

  const sotuvdanKeyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(sotuvdanKeyin.miqdor, 45);
  // Avgustda boshqa sotuvlar ham bo'lishi mumkin — FARQNI tekshiramiz.
  const oldin = await O(async () => dashboard.getMonthSummary(ombor.business.id, "2026-08"));

  const sale = await rawPrisma.sale.findFirst({ where: { productId: p.id } });
  await O(async () =>
    inventory.cancelSale({
      businessId: ombor.business.id, saleId: sale.id,
      sabab: "Xato mahsulot tanlandi", userId: ombor.user.id,
    })
  );

  const bekordanKeyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(bekordanKeyin.miqdor, 50, "ombor qoldig'i qaytishi kerak");

  const keyin = await O(async () => dashboard.getMonthSummary(ombor.business.id, "2026-08"));
  assert.equal(oldin.jamiKirim - keyin.jamiKirim, 30_000, "aynan shu sotuv kirimi bekor qilinishi kerak");

  const bekor = await rawPrisma.sale.findUnique({ where: { id: sale.id } });
  assert.ok(bekor.deletedAt, "sotuv yumshoq o'chirilishi kerak");
  assert.equal(bekor.cancelledBy, ombor.user.id);
  assert.equal(bekor.cancelReason, "Xato mahsulot tanlandi");
});

test("bekor qilingan sotuv foydalilik va hisobotdan chiqib ketadi", async () => {
  const foyda = await O(async () => queries.getProductProfitability(ombor.business.id));
  assert.ok(!foyda.some((f: any) => f.nomi === "Fontan"), "bekor qilingan sotuv foydaga kirmasligi kerak");
});

test("takroriy bekor qilish rad etiladi, sababsiz ham", async () => {
  const sale = await rawPrisma.sale.findFirst({ where: { deletedAt: { not: null } } });
  await assert.rejects(
    () => O(async () => inventory.cancelSale({
      businessId: ombor.business.id, saleId: sale.id, sabab: "yana", userId: ombor.user.id,
    })),
    /allaqachon bekor/
  );
  const tirik = await rawPrisma.sale.findFirst({ where: { deletedAt: null } });
  await assert.rejects(
    () => O(async () => inventory.cancelSale({
      businessId: ombor.business.id, saleId: tirik.id, sabab: "   ", userId: ombor.user.id,
    })),
    /sababi/
  );
});

test("qarzga sotuvni bekor qilish qarzni ham o'chiradi", async () => {
  const p = await rawPrisma.product.create({
    data: { businessId: ombor.business.id, nomi: "Petarda", kelganNarx: 500, sotuvNarx: 1_500, miqdor: 20 },
  });
  await O(async () =>
    inventory.createSale({
      businessId: ombor.business.id, productId: p.id, miqdor: 4, tolovTuri: "qarz",
      mijozNomi: "Jasur", sana: "2026-08-02", userId: ombor.user.id,
    })
  );
  const sale = await rawPrisma.sale.findFirst({ where: { productId: p.id } });
  assert.ok(await rawPrisma.debt.findFirst({ where: { saleId: sale.id } }), "qarz ochilishi kerak");

  await O(async () =>
    inventory.cancelSale({
      businessId: ombor.business.id, saleId: sale.id, sabab: "Mijoz voz kechdi", userId: ombor.user.id,
    })
  );
  assert.equal(await rawPrisma.debt.findFirst({ where: { saleId: sale.id } }), null, "qarz o'chirilishi kerak");
  assert.equal((await rawPrisma.product.findUnique({ where: { id: p.id } })).miqdor, 20);
});

test("qarzi to'langan sotuvni bekor qilib bo'lmaydi", async () => {
  const p = await rawPrisma.product.create({
    data: { businessId: ombor.business.id, nomi: "Bengal", kelganNarx: 300, sotuvNarx: 900, miqdor: 30 },
  });
  await O(async () =>
    inventory.createSale({
      businessId: ombor.business.id, productId: p.id, miqdor: 3, tolovTuri: "qarz",
      mijozNomi: "Aziz", userId: ombor.user.id,
    })
  );
  const sale = await rawPrisma.sale.findFirst({ where: { productId: p.id } });
  const debt = await rawPrisma.debt.findFirst({ where: { saleId: sale.id } });
  await O(async () =>
    inventory.recordDebtPayment({
      businessId: ombor.business.id, debtId: debt.id, summa: 1_000, userId: ombor.user.id,
    })
  );

  await assert.rejects(
    () => O(async () => inventory.cancelSale({
      businessId: ombor.business.id, saleId: sale.id, sabab: "test", userId: ombor.user.id,
    })),
    /to'lovlarni bekor qiling/
  );
  // Rad etilgani uchun qoldiq ham o'zgarmasligi kerak (tranzaksiya orqaga qaytdi).
  assert.equal((await rawPrisma.product.findUnique({ where: { id: p.id } })).miqdor, 27);
});

test("boshqa tenant sotuvini bekor qilib bo'lmaydi", async () => {
  const sale = await rawPrisma.sale.findFirst({ where: { businessId: ombor.business.id, deletedAt: null } });
  await assert.rejects(() =>
    A(async () => inventory.cancelSale({
      businessId: avto.business.id, saleId: sale.id, sabab: "hack", userId: avto.user.id,
    }))
  );
});

test("avto oylik hisoboti sana bo'yicha ishlaydi", async () => {
  const yakun = await A(async () => report.getAvtoOylikYakun(avto.business.id, new Date().toISOString().slice(0, 7)));
  const cobalt = yakun.qatorlar.find((q: any) => q.nomi === "Cobalt");
  assert.ok(cobalt, "shu oyda sotilgan mashina hisobotda bo'lishi kerak");
  assert.equal(cobalt.sotilganNarx, 135_000_000);
});
