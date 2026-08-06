/**
 * KELISHILGAN NARX TESTLARI.
 *
 * Salyut kabi bizneslarda narx har sotuvda savdolashib belgilanadi. Qoidalar:
 * - Sotuvda kelishilgan narx berilsa — sotuv o'sha narxda yoziladi.
 * - Oddiy (umumiy) biznesda mahsulot kartochkasidagi standart narx
 *   O'ZGARMAYDI (H-1 himoyasi) — faqat avto rejimida kartochka yangilanadi.
 * - Standart narxi yo'q (0) mahsulot faqat kelishilgan narx bilan sotiladi.
 * - Naqd sotuvda pul tanlangan kassaga (naqd/Click) tushadi.
 *
 * Ishga tushirish: npm run test:kelishilgan-narx
 */
process.env.DATABASE_URL = "file:./prisma/test-kelishilgan-narx.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let inventory: any;

const TENANT = "t_kn";
const BIZ = "biz_kn";
const USER = "u_kn_owner";

before(async () => {
  rmSync("prisma/test-kelishilgan-narx.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  inventory = await import("@/lib/services/inventory");

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "Kelishilgan tenant", slug: "kelishilgan-tenant", status: "ACTIVE" },
  });
  await rawPrisma.business.create({
    data: { id: BIZ, nomi: "Salyut biznes", tenantId: TENANT, omborli: true, turi: "umumiy" },
  });
  await rawPrisma.user.create({
    data: { id: USER, ism: "Direktor", login: "kn_owner", parolHash: "x", rol: "OWNER", tenantId: TENANT, businessId: BIZ },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("kelishilgan narx sotuvda ishlatiladi, standart narx O'ZGARMAYDI (umumiy)", async () => {
  const product = await rawPrisma.product.create({
    data: { businessId: BIZ, nomi: "8 talik salyut", kelganNarx: 200_000, sotuvNarx: 250_000, miqdor: 50 },
  });

  const sale = await runWithTenant(TENANT, () =>
    inventory.createSale({
      businessId: BIZ,
      productId: product.id,
      miqdor: 2,
      tolovTuri: "naqd",
      narx: 230_000, // savdolashib arzonroqqa kelishildi
      userId: USER,
    })
  );

  assert.equal(sale.birlikNarx, 230_000, "sotuv kelishilgan narxda yozilishi kerak");
  assert.equal(sale.jamiSumma, 460_000);

  // H-1 himoyasi: bitta chegirmali sotuv butun katalog narxini o'zgartirmasin.
  const keyin = await rawPrisma.product.findUnique({ where: { id: product.id } });
  assert.equal(keyin.sotuvNarx, 250_000, "standart narx kartochkada o'zgarmasligi kerak");

  // Kirim ham kelishilgan summada.
  const kirim = await rawPrisma.transaction.findFirst({
    where: { businessId: BIZ, turi: "kirim", summa: 460_000 },
  });
  assert.ok(kirim, "kirim kelishilgan summada yozilishi kerak");
});

test("standart narxsiz (0) mahsulot kelishilgan narx bilan sotiladi", async () => {
  const product = await rawPrisma.product.create({
    data: { businessId: BIZ, nomi: "Mikki", kelganNarx: 0, sotuvNarx: 0, miqdor: 10 },
  });

  const sale = await runWithTenant(TENANT, () =>
    inventory.createSale({
      businessId: BIZ,
      productId: product.id,
      miqdor: 3,
      tolovTuri: "naqd",
      narx: 90_000,
      userId: USER,
    })
  );
  assert.equal(sale.birlikNarx, 90_000);
  assert.equal(sale.jamiSumma, 270_000);
});

test("standart narxsiz mahsulotni narxsiz sotib bo'lmaydi", async () => {
  const product = await rawPrisma.product.create({
    data: { businessId: BIZ, nomi: "Nomsiz raketa", kelganNarx: 0, sotuvNarx: 0, miqdor: 5 },
  });

  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        inventory.createSale({
          businessId: BIZ,
          productId: product.id,
          miqdor: 1,
          tolovTuri: "naqd",
          userId: USER,
        })
      ),
    /Sotuv narxi kiritilmagan/
  );
});

test("naqd sotuv tanlangan kassaga tushadi (Click)", async () => {
  await rawPrisma.account.create({
    data: { id: "acc_kn_naqd", businessId: BIZ, nomi: "Naqd kassa", turi: "naqd", tartib: 0 },
  });
  const click = await rawPrisma.account.create({
    data: { id: "acc_kn_click", businessId: BIZ, nomi: "Click", turi: "plastik", tartib: 1 },
  });
  const product = await rawPrisma.product.create({
    data: { businessId: BIZ, nomi: "7 talik salyut", kelganNarx: 150_000, sotuvNarx: 200_000, miqdor: 20 },
  });

  const sale = await runWithTenant(TENANT, () =>
    inventory.createSale({
      businessId: BIZ,
      productId: product.id,
      miqdor: 1,
      tolovTuri: "naqd",
      accountId: click.id,
      userId: USER,
    })
  );

  const txn = await rawPrisma.transaction.findUnique({ where: { id: sale.transactionId } });
  assert.equal(txn.accountId, click.id, "kirim Click kassasiga yozilishi kerak");
});

test("begona biznes kassasiga sotuv yozib bo'lmaydi", async () => {
  await rawPrisma.business.create({
    data: { id: "biz_kn_b", nomi: "Boshqa biznes", tenantId: TENANT, omborli: true },
  });
  const begona = await rawPrisma.account.create({
    data: { id: "acc_kn_begona", businessId: "biz_kn_b", nomi: "Begona kassa", turi: "naqd" },
  });
  const product = await rawPrisma.product.create({
    data: { businessId: BIZ, nomi: "16 talik salyut", kelganNarx: 250_000, sotuvNarx: 330_000, miqdor: 10 },
  });

  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        inventory.createSale({
          businessId: BIZ,
          productId: product.id,
          miqdor: 1,
          tolovTuri: "naqd",
          accountId: begona.id,
          userId: USER,
        })
      ),
    /Kassa topilmadi/
  );

  // Sotuv ham, qoldiq kamayishi ham orqaga qaytgan bo'lishi kerak.
  const keyin = await rawPrisma.product.findUnique({ where: { id: product.id } });
  assert.equal(keyin.miqdor, 10, "xato sotuvda qoldiq qaytishi kerak");
});
