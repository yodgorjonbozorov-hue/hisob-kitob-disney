/**
 * INVENTARIZATSIYA, HISOBDAN CHIQARISH VA MINIMAL QOLDIQ (Faza 4.3).
 *
 * Ilgari ombor qoldig'ini to'g'rilashning yagona yo'li mahsulotni qo'lda
 * tahrirlash edi — kim, qachon va NEGA o'zgartirgani hech qayerda qolmasdi.
 * "Kam qoldi" ogohlantirishi esa butun tizim uchun bitta sobit chegara (5)
 * bilan ishlardi.
 *
 * Ishga tushirish: npm run test:inventarizatsiya
 */
process.env.DATABASE_URL = "file:./prisma/test-inventarizatsiya.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let adjustStock: any;
let queries: any;
let notifications: any;
let createTenantWithOwner: any;

let t: any;
let mahsulot: any;

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

before(async () => {
  rmSync("prisma/test-inventarizatsiya.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ adjustStock } = await import("@/lib/services/stockAdjust"));
  queries = await import("@/lib/queries/inventory");
  notifications = await import("@/lib/queries/notifications");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Ombor test",
    ism: "Egasi",
    login: "+998922222201",
    parol: "parol12345",
  });
  await rawPrisma.business.update({ where: { id: t.business.id }, data: { omborli: true } });

  mahsulot = await rawPrisma.product.create({
    data: {
      businessId: t.business.id,
      nomi: "Un",
      kelganNarx: 5_000,
      sotuvNarx: 8_000,
      miqdor: 100,
      birlik: "kg",
      minQoldiq: 20,
      sku: "UN-50",
    },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Inventarizatsiya ----------

test("inventarizatsiya qoldiqni sanalgan qiymatga keltiradi va farqni yozadi", async () => {
  const yozuv = await T(async () =>
    adjustStock({
      businessId: t.business.id, productId: mahsulot.id,
      turi: "inventarizatsiya", miqdor: 93, sabab: "Oylik sanash", userId: t.user.id,
    })
  );
  assert.equal(yozuv.eskiMiqdor, 100);
  assert.equal(yozuv.yangiMiqdor, 93);
  assert.equal(yozuv.farq, -7, "kamomad manfiy farq bilan yozilishi kerak");
  assert.equal(yozuv.sabab, "Oylik sanash");

  const p = await rawPrisma.product.findUnique({ where: { id: mahsulot.id } });
  assert.equal(p.miqdor, 93);
});

test("inventarizatsiya qoldiqni OSHIRISHI ham mumkin", async () => {
  await T(async () =>
    adjustStock({
      businessId: t.business.id, productId: mahsulot.id,
      turi: "inventarizatsiya", miqdor: 95, sabab: "Qayta sanaldi", userId: t.user.id,
    })
  );
  const p = await rawPrisma.product.findUnique({ where: { id: mahsulot.id } });
  assert.equal(p.miqdor, 95);
});

test("qoldiq o'zgarmasa yozuv yaratilmaydi", async () => {
  await assert.rejects(
    () => T(async () => adjustStock({
      businessId: t.business.id, productId: mahsulot.id,
      turi: "inventarizatsiya", miqdor: 95, sabab: "Yana sanaldi", userId: t.user.id,
    })),
    /o'zgarmadi/
  );
});

// ---------- Hisobdan chiqarish ----------

test("hisobdan chiqarish faqat kamaytiradi", async () => {
  const yozuv = await T(async () =>
    adjustStock({
      businessId: t.business.id, productId: mahsulot.id,
      turi: "chiqarish", miqdor: 5, sabab: "Namlik tegdi", userId: t.user.id,
    })
  );
  assert.equal(yozuv.farq, -5);
  assert.equal(yozuv.yangiMiqdor, 90);
});

test("qoldiqdan ko'p chiqarib bo'lmaydi", async () => {
  await assert.rejects(
    () => T(async () => adjustStock({
      businessId: t.business.id, productId: mahsulot.id,
      turi: "chiqarish", miqdor: 1000, sabab: "test", userId: t.user.id,
    })),
    /chiqarib bo'lmaydi/
  );
  const p = await rawPrisma.product.findUnique({ where: { id: mahsulot.id } });
  assert.equal(p.miqdor, 90, "rad etilganda qoldiq o'zgarmasligi kerak");
});

test("sababsiz to'g'rilash rad etiladi", async () => {
  await assert.rejects(
    () => T(async () => adjustStock({
      businessId: t.business.id, productId: mahsulot.id,
      turi: "chiqarish", miqdor: 1, sabab: "   ", userId: t.user.id,
    })),
    /Sabab/
  );
});

test("to'g'rilashlar tarixi ro'yxatda ko'rinadi", async () => {
  const tarix = await T(async () => queries.listStockAdjustments(t.business.id));
  assert.equal(tarix.length, 3, "3 ta muvaffaqiyatli to'g'rilash");
  assert.equal(tarix[0].turi, "chiqarish", "eng yangisi birinchi");
  assert.equal(tarix[0].productNomi, "Un");
});

test("to'g'rilash audit jurnaliga tushadi", async () => {
  const yozuvlar = await rawPrisma.auditLog.findMany({
    where: { entity: "product", businessId: t.business.id },
  });
  assert.ok(yozuvlar.length >= 3, "har to'g'rilash audit qilinishi kerak");
  assert.ok(yozuvlar.some((y: any) => String(y.after).includes("Namlik tegdi")));
});

// ---------- SKU, birlik, minimal qoldiq ----------

test("SKU va birlik mahsulot ro'yxatida qaytadi", async () => {
  const royxat = await T(async () =>
    queries.listProducts(t.business.id, { forKassir: false })
  );
  const un = royxat.find((p: any) => p.nomi === "Un");
  assert.equal(un.sku, "UN-50");
  assert.equal(un.birlik, "kg");
  assert.equal(un.minQoldiq, 20);
  assert.equal(un.kamQoldi, false, "90 kg > 20 kg — ogohlantirish yo'q");
});

test("minimal qoldiqdan pastga tushganda kamQoldi belgisi yonadi", async () => {
  await T(async () =>
    adjustStock({
      businessId: t.business.id, productId: mahsulot.id,
      turi: "chiqarish", miqdor: 75, sabab: "Katta buyurtma", userId: t.user.id,
    })
  );
  const royxat = await T(async () =>
    queries.listProducts(t.business.id, { forKassir: false })
  );
  const un = royxat.find((p: any) => p.nomi === "Un");
  assert.equal(un.miqdor, 15);
  assert.equal(un.kamQoldi, true, "15 kg <= 20 kg — ogohlantirish");
});

test("bildirishnoma har mahsulotning O'Z chegarasini ishlatadi", async () => {
  // minQoldiq = 20, qoldiq 15 → ogohlantirish chiqishi kerak.
  // Eski mantiqda sobit 5 ishlatilgani uchun 15 dona "yetarli" hisoblanardi.
  const royxat = await T(async () =>
    notifications.getNotifications(t.business.id, { omborli: true, rol: "OWNER" })
  );
  const ombor = royxat.find((n: any) => n.title === "Ombor kam qoldi");
  assert.ok(ombor, "o'z chegarasidan past tushgan mahsulot ogohlantirilishi kerak");
  assert.match(ombor.message, /Un/);
});
