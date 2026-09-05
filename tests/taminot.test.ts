/**
 * TA'MINOT ("Omborga ta'minot") — Ombor modulining bir qadamli kirim oqimi.
 *
 * Bu yerda tekshiriladigan narsa UI emas, HISOB: bir xil tovar naqdga
 * olinganda kassadan pul chiqishi, qarzga olinganda esa PUL UMUMAN
 * QIMIRLAMASLIGI va faqat "Men qarzdorman" summasi oshishi kerak. Ikkalasida
 * ham ombor bir xil oshadi.
 *
 * Eng muhim testlardan biri — TAKROR SAQLASH: "Ta'minotni saqlash" ikki
 * marta bosilsa ombor ikki marta oshmasligi shart. Bu himoya bazadagi
 * UNIQUE cheklovga tayanadi, shuning uchun u shu yerda haqiqiy parallel
 * so'rovlar bilan sinaladi.
 *
 * Ishga tushirish: npm run test:taminot
 */
process.env.DATABASE_URL = "file:./prisma/test-taminot.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let taminot: any;
let xarid: any;
let inventory: any;
let stockAdjust: any;
let qarz: any;
let omborQueries: any;
let accountQueries: any;
let createTenantWithOwner: any;

let t: any;
let t2: any;
let kassa: any;
let plastik: any;
let taminotchi: any;
let begonaTaminotchi: any;
let atirgul: any;
let gipsafila: any;

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}
function T2<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t2.tenant.id, fn, { userId: t2.user.id, ism: "Begona" });
}

/** Kassa qoldig'i — ledgerdan hisoblanadi (saqlangan ustun yo'q). */
async function kassaQoldiq(accountId: string): Promise<number> {
  const qoldiqlar = await T(() => accountQueries.getAccountBalances(t.business.id));
  return qoldiqlar.find((a: any) => a.id === accountId)?.qoldiq ?? 0;
}

/** Ochiq "beriladigan" qarzlar bo'yicha qolgan summa ("Men qarzdorman"). */
async function menQarzdorman(): Promise<number> {
  const agg = await rawPrisma.debt.aggregate({
    where: { businessId: t.business.id, turi: "beriladigan", isYopilgan: false },
    _sum: { jamiSumma: true, tolangan: true },
  });
  return (agg._sum.jamiSumma ?? 0) - (agg._sum.tolangan ?? 0);
}

/** Berilgan turdagi (o'chirilmagan) tranzaksiyalar yig'indisi. */
async function jamiTranzaksiya(turi: "kirim" | "chiqim"): Promise<number> {
  const agg = await rawPrisma.transaction.aggregate({
    where: { businessId: t.business.id, turi, deletedAt: null },
    _sum: { summa: true },
  });
  return agg._sum.summa ?? 0;
}

const kalit = (n: string) => `sinov-kalit-${n}`;

before(async () => {
  rmSync("prisma/test-taminot.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  taminot = await import("@/lib/services/taminot");
  xarid = await import("@/lib/services/xarid");
  inventory = await import("@/lib/services/inventory");
  stockAdjust = await import("@/lib/services/stockAdjust");
  qarz = await import("@/lib/services/qarz");
  omborQueries = await import("@/lib/queries/ombor");
  accountQueries = await import("@/lib/queries/accounts");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Gul do'koni",
    ism: "Egasi",
    login: "+998933333301",
    parol: "parol12345",
  });
  t2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona firma",
    ism: "Begona",
    login: "+998933333302",
    parol: "parol12345",
  });
  await rawPrisma.business.update({ where: { id: t.business.id }, data: { omborli: true } });
  await rawPrisma.business.update({ where: { id: t2.business.id }, data: { omborli: true } });

  kassa = await rawPrisma.account.findFirst({
    where: { businessId: t.business.id, turi: "naqd" },
  });
  assert.ok(kassa, "yangi biznesda naqd kassa ochilgan bo'lishi kerak");
  plastik = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Click terminal", turi: "plastik", tartib: 5 },
  });

  // Boshlang'ich kassa: 10 mln.
  const kategoriya = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Boshlang'ich", turi: "kirim" },
  });
  await rawPrisma.transaction.create({
    data: {
      businessId: t.business.id,
      turi: "kirim",
      categoryId: kategoriya.id,
      accountId: kassa.id,
      summa: 10_000_000,
      sana: new Date("2026-08-01T00:00:00.000Z"),
      userId: t.user.id,
    },
  });

  taminotchi = await T(() => xarid.createSupplier(t.business.id, { nomi: "Toshkent Gul" }));
  begonaTaminotchi = await T2(() =>
    xarid.createSupplier(t2.business.id, { nomi: "Begona ta'minotchi" })
  );

  atirgul = await rawPrisma.product.create({
    data: { businessId: t.business.id, nomi: "Atirgul 50sm", sotuvNarx: 10_000, miqdor: 0 },
  });
  gipsafila = await rawPrisma.product.create({
    data: { businessId: t.business.id, nomi: "Gipsafila", sotuvNarx: 20_000, miqdor: 0 },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 45-stsenariy: QARZGA olingan tovar
// ---------------------------------------------------------------------------

test("qarzga olingan ta'minot: ombor oshadi, kassa TEGILMAYDI, qarz yoziladi", async () => {
  const kassaOldin = await kassaQoldiq(kassa.id);
  const chiqimOldin = await jamiTranzaksiya("chiqim");
  const kirimOldin = await jamiTranzaksiya("kirim");

  const natija = await T(() =>
    taminot.taminotYarat({
      businessId: t.business.id,
      userId: t.user.id,
      data: {
        idempotencyKey: kalit("qarz"),
        supplierId: taminotchi.id,
        tolovUsuli: "qarz",
        satrlar: [{ productId: atirgul.id, miqdor: 500, birlikNarx: 8_000 }],
      },
    })
  );

  assert.equal(natija.jamiSumma, 4_000_000);
  assert.equal(natija.takror, false);
  assert.equal(natija.transactionId, null, "qarzga olinganda chiqim tranzaksiya yozilmaydi");
  assert.ok(natija.debtId, "qarz yozuvi bo'lishi kerak");

  const p = await rawPrisma.product.findUnique({ where: { id: atirgul.id } });
  assert.equal(p.miqdor, 500, "ombor +500");
  assert.equal(p.kelganNarx, 8_000, "tannarx kelgan narxdan snapshot olinadi");

  const kpi = await T(() => omborQueries.omborKpi(t.business.id));
  assert.equal(kpi.omborQiymati, 4_000_000, "ombor qiymati = qoldiq × tannarx");

  assert.equal(await menQarzdorman(), 4_000_000, "ta'minotchiga qarz 4 mln");
  assert.equal(await kassaQoldiq(kassa.id), kassaOldin, "kassadan pul kamaymaydi");
  assert.equal(await jamiTranzaksiya("chiqim"), chiqimOldin, "soxta chiqim yozilmaydi");
  assert.equal(await jamiTranzaksiya("kirim"), kirimOldin, "Jami kirim oshmaydi");

  const debt = await rawPrisma.debt.findUnique({ where: { id: natija.debtId } });
  assert.equal(debt.turi, "beriladigan", "biz qarzdormiz");
  assert.equal(debt.mijozNomi, "Toshkent Gul");
});

// ---------------------------------------------------------------------------
// 46-stsenariy: NAQDGA olingan tovar
// ---------------------------------------------------------------------------

test("naqdga olingan ta'minot: kassa kamayadi, chiqim BIR MARTA yoziladi", async () => {
  const kassaOldin = await kassaQoldiq(kassa.id);
  const chiqimOldin = await jamiTranzaksiya("chiqim");
  const qarzOldin = await menQarzdorman();

  const natija = await T(() =>
    taminot.taminotYarat({
      businessId: t.business.id,
      userId: t.user.id,
      data: {
        idempotencyKey: kalit("naqd"),
        supplierId: taminotchi.id,
        tolovUsuli: "naqd",
        satrlar: [{ productId: gipsafila.id, miqdor: 100, birlikNarx: 15_000 }],
      },
    })
  );

  assert.equal(natija.jamiSumma, 1_500_000);
  assert.ok(natija.transactionId, "naqd to'lovda chiqim tranzaksiya yoziladi");
  assert.equal(natija.debtId, null, "naqd to'lovda qarz ochilmaydi");

  const p = await rawPrisma.product.findUnique({ where: { id: gipsafila.id } });
  assert.equal(p.miqdor, 100);

  assert.equal(await kassaQoldiq(kassa.id), kassaOldin - 1_500_000, "kassadan 1,5 mln chiqdi");
  assert.equal(
    await jamiTranzaksiya("chiqim"),
    chiqimOldin + 1_500_000,
    "chiqim aynan bir marta yozildi (dublikat yo'q)"
  );
  assert.equal(await menQarzdorman(), qarzOldin, "naqd xaridda qarz oshmaydi");

  const chiqimlar = await rawPrisma.transaction.findMany({
    where: { businessId: t.business.id, turi: "chiqim", deletedAt: null },
  });
  assert.equal(chiqimlar.length, 1, "bitta ta'minot — bitta chiqim yozuvi");
  assert.equal(chiqimlar[0].accountId, kassa.id, "pul naqd kassadan chiqdi");
  assert.equal(chiqimlar[0].tolovTuri, "naqd");
});

// ---------------------------------------------------------------------------
// 47-stsenariy: Click/karta — boshqa kassadan
// ---------------------------------------------------------------------------

test("karta to'lovi naqd kassaga EMAS, naqdsiz kassaga yoziladi", async () => {
  const naqdOldin = await kassaQoldiq(kassa.id);

  await T(() =>
    taminot.taminotYarat({
      businessId: t.business.id,
      userId: t.user.id,
      data: {
        idempotencyKey: kalit("karta"),
        supplierId: taminotchi.id,
        tolovUsuli: "karta",
        satrlar: [{ productId: gipsafila.id, miqdor: 10, birlikNarx: 15_000 }],
      },
    })
  );

  assert.equal(await kassaQoldiq(kassa.id), naqdOldin, "naqd kassa tegilmaydi");
  assert.equal(await kassaQoldiq(plastik.id), -150_000, "pul plastik kassadan chiqdi");

  const txn = await rawPrisma.transaction.findFirst({
    where: { businessId: t.business.id, accountId: plastik.id },
  });
  assert.equal(txn.tolovTuri, "click", "naqdsiz to'lov 'click' bo'limiga tushadi");
});

// ---------------------------------------------------------------------------
// 48-stsenariy: qarzni keyin to'lash
// ---------------------------------------------------------------------------

test("qarz keyin to'langanda: qarz kamayadi, kassa kamayadi, ombor TEGILMAYDI", async () => {
  const debt = await rawPrisma.debt.findFirst({
    where: { businessId: t.business.id, turi: "beriladigan", isYopilgan: false },
  });
  const kassaOldin = await kassaQoldiq(kassa.id);
  const chiqimOldin = await jamiTranzaksiya("chiqim");
  const omborOldin = (await rawPrisma.product.findUnique({ where: { id: atirgul.id } })).miqdor;

  const natija = await T(() =>
    qarz.qarzTolov({
      businessId: t.business.id,
      debtId: debt.id,
      summa: 1_000_000,
      tolovTuri: "naqd",
      accountId: kassa.id,
      userId: t.user.id,
    })
  );

  assert.equal(natija.qolgan, 3_000_000, "4 mln → 3 mln");
  assert.equal(await kassaQoldiq(kassa.id), kassaOldin - 1_000_000);
  assert.equal(await jamiTranzaksiya("chiqim"), chiqimOldin + 1_000_000, "real chiqim +1 mln");
  assert.equal(
    (await rawPrisma.product.findUnique({ where: { id: atirgul.id } })).miqdor,
    omborOldin,
    "to'lov ombor qoldig'iga tegmaydi"
  );

  // Original ta'minot yozuvi o'zgarmaydi.
  const order = await rawPrisma.purchaseOrder.findFirst({
    where: { businessId: t.business.id, idempotencyKey: kalit("qarz") },
  });
  assert.equal(order.jamiSumma, 4_000_000);
  assert.equal(order.tolanganSumma, 0, "ta'minot yozuvi to'lovdan keyin ham o'zgarmaydi");
});

// ---------------------------------------------------------------------------
// 49-stsenariy: STOCK — bitta manba, uchta harakat
// ---------------------------------------------------------------------------

test("qoldiq: +500 ta'minot − 20 sotuv − 5 chiqarish = 475, tarixda 3 harakat", async () => {
  await T(() =>
    inventory.createSale({
      businessId: t.business.id,
      productId: atirgul.id,
      miqdor: 20,
      tolovTuri: "naqd",
      accountId: kassa.id,
      userId: t.user.id,
    })
  );
  await T(() =>
    stockAdjust.adjustStock({
      businessId: t.business.id,
      productId: atirgul.id,
      turi: "chiqarish",
      miqdor: 5,
      sabab: "Buzildi",
      userId: t.user.id,
    })
  );

  const p = await rawPrisma.product.findUnique({ where: { id: atirgul.id } });
  assert.equal(p.miqdor, 475, "500 − 20 − 5");

  const detal = await T(() => omborQueries.mahsulotDetal(t.business.id, atirgul.id));
  assert.equal(detal.miqdor, 475, "tafsilot qoldiqni qayta hisoblamaydi — yagona manba");
  assert.equal(detal.harakatlar.length, 3, "ta'minot, sotuv va hisobdan chiqarish");
  const turlar = detal.harakatlar.map((h: any) => h.turi).sort();
  assert.deepEqual(turlar, ["chiqarish", "sotuv", "taminot"]);
  assert.equal(
    detal.harakatlar.reduce((a: number, h: any) => a + h.farq, 0),
    475,
    "harakatlar yig'indisi qoldiqqa teng"
  );
});

// ---------------------------------------------------------------------------
// 50-stsenariy: TAKROR SAQLASH (double submit)
// ---------------------------------------------------------------------------

test("bir xil kalit bilan PARALLEL ikki so'rov: ombor va qarz BIR MARTA oshadi", async () => {
  const omborOldin = (await rawPrisma.product.findUnique({ where: { id: gipsafila.id } })).miqdor;
  const qarzOldin = await menQarzdorman();

  const sorov = () =>
    T(() =>
      taminot.taminotYarat({
        businessId: t.business.id,
        userId: t.user.id,
        data: {
          idempotencyKey: kalit("takror"),
          supplierId: taminotchi.id,
          tolovUsuli: "qarz",
          satrlar: [{ productId: gipsafila.id, miqdor: 500, birlikNarx: 8_000 }],
        },
      })
    );

  // Ketma-ket EMAS, aynan parallel: faqat shunda ilova darajasidagi
  // tekshiruv yetarli emasligi ko'rinadi va bazadagi UNIQUE sinaladi.
  const [a, b] = await Promise.all([sorov(), sorov()]);
  assert.equal(a.id, b.id, "ikkala so'rov ham AYNI BIR ta'minotni qaytaradi");
  assert.ok(a.takror || b.takror, "biri takror sifatida belgilanadi");

  const p = await rawPrisma.product.findUnique({ where: { id: gipsafila.id } });
  assert.equal(p.miqdor, omborOldin + 500, "ombor +500, +1000 EMAS");
  assert.equal(await menQarzdorman(), qarzOldin + 4_000_000, "qarz 4 mln, 8 mln EMAS");

  const yozuvlar = await rawPrisma.purchaseOrder.count({
    where: { businessId: t.business.id, idempotencyKey: kalit("takror") },
  });
  assert.equal(yozuvlar, 1, "bitta ta'minot yozuvi");
});

test("uchinchi marta yuborish ham yangi yozuv yaratmaydi", async () => {
  const omborOldin = (await rawPrisma.product.findUnique({ where: { id: gipsafila.id } })).miqdor;
  const natija = await T(() =>
    taminot.taminotYarat({
      businessId: t.business.id,
      userId: t.user.id,
      data: {
        idempotencyKey: kalit("takror"),
        supplierId: taminotchi.id,
        tolovUsuli: "qarz",
        satrlar: [{ productId: gipsafila.id, miqdor: 500, birlikNarx: 8_000 }],
      },
    })
  );
  assert.equal(natija.takror, true);
  assert.equal(
    (await rawPrisma.product.findUnique({ where: { id: gipsafila.id } })).miqdor,
    omborOldin
  );
});

// ---------------------------------------------------------------------------
// Bekor qilish — teskari yozuvlar
// ---------------------------------------------------------------------------

test("qarzga ta'minotni bekor qilish: qoldiq qaytadi, qarz o'chadi, tarix qoladi", async () => {
  const order = await rawPrisma.purchaseOrder.findFirst({
    where: { businessId: t.business.id, idempotencyKey: kalit("takror") },
  });
  const omborOldin = (await rawPrisma.product.findUnique({ where: { id: gipsafila.id } })).miqdor;
  const qarzOldin = await menQarzdorman();

  await T(() =>
    taminot.taminotBekor({
      businessId: t.business.id,
      orderId: order.id,
      userId: t.user.id,
      sabab: "Xato kiritildi",
    })
  );

  const p = await rawPrisma.product.findUnique({ where: { id: gipsafila.id } });
  assert.equal(p.miqdor, omborOldin - 500, "qoldiq qaytarildi");
  assert.equal(await menQarzdorman(), qarzOldin - 4_000_000, "qarz ham qaytarildi");

  const yangi = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  assert.equal(yangi.holat, "bekor");
  assert.equal(yangi.bekorSabab, "Xato kiritildi");

  // Tarix QAYTA YOZILMAYDI — teskari harakat qo'shiladi.
  const togrilash = await rawPrisma.stockAdjustment.findFirst({
    where: { businessId: t.business.id, productId: gipsafila.id, turi: "taminot_bekor" },
  });
  assert.ok(togrilash, "bekor qilish uchun teskari harakat yoziladi");
  assert.equal(togrilash.farq, -500);
  const kirimlar = await rawPrisma.stockEntry.count({
    where: { businessId: t.business.id, productId: gipsafila.id },
  });
  assert.ok(kirimlar >= 2, "eski kirim yozuvlari o'chirilmaydi");
});

test("naqd ta'minotni bekor qilish kassani tiklaydi", async () => {
  const order = await rawPrisma.purchaseOrder.findFirst({
    where: { businessId: t.business.id, idempotencyKey: kalit("naqd") },
  });
  const kassaOldin = await kassaQoldiq(kassa.id);

  await T(() =>
    taminot.taminotBekor({
      businessId: t.business.id,
      orderId: order.id,
      userId: t.user.id,
      sabab: "Ta'minotchi qaytarib oldi",
    })
  );

  assert.equal(await kassaQoldiq(kassa.id), kassaOldin + 1_500_000, "chiqim qaytarildi");
  const txn = await rawPrisma.transaction.findUnique({ where: { id: order.transactionId } });
  assert.ok(txn.deletedAt, "chiqim yumshoq o'chiriladi (tarix saqlanadi)");
});

test("tovari sotilgan ta'minotni bekor qilib bo'lmaydi", async () => {
  const order = await rawPrisma.purchaseOrder.findFirst({
    where: { businessId: t.business.id, idempotencyKey: kalit("qarz") },
  });
  // Atirguldan 475 ta qoldi, ta'minotda 500 ta kelgan edi — qaytarib bo'lmaydi.
  await assert.rejects(
    () =>
      T(() =>
        taminot.taminotBekor({
          businessId: t.business.id,
          orderId: order.id,
          userId: t.user.id,
          sabab: "sinov",
        })
      ),
    /qaytarib bo'lmaydi/
  );

  const p = await rawPrisma.product.findUnique({ where: { id: atirgul.id } });
  assert.equal(p.miqdor, 475, "rad etilgan urinish qoldiqni o'zgartirmaydi");
});

test("qarzi qisman to'langan ta'minot ham bekor qilinmaydi", async () => {
  const lola = await rawPrisma.product.create({
    data: { businessId: t.business.id, nomi: "Lola", sotuvNarx: 12_000, miqdor: 0 },
  });
  const natija = await T(() =>
    taminot.taminotYarat({
      businessId: t.business.id,
      userId: t.user.id,
      data: {
        idempotencyKey: kalit("qarz-tolangan"),
        supplierId: taminotchi.id,
        tolovUsuli: "qarz",
        satrlar: [{ productId: lola.id, miqdor: 50, birlikNarx: 6_000 }],
      },
    })
  );
  await T(() =>
    qarz.qarzTolov({
      businessId: t.business.id,
      debtId: natija.debtId,
      summa: 100_000,
      tolovTuri: "naqd",
      accountId: kassa.id,
      userId: t.user.id,
    })
  );

  await assert.rejects(
    () =>
      T(() =>
        taminot.taminotBekor({
          businessId: t.business.id,
          orderId: natija.id,
          userId: t.user.id,
          sabab: "sinov",
        })
      ),
    /to'lovlarni bekor qiling/
  );
  assert.equal(
    (await rawPrisma.product.findUnique({ where: { id: lola.id } })).miqdor,
    50,
    "rad etilgan urinish qoldiqni o'zgartirmaydi"
  );
});

// ---------------------------------------------------------------------------
// Tenant / biznes izolyatsiyasi (IDOR)
// ---------------------------------------------------------------------------

test("begona tenant ta'minotchisi bilan ta'minot yaratib bo'lmaydi", async () => {
  await assert.rejects(
    () =>
      T(() =>
        taminot.taminotYarat({
          businessId: t.business.id,
          userId: t.user.id,
          data: {
            idempotencyKey: kalit("idor-supplier"),
            supplierId: begonaTaminotchi.id,
            tolovUsuli: "naqd",
            satrlar: [{ productId: atirgul.id, miqdor: 1, birlikNarx: 1_000 }],
          },
        })
      ),
    /Ta'minotchi topilmadi/
  );
  const yozuv = await rawPrisma.purchaseOrder.count({
    where: { idempotencyKey: kalit("idor-supplier") },
  });
  assert.equal(yozuv, 0, "rad etilgan urinishdan yozuv qolmaydi");
});

test("begona biznes mahsuloti bilan ta'minot yaratib bo'lmaydi", async () => {
  const begonaMahsulot = await rawPrisma.product.create({
    data: { businessId: t2.business.id, nomi: "Begona tovar", miqdor: 0 },
  });
  await assert.rejects(
    () =>
      T(() =>
        taminot.taminotYarat({
          businessId: t.business.id,
          userId: t.user.id,
          data: {
            idempotencyKey: kalit("idor-product"),
            supplierId: taminotchi.id,
            tolovUsuli: "naqd",
            satrlar: [{ productId: begonaMahsulot.id, miqdor: 1, birlikNarx: 1_000 }],
          },
        })
      ),
    /Mahsulot topilmadi/
  );
  const p = await rawPrisma.product.findUnique({ where: { id: begonaMahsulot.id } });
  assert.equal(p.miqdor, 0, "begona mahsulot qoldig'i o'zgarmaydi");
});

test("begona tenant boshqa biznesning ta'minotini ko'rmaydi ham, bekor qilolmaydi ham", async () => {
  const order = await rawPrisma.purchaseOrder.findFirst({
    where: { businessId: t.business.id, idempotencyKey: kalit("qarz") },
  });

  const royxat = await T2(() => omborQueries.listTaminotlar(t2.business.id, { limit: 50 }));
  assert.equal(royxat.jami, 0, "begona tenantda ta'minot yo'q");

  await assert.rejects(
    () =>
      T2(() =>
        taminot.taminotBekor({
          businessId: t.business.id,
          orderId: order.id,
          userId: t2.user.id,
          sabab: "o'g'irlik urinishi",
        })
      ),
    /kompaniyangizga tegishli emas/
  );

  const yangi = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  assert.equal(yangi.holat, "qabul_qilingan", "begona urinish holatni o'zgartirmaydi");
});

test("begona tenant boshqa biznes mahsulotini o'qiy olmaydi", async () => {
  const detal = await T2(() => omborQueries.mahsulotDetal(t2.business.id, atirgul.id));
  assert.equal(detal, null);
});

// ---------------------------------------------------------------------------
// Ro'yxat, qidiruv va KPI
// ---------------------------------------------------------------------------

test("server tomonda qidiruv va sahifalash ishlaydi", async () => {
  const filtr = { q: null, categoryId: null, holat: "barchasi" as const, sahifa: 1, limit: 1 };
  const birinchi = await T(() => omborQueries.listOmborMahsulotlar(t.business.id, filtr));
  assert.equal(birinchi.mahsulotlar.length, 1, "limit hurmat qilinadi");
  assert.ok(birinchi.jami >= 2);
  assert.equal(birinchi.yanaBor, true);

  const qidiruv = await T(() =>
    omborQueries.listOmborMahsulotlar(t.business.id, { ...filtr, q: "Atirgul", limit: 24 })
  );
  assert.equal(qidiruv.jami, 1);
  assert.equal(qidiruv.mahsulotlar[0].nomi, "Atirgul 50sm");
});

test("KPI: kam qolgan va tugagan alohida sanaladi, qoldiq birliklar bo'yicha", async () => {
  await rawPrisma.product.update({
    where: { id: atirgul.id },
    data: { minQoldiq: 500 }, // qoldiq 475 → kam qolgan
  });
  const kilo = await rawPrisma.product.create({
    data: { businessId: t.business.id, nomi: "Qadoq", birlik: "kg", miqdor: 120, kelganNarx: 1_000 },
  });
  const tugagan = await rawPrisma.product.create({
    data: { businessId: t.business.id, nomi: "Tugagan tovar", miqdor: 0, kelganNarx: 5_000 },
  });

  const kpi = await T(() => omborQueries.omborKpi(t.business.id));
  assert.equal(kpi.kamQolgan, 1, "chegarasidan pastga tushgan bitta mahsulot");
  assert.ok(kpi.tugagan >= 1, "qoldig'i nolga tushgan mahsulot ham sanaladi");

  const birliklar = kpi.birliklar.map((b: any) => b.birlik).sort();
  assert.deepEqual(birliklar, ["dona", "kg"], "birliklar QO'SHILMAYDI, alohida turadi");
  // Kutilgan qiymat bazadan hisoblanadi: bu test qatorda turgan boshqa
  // testlar qancha tovar qoldirganiga BOG'LIQ bo'lmasligi kerak.
  const donaMahsulotlar = await rawPrisma.product.findMany({
    where: { businessId: t.business.id, isActive: true, birlik: "dona" },
    select: { miqdor: true },
  });
  const kutilgan = donaMahsulotlar.reduce(
    (a: number, p: any) => a + Math.max(0, p.miqdor),
    0
  );
  const dona = kpi.birliklar.find((b: any) => b.birlik === "dona");
  assert.equal(dona.miqdor, kutilgan, "dona bo'yicha qoldiq kg bilan aralashmaydi");
  assert.notEqual(dona.miqdor, kutilgan + 120, "kg qoldig'i donaga qo'shilmaydi");

  // Tugagan mahsulot kartochkasi ro'yxatdan YO'QOLMAYDI — filtr bilan
  // topiladi va yangi ta'minot kelganda o'z-o'zidan normal holatga qaytadi.
  const tugaganlar = await T(() =>
    omborQueries.listOmborMahsulotlar(t.business.id, {
      q: null,
      categoryId: null,
      holat: "tugagan" as const,
      sahifa: 1,
      limit: 24,
    })
  );
  assert.ok(
    tugaganlar.mahsulotlar.some((m: any) => m.id === tugagan.id),
    "tugagan mahsulot filtrda ko'rinadi"
  );
  assert.equal(
    tugaganlar.mahsulotlar.find((m: any) => m.id === tugagan.id).holat,
    "tugagan"
  );

  await rawPrisma.product.delete({ where: { id: kilo.id } });
  await rawPrisma.product.delete({ where: { id: tugagan.id } });
});

test("kam qolgan filtri chegarasi yo'q mahsulotni ushlamaydi", async () => {
  const kam = await T(() =>
    omborQueries.listOmborMahsulotlar(t.business.id, {
      q: null,
      categoryId: null,
      holat: "kam" as const,
      sahifa: 1,
      limit: 24,
    })
  );
  assert.equal(kam.jami, 1);
  assert.equal(kam.mahsulotlar[0].id, atirgul.id);
  assert.equal(kam.mahsulotlar[0].holat, "kam");
});
