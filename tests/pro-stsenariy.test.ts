/**
 * PRO STSENARIY — Fortex Selos (kg + so'm, shaxsiy kassalar, qisman to'lov).
 *
 * Talab qilingan test stsenariysi:
 *   Murod (xaridor) Baxtiyor akadan (Taminotchi maxsus rolli tizim useri)
 *   100 kg Selos oladi, 1 kg = 8 000 so'm, jami 800 000 so'm.
 *     - Ombor: +100 kg;
 *     - Murod kassasi: −800 000; Baxtiyor kassasi: +800 000 (TRANSFER, chiqim emas);
 *     - Qarz: 0.
 *   Keyin qisman to'lov: 500 000 hozir → qarz 300 000 → 300 000 to'lanadi → qarz 0.
 *   Barcha balanslar ledger'dan hisoblanadi va matematik jihatdan aniq chiqishi shart.
 *
 * Ishga tushirish: npm run test:pro
 */
process.env.DATABASE_URL = "file:./prisma/test-pro.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let xarid: any;
let inventory: any;
let qarz: any;
let rollar: any;
let userKassa: any;
let accounts: any;
let tekshir: any;
let createTenantWithOwner: any;

let t: any; // Fortex Selos tenanti (Murod — OWNER)
let baxtiyor: any; // Taminotchi maxsus rolli user
let taminotchiRol: any;
let selos: any;
let supplier: any;

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Murod" });
}

/** Foydalanuvchining shaxsiy kassasi qoldig'i (ledger'dan). */
async function kassaQoldiq(userId: string): Promise<number> {
  const balanslar = await T(async () => accounts.getAccountBalances(t.business.id));
  const kassa = balanslar.find((k: any) => k.userId === userId);
  return kassa?.qoldiq ?? 0;
}

before(async () => {
  rmSync("prisma/test-pro.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  xarid = await import("@/lib/services/xarid");
  inventory = await import("@/lib/services/inventory");
  qarz = await import("@/lib/services/qarz");
  rollar = await import("@/lib/services/rollar");
  userKassa = await import("@/lib/services/userKassa");
  accounts = await import("@/lib/queries/accounts");
  tekshir = await import("@/lib/permissions/tekshir");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Fortex Selos",
    ism: "Murod",
    login: "+998933330001",
    parol: "parol12345",
  });
  // PRO tarif — maxsus rollar va shaxsiy kassalar shu tarifda ochiq.
  await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
  await rawPrisma.business.update({ where: { id: t.business.id }, data: { omborli: true } });

  selos = await rawPrisma.product.create({
    data: {
      businessId: t.business.id,
      nomi: "Selos",
      kelganNarx: 0,
      sotuvNarx: 9_000,
      miqdor: 0,
      birlik: "kg",
    },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- 1. Maxsus rol (custom role system) ----------

test("mijoz o'zi 'Taminotchi' rolini yaratadi — granular huquqlar bilan", async () => {
  taminotchiRol = await T(async () =>
    rollar.createRole({
      nomi: "Taminotchi",
      izoh: "Selos yetkazib beruvchi",
      huquqlar: ["mahsulot.korish", "tranzaksiya.korish", "pul.qabul", "ombor.korish"],
      bazaRol: "SELLER",
    })
  );
  assert.equal(taminotchiRol.nomi, "Taminotchi");
  assert.equal(taminotchiRol.bazaRol, "SELLER");

  // Bir xil nomdagi ikkinchi rol rad etiladi.
  await assert.rejects(
    () => T(async () => rollar.createRole({ nomi: "Taminotchi", huquqlar: [], bazaRol: "SELLER" })),
    /allaqachon bor/
  );
});

test("maxsus rolli foydalanuvchining effektiv huquqlari to'g'ri hisoblanadi", async () => {
  baxtiyor = await rawPrisma.user.create({
    data: {
      ism: "Baxtiyor aka",
      login: "+998933330002",
      parolHash: "h",
      rol: "SELLER",
      tenantId: t.tenant.id,
      roleId: taminotchiRol.id,
      // Override: alohida 'pul.berish' berildi, 'ombor.korish' olib qo'yildi.
      huquqPlus: JSON.stringify(["pul.berish"]),
      huquqMinus: JSON.stringify(["ombor.korish"]),
    },
  });

  const huquqlar = tekshir.effektivHuquqlar({
    rol: baxtiyor.rol,
    role: { huquqlar: taminotchiRol.huquqlar, isActive: true, deletedAt: null },
    huquqPlus: baxtiyor.huquqPlus,
    huquqMinus: baxtiyor.huquqMinus,
  });
  assert.ok(huquqlar.has("mahsulot.korish"), "roldan kelgan huquq");
  assert.ok(huquqlar.has("pul.qabul"), "roldan kelgan huquq");
  assert.ok(huquqlar.has("pul.berish"), "huquqPlus override");
  assert.ok(!huquqlar.has("ombor.korish"), "huquqMinus override ustun");
  assert.ok(!huquqlar.has("rol.boshqarish"), "berilmagan huquq yopiq");
});

test("faol foydalanuvchisi bor rolni o'chirib bo'lmaydi", async () => {
  await assert.rejects(
    () => T(async () => rollar.deleteRole(taminotchiRol.id)),
    /foydalanuvchi bor/
  );
});

// ---------- 2. Asosiy stsenariy: 100 kg × 8 000 = 800 000, to'liq to'lov ----------

test("xarid: 100 kg × 8 000 → ombor +100 kg, Murod −800k, Baxtiyor +800k, qarz 0", async () => {
  supplier = await T(async () =>
    xarid.createSupplier(t.business.id, {
      nomi: "Baxtiyor aka",
      userId: baxtiyor.id,
    })
  );
  assert.equal(supplier.userId, baxtiyor.id);

  const order = await T(async () =>
    xarid.createOrder(t.business.id, t.user.id, {
      supplierId: supplier.id,
      sana: "2026-08-14",
      tolovTuri: "naqd",
      satrlar: [{ productId: selos.id, miqdor: 100, birlikNarx: 8_000 }],
    })
  );
  assert.equal(order.jamiSumma, 800_000, "total = quantity_kg × price_per_kg");

  const qabul = await T(async () =>
    xarid.qabulQilish({
      businessId: t.business.id,
      orderId: order.id,
      userId: t.user.id,
      tolanganSumma: 800_000,
    })
  );
  assert.equal(qabul.holat, "qabul_qilingan");
  assert.equal(qabul.tolanganSumma, 800_000);
  assert.equal(qabul.debtId, null, "to'liq to'lovda qarz ochilmaydi");
  assert.equal(qabul.transactionId, null, "ichki ta'minotchi: chiqim tranzaksiya YO'Q");
  assert.ok(qabul.transferId, "to'lov kassa transferi bilan yozildi");

  // Ombor: +100 kg, tannarx snapshot yangilandi.
  const p = await rawPrisma.product.findUnique({ where: { id: selos.id } });
  assert.equal(p.miqdor, 100, "inventory +100 kg");
  assert.equal(p.kelganNarx, 8_000, "tannarx snapshot");

  // Kassalar — ledger'dan.
  assert.equal(await kassaQoldiq(t.user.id), -800_000, "Murod kassasi");
  assert.equal(await kassaQoldiq(baxtiyor.id), 800_000, "Baxtiyor kassasi");

  // Ochiq qarz yo'q.
  const ochiqQarz = await rawPrisma.debt.count({
    where: { businessId: t.business.id, isYopilgan: false },
  });
  assert.equal(ochiqQarz, 0);
});

test("narx har xaridda alohida snapshot — eski narx yangisiga ta'sir qilmaydi", async () => {
  // Ertaga: 150 kg × 8 500 = 1 275 000 (qoralama holida qoladi — pulga tegmaydi).
  const order = await T(async () =>
    xarid.createOrder(t.business.id, t.user.id, {
      supplierId: supplier.id,
      sana: "2026-08-15",
      tolovTuri: "naqd",
      satrlar: [{ productId: selos.id, miqdor: 150, birlikNarx: 8_500 }],
    })
  );
  assert.equal(order.jamiSumma, 1_275_000);

  // Birinchi buyurtma narxi o'zgarmagan.
  const eski = await rawPrisma.purchaseOrderItem.findFirst({
    where: { businessId: t.business.id, birlikNarx: 8_000 },
  });
  assert.ok(eski, "eski snapshot joyida");

  // Qoralama pul va omborga tegmagan.
  assert.equal(await kassaQoldiq(t.user.id), -800_000);
  await T(async () =>
    xarid.orderHolatiniOzgartir({ businessId: t.business.id, orderId: order.id, holat: "bekor" })
  );
});

// ---------- 3. Qisman to'lov: 500 000 hozir, 300 000 keyin ----------

let qarzId: string;

test("qisman to'lov: 500k → Murod −500k, Baxtiyor +500k, qarz 300k", async () => {
  const order = await T(async () =>
    xarid.createOrder(t.business.id, t.user.id, {
      supplierId: supplier.id,
      sana: "2026-08-16",
      tolovTuri: "naqd",
      satrlar: [{ productId: selos.id, miqdor: 100, birlikNarx: 8_000 }],
    })
  );

  const qabul = await T(async () =>
    xarid.qabulQilish({
      businessId: t.business.id,
      orderId: order.id,
      userId: t.user.id,
      tolanganSumma: 500_000,
    })
  );
  assert.equal(qabul.tolanganSumma, 500_000);
  assert.ok(qabul.debtId, "qoldiq qarzga ochildi");
  qarzId = qabul.debtId;

  const debt = await rawPrisma.debt.findUnique({ where: { id: qarzId } });
  assert.equal(debt.jamiSumma, 300_000, "qarz = 800k − 500k");
  assert.equal(debt.turi, "beriladigan");
  assert.equal(debt.isYopilgan, false);

  // Balans: −800k (1-xarid) − 500k = −1 300 000; Baxtiyor: +1 300 000.
  assert.equal(await kassaQoldiq(t.user.id), -1_300_000);
  assert.equal(await kassaQoldiq(baxtiyor.id), 1_300_000);

  // Ombor: 100 + 100 = 200 kg.
  const p = await rawPrisma.product.findUnique({ where: { id: selos.id } });
  assert.equal(p.miqdor, 200);
});

test("qarz to'lovi 300k → qarz yopiladi, pul transfer bilan o'tadi", async () => {
  const debt = await T(async () =>
    qarz.qarzTolov({
      businessId: t.business.id,
      debtId: qarzId,
      summa: 300_000,
      userId: t.user.id,
    })
  );
  assert.equal(debt.tolangan, 300_000);
  assert.equal(debt.isYopilgan, true, "qarz 0 — yopildi");

  assert.equal(await kassaQoldiq(t.user.id), -1_600_000);
  assert.equal(await kassaQoldiq(baxtiyor.id), 1_600_000);

  // Ichki ta'minotchi to'lovlari kirim/chiqim aylanmasini SOXTA oshirmasligi kerak:
  // bu stsenariyda birorta Transaction yozilmagan.
  const txSoni = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });
  assert.equal(txSoni, 0, "pul harakati faqat transfer ledger'ida");

  // DebtPayment tarixi bor (audit iz).
  const tolovlar = await rawPrisma.debtPayment.count({ where: { debtId: qarzId } });
  assert.equal(tolovlar, 1);
});

test("takroriy to'lov (duplicate payment) rad etiladi", async () => {
  await assert.rejects(
    () =>
      T(async () =>
        qarz.qarzTolov({
          businessId: t.business.id,
          debtId: qarzId,
          summa: 300_000,
          userId: t.user.id,
        })
      ),
    /yopilgan/
  );
});

// ---------- 4. User-to-user transfer va validatsiyalar ----------

test("foydalanuvchidan foydalanuvchiga o'tkazma (sender→receiver) ledger'da yoziladi", async () => {
  const transfer = await T(async () =>
    userKassa.createUserTransfer({
      businessId: t.business.id,
      actorId: t.user.id,
      actorRol: "OWNER",
      data: { toUserId: baxtiyor.id, summa: 100_000, sana: "2026-08-16", izoh: "Bonus" },
    })
  );
  assert.equal(transfer.fromUserId, t.user.id);
  assert.equal(transfer.toUserId, baxtiyor.id);
  assert.equal(transfer.fromUserIsm, "Murod");
  assert.equal(transfer.toUserIsm, "Baxtiyor aka");
  assert.equal(transfer.valyuta, "UZS");
  assert.equal(transfer.holat, "bajarildi");

  assert.equal(await kassaQoldiq(t.user.id), -1_700_000);
  assert.equal(await kassaQoldiq(baxtiyor.id), 1_700_000);
});

test("o'ziga o'tkazish rad etiladi (sender ≠ receiver)", async () => {
  await assert.rejects(
    () =>
      T(async () =>
        userKassa.createUserTransfer({
          businessId: t.business.id,
          actorId: t.user.id,
          actorRol: "OWNER",
          data: { toUserId: t.user.id, summa: 1_000, sana: "2026-08-16" },
        })
      ),
    /O'zingizga/
  );
});

test("oddiy xodim balansdan ortiq o'tkaza olmaydi (biznes qoidasi)", async () => {
  // Baxtiyor (SELLER, balans 1.7M) 5M o'tkazmoqchi — rad etiladi.
  await assert.rejects(
    () =>
      runWithTenant(
        t.tenant.id,
        async () =>
          userKassa.createUserTransfer({
            businessId: t.business.id,
            actorId: baxtiyor.id,
            actorRol: "SELLER",
            data: { toUserId: t.user.id, summa: 5_000_000, sana: "2026-08-16" },
          }),
        { userId: baxtiyor.id, ism: "Baxtiyor aka" }
      ),
    /yetarli mablag'/
  );
});

test("o'tkazmani bekor qilish — storno bilan, balans tiklanadi", async () => {
  const transfer = await T(async () =>
    userKassa.createUserTransfer({
      businessId: t.business.id,
      actorId: t.user.id,
      actorRol: "OWNER",
      data: { toUserId: baxtiyor.id, summa: 50_000, sana: "2026-08-16" },
    })
  );
  const oldin = await kassaQoldiq(t.user.id);

  await T(async () =>
    userKassa.cancelUserTransfer({
      businessId: t.business.id,
      transferId: transfer.id,
      actorId: t.user.id,
      actorRol: "OWNER",
    })
  );

  assert.equal(await kassaQoldiq(t.user.id), oldin + 50_000, "storno balansni tikladi");
  const asl = await rawPrisma.accountTransfer.findUnique({ where: { id: transfer.id } });
  assert.equal(asl.holat, "bekor");
  const storno = await rawPrisma.accountTransfer.findFirst({
    where: { relatedType: "storno", relatedId: transfer.id },
  });
  assert.ok(storno, "teskari yozuv (append-only ledger)");
});

// ---------- 5. Matematik yaxlitlik (double-entry) ----------

test("har xarid to'lovi aynan o'z summasi bilan transfer yozgan (800k va 500k)", async () => {
  const transferlar = await rawPrisma.accountTransfer.findMany({
    where: { businessId: t.business.id, relatedType: "purchaseOrder" },
    select: { summa: true, fromUserId: true, toUserId: true, valyuta: true },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    transferlar.map((x: any) => x.summa),
    [800_000, 500_000],
    "to'liq to'lov 800k, qisman to'lov 500k"
  );
  // Har transfer SOURCE → DESTINATION: Murod → Baxtiyor.
  for (const x of transferlar) {
    assert.equal(x.fromUserId, t.user.id);
    assert.equal(x.toUserId, baxtiyor.id);
    assert.equal(x.valyuta, "UZS");
  }
});

test("qarz to'lovi 300k ham alohida transfer sifatida yozilgan", async () => {
  const tolov = await rawPrisma.accountTransfer.findFirst({
    where: { businessId: t.business.id, relatedType: "debt", relatedId: qarzId },
    select: { summa: true, fromUserId: true, toUserId: true },
  });
  assert.ok(tolov, "qarz to'lovi ledger'da");
  assert.equal(tolov.summa, 300_000);
  assert.equal(tolov.fromUserId, t.user.id);
  assert.equal(tolov.toUserId, baxtiyor.id);
});

test("DOUBLE-ENTRY: ichki o'tkazmalarda barcha kassalar yig'indisi 0", async () => {
  // Bu stsenariyda tashqi pul (kirim/chiqim tranzaksiya) umuman yo'q —
  // pul faqat biznes ICHIDA ko'chgan. Demak Σ(barcha kassa qoldig'i) = 0
  // bo'lishi SHART: har o'tkazma bir kassadan chiqib ikkinchisiga tushgan.
  const balanslar = await T(async () => accounts.getAccountBalances(t.business.id));
  const yigindi = balanslar.reduce((s: number, k: any) => s + k.qoldiq, 0);
  assert.equal(yigindi, 0, "manbasiz pul paydo bo'lmagan va yo'qolmagan");
});

test("balans ledger'dan qayta hisoblanganda bir xil chiqadi (mustaqil tekshiruv)", async () => {
  // getAccountBalances'ga ishonmasdan, xom ledger'dan qo'lda hisoblaymiz.
  const kassalar = await rawPrisma.account.findMany({
    where: { businessId: t.business.id },
    select: { id: true, userId: true },
  });
  const murodKassa = kassalar.filter((k: any) => k.userId === t.user.id).map((k: any) => k.id);
  const baxtiyorKassa = kassalar.filter((k: any) => k.userId === baxtiyor.id).map((k: any) => k.id);

  const hammasi = await rawPrisma.accountTransfer.findMany({
    where: { businessId: t.business.id },
    select: { fromAccountId: true, toAccountId: true, summa: true },
  });
  const qoldiq = (ids: string[]) =>
    hammasi.reduce(
      (s: number, x: any) =>
        s + (ids.includes(x.toAccountId) ? x.summa : 0) - (ids.includes(x.fromAccountId) ? x.summa : 0),
      0
    );

  assert.equal(qoldiq(murodKassa), await kassaQoldiq(t.user.id), "Murod: xom ledger = hisoblangan balans");
  assert.equal(qoldiq(baxtiyorKassa), await kassaQoldiq(baxtiyor.id), "Baxtiyor: xom ledger = hisoblangan balans");
  assert.equal(qoldiq(murodKassa) + qoldiq(baxtiyorKassa), 0, "ikki tomon bir-birini qoplaydi");
});

test("qarz tarixi matematik jihatdan yopiq: 800k = 500k to'lov + 300k qarz to'lovi", async () => {
  const debt = await rawPrisma.debt.findUnique({
    where: { id: qarzId },
    include: { payments: { select: { summa: true } } },
  });
  const tolovlarJami = debt.payments.reduce((s: number, p: any) => s + p.summa, 0);
  assert.equal(debt.jamiSumma, 300_000, "qarz = 800k − 500k");
  assert.equal(tolovlarJami, 300_000, "to'lovlar yig'indisi qarzga teng");
  assert.equal(debt.jamiSumma - debt.tolangan, 0, "qoldiq 0");
  assert.equal(debt.isYopilgan, true);

  // Buyurtma tomonidan: to'langan (500k) + qarz (300k) = jami (800k).
  const order = await rawPrisma.purchaseOrder.findFirst({ where: { debtId: qarzId } });
  assert.equal(order.tolanganSumma + debt.jamiSumma, order.jamiSumma);
  assert.equal(order.jamiSumma, 800_000);
});

// ---------- 6. To'lov holati (§13) va validatsiya (§14) ----------

test("to'lov holati: to'langan / qisman / qarz — eski yozuvlar ham to'g'ri", async () => {
  const { tolovHolati } = await import("@/lib/validation/xarid");
  const asos = { holat: "qabul_qilingan", jamiSumma: 800_000, tolovTuri: "naqd" };

  assert.equal(tolovHolati({ ...asos, tolanganSumma: 800_000 }), "tolangan");
  assert.equal(tolovHolati({ ...asos, tolanganSumma: 500_000 }), "qisman");
  assert.equal(tolovHolati({ ...asos, tolanganSumma: 0, debtId: "d1" }), "qarz");
  // Eski yozuv: tolanganSumma to'ldirilmagan (0), lekin chiqim yozilgan.
  assert.equal(tolovHolati({ ...asos, tolanganSumma: 0, transactionId: "t1" }), "tolangan");
  assert.equal(tolovHolati({ ...asos, tolovTuri: "qarz", tolanganSumma: 0 }), "qarz");
  assert.equal(tolovHolati({ ...asos, holat: "qoralama", tolanganSumma: 0 }), "qoralama");
  assert.equal(tolovHolati({ ...asos, holat: "tasdiqlangan", tolanganSumma: 0 }), "kutilmoqda");
  assert.equal(tolovHolati({ ...asos, holat: "bekor", tolanganSumma: 0 }), "bekor");
});

test("validatsiya: miqdor va narx 0 dan katta bo'lishi shart", async () => {
  const { createOrderSchema } = await import("@/lib/validation/xarid");
  const asos = { supplierId: "s1", sana: "2026-08-16", tolovTuri: "naqd" as const };

  assert.equal(
    createOrderSchema.safeParse({
      ...asos,
      satrlar: [{ productId: "p1", miqdor: 100, birlikNarx: 8_000 }],
    }).success,
    true
  );
  assert.equal(
    createOrderSchema.safeParse({ ...asos, satrlar: [{ productId: "p1", miqdor: 0, birlikNarx: 8_000 }] }).success,
    false,
    "0 kg rad etiladi"
  );
  assert.equal(
    createOrderSchema.safeParse({ ...asos, satrlar: [{ productId: "p1", miqdor: 100, birlikNarx: 0 }] }).success,
    false,
    "0 narx rad etiladi"
  );
  assert.equal(
    createOrderSchema.safeParse({ ...asos, satrlar: [{ productId: "p1", miqdor: -5, birlikNarx: 8_000 }] }).success,
    false,
    "manfiy miqdor rad etiladi"
  );
});

test("to'langan summa jami summadan oshib keta olmaydi", async () => {
  const order = await T(async () =>
    xarid.createOrder(t.business.id, t.user.id, {
      supplierId: supplier.id,
      sana: "2026-08-17",
      tolovTuri: "naqd",
      satrlar: [{ productId: selos.id, miqdor: 10, birlikNarx: 8_000 }],
    })
  );
  await assert.rejects(
    () =>
      T(async () =>
        xarid.qabulQilish({
          businessId: t.business.id,
          orderId: order.id,
          userId: t.user.id,
          tolanganSumma: 200_000, // jami 80 000
        })
      ),
    /oralig'ida/
  );
  // Rad etilgan qabul omborga ham, pulga ham tegmagan.
  const p = await rawPrisma.product.findUnique({ where: { id: selos.id } });
  assert.equal(p.miqdor, 200, "atomik: rollback bo'ldi");
  await T(async () =>
    xarid.orderHolatiniOzgartir({ businessId: t.business.id, orderId: order.id, holat: "bekor" })
  );
});

// ---------- 7. Foydalanuvchilar sahifasi ustunlari (Balans / Qarz / Yozuvlar) ----------

test("user moliyasi: balans ledger'ga teng, ochiq qarz ta'minotchi kesimida ko'rinadi", async () => {
  const { getUserMoliya } = await import("@/lib/queries/userMoliya");

  const murodOldin = await kassaQoldiq(t.user.id);
  const baxtiyorOldin = await kassaQoldiq(baxtiyor.id);

  // 50 kg × 8 000 = 400 000, faqat 100 000 to'lanadi → ochiq qarz 300 000.
  const order = await T(async () =>
    xarid.createOrder(t.business.id, t.user.id, {
      supplierId: supplier.id,
      sana: "2026-08-18",
      tolovTuri: "naqd",
      satrlar: [{ productId: selos.id, miqdor: 50, birlikNarx: 8_000 }],
    })
  );
  await T(async () =>
    xarid.qabulQilish({
      businessId: t.business.id,
      orderId: order.id,
      userId: t.user.id,
      tolanganSumma: 100_000,
    })
  );

  const moliya = await T(async () => getUserMoliya(t.business.id));
  const murod = moliya.get(t.user.id)!;
  const bax = moliya.get(baxtiyor.id)!;

  // Balans — mustaqil hisoblangan kassa qoldig'i bilan bir xil.
  assert.equal(murod.balans, murodOldin - 100_000);
  assert.equal(bax.balans, baxtiyorOldin + 100_000);
  assert.equal(murod.balans, await kassaQoldiq(t.user.id));
  assert.equal(bax.balans, await kassaQoldiq(baxtiyor.id));

  // Qarz — biznes Baxtiyor akaga 300 000 qarzdor; xaridorda qarz yo'q.
  assert.equal(bax.qarz, 300_000, "400k − 100k");
  assert.equal(murod.qarz, 0);

  // Yozuvlar soni — har ikkalasida ham pul harakatlari bor.
  assert.ok(murod.amallar > 0 && bax.amallar > 0);
  assert.equal(murod.amallar, bax.amallar, "har o'tkazma ikkala tomonda ham sanaladi");

  // Double-entry invarianti shundan keyin ham buzilmagan.
  const balanslar = await T(async () => accounts.getAccountBalances(t.business.id));
  assert.equal(
    balanslar.reduce((s: number, k: any) => s + k.qoldiq, 0),
    0
  );
});

// ---------- 8. Audit log ----------

test("muhim amallar audit jurnalida qolgan", async () => {
  const logs = await rawPrisma.auditLog.findMany({
    where: { tenantId: t.tenant.id },
    select: { entity: true, action: true },
  });
  const bor = (entity: string) => logs.some((l: any) => l.entity === entity);
  assert.ok(bor("role"), "rol yaratildi — logda");
  assert.ok(bor("purchaseOrder"), "xarid — logda");
  assert.ok(bor("accountTransfer"), "pul o'tkazmalari — logda");
  assert.ok(bor("debtPayment"), "qarz to'lovi — logda");
});
