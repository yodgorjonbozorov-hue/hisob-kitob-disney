/**
 * CSV IMPORT VA SOTUV CHEKI TESTLARI (Faza 4.4).
 *
 * Import mijozning Excel'dagi tarixini Balansa'ga ko'chirish yo'li — bu
 * dasturga o'tishning eng katta to'sig'i edi. Shuning uchun xato qatorlar
 * butun importni to'xtatmasligi, lekin yozish YARIM qolmasligi kerak.
 *
 * Ishga tushirish: npm run test:csv-import
 */
process.env.DATABASE_URL = "file:./prisma/test-csv-import.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let csv: any;
let dashboard: any;
let receipt: any;
let inventory: any;
let createTenantWithOwner: any;

let t: any;

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

before(async () => {
  rmSync("prisma/test-csv-import.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  csv = await import("@/lib/services/csvImport");
  dashboard = await import("@/lib/queries/dashboard");
  receipt = await import("@/lib/queries/receipt");
  inventory = await import("@/lib/services/inventory");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Import test",
    ism: "Egasi",
    login: "+998933333301",
    parol: "parol12345",
  });
  await rawPrisma.business.update({ where: { id: t.business.id }, data: { omborli: true } });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- CSV tahlili ----------

test("sarlavhali CSV to'g'ri o'qiladi", () => {
  const { qatorlar, xatolar } = csv.csvniOqi(
    `sana,turi,kategoriya,summa,izoh
2026-07-01,kirim,Sotuv,1250000,Do'kondan tushum
2026-07-02,chiqim,Ijara,3000000,Iyul oyi`
  );
  assert.equal(xatolar.length, 0);
  assert.equal(qatorlar.length, 2);
  assert.equal(qatorlar[0].summa, 1_250_000);
  assert.equal(qatorlar[0].turi, "kirim");
  assert.equal(qatorlar[1].kategoriya, "Ijara");
});

test("sarlavhasiz CSV ham o'qiladi", () => {
  const { qatorlar } = csv.csvniOqi("2026-07-01,kirim,Sotuv,500000,");
  assert.equal(qatorlar.length, 1);
  assert.equal(qatorlar[0].summa, 500_000);
});

test("qo'shtirnoq ichidagi vergul izohni buzmaydi", () => {
  const { qatorlar, xatolar } = csv.csvniOqi(
    `2026-07-01,chiqim,Ijara,3000000,"Iyul, avans bilan"`
  );
  assert.equal(xatolar.length, 0);
  assert.equal(qatorlar[0].izoh, "Iyul, avans bilan");
});

test("turli formatdagi summalar tushuniladi", () => {
  const { qatorlar } = csv.csvniOqi(
    `2026-07-01,kirim,Sotuv,"1 250 000",
2026-07-02,kirim,Sotuv,"1,300,000",
2026-07-03,kirim,Sotuv,1400000.00,`
  );
  assert.deepEqual(qatorlar.map((q: any) => q.summa), [1_250_000, 1_300_000, 1_400_000]);
});

test("xato qatorlar aniq sabab bilan ajratiladi, boshqalari saqlanadi", () => {
  const { qatorlar, xatolar } = csv.csvniOqi(
    `sana,turi,kategoriya,summa,izoh
2026-07-01,kirim,Sotuv,1000000,
01.07.2026,kirim,Sotuv,1000000,
2026-07-02,daromad,Sotuv,1000000,
2026-07-03,chiqim,Ijara,-500,
2026-07-04,chiqim,,100000,
2026-07-05,chiqim,Ijara,200000,`
  );
  assert.equal(qatorlar.length, 2, "to'g'ri qatorlar saqlanishi kerak");
  assert.equal(xatolar.length, 4);
  assert.match(xatolar[0].xato, /YYYY-MM-DD/);
  assert.match(xatolar[1].xato, /kirim/);
  assert.match(xatolar[2].xato, /musbat/);
  assert.equal(xatolar[0].qator, 3, "fayldagi haqiqiy qator raqami");
});

test("500 qatordan ko'pi rad etiladi", () => {
  const satrlar = Array.from({ length: 505 }, () => "2026-07-01,kirim,Sotuv,1000,").join("\n");
  const { qatorlar, xatolar } = csv.csvniOqi(satrlar);
  assert.equal(qatorlar.length, csv.MAX_QATOR);
  assert.ok(xatolar.some((x: any) => /500/.test(x.xato)));
});

// ---------- Yozish ----------

test("import yozuvlarni yaratadi va kategoriyalarni topadi/ochadi", async () => {
  const { qatorlar } = csv.csvniOqi(
    `sana,turi,kategoriya,summa,izoh
2026-05-01,kirim,Sotuv,1000000,
2026-05-02,chiqim,Yangi kategoriya,400000,
2026-05-03,kirim,Sotuv,500000,`
  );
  const yozildi = await T(async () =>
    csv.csvniYoz({ businessId: t.business.id, userId: t.user.id, qatorlar })
  );
  assert.equal(yozildi, 3);

  const may = await T(async () => dashboard.getMonthSummary(t.business.id, "2026-05"));
  assert.equal(may.jamiKirim, 1_500_000);
  assert.equal(may.jamiChiqim, 400_000);

  // Mavjud "Sotuv" kategoriyasi TAKRORLANMASLIGI kerak.
  const sotuv = await rawPrisma.category.findMany({
    where: { businessId: t.business.id, nomi: "Sotuv", turi: "kirim" },
  });
  assert.equal(sotuv.length, 1);

  const yangi = await rawPrisma.category.findFirst({
    where: { businessId: t.business.id, nomi: "Yangi kategoriya" },
  });
  assert.ok(yangi, "yo'q kategoriya yaratilishi kerak");
});

test("import qilingan yozuvlar birinchi faol kassaga bog'lanadi", async () => {
  const tx = await rawPrisma.transaction.findFirst({
    where: { businessId: t.business.id, summa: 1_000_000 },
  });
  assert.ok(tx.accountId, "kassa bog'lanishi kerak");
  const kassa = await rawPrisma.account.findUnique({ where: { id: tx.accountId } });
  assert.equal(kassa.businessId, t.business.id);
});

test("import audit jurnaliga tushadi", async () => {
  const yozuv = await rawPrisma.auditLog.findFirst({
    where: { entityId: "csv-import", businessId: t.business.id },
  });
  assert.ok(yozuv, "import audit qilinishi kerak");
  assert.match(String(yozuv.after), /CSV import/);
});

test("bo'sh ro'yxat yozilmaydi", async () => {
  const yozildi = await T(async () =>
    csv.csvniYoz({ businessId: t.business.id, userId: t.user.id, qatorlar: [] })
  );
  assert.equal(yozildi, 0);
});

// ---------- Chek ----------

test("chek ma'lumotlari to'liq yig'iladi", async () => {
  const p = await rawPrisma.product.create({
    data: {
      businessId: t.business.id, nomi: "Shakar", kelganNarx: 8_000,
      sotuvNarx: 12_000, miqdor: 50, birlik: "kg",
    },
  });
  await T(async () =>
    inventory.createSale({
      businessId: t.business.id, productId: p.id, miqdor: 3,
      tolovTuri: "naqd", sana: "2026-08-03", userId: t.user.id,
    })
  );
  const sale = await rawPrisma.sale.findFirst({ where: { productId: p.id } });

  const chek = await T(async () => receipt.getReceiptData(t.business.id, sale.id));
  assert.ok(chek);
  assert.equal(chek.mahsulot, "Shakar");
  assert.equal(chek.birlik, "kg");
  assert.equal(chek.miqdor, 3);
  assert.equal(chek.birlikNarx, 12_000);
  assert.equal(chek.jamiSumma, 36_000);
  assert.equal(chek.tolovTuri, "naqd");
  assert.equal(chek.qolganQarz, null, "naqd sotuvda qarz yo'q");
  assert.equal(chek.kassir, "Egasi");
  assert.equal(chek.businessNomi, "Import test");
});

test("qarzga sotuv chekida qolgan qarz ko'rinadi", async () => {
  const p = await rawPrisma.product.create({
    data: { businessId: t.business.id, nomi: "Guruch", kelganNarx: 10_000, sotuvNarx: 15_000, miqdor: 40 },
  });
  await T(async () =>
    inventory.createSale({
      businessId: t.business.id, productId: p.id, miqdor: 2, tolovTuri: "qarz",
      mijozNomi: "Jasur", userId: t.user.id,
    })
  );
  const sale = await rawPrisma.sale.findFirst({ where: { productId: p.id } });
  const chek = await T(async () => receipt.getReceiptData(t.business.id, sale.id));
  assert.equal(chek.qolganQarz, 30_000);
  assert.equal(chek.mijozNomi, "Jasur");
});

test("boshqa biznes sotuvining cheki ochilmaydi", async () => {
  const boshqa = await createTenantWithOwner({
    kompaniyaNomi: "Begona",
    ism: "B",
    login: "+998933333302",
    parol: "parol12345",
  });
  const sale = await rawPrisma.sale.findFirst({ where: { businessId: t.business.id } });
  const chek = await runWithTenant(boshqa.tenant.id, async () =>
    receipt.getReceiptData(boshqa.business.id, sale.id)
  );
  assert.equal(chek, null);
});
