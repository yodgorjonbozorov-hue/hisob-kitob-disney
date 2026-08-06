/**
 * XARID MODULI (Faza 6.1) — ta'minotchi, xarid buyurtmasi va qabul qilish.
 *
 * Modulning yuragi — `qabulQilish`: buyurtma qabul qilinganda ombor kirimi,
 * tannarx va pul yozuvi BITTA atomik amalda yoziladi. Qoralama va tasdiqlangan
 * buyurtma esa hech narsaga tegmasligi kerak — reja bilan haqiqat aralashmaydi.
 *
 * Ishga tushirish: npm run test:xarid
 */
process.env.DATABASE_URL = "file:./prisma/test-xarid.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let xarid: any;
let queries: any;
let createTenantWithOwner: any;

let t: any;
let t2: any;
let taminotchi: any;
let un: any;
let shakar: any;

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}
function T2<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t2.tenant.id, fn, { userId: t2.user.id, ism: "Begona" });
}

before(async () => {
  rmSync("prisma/test-xarid.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  xarid = await import("@/lib/services/xarid");
  queries = await import("@/lib/queries/xarid");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Xarid test",
    ism: "Egasi",
    login: "+998922222301",
    parol: "parol12345",
  });
  t2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona firma",
    ism: "Begona",
    login: "+998922222302",
    parol: "parol12345",
  });
  await rawPrisma.business.update({ where: { id: t.business.id }, data: { omborli: true } });

  un = await rawPrisma.product.create({
    data: {
      businessId: t.business.id,
      nomi: "Un", kelganNarx: 5_000, sotuvNarx: 8_000, miqdor: 10, birlik: "kg",
    },
  });
  shakar = await rawPrisma.product.create({
    data: {
      businessId: t.business.id,
      nomi: "Shakar", kelganNarx: 9_000, sotuvNarx: 12_000, miqdor: 0, birlik: "kg",
    },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Ta'minotchilar ----------

test("ta'minotchi yaratiladi va ro'yxatda ko'rinadi", async () => {
  taminotchi = await T(async () =>
    xarid.createSupplier(t.business.id, { nomi: "Oq Bug'doy MChJ", tel: "+998901112233" })
  );
  assert.equal(taminotchi.nomi, "Oq Bug'doy MChJ");
  assert.equal(taminotchi.isActive, true);

  const royxat = await T(async () => queries.listSuppliers(t.business.id));
  assert.equal(royxat.length, 1);
  assert.equal(royxat[0].jamiXarid, 0, "hali qabul qilingan buyurtma yo'q");
  assert.equal(royxat[0].ochiqBuyurtma, 0);
});

test("bir xil nomdagi ikkinchi ta'minotchi rad etiladi", async () => {
  await assert.rejects(
    () => T(async () => xarid.createSupplier(t.business.id, { nomi: "Oq Bug'doy MChJ" })),
    /allaqachon bor/
  );
});

test("boshqa tenant ta'minotchisini tahrirlab bo'lmaydi", async () => {
  await assert.rejects(
    () => T2(async () => xarid.updateSupplier(t2.business.id, taminotchi.id, { nomi: "O'g'irlandi" })),
    /topilmadi/
  );
  const p = await rawPrisma.supplier.findUnique({ where: { id: taminotchi.id } });
  assert.equal(p.nomi, "Oq Bug'doy MChJ");
});

// ---------- Buyurtma: qoralama hech narsaga tegmaydi ----------

test("qoralama buyurtma ombor va pulga TEGMAYDI", async () => {
  const order = await T(async () =>
    xarid.createOrder(t.business.id, t.user.id, {
      supplierId: taminotchi.id,
      sana: "2026-08-01",
      tolovTuri: "naqd",
      satrlar: [
        { productId: un.id, miqdor: 100, birlikNarx: 5_500 },
        { productId: shakar.id, miqdor: 50, birlikNarx: 10_000 },
      ],
    })
  );
  assert.equal(order.holat, "qoralama");
  assert.equal(order.jamiSumma, 100 * 5_500 + 50 * 10_000);

  const p = await rawPrisma.product.findUnique({ where: { id: un.id } });
  assert.equal(p.miqdor, 10, "qoralama qoldiqni oshirmasligi kerak");
  assert.equal(p.kelganNarx, 5_000, "qoralama tannarxni o'zgartirmasligi kerak");

  const txlar = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });
  assert.equal(txlar, 0, "qoralamada pul yozuvi bo'lmaydi");
});

test("boshqa biznesning mahsuloti bilan buyurtma yaratib bo'lmaydi", async () => {
  const begonaMahsulot = await rawPrisma.product.create({
    data: {
      businessId: t2.business.id,
      nomi: "Begona tovar", kelganNarx: 1_000, sotuvNarx: 2_000, miqdor: 5,
    },
  });
  await assert.rejects(
    () => T(async () => xarid.createOrder(t.business.id, t.user.id, {
      supplierId: taminotchi.id,
      sana: "2026-08-01",
      tolovTuri: "naqd",
      satrlar: [{ productId: begonaMahsulot.id, miqdor: 1, birlikNarx: 1_000 }],
    })),
    /boshqa biznesga tegishli|topilmadi/
  );
});

test("tasdiqlash holatni o'zgartiradi, ombor esa joyida qoladi", async () => {
  const order = await T(async () => (await queries.listOrders(t.business.id))[0]);
  await T(async () =>
    xarid.orderHolatiniOzgartir({ businessId: t.business.id, orderId: order.id, holat: "tasdiqlangan" })
  );
  const yangilangan = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  assert.equal(yangilangan.holat, "tasdiqlangan");

  const p = await rawPrisma.product.findUnique({ where: { id: un.id } });
  assert.equal(p.miqdor, 10, "tasdiqlash ham ombor qoldig'iga tegmaydi");
});

// ---------- Qabul qilish: naqd ----------

test("naqd buyurtmani qabul qilish omborga kirim va CHIQIM yozadi", async () => {
  const order = await T(async () => (await queries.listOrders(t.business.id))[0]);
  const natija = await T(async () =>
    xarid.qabulQilish({
      businessId: t.business.id, orderId: order.id, userId: t.user.id, qabulSana: "2026-08-03",
    })
  );
  assert.equal(natija.holat, "qabul_qilingan");
  assert.ok(natija.transactionId, "naqd xaridda tranzaksiya yozilishi kerak");
  assert.equal(natija.debtId, null, "naqd xaridda qarz yozilmaydi");

  const unYangi = await rawPrisma.product.findUnique({ where: { id: un.id } });
  assert.equal(unYangi.miqdor, 110, "10 + 100");
  assert.equal(unYangi.kelganNarx, 5_500, "tannarx yangi xarid narxiga yangilanadi");

  const shakarYangi = await rawPrisma.product.findUnique({ where: { id: shakar.id } });
  assert.equal(shakarYangi.miqdor, 50);
  assert.equal(shakarYangi.kelganNarx, 10_000);

  const kirimlar = await rawPrisma.stockEntry.findMany({ where: { businessId: t.business.id } });
  assert.equal(kirimlar.length, 2, "har satr uchun bitta StockEntry");

  const txn = await rawPrisma.transaction.findUnique({ where: { id: natija.transactionId } });
  assert.equal(txn.turi, "chiqim");
  assert.equal(txn.summa, 100 * 5_500 + 50 * 10_000);

  const qarzlar = await rawPrisma.debt.count({ where: { businessId: t.business.id } });
  assert.equal(qarzlar, 0);
});

test("qabul qilingan buyurtmani qayta qabul qilib bo'lmaydi", async () => {
  const order = await T(async () => (await queries.listOrders(t.business.id))[0]);
  await assert.rejects(
    () => T(async () => xarid.qabulQilish({
      businessId: t.business.id, orderId: order.id, userId: t.user.id,
    })),
    /allaqachon qabul qilingan/
  );
  const p = await rawPrisma.product.findUnique({ where: { id: un.id } });
  assert.equal(p.miqdor, 110, "rad etilgan urinish qoldiqni ikki marta oshirmasligi kerak");
});

test("qabul qilingan buyurtmani tahrirlab ham, bekor qilib ham bo'lmaydi", async () => {
  const order = await T(async () => (await queries.listOrders(t.business.id))[0]);
  await assert.rejects(
    () => T(async () => xarid.updateOrder(t.business.id, order.id, {
      satrlar: [{ productId: un.id, miqdor: 1, birlikNarx: 1 }],
    })),
    /Faqat qoralama/
  );
  await assert.rejects(
    () => T(async () => xarid.orderHolatiniOzgartir({
      businessId: t.business.id, orderId: order.id, holat: "bekor",
    })),
    /o'zgartirib bo'lmaydi/
  );
});

// ---------- Qabul qilish: qarzga ----------

test("qarzga olingan xarid CHIQIM emas, 'beriladigan' QARZ yozadi", async () => {
  const order = await T(async () =>
    xarid.createOrder(t.business.id, t.user.id, {
      supplierId: taminotchi.id,
      sana: "2026-08-04",
      tolovTuri: "qarz",
      satrlar: [{ productId: un.id, miqdor: 20, birlikNarx: 6_000 }],
    })
  );
  const oldingiTxSoni = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });

  const natija = await T(async () =>
    xarid.qabulQilish({
      businessId: t.business.id, orderId: order.id, userId: t.user.id, qabulSana: "2026-08-04",
    })
  );
  assert.equal(natija.transactionId, null, "qarzga olinganda pul chiqmaydi");
  assert.ok(natija.debtId, "qarz yozuvi bo'lishi kerak");

  const qarz = await rawPrisma.debt.findUnique({ where: { id: natija.debtId } });
  assert.equal(qarz.turi, "beriladigan", "ta'minotchiga biz qarzdormiz");
  assert.equal(qarz.jamiSumma, 20 * 6_000);
  assert.equal(qarz.mijozNomi, "Oq Bug'doy MChJ");

  const yangiTxSoni = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });
  assert.equal(yangiTxSoni, oldingiTxSoni, "qarzga xaridda yangi tranzaksiya yozilmaydi");

  const p = await rawPrisma.product.findUnique({ where: { id: un.id } });
  assert.equal(p.miqdor, 130, "tovar baribir omborga tushadi");
});

// ---------- Ta'minotchini o'chirish ----------

test("ochiq buyurtmasi bor ta'minotchi o'chirilmaydi", async () => {
  const order = await T(async () =>
    xarid.createOrder(t.business.id, t.user.id, {
      supplierId: taminotchi.id,
      sana: "2026-08-04",
      tolovTuri: "naqd",
      satrlar: [{ productId: shakar.id, miqdor: 5, birlikNarx: 10_000 }],
    })
  );
  await assert.rejects(
    () => T(async () => xarid.deleteSupplier(t.business.id, taminotchi.id)),
    /yopilmagan buyurtma/
  );

  await T(async () =>
    xarid.orderHolatiniOzgartir({ businessId: t.business.id, orderId: order.id, holat: "bekor" })
  );
  await T(async () => xarid.deleteSupplier(t.business.id, taminotchi.id));

  const ochirilgan = await rawPrisma.supplier.findUnique({ where: { id: taminotchi.id } });
  assert.ok(ochirilgan.deletedAt, "yumshoq o'chirish — yozuv qoladi");
  assert.equal(ochirilgan.isActive, false);

  const tarix = await rawPrisma.purchaseOrder.count({ where: { supplierId: taminotchi.id } });
  assert.ok(tarix >= 3, "o'chirilgandan keyin ham buyurtmalar tarixi saqlanadi");
});

// ---------- Statistika va tenant izolyatsiyasi ----------

test("statistika qabul qilingan xaridni oylik bo'yicha hisoblaydi", async () => {
  const from = new Date("2026-08-01T00:00:00.000Z");
  const to = new Date("2026-09-01T00:00:00.000Z");
  const stats = await T(async () => queries.getXaridStats(t.business.id, from, to));

  assert.equal(stats.ochiqBuyurtma, 0, "biri qabul qilingan, biri bekor");
  assert.equal(stats.oylikXarid, 100 * 5_500 + 50 * 10_000 + 20 * 6_000);
  assert.equal(stats.taminotchiSoni, 0, "yagona ta'minotchi o'chirilgan");
});

test("begona tenant xarid buyurtmalarini ko'rmaydi", async () => {
  const begonaOrders = await T2(async () => queries.listOrders(t2.business.id));
  assert.equal(begonaOrders.length, 0);

  const begonaSuppliers = await T2(async () => queries.listSuppliers(t2.business.id));
  assert.equal(begonaSuppliers.length, 0);
});
