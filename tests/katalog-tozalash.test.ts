/**
 * KATALOGNI TOZALASH TESTLARI.
 *
 * Xavflar: (1) saqlanadigan kategoriya tovari adashib o'chib ketishi;
 * (2) sotuv/kirim tarixi bor tovar o'chirilib hisobotni teshik qilishi;
 * (3) boshqa biznes katalogiga tegib ketish.
 *
 * Ishga tushirish: npm run test:katalog-tozalash
 */
process.env.DATABASE_URL = "file:./prisma/test-katalog-tozalash.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let svc: any;
let createTenantWithOwner: any;
let t: any;
let boshqa: any;

let gullarId: string;
let savatId: string;

function T(fn: () => unknown): Promise<any> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

before(async () => {
  rmSync("prisma/test-katalog-tozalash.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  svc = await import("@/lib/services/katalogTozalash");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Tozalash test",
    ism: "Egasi",
    login: "+998933333501",
    parol: "parol12345",
  });
  boshqa = await createTenantWithOwner({
    kompaniyaNomi: "Boshqa tozalash",
    ism: "Egasi",
    login: "+998933333502",
    parol: "parol12345",
  });
  for (const biz of [t.business.id, boshqa.business.id]) {
    await rawPrisma.business.update({ where: { id: biz }, data: { omborli: true } });
  }

  // Kategoriyalar va tovarlar: Gullar (2 ta), Savat (2 ta, bittasi tarixli),
  // kategoriyasiz (1 ta).
  const gullar = await rawPrisma.productCategory.create({
    data: { businessId: t.business.id, nomi: "Gullar" },
  });
  const savat = await rawPrisma.productCategory.create({
    data: { businessId: t.business.id, nomi: "Savat" },
  });
  gullarId = gullar.id;
  savatId = savat.id;

  const yarat = (nomi: string, categoryId: string | null) =>
    rawPrisma.product.create({
      data: { businessId: t.business.id, nomi, categoryId, sotuvNarx: 1000 },
    });
  await yarat("Atirgul", gullarId);
  await yarat("Lola", gullarId);
  const tarixli = await yarat("Katta savat", savatId);
  await yarat("Kichik savat", savatId);
  await yarat("Lenta", null);

  // "Katta savat"ga inventarizatsiya izi — endi u TARIXLI.
  await rawPrisma.stockAdjustment.create({
    data: {
      businessId: t.business.id,
      productId: tarixli.id,
      turi: "inventarizatsiya",
      eskiMiqdor: 0,
      yangiMiqdor: 5,
      farq: 5,
      sabab: "test",
      userId: t.user.id,
    },
  });
  await rawPrisma.product.update({ where: { id: tarixli.id }, data: { miqdor: 5 } });

  // Boshqa biznesda ham tovar — unga TEGILMASLIGI kerak.
  await rawPrisma.product.create({
    data: { businessId: boshqa.business.id, nomi: "Begona tovar", sotuvNarx: 500 },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("oldindan hisob to'g'ri: nomzod, tarixli va qoladiganlar", async () => {
  const hisob = await T(() =>
    svc.tozalashniKorish({
      businessId: t.business.id,
      saqlanadiganKategoriyalar: [gullarId],
      kategoriyasizSaqlansin: false,
    })
  );
  // Qoladi: Gullar (2). Nomzod: Savat (2) + kategoriyasiz Lenta (1) = 3,
  // ulardan 1 tasi tarixli.
  assert.equal(hisob.qoladi, 2);
  assert.equal(hisob.ochiriladi, 2);
  assert.equal(hisob.nofaolBoladi, 1);
});

test("kategoriyasiz tovarlar saqlansin desa ular nomzod emas", async () => {
  const hisob = await T(() =>
    svc.tozalashniKorish({
      businessId: t.business.id,
      saqlanadiganKategoriyalar: [gullarId],
      kategoriyasizSaqlansin: true,
    })
  );
  assert.equal(hisob.qoladi, 3); // Gullar 2 + Lenta 1
  assert.equal(hisob.ochiriladi + hisob.nofaolBoladi, 2);
});

test("tozalash: tanlangan qoladi, tarixli nofaol bo'ladi, boshqa tenant tegilmaydi", async () => {
  const natija = await T(() =>
    svc.katalogniTozala({
      businessId: t.business.id,
      userId: t.user.id,
      saqlanadiganKategoriyalar: [gullarId],
      kategoriyasizSaqlansin: false,
    })
  );
  assert.equal(natija.ochiriladi, 2); // Kichik savat + Lenta
  assert.equal(natija.nofaolBoladi, 1); // Katta savat
  assert.equal(natija.qoladi, 2);

  const qolganlar = await rawPrisma.product.findMany({
    where: { businessId: t.business.id },
    select: { nomi: true, isActive: true },
    orderBy: { nomi: "asc" },
  });
  assert.deepEqual(
    qolganlar.map((p: any) => `${p.nomi}:${p.isActive ? "faol" : "nofaol"}`),
    ["Atirgul:faol", "Katta savat:nofaol", "Lola:faol"]
  );

  // Tarix o'z joyida — hisobot teshik emas.
  const iz = await rawPrisma.stockAdjustment.count({ where: { businessId: t.business.id } });
  assert.equal(iz, 1);

  // Boshqa biznes katalogi butun.
  const begona = await rawPrisma.product.count({ where: { businessId: boshqa.business.id } });
  assert.equal(begona, 1);
});

test("audit jurnalida tozalash izi qoladi", async () => {
  const audit = await rawPrisma.auditLog.findFirst({
    where: { businessId: t.business.id, entityId: "katalog-tozalash" },
  });
  assert.ok(audit, "audit yozuvi topilmadi");
  assert.equal(audit.action, "delete");
});
