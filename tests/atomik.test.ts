/**
 * ATOMIKLIK TESTLARI (C-2).
 *
 * Qoida: moliyaviy ko'p qadamli amal yo TO'LIQ bajariladi, yo UMUMAN
 * bajarilmaydi. O'rtada xato bo'lsa ombor qoldig'i, sotuv, tranzaksiya va
 * qarz yozuvlari birgalikda orqaga qaytishi kerak.
 *
 * Xatoni sun'iy yuzaga keltirish uchun mavjud bo'lmagan `userId` ishlatiladi:
 * qadamlarning oxirida Transaction yozuvi tashqi kalit bo'yicha yiqiladi.
 *
 * Ishga tushirish: npm run test:atomik
 */
process.env.DATABASE_URL = "file:./prisma/test-atomik.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let inventory: any;
// Qarz to'lovi `inventory` dan `qarz` xizmatiga ko'chirilgan (qarz tizimi).
let qarzSvc: any;

const TENANT = "t_at";
const BIZ = "biz_at";
const USER = "u_at_owner";
const YOQ_USER = "u_at_yoq"; // bazada yo'q — FK xatosi beradi

before(async () => {
  rmSync("prisma/test-atomik.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  inventory = await import("@/lib/services/inventory");
  qarzSvc = await import("@/lib/services/qarz");

  // SQLite'da tashqi kalitlar standart holda o'chirilgan bo'lishi mumkin —
  // atomiklik testi FK xatosiga tayangani uchun ochiq yoqamiz.
  await rawPrisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "Atomik tenant", slug: "atomik-tenant", status: "ACTIVE" },
  });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "Atomik biznes", tenantId: TENANT, omborli: true } });
  await rawPrisma.user.create({
    data: { id: USER, ism: "Direktor", login: "at_owner", parolHash: "x", rol: "OWNER", tenantId: TENANT, businessId: BIZ },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("ensureCategory: parallel sotuvlar kategoriya dublikatini yaratmaydi", async () => {
  // Ikkita mahsulot, ikkalasi ham "Sotuv" kategoriyasini talab qiladi.
  const p1 = await rawPrisma.product.create({
    data: { businessId: BIZ, nomi: "Salyut A", kelganNarx: 1000, sotuvNarx: 2000, miqdor: 50 },
  });
  const p2 = await rawPrisma.product.create({
    data: { businessId: BIZ, nomi: "Salyut B", kelganNarx: 1000, sotuvNarx: 3000, miqdor: 50 },
  });

  await Promise.all([
    runWithTenant(TENANT, () =>
      inventory.createSale({ businessId: BIZ, productId: p1.id, miqdor: 1, tolovTuri: "naqd", userId: USER })
    ),
    runWithTenant(TENANT, () =>
      inventory.createSale({ businessId: BIZ, productId: p2.id, miqdor: 1, tolovTuri: "naqd", userId: USER })
    ),
  ]);

  const kategoriyalar = await rawPrisma.category.findMany({
    where: { businessId: BIZ, nomi: "Sotuv", turi: "kirim" },
  });
  assert.equal(kategoriyalar.length, 1, "'Sotuv' kategoriyasi bitta bo'lishi kerak");
});

test("createSale yarim yo'lda uzilsa ombor qoldig'i va sotuv yozuvi qaytadi", async () => {
  const product = await rawPrisma.product.create({
    data: { businessId: BIZ, nomi: "Raketa", kelganNarx: 5000, sotuvNarx: 9000, miqdor: 20 },
  });
  const saleOldin = await rawPrisma.sale.count({ where: { businessId: BIZ } });

  await assert.rejects(() =>
    runWithTenant(TENANT, () =>
      inventory.createSale({
        businessId: BIZ,
        productId: product.id,
        miqdor: 3,
        tolovTuri: "naqd",
        userId: YOQ_USER, // Transaction yozuvida FK xatosi
      })
    )
  );

  const keyin = await rawPrisma.product.findUnique({ where: { id: product.id } });
  assert.equal(keyin.miqdor, 20, "qoldiq to'liq qaytishi kerak");
  const saleKeyin = await rawPrisma.sale.count({ where: { businessId: BIZ } });
  assert.equal(saleKeyin, saleOldin, "yarim qolgan sotuv yozuvi qolmasligi kerak");
});

test("createAvtoMashina uzilsa mashina ham, ombor kirimi ham qolmaydi", async () => {
  const oldin = await rawPrisma.product.count({ where: { businessId: BIZ } });
  const stockOldin = await rawPrisma.stockEntry.count({ where: { businessId: BIZ } });

  await assert.rejects(() =>
    runWithTenant(TENANT, () =>
      inventory.createAvtoMashina({
        businessId: BIZ,
        nomi: "Malibu",
        olinganNarx: 200_000_000,
        tolovTuri: "naqd",
        userId: YOQ_USER,
      })
    )
  );

  assert.equal(await rawPrisma.product.count({ where: { businessId: BIZ } }), oldin);
  assert.equal(await rawPrisma.stockEntry.count({ where: { businessId: BIZ } }), stockOldin);
});

test("recordDebtPayment uzilsa qarz ham, to'lov yozuvi ham o'zgarmaydi", async () => {
  const debt = await rawPrisma.debt.create({
    data: {
      businessId: BIZ,
      turi: "olinadigan",
      mijozNomi: "Jasur",
      jamiSumma: 1_000_000,
      tolangan: 0,
      userId: USER,
    },
  });

  await assert.rejects(() =>
    runWithTenant(TENANT, () =>
      qarzSvc.qarzTolov({ businessId: BIZ, debtId: debt.id, summa: 400_000, userId: YOQ_USER })
    )
  );

  const keyin = await rawPrisma.debt.findUnique({ where: { id: debt.id } });
  assert.equal(keyin.tolangan, 0, "qarz kamaymasligi kerak");
  assert.equal(await rawPrisma.debtPayment.count({ where: { debtId: debt.id } }), 0);
});

test("muvaffaqiyatli qarz to'lovi qarzni ham, tranzaksiyani ham yozadi", async () => {
  const debt = await rawPrisma.debt.create({
    data: {
      businessId: BIZ,
      turi: "olinadigan",
      mijozNomi: "Aziz",
      jamiSumma: 500_000,
      tolangan: 0,
      userId: USER,
    },
  });

  const updated = await runWithTenant(TENANT, () =>
    qarzSvc.qarzTolov({ businessId: BIZ, debtId: debt.id, summa: 500_000, userId: USER })
  );
  assert.equal(updated.tolangan, 500_000);
  assert.equal(updated.isYopilgan, true);

  const tolov = await rawPrisma.debtPayment.findFirst({ where: { debtId: debt.id } });
  assert.ok(tolov.transactionId, "to'lov tranzaksiyaga bog'lanishi kerak");
  const txn = await rawPrisma.transaction.findUnique({ where: { id: tolov.transactionId } });
  assert.equal(txn.turi, "kirim");
  assert.equal(txn.summa, 500_000);
});

test("tenant izolyatsiyasi: boshqa tenant biznesida tranzaksiya ochilmaydi", async () => {
  await rawPrisma.tenant.create({
    data: { id: "t_at_b", name: "B tenant", slug: "atomik-b", status: "ACTIVE" },
  });
  await assert.rejects(
    () =>
      runWithTenant("t_at_b", () =>
        inventory.createDebt({
          businessId: BIZ, // A tenantning biznesi
          turi: "olinadigan",
          mijozNomi: "Begona",
          jamiSumma: 100_000,
          userId: USER,
        })
      ),
    /tegishli emas/
  );
});
