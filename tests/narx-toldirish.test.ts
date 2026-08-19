/**
 * NARX VA QOLDIQNI OMMAVIY TO'LDIRISH TESTLARI.
 *
 * Boshqa dasturdan ko'chirilgan katalog narxsiz va qoldiqsiz keladi.
 * Bu yerda tekshiriladigan asosiy xavflar:
 *
 *  - qoldiqni to'ldirish XARID hisoblanib qolsa, mijozning hisobotida
 *    bir kunda soxta chiqim paydo bo'lardi;
 *  - boshqa biznesning mahsuloti idsi yuborilsa u ham yangilanib ketardi.
 *
 * Ishga tushirish: npm run test:narx-toldirish
 */
process.env.DATABASE_URL = "file:./prisma/test-narx-toldirish.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

// Dinamik importlar `any` — bu test faylida qat'iy turlar yo'q.
let rawPrisma: any;
let runWithTenant: any;
let narx: any;
let createTenantWithOwner: any;

let t: any;
let begona: any;
let mahsulotlar: any[] = [];

function T(fn: () => unknown): Promise<any> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

before(async () => {
  rmSync("prisma/test-narx-toldirish.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  narx = await import("@/lib/services/narxToldirish");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Narx test",
    ism: "Egasi",
    login: "+998933333501",
    parol: "parol12345",
  });
  await rawPrisma.business.update({
    where: { id: t.business.id },
    data: { omborli: true, magazin: true },
  });

  begona = await createTenantWithOwner({
    kompaniyaNomi: "Begona kompaniya",
    ism: "Begona",
    login: "+998933333502",
    parol: "parol12345",
  });

  // Ko'chirilgandek: narxsiz va qoldiqsiz uch tovar.
  for (const nomi of ["fonus", "vaza 200 minglik", "teddi 1.2 mln"]) {
    mahsulotlar.push(
      await rawPrisma.product.create({ data: { businessId: t.business.id, nomi } })
    );
  }
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("narx va qoldiq to'ldiriladi", async () => {
  const n = await T(() =>
    narx.narxlarniToldir({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar: [
        { productId: mahsulotlar[0].id, kelganNarx: 8000, sotuvNarx: 15000, miqdor: 12 },
        { productId: mahsulotlar[1].id, sotuvNarx: 200000, miqdor: 3 },
      ],
    })
  );
  assert.equal(n.yangilandi, 2);
  assert.equal(n.qoldiqTogrilandi, 2);
  assert.equal(n.topilmadi, 0);

  const fonus = await rawPrisma.product.findUnique({ where: { id: mahsulotlar[0].id } });
  assert.equal(fonus.kelganNarx, 8000);
  assert.equal(fonus.sotuvNarx, 15000);
  assert.equal(fonus.miqdor, 12);

  // Tannarx berilmagan tovarniki tegilmagan holicha qoladi.
  const vaza = await rawPrisma.product.findUnique({ where: { id: mahsulotlar[1].id } });
  assert.equal(vaza.kelganNarx, 0);
  assert.equal(vaza.sotuvNarx, 200000);
});

test("QOLDIQ PUL HARAKATI YARATMAYDI", async () => {
  const pul = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });
  assert.equal(pul, 0, "qoldiqni to'ldirish xarid chiqimi yozmasligi kerak");
  const kirim = await rawPrisma.stockEntry.count({ where: { businessId: t.business.id } });
  assert.equal(kirim, 0, "ombor kirimi ham yaratilmasligi kerak");

  // Lekin iz qoladi: kim, qachon, nimadan nimaga o'zgartirgan.
  const tuzatish = await rawPrisma.stockAdjustment.findFirst({
    where: { businessId: t.business.id, productId: mahsulotlar[0].id },
  });
  assert.ok(tuzatish);
  assert.equal(tuzatish.turi, "inventarizatsiya");
  assert.equal(tuzatish.eskiMiqdor, 0);
  assert.equal(tuzatish.yangiMiqdor, 12);
  assert.equal(tuzatish.userId, t.user.id);
});

test("o'zgarmagan qiymat qayta yozilmaydi", async () => {
  const oldin = await rawPrisma.stockAdjustment.count({ where: { businessId: t.business.id } });
  const n = await T(() =>
    narx.narxlarniToldir({
      businessId: t.business.id,
      userId: t.user.id,
      // Aynan o'sha qiymatlar.
      qatorlar: [{ productId: mahsulotlar[0].id, sotuvNarx: 15000, miqdor: 12 }],
    })
  );
  assert.equal(n.yangilandi, 0);
  assert.equal(n.qoldiqTogrilandi, 0);
  const keyin = await rawPrisma.stockAdjustment.count({ where: { businessId: t.business.id } });
  assert.equal(keyin, oldin, "keraksiz inventarizatsiya izi yaratilmasligi kerak");
});

test("qoldiqni KAMAYTIRISH ham yoziladi", async () => {
  const n = await T(() =>
    narx.narxlarniToldir({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar: [{ productId: mahsulotlar[0].id, miqdor: 5 }],
    })
  );
  assert.equal(n.qoldiqTogrilandi, 1);
  const tuzatish = await rawPrisma.stockAdjustment.findFirst({
    where: { businessId: t.business.id, productId: mahsulotlar[0].id },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(tuzatish.farq, -7);
});

test("BOSHQA BIZNES mahsuloti yangilanmaydi", async () => {
  const begonaMahsulot = await rawPrisma.product.create({
    data: { businessId: begona.business.id, nomi: "Begona tovar", sotuvNarx: 1000 },
  });
  const n = await T(() =>
    narx.narxlarniToldir({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar: [
        { productId: begonaMahsulot.id, sotuvNarx: 999999 },
        { productId: mahsulotlar[2].id, sotuvNarx: 1200000 },
      ],
    })
  );
  assert.equal(n.topilmadi, 1);
  assert.equal(n.yangilandi, 1);

  const tekshir = await rawPrisma.product.findUnique({ where: { id: begonaMahsulot.id } });
  assert.equal(tekshir.sotuvNarx, 1000, "begona mahsulot narxi o'zgarmasligi kerak");
});

test("boshqa tenant biznesiga umuman yozib bo'lmaydi", async () => {
  await assert.rejects(
    () =>
      T(() =>
        narx.narxlarniToldir({
          businessId: begona.business.id,
          userId: t.user.id,
          qatorlar: [{ productId: mahsulotlar[0].id, sotuvNarx: 1 }],
        })
      ),
    /tegishli emas/
  );
});

test("to'ldirilgandan keyin tovar KASSADA sotiladigan holatga keladi", async () => {
  const { listPosMahsulotlar } = await import("@/lib/queries/pos");
  const royxat = await T(() => listPosMahsulotlar(t.business.id));
  const fonus = royxat.find((p: any) => p.nomi === "fonus");
  assert.ok(fonus, "tovar kassa ro'yxatida bo'lishi kerak");
  assert.equal(fonus.sotuvNarx, 15000);
  assert.ok(fonus.miqdor > 0, "qoldiq bo'lmasa kassada sotib bo'lmaydi");
});
