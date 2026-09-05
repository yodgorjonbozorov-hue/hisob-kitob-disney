/**
 * TA'MINOTNI TO'G'RILASH VA TA'MINOTCHI PROFILI.
 *
 * `tests/taminot.test.ts` yaratish va bekor qilishni tekshiradi; bu yerda
 * DIREKTOR HUQUQI sinaladi — xato kiritilgan ta'minotni to'g'rilash.
 *
 * Eng muhim invariant: tahrirlashdan KEYIN uchala raqam bir vaqtda to'g'ri
 * bo'lishi kerak — ombor qoldig'i, kassa qoldig'i va ta'minotchi qarzi.
 * Miqdorni 50 dan 40 ga tushirish faqat buyurtma satrini emas, omborni ham
 * o'zgartiradi; Naqd → Qarz esa kassadan chiqqan pulni QAYTARIB, qarz
 * ochishi kerak. Bittasi qilinib ikkinchisi qilinmasa hisob buziladi.
 *
 * Ishga tushirish: npm run test:taminot-tahrir
 */
process.env.DATABASE_URL = "file:./prisma/test-taminot-tahrir.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let taminot: any;
let xarid: any;
let qarz: any;
let accountQueries: any;
let taminotchiQueries: any;
let createTenantWithOwner: any;

let t: any;
let kassa: any;
let plastik: any;
let taminotchi: any;
let ikkinchiTaminotchi: any;
let boyoq: any;
let lak: any;
let chotka: any;

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
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

async function qoldiq(productId: string): Promise<number> {
  const p = await rawPrisma.product.findUnique({ where: { id: productId } });
  return p.miqdor;
}

/** Yangi ta'minot yaratadi va uning id sini qaytaradi. */
async function taminotYarat(opts: {
  kalit: string;
  supplierId?: string;
  usul: "naqd" | "karta" | "qarz";
  accountId?: string | null;
  satrlar: { productId: string; miqdor: number; birlikNarx: number }[];
}) {
  return T(() =>
    taminot.taminotYarat({
      businessId: t.business.id,
      userId: t.user.id,
      data: {
        idempotencyKey: `tahrir-${opts.kalit}`,
        supplierId: opts.supplierId ?? taminotchi.id,
        tolovUsuli: opts.usul,
        accountId: opts.accountId ?? null,
        satrlar: opts.satrlar,
      },
    })
  );
}

function tahrir(orderId: string, data: any) {
  return T(() =>
    taminot.taminotTahrir({
      businessId: t.business.id,
      orderId,
      userId: t.user.id,
      data,
    })
  );
}

before(async () => {
  rmSync("prisma/test-taminot-tahrir.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  taminot = await import("@/lib/services/taminot");
  xarid = await import("@/lib/services/xarid");
  qarz = await import("@/lib/services/qarz");
  accountQueries = await import("@/lib/queries/accounts");
  taminotchiQueries = await import("@/lib/queries/taminotchi");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Bo'yoq do'koni",
    ism: "Egasi",
    login: "+998933333401",
    parol: "parol12345",
  });
  await rawPrisma.business.update({ where: { id: t.business.id }, data: { omborli: true } });

  kassa = await rawPrisma.account.findFirst({
    where: { businessId: t.business.id, turi: "naqd" },
  });
  assert.ok(kassa, "yangi biznesda naqd kassa ochilgan bo'lishi kerak");
  plastik = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Click terminal", turi: "plastik", tartib: 5 },
  });

  // Boshlang'ich kassa: 100 mln (barcha stsenariylarga yetadi).
  const kategoriya = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Boshlang'ich", turi: "kirim" },
  });
  await rawPrisma.transaction.create({
    data: {
      businessId: t.business.id,
      turi: "kirim",
      categoryId: kategoriya.id,
      accountId: kassa.id,
      summa: 100_000_000,
      sana: new Date("2026-08-01T00:00:00.000Z"),
      userId: t.user.id,
    },
  });

  taminotchi = await T(() => xarid.createSupplier(t.business.id, { nomi: "Toshkent Optom" }));
  ikkinchiTaminotchi = await T(() =>
    xarid.createSupplier(t.business.id, { nomi: "Andijon Savdo" })
  );

  boyoq = await rawPrisma.product.create({
    data: { businessId: t.business.id, nomi: "Altay bo'yoq", sotuvNarx: 150_000, miqdor: 0 },
  });
  lak = await rawPrisma.product.create({
    data: { businessId: t.business.id, nomi: "Lak", sotuvNarx: 100_000, miqdor: 0 },
  });
  chotka = await rawPrisma.product.create({
    data: { businessId: t.business.id, nomi: "Cho'tka", sotuvNarx: 20_000, miqdor: 0 },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// TEST 5 — bir ta'minotda uchta mahsulot
// ---------------------------------------------------------------------------

test("bir ta'minotda 3 ta mahsulot: uchalasi ham omborga kiradi, jami yig'indi", async () => {
  const qarzOldin = await menQarzdorman();

  const natija = await taminotYarat({
    kalit: "uchta",
    usul: "qarz",
    satrlar: [
      { productId: boyoq.id, miqdor: 50, birlikNarx: 120_000 },
      { productId: lak.id, miqdor: 20, birlikNarx: 80_000 },
      { productId: chotka.id, miqdor: 100, birlikNarx: 15_000 },
    ],
  });

  assert.equal(natija.jamiSumma, 6_000_000 + 1_600_000 + 1_500_000, "9,1 mln");
  assert.equal(await qoldiq(boyoq.id), 50);
  assert.equal(await qoldiq(lak.id), 20);
  assert.equal(await qoldiq(chotka.id), 100);
  assert.equal(await menQarzdorman(), qarzOldin + 9_100_000, "qarz jami summaga oshadi");
});

// ---------------------------------------------------------------------------
// TEST 6 — direktor miqdorni to'g'rilaydi
// ---------------------------------------------------------------------------

test("miqdorni 50 → 40 qilish ombordan 10 tasini AYIRADI va qarzni kamaytiradi", async () => {
  const order = await taminotYarat({
    kalit: "miqdor",
    usul: "qarz",
    satrlar: [{ productId: boyoq.id, miqdor: 50, birlikNarx: 120_000 }],
  });
  const qoldiqOldin = await qoldiq(boyoq.id);
  const qarzOldin = await menQarzdorman();
  assert.equal(order.jamiSumma, 6_000_000);

  await tahrir(order.id, {
    satrlar: [{ productId: boyoq.id, miqdor: 40, birlikNarx: 120_000 }],
  });

  assert.equal(await qoldiq(boyoq.id), qoldiqOldin - 10, "ombor −10 to'g'rilanadi");
  assert.equal(
    await menQarzdorman(),
    qarzOldin - 6_000_000 + 4_800_000,
    "eski qarz o'chadi, yangisi 4,8 mln bo'lib yoziladi"
  );

  const yangilangan = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  assert.equal(yangilangan.jamiSumma, 4_800_000);

  // Tarix qayta yozilmaydi — to'g'rilash QO'SHILADI.
  const togrilash = await rawPrisma.stockAdjustment.findFirst({
    where: { businessId: t.business.id, productId: boyoq.id, turi: "taminot_tahrir" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(togrilash, "ombor to'g'rilashi yozilishi kerak");
  assert.equal(togrilash.farq, -10);
});

test("narxni to'g'rilash jami summani va tannarxni yangilaydi", async () => {
  const order = await taminotYarat({
    kalit: "narx",
    usul: "qarz",
    satrlar: [{ productId: lak.id, miqdor: 10, birlikNarx: 80_000 }],
  });
  const qoldiqOldin = await qoldiq(lak.id);

  await tahrir(order.id, {
    satrlar: [{ productId: lak.id, miqdor: 10, birlikNarx: 90_000 }],
  });

  assert.equal(await qoldiq(lak.id), qoldiqOldin, "miqdor o'zgarmasa ombor tegilmaydi");
  const p = await rawPrisma.product.findUnique({ where: { id: lak.id } });
  assert.equal(p.kelganNarx, 90_000, "tannarx yangi narxdan snapshot oladi");
  const yangilangan = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  assert.equal(yangilangan.jamiSumma, 900_000);
});

test("ta'minotchini almashtirish qarzni yangi ta'minotchi nomiga ko'chiradi", async () => {
  const order = await taminotYarat({
    kalit: "supplier",
    usul: "qarz",
    satrlar: [{ productId: chotka.id, miqdor: 10, birlikNarx: 15_000 }],
  });

  await tahrir(order.id, { supplierId: ikkinchiTaminotchi.id });

  const yangilangan = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  assert.equal(yangilangan.supplierId, ikkinchiTaminotchi.id);
  const debt = await rawPrisma.debt.findUnique({ where: { id: yangilangan.debtId } });
  assert.equal(debt.mijozNomi, "Andijon Savdo", "qarz yangi ta'minotchi nomiga yoziladi");
});

// ---------------------------------------------------------------------------
// TEST 7 — Naqd → Qarz
// ---------------------------------------------------------------------------

test("Naqd → Qarz: kassadan chiqqan pul QAYTADI, qarz ochiladi, ombor tegilmaydi", async () => {
  const order = await taminotYarat({
    kalit: "naqd-qarz",
    usul: "naqd",
    accountId: kassa.id,
    satrlar: [{ productId: boyoq.id, miqdor: 5, birlikNarx: 120_000 }],
  });
  assert.ok(order.transactionId, "naqdda chiqim tranzaksiya bo'ladi");

  const kassaOldin = await kassaQoldiq(kassa.id);
  const qarzOldin = await menQarzdorman();
  const qoldiqOldin = await qoldiq(boyoq.id);

  await tahrir(order.id, { tolovUsuli: "qarz" });

  assert.equal(await kassaQoldiq(kassa.id), kassaOldin + 600_000, "chiqim qaytariladi");
  assert.equal(await menQarzdorman(), qarzOldin + 600_000, "o'rniga qarz yoziladi");
  assert.equal(await qoldiq(boyoq.id), qoldiqOldin, "tovar omborda qoladi");

  const yangilangan = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  assert.equal(yangilangan.tolovTuri, "qarz");
  assert.equal(yangilangan.tolanganSumma, 0);
  assert.equal(yangilangan.transactionId, null);
  assert.ok(yangilangan.debtId);

  const eski = await rawPrisma.transaction.findUnique({ where: { id: order.transactionId } });
  assert.ok(eski.deletedAt, "eski chiqim yumshoq o'chiriladi — tarix qoladi");
});

// ---------------------------------------------------------------------------
// TEST 8 — Qarz → Naqd
// ---------------------------------------------------------------------------

test("Qarz → Naqd: qarz bekor bo'ladi, kassadan chiqim yoziladi", async () => {
  const order = await taminotYarat({
    kalit: "qarz-naqd",
    usul: "qarz",
    satrlar: [{ productId: lak.id, miqdor: 4, birlikNarx: 80_000 }],
  });
  assert.ok(order.debtId, "qarzga olinganda qarz bo'ladi");

  const kassaOldin = await kassaQoldiq(kassa.id);
  const qarzOldin = await menQarzdorman();
  const qoldiqOldin = await qoldiq(lak.id);

  await tahrir(order.id, { tolovUsuli: "naqd", accountId: kassa.id });

  assert.equal(await kassaQoldiq(kassa.id), kassaOldin - 320_000, "kassadan chiqim");
  assert.equal(await menQarzdorman(), qarzOldin - 320_000, "qarz yopiladi");
  assert.equal(await qoldiq(lak.id), qoldiqOldin, "tovar omborda qoladi");

  const yangilangan = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  assert.equal(yangilangan.tolovTuri, "naqd");
  assert.equal(yangilangan.tolanganSumma, 320_000);
  assert.equal(yangilangan.debtId, null);
  assert.ok(yangilangan.transactionId);

  const eskiQarz = await rawPrisma.debt.findUnique({ where: { id: order.debtId } });
  assert.equal(eskiQarz, null, "eski qarz o'chiriladi");
});

test("Naqd → Karta: pul naqd kassaga emas, naqdsiz kassaga yoziladi", async () => {
  const order = await taminotYarat({
    kalit: "naqd-karta",
    usul: "naqd",
    accountId: kassa.id,
    satrlar: [{ productId: chotka.id, miqdor: 4, birlikNarx: 15_000 }],
  });

  await tahrir(order.id, { tolovUsuli: "karta", accountId: plastik.id });

  const yangilangan = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  const txn = await rawPrisma.transaction.findUnique({ where: { id: yangilangan.transactionId } });
  assert.equal(txn.accountId, plastik.id, "chiqim naqdsiz kassadan");
  assert.equal(txn.tolovTuri, "click");
});

// ---------------------------------------------------------------------------
// TO'SIQLAR — tahrirlash hisobni buzishga yo'l qo'ymaydi
// ---------------------------------------------------------------------------

test("tovari sotilgan ta'minot miqdorini kamaytirib bo'lmaydi", async () => {
  const order = await taminotYarat({
    kalit: "sotilgan",
    usul: "qarz",
    satrlar: [{ productId: chotka.id, miqdor: 30, birlikNarx: 15_000 }],
  });

  // Tovarning katta qismi sotildi — omborda 5 ta qoldi.
  const bor = await qoldiq(chotka.id);
  await rawPrisma.product.update({ where: { id: chotka.id }, data: { miqdor: 5 } });

  await assert.rejects(
    () => tahrir(order.id, { satrlar: [{ productId: chotka.id, miqdor: 1, birlikNarx: 15_000 }] }),
    /omborda 5 ta qoldi/,
    "qoldiqni manfiyga tushiradigan to'g'rilash rad etiladi"
  );

  // Rad etilgan amal HECH NARSANI o'zgartirmagan bo'lishi kerak.
  assert.equal(await qoldiq(chotka.id), 5);
  const ozgarmagan = await rawPrisma.purchaseOrder.findUnique({ where: { id: order.id } });
  assert.equal(ozgarmagan.jamiSumma, 450_000);

  await rawPrisma.product.update({ where: { id: chotka.id }, data: { miqdor: bor } });
});

test("qarzi qisman to'langan ta'minotni tahrirlab bo'lmaydi", async () => {
  const order = await taminotYarat({
    kalit: "qisman",
    usul: "qarz",
    satrlar: [{ productId: boyoq.id, miqdor: 2, birlikNarx: 120_000 }],
  });

  await T(() =>
    qarz.qarzTolov({
      businessId: t.business.id,
      debtId: order.debtId,
      userId: t.user.id,
      summa: 100_000,
      accountId: kassa.id,
    })
  );

  await assert.rejects(
    () => tahrir(order.id, { satrlar: [{ productId: boyoq.id, miqdor: 1, birlikNarx: 120_000 }] }),
    /to'lov qilingan/,
    "to'lov bo'lgan qarzni tahrirlash rad etiladi"
  );
});

test("bekor qilingan ta'minot tahrirlanmaydi", async () => {
  const order = await taminotYarat({
    kalit: "bekor",
    usul: "qarz",
    satrlar: [{ productId: lak.id, miqdor: 1, birlikNarx: 80_000 }],
  });
  await T(() =>
    taminot.taminotBekor({
      businessId: t.business.id,
      orderId: order.id,
      userId: t.user.id,
      sabab: "xato kiritildi",
    })
  );

  await assert.rejects(
    () => tahrir(order.id, { tolovUsuli: "naqd" }),
    /Bekor qilingan/,
    "bekor qilingan ta'minot tahrirlanmaydi"
  );
});

test("tahrirlash audit jurnaliga eski va yangi qiymat bilan tushadi", async () => {
  const order = await taminotYarat({
    kalit: "audit",
    usul: "qarz",
    satrlar: [{ productId: lak.id, miqdor: 3, birlikNarx: 80_000 }],
  });
  await tahrir(order.id, { satrlar: [{ productId: lak.id, miqdor: 2, birlikNarx: 80_000 }] });

  const yozuv = await rawPrisma.auditLog.findFirst({
    where: { businessId: t.business.id, entity: "purchaseOrder", entityId: order.id, action: "update" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(yozuv, "tahrirlash audit yozuvi bo'lishi kerak");
  const before = JSON.parse(yozuv.before);
  const after = JSON.parse(yozuv.after);
  assert.equal(before.jamiSumma, 240_000);
  assert.equal(after.jamiSumma, 160_000);
  assert.ok(yozuv.userId, "kim o'zgartirgani yoziladi");
});

// ---------------------------------------------------------------------------
// TA'MINOTCHI PROFILI VA QARZ TO'LASH
// ---------------------------------------------------------------------------

test("ta'minotchi profili: jami ta'minot, to'langan va qolgan qarz to'g'ri", async () => {
  const yangi = await T(() => xarid.createSupplier(t.business.id, { nomi: "Namangan Bozor" }));

  await taminotYarat({
    kalit: "profil-naqd",
    supplierId: yangi.id,
    usul: "naqd",
    accountId: kassa.id,
    satrlar: [{ productId: chotka.id, miqdor: 10, birlikNarx: 15_000 }],
  });
  await taminotYarat({
    kalit: "profil-qarz",
    supplierId: yangi.id,
    usul: "qarz",
    satrlar: [{ productId: boyoq.id, miqdor: 5, birlikNarx: 120_000 }],
  });

  const natija = await T(() => taminotchiQueries.taminotchiProfil(t.business.id, yangi.id));
  assert.ok(natija);
  const p = natija.profil;
  assert.equal(p.jamiTaminot, 150_000 + 600_000);
  assert.equal(p.jamiTolangan, 150_000, "ta'minot paytida to'langan qism");
  assert.equal(p.jamiQarz, 600_000);
  assert.equal(p.qolganQarz, 600_000, "hali to'lanmagan");
  assert.equal(p.taminotSoni, 2);
  assert.ok(p.oxirgiTaminot, "oxirgi ta'minot sanasi bo'lishi kerak");
  assert.equal(natija.tarix.taminotlar.length, 2, "tarixda ikkala ta'minot");
});

test("qarzning QISMAN to'lovi: qolgan qarz kamayadi, kassadan pul chiqadi", async () => {
  const yangi = await T(() => xarid.createSupplier(t.business.id, { nomi: "Farg'ona Ombor" }));
  await taminotYarat({
    kalit: "qisman-tolov",
    supplierId: yangi.id,
    usul: "qarz",
    satrlar: [{ productId: boyoq.id, miqdor: 50, birlikNarx: 120_000 }],
  });

  const oldin = await T(() => taminotchiQueries.taminotchiProfil(t.business.id, yangi.id));
  assert.equal(oldin.profil.qolganQarz, 6_000_000);

  const kassaOldin = await kassaQoldiq(kassa.id);
  await T(() =>
    qarz.qarzdorTolov({
      businessId: t.business.id,
      userId: t.user.id,
      turi: "beriladigan",
      kalit: oldin.profil.qarzKalit,
      summa: 2_000_000,
      accountId: kassa.id,
    })
  );

  const keyin = await T(() => taminotchiQueries.taminotchiProfil(t.business.id, yangi.id));
  assert.equal(keyin.profil.jamiQarz, 6_000_000, "jami qarz o'zgarmaydi");
  assert.equal(keyin.profil.qolganQarz, 4_000_000, "qolgan qarz 4 mln");
  assert.equal(keyin.profil.qarzTolovlari, 2_000_000, "to'langan 2 mln");
  assert.equal(await kassaQoldiq(kassa.id), kassaOldin - 2_000_000, "kassadan 2 mln chiqdi");
});

test("takror saqlash: bir kalit bilan ikki so'rov omborni bir marta oshiradi", async () => {
  const qoldiqOldin = await qoldiq(chotka.id);
  const [a, b] = await Promise.all([
    taminotYarat({
      kalit: "double",
      usul: "qarz",
      satrlar: [{ productId: chotka.id, miqdor: 7, birlikNarx: 15_000 }],
    }),
    taminotYarat({
      kalit: "double",
      usul: "qarz",
      satrlar: [{ productId: chotka.id, miqdor: 7, birlikNarx: 15_000 }],
    }),
  ]);

  assert.equal(a.id, b.id, "ikkala so'rov ayni yozuvni qaytaradi");
  assert.equal(await qoldiq(chotka.id), qoldiqOldin + 7, "ombor BIR MARTA oshadi");
});
