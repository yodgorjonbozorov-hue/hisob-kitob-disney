/**
 * MIJOZ TELEGRAM XABARNOMASI — optom savdo.
 *
 * Optom mijozga tovar berilganda uning Telegramiga to'liq savdo ma'lumoti
 * ketadi. Test tekshiradigan ASOSIY VA'DA: xabardagi HAR RAQAM bazadagi
 * tasdiqlangan yozuvdan chiqadi (sotuv snapshot narxi, kirim tranzaksiyasi,
 * qarz ledgeri) — hech qayerda ikkinchi hisob-kitob yo'q.
 *
 * Ishga tushirish: npm run test:mijoz-telegram
 */
process.env.DATABASE_URL = "file:./prisma/test-mijoz-telegram.db";
process.env.TELEGRAM_BOT_USERNAME = "BalansaBot";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let posSvc: any;
let omborSvc: any;
let qarzSvc: any;
let xabarnomaSvc: any;
let mijozTgSvc: any;
let tgQueries: any;
let posQueries: any;
let yuborish: any;

let T: any;
let T2: any;
let cola: string;
let fanta: string;
let suv: string;
let guruch: string;
let mijoz: string;
let ulanmagan: string;

/** Soxta Telegramga tushgan xabarlar. */
let yuborilgan: { chatId: string; matn: string }[] = [];
/** Keyingi yuborish(lar) xato bersinmi. */
let xatoRejimi = false;

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}
function B<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T2.tenant.id, fn, { userId: T2.user.id, ism: "Direktor 2" });
}

/** Mijozning ledgerdagi HOZIRGI ochiq qarzi (snapshot emas). */
function joriyQarz(): Promise<number> {
  return A(async () => {
    const agg = await rawPrisma.debt.aggregate({
      where: { businessId: T.business.id, contactId: mijoz, isYopilgan: false, turi: "olinadigan" },
      _sum: { jamiSumma: true, tolangan: true },
    });
    return (agg._sum.jamiSumma ?? 0) - (agg._sum.tolangan ?? 0);
  });
}

/** Oxirgi yuborilgan matn. */
function oxirgi(): string {
  assert.ok(yuborilgan.length > 0, "hech qanday xabar yuborilmagan");
  return yuborilgan[yuborilgan.length - 1].matn;
}

async function mahsulot(
  businessId: string,
  nomi: string,
  narx: number,
  birlik: string,
  miqdor = 1000
): Promise<string> {
  const p = await rawPrisma.product.create({
    data: { businessId, nomi, kelganNarx: Math.round(narx * 0.7), sotuvNarx: narx, miqdor, birlik },
  });
  return p.id;
}

/** POS savati orqali buyurtma yaratadi (optom "order" — chek + satrlar). */
function buyurtma(p: {
  satrlar: { productId: string; miqdor: number; narx?: number }[];
  tolovTuri: "naqd" | "karta" | "click" | "qarz";
  contactId?: string;
  sana?: string;
}) {
  return A(() =>
    posSvc.posSotuv({
      businessId: T.business.id,
      satrlar: p.satrlar,
      tolovTuri: p.tolovTuri,
      contactId: p.contactId ?? mijoz,
      mijozNomi: "Akmal Optom",
      mijozSaqla: true,
      sana: p.sana ?? "2026-09-05",
      userId: T.user.id,
    })
  );
}

before(async () => {
  for (const s of ["", "-journal"]) rmSync(`prisma/test-mijoz-telegram.db${s}`, { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  posSvc = await import("@/lib/services/pos");
  omborSvc = await import("@/lib/services/inventory");
  qarzSvc = await import("@/lib/services/qarz");
  xabarnomaSvc = await import("@/lib/services/mijozXabarnoma");
  mijozTgSvc = await import("@/lib/services/mijozTelegram");
  tgQueries = await import("@/lib/queries/mijozTelegram");
  posQueries = await import("@/lib/queries/pos");
  yuborish = await import("@/lib/telegram/yuborish");

  // SOXTA YUBORUVCHI: haqiqiy bot importi TELEGRAM_BOT_TOKEN talab qiladi va
  // testda mavjud emas. Shu ilgak orqali "Telegram xato berdi" stsenariysi
  // ham sinaladi (10-test).
  yuborish.setTelegramYuboruvchi(async (chatId: string, matn: string) => {
    if (xatoRejimi) throw new Error("Telegram API 503");
    yuborilgan.push({ chatId, matn });
  });

  T = await createTenantWithOwner({
    kompaniyaNomi: "Optom Baza",
    ism: "Fayruza",
    login: "+998900000801",
    parol: "parol12345",
  });
  T2 = await createTenantWithOwner({
    kompaniyaNomi: "Boshqa Optom",
    ism: "Direktor 2",
    login: "+998900000802",
    parol: "parol12345",
  });
  for (const t of [T, T2]) {
    await rawPrisma.business.update({
      where: { id: t.business.id },
      data: { turi: "optom", omborli: true, magazin: true },
    });
  }

  cola = await mahsulot(T.business.id, "Coca-Cola 1.5L", 12_000, "dona");
  fanta = await mahsulot(T.business.id, "Fanta 1.5L", 11_500, "dona");
  suv = await mahsulot(T.business.id, "Suv 1L", 3_000, "dona");
  guruch = await mahsulot(T.business.id, "Guruch", 8_500, "kg");

  const m = await rawPrisma.contact.create({
    data: {
      businessId: T.business.id,
      ism: "Akmal Optom",
      tel: "+998901112233",
      createdBy: T.user.id,
      telegramChatId: "555000111",
      telegramUlanganAt: new Date(),
    },
  });
  mijoz = m.id;

  const u = await rawPrisma.contact.create({
    data: { businessId: T.business.id, ism: "Ulanmagan Mijoz", createdBy: T.user.id },
  });
  ulanmagan = u.id;
});

after(async () => {
  yuborish?.setTelegramYuboruvchi(null);
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1. Naqd savdo
// ---------------------------------------------------------------------------

test("1. Naqd savdo: xabarda jami va naqd to'lov, qarz qatori yo'q", async () => {
  yuborilgan = [];
  const chek = await buyurtma({ satrlar: [{ productId: cola, miqdor: 20 }], tolovTuri: "naqd" });

  assert.equal(yuborilgan.length, 1, "naqd savdodan keyin bitta xabar ketishi kerak");
  const m = oxirgi();
  assert.match(m, /📦 Xaridingiz/);
  assert.match(m, /20 dona × 12 000 so'm/);
  assert.match(m, /💰 Jami: 240 000 so'm/);
  assert.match(m, /💵 Naqd: 240 000 so'm/);
  assert.ok(!/Qarzga/.test(m), "naqd savdoda qarz qatori bo'lmasligi kerak");
  assert.match(m, /👤 Sotuvchi: Fayruza/);
  assert.match(m, new RegExp(`Buyurtma №${chek.raqam}`));
});

// ---------------------------------------------------------------------------
// 2. 100% qarz savdo
// ---------------------------------------------------------------------------

let qarzChek: any;

test("2. To'liq qarzga savdo: jami = qarz, to'lov qatori yo'q", async () => {
  yuborilgan = [];
  qarzChek = await buyurtma({ satrlar: [{ productId: fanta, miqdor: 10 }], tolovTuri: "qarz" });

  const m = oxirgi();
  assert.match(m, /💰 Jami: 115 000 so'm/);
  assert.match(m, /📕 Qarzga: 115 000 so'm/);
  assert.ok(!/To'landi/.test(m), "to'lovsiz qarzda 'To'landi' qatori bo'lmasligi kerak");
});

// ---------------------------------------------------------------------------
// 3. Qisman to'lov
// ---------------------------------------------------------------------------

test("3. Qisman to'lov: to'langan qism va qolgan qarz ledgerdan chiqadi", async () => {
  const debt = await A(() =>
    rawPrisma.debt.findFirst({ where: { businessId: T.business.id, contactId: mijoz, status: "OPEN" } })
  );
  await A(() =>
    qarzSvc.qarzTolov({
      businessId: T.business.id,
      debtId: debt.id,
      userId: T.user.id,
      summa: 40_000,
      tolovTuri: "naqd",
      sana: "2026-09-05",
    })
  );

  yuborilgan = [];
  const natija = await A(() =>
    xabarnomaSvc.xabarnomaniQaytaYubor({ businessId: T.business.id, chekId: qarzChek.id })
  );
  assert.equal(natija.holat, "YUBORILDI");

  const m = oxirgi();
  assert.match(m, /💰 Jami: 115 000 so'm/);
  assert.match(m, /💵 Naqd: 40 000 so'm/);
  assert.match(m, /📕 Qarzga: 75 000 so'm/, "qarz = 115 000 − 40 000");
});

// ---------------------------------------------------------------------------
// 4. Naqd + Click + qarz (aralash to'lov)
// ---------------------------------------------------------------------------

test("4. Aralash to'lov: har kanal alohida qator, ostida yig'indi", async () => {
  yuborilgan = [];
  const chek = await buyurtma({ satrlar: [{ productId: cola, miqdor: 100 }], tolovTuri: "qarz" });
  const debt = await A(() =>
    rawPrisma.debt.findFirst({ where: { businessId: T.business.id, izoh: `${chek.raqam}-chek` } })
  );
  for (const [summa, usul] of [
    [300_000, "naqd"],
    [500_000, "click"],
  ] as const) {
    await A(() =>
      qarzSvc.qarzTolov({
        businessId: T.business.id,
        debtId: debt.id,
        userId: T.user.id,
        summa,
        tolovTuri: usul,
        sana: "2026-09-05",
      })
    );
  }

  yuborilgan = [];
  await A(() => xabarnomaSvc.xabarnomaniQaytaYubor({ businessId: T.business.id, chekId: chek.id }));

  const m = oxirgi();
  assert.match(m, /💰 Jami: 1 200 000 so'm/);
  assert.match(m, /💵 Naqd: 300 000 so'm/);
  assert.match(m, /💳 Click: 500 000 so'm/);
  assert.match(m, /💳 To'landi: 800 000 so'm/);
  assert.match(m, /📕 Qarzga: 400 000 so'm/);
});

// ---------------------------------------------------------------------------
// 5-7. Bir nechta mahsulot, kg va dona birliklari
// ---------------------------------------------------------------------------

test("5-7. Ko'p mahsulotli savdo: har satr o'z birligi bilan, jami to'g'ri", async () => {
  yuborilgan = [];
  await buyurtma({
    satrlar: [
      { productId: cola, miqdor: 20 },
      { productId: fanta, miqdor: 10 },
      { productId: suv, miqdor: 30 },
      { productId: guruch, miqdor: 125 },
    ],
    tolovTuri: "naqd",
  });

  const m = oxirgi();
  assert.match(m, /1\. Coca-Cola 1\.5L\n   20 dona × 12 000 so'm\n   = 240 000 so'm/);
  assert.match(m, /Fanta 1\.5L\n   10 dona × 11 500 so'm\n   = 115 000 so'm/);
  assert.match(m, /Suv 1L\n   30 dona × 3 000 so'm\n   = 90 000 so'm/);
  assert.match(m, /Guruch\n   125 kg × 8 500 so'm\n   = 1 062 500 so'm/, "kg birligi ko'rinishi kerak");
  assert.match(m, /💰 Jami: 1 507 500 so'm/);
});

// ---------------------------------------------------------------------------
// 8. Oldindan qarzi bor mijoz
// ---------------------------------------------------------------------------

test("8. Oldingi qarzi bor mijoz: oldingi + yangi = jami qarz", async () => {
  const oldingiQarz = await joriyQarz();
  assert.ok(oldingiQarz > 0, "test uchun mijozda oldindan qarz bo'lishi kerak");

  yuborilgan = [];
  await buyurtma({ satrlar: [{ productId: suv, miqdor: 30 }], tolovTuri: "qarz" });

  const m = oxirgi();
  assert.match(m, new RegExp(`Oldingi qarz: ${fs(oldingiQarz)} so'm`));
  assert.match(m, /Yangi qarz: \+90 000 so'm/);
  assert.match(m, new RegExp(`📕 Jami qarz: ${fs(oldingiQarz + 90_000)} so'm`));
});

/** Test ichida kutilayotgan summani xabardagi format bilan bir xil yozadi. */
function fs(v: number): string {
  return String(v)
    .split("")
    .reverse()
    .join("")
    .replace(/(\d{3})(?=\d)/g, "$1 ")
    .split("")
    .reverse()
    .join("");
}

// ---------------------------------------------------------------------------
// 9. Telegramga ulanmagan mijoz
// ---------------------------------------------------------------------------

test("9. Ulanmagan mijoz: xabar yuborilmaydi va jurnalga yozilmaydi", async () => {
  yuborilgan = [];
  const chek = await buyurtma({
    satrlar: [{ productId: cola, miqdor: 1 }],
    tolovTuri: "naqd",
    contactId: ulanmagan,
  });

  assert.equal(yuborilgan.length, 0, "ulanmagan mijozga xabar ketmasligi kerak");
  const jurnal = await A(() =>
    rawPrisma.telegramNotification.count({ where: { businessId: T.business.id, chekId: chek.id } })
  );
  assert.equal(jurnal, 0, "ulanmagan mijoz uchun jurnal yozuvi ochilmasligi kerak");

  const holat = await A(() =>
    tgQueries.buyurtmaTelegramHolati(T.business.id, { chekId: chek.id })
  );
  assert.equal(holat.holat, "ULANMAGAN");
});

// ---------------------------------------------------------------------------
// 10. Telegram xato bersa savdo buzilmaydi
// ---------------------------------------------------------------------------

test("10. Telegram xatosi savdoni buzmaydi, jurnalda XATO qoladi", async () => {
  xatoRejimi = true;
  yuborilgan = [];
  let chek: any;
  try {
    chek = await buyurtma({ satrlar: [{ productId: cola, miqdor: 2 }], tolovTuri: "naqd" });
  } finally {
    xatoRejimi = false;
  }

  assert.ok(chek?.id, "Telegram yiqilsa ham chek saqlanishi kerak");
  const yozuv = await A(() =>
    rawPrisma.telegramNotification.findFirst({
      where: { businessId: T.business.id, chekId: chek.id },
    })
  );
  assert.equal(yozuv.holat, "XATO");
  assert.equal(yozuv.urinish, 3, "maksimum 3 marta urinilishi kerak");
  assert.match(yozuv.xato, /503/);
  assert.equal(
    yozuv.idempotencyKey,
    `CHEK:${chek.id}:SALE_CREATED:1`,
    "yiqilgan yozuv ham kalit bilan yozilishi kerak"
  );

  // Qayta yuborish O'SHA yozuvni tuzatadi — yangi satr ochmaydi.
  yuborilgan = [];
  const natija = await A(() =>
    xabarnomaSvc.xabarnomaniQaytaYubor({ businessId: T.business.id, chekId: chek.id })
  );
  assert.equal(natija.holat, "YUBORILDI");
  assert.equal(natija.versiya, 1, "yiqilgan xabar versiyani band qilmasligi kerak");
  const soni = await A(() =>
    rawPrisma.telegramNotification.count({
      where: { businessId: T.business.id, chekId: chek.id },
    })
  );
  assert.equal(soni, 1, "qayta urinish yangi jurnal satri ochmasligi kerak");
});

// ---------------------------------------------------------------------------
// 10b. QARZ SNAPSHOT'i — qayta urinish ledgerdan qayta hisoblamaydi
// ---------------------------------------------------------------------------

test("10b. Kech yuborilgan xabar SNAPSHOT raqamlarini saqlaydi", async () => {
  // Mijozda oldindan qarz bor holatda qarzga savdo qilamiz, lekin Telegram
  // yiqilib turadi — xabar yozuvda "XATO" bo'lib qoladi.
  const oldin = await joriyQarz();
  assert.ok(oldin > 0, "test uchun mijozda oldindan qarz bo'lishi kerak");

  xatoRejimi = true;
  let chek: any;
  try {
    chek = await buyurtma({ satrlar: [{ productId: fanta, miqdor: 2 }], tolovTuri: "qarz" });
  } finally {
    xatoRejimi = false;
  }

  const yozuv = await A(() =>
    rawPrisma.telegramNotification.findFirst({
      where: { businessId: T.business.id, chekId: chek.id },
    })
  );
  assert.equal(yozuv.debtBefore, oldin, "debtBefore — savdogacha bo'lgan qarz");
  assert.equal(yozuv.debtAdded, 23_000, "debtAdded — shu savdodan qo'shilgan qarz");
  assert.equal(yozuv.debtAfter, oldin + 23_000, "debtAfter = before + added");

  // ORADAN BOSHQA SAVDO O'TDI — ledgerdagi jami qarz o'zgardi.
  await buyurtma({ satrlar: [{ productId: suv, miqdor: 10 }], tolovTuri: "qarz" });
  const keyin = await joriyQarz();
  assert.equal(keyin, oldin + 23_000 + 30_000, "ledger o'zgargan bo'lishi kerak");

  // Endi yiqilgan xabar qayta yuboriladi: raqamlar O'SHA paytdagidek qolishi
  // kerak, ledgerdan qayta hisoblanmasin.
  yuborilgan = [];
  const natija = await A(() =>
    xabarnomaSvc.xabarnomaniQaytaYubor({ businessId: T.business.id, chekId: chek.id })
  );
  assert.equal(natija.holat, "YUBORILDI");

  const m = oxirgi();
  assert.match(m, new RegExp(`Oldingi qarz: ${fs(oldin)} so'm`));
  assert.match(m, /Yangi qarz: \+23 000 so'm/);
  assert.match(
    m,
    new RegExp(`📕 Jami qarz: ${fs(oldin + 23_000)} so'm`),
    "snapshot ishlatilishi kerak — keyingi savdo qo'shilmasin"
  );
  assert.ok(!new RegExp(fs(keyin)).test(m), "yangi ledger qoldig'i xabarga tushmasligi kerak");

  const soni = await A(() =>
    rawPrisma.telegramNotification.count({
      where: { businessId: T.business.id, chekId: chek.id },
    })
  );
  assert.equal(soni, 1, "qayta urinish yangi satr ochmasligi kerak");
});

test("10c. Botdagi 'Mening qarzim' esa REAL-TIME ledgerdan o'qiydi", async () => {
  const buyurtmaSvc = await import("@/lib/telegram/buyurtma");
  const realTime = await A(() => buyurtmaSvc.mijozJoriyQarzi(T.business.id, mijoz));
  const ledger = await joriyQarz();
  assert.equal(realTime, ledger, "qarz sahifasi snapshot emas, ledger o'qishi bo'lishi kerak");
});

// ---------------------------------------------------------------------------
// 11. Buyurtma o'zgarganda — SALE_UPDATED va versiya
// ---------------------------------------------------------------------------

let ozgarChek: any;

test("11. O'zgargan buyurtma: SALE_UPDATED 2-versiya bilan ketadi", async () => {
  yuborilgan = [];
  ozgarChek = await buyurtma({ satrlar: [{ productId: fanta, miqdor: 4 }], tolovTuri: "qarz" });
  assert.match(oxirgi(), /📦 Xaridingiz/);

  const debt = await A(() =>
    rawPrisma.debt.findFirst({ where: { businessId: T.business.id, izoh: `${ozgarChek.raqam}-chek` } })
  );
  await A(() =>
    qarzSvc.qarzTolov({
      businessId: T.business.id,
      debtId: debt.id,
      userId: T.user.id,
      summa: 6_000,
      tolovTuri: "naqd",
      sana: "2026-09-05",
    })
  );

  yuborilgan = [];
  const natija = await A(() =>
    xabarnomaSvc.xabarnomaniQaytaYubor({ businessId: T.business.id, chekId: ozgarChek.id })
  );
  assert.equal(natija.holat, "YUBORILDI");
  assert.equal(natija.versiya, 2, "o'zgartirish keyingi versiya bilan yozilishi kerak");
  assert.match(oxirgi(), /⚠️ Xaridingizga o'zgartirish kiritildi/);
  assert.match(oxirgi(), /💵 Naqd: 6 000 so'm/);
  assert.match(oxirgi(), /📕 Qarzga: 40 000 so'm/);

  const holat = await A(() =>
    tgQueries.buyurtmaTelegramHolati(T.business.id, { chekId: ozgarChek.id })
  );
  assert.equal(holat.turi, "SALE_UPDATED");
  assert.equal(holat.versiya, 2);

  const yozuvlar = await A(() =>
    rawPrisma.telegramNotification.findMany({
      where: { businessId: T.business.id, chekId: ozgarChek.id },
      orderBy: { versiya: "asc" },
    })
  );
  assert.deepEqual(
    yozuvlar.map((y: any) => y.idempotencyKey),
    [`CHEK:${ozgarChek.id}:SALE_CREATED:1`, `CHEK:${ozgarChek.id}:SALE_UPDATED:2`]
  );
  // O'zgartirish YANGI snapshot yozadi (raqamlar haqiqatan o'zgargan).
  assert.equal(yozuvlar[1].debtAdded, 40_000, "to'lovdan keyingi qarz snapshotga tushishi kerak");
});

// ---------------------------------------------------------------------------
// 12. Bekor qilingan buyurtma
// ---------------------------------------------------------------------------

test("12. Bekor qilingan buyurtma: mijoz bekor xabarini oladi, qarz qaytadi", async () => {
  yuborilgan = [];
  const chek = await buyurtma({ satrlar: [{ productId: suv, miqdor: 5 }], tolovTuri: "qarz" });

  yuborilgan = [];
  await A(() =>
    posSvc.posChekBekor({
      businessId: T.business.id,
      chekId: chek.id,
      sabab: "Mijoz qaytardi",
      userId: T.user.id,
    })
  );

  const m = oxirgi();
  assert.match(m, /❌ Xarid bekor qilindi/);
  assert.match(m, /Bekor qilingan summa: 15 000 so'm/);
  assert.match(m, /Sabab: Mijoz qaytardi/);

  // Bekor qilingan qarz mijoz qarzida QOLMASLIGI kerak.
  const qoldi = await A(() =>
    rawPrisma.debt.count({ where: { businessId: T.business.id, izoh: `${chek.raqam}-chek` } })
  );
  assert.equal(qoldi, 0);
});

// ---------------------------------------------------------------------------
// 13. Takroriy hodisa
// ---------------------------------------------------------------------------

test("13. Dublikat hodisa: ikkinchi marta yuborilmaydi", async () => {
  yuborilgan = [];
  const chek = await buyurtma({ satrlar: [{ productId: cola, miqdor: 3 }], tolovTuri: "naqd" });
  assert.equal(yuborilgan.length, 1);

  // AYNAN o'sha hodisa qayta keldi (webhook takrori, tugma ikki marta bosildi).
  yuborilgan = [];
  const natija = await A(() =>
    xabarnomaSvc.buyurtmaXabarnomasi({
      businessId: T.business.id,
      chekId: chek.id,
      turi: "SALE_CREATED",
    })
  );
  assert.equal(natija.holat, "DUBLIKAT");
  assert.equal(yuborilgan.length, 0, "dublikat hodisa mijozga xabar yubormasligi kerak");

  const soni = await A(() =>
    rawPrisma.telegramNotification.count({
      where: { businessId: T.business.id, chekId: chek.id, turi: "SALE_CREATED" },
    })
  );
  assert.equal(soni, 1, "bazada bitta SALE_CREATED yozuvi qolishi kerak");

  const yozuv = await A(() =>
    rawPrisma.telegramNotification.findFirst({
      where: { businessId: T.business.id, chekId: chek.id },
    })
  );
  assert.equal(yozuv.idempotencyKey, `CHEK:${chek.id}:SALE_CREATED:1`);
});

test("13b. PARALLEL bir xil hodisa: bitta xabar, bitta satr", async () => {
  yuborilgan = [];
  const chek = await buyurtma({ satrlar: [{ productId: suv, miqdor: 2 }], tolovTuri: "naqd" });
  assert.equal(yuborilgan.length, 1);

  // Beshta so'rov BIR VAQTDA o'sha hodisa bilan keldi.
  yuborilgan = [];
  const natijalar = await A(() =>
    Promise.all(
      Array.from({ length: 5 }, () =>
        xabarnomaSvc.buyurtmaXabarnomasi({
          businessId: T.business.id,
          chekId: chek.id,
          turi: "SALE_CREATED",
        })
      )
    )
  );
  assert.ok(
    natijalar.every((n: any) => n.holat === "DUBLIKAT"),
    "parallel takroriy hodisalar dublikat deb qaytishi kerak"
  );
  assert.equal(yuborilgan.length, 0, "mijozga bitta ham qo'shimcha xabar ketmasligi kerak");

  const soni = await A(() =>
    rawPrisma.telegramNotification.count({
      where: { businessId: T.business.id, chekId: chek.id },
    })
  );
  assert.equal(soni, 1, "parallel so'rovlar bitta satrga tushishi kerak");
});

test("13d. PARALLEL QAYTA YUBORISH: yiqilgan xabar ikki nusxada ketmaydi", async () => {
  // Xabar yiqilib qoladi — satr "XATO" holatida, ya'ni qayta urinishga ochiq.
  xatoRejimi = true;
  let chek: any;
  try {
    chek = await buyurtma({ satrlar: [{ productId: cola, miqdor: 4 }], tolovTuri: "naqd" });
  } finally {
    xatoRejimi = false;
  }

  // Direktor tugmani IKKI MARTA bosdi (parallel). Kalit ikkinchi SATR
  // ochilishini to'sadi, "band" belgisi esa ikkinchi YUBORISHNI to'sadi.
  yuborilgan = [];
  const natijalar = await A(() =>
    Promise.all(
      Array.from({ length: 4 }, () =>
        xabarnomaSvc.xabarnomaniQaytaYubor({ businessId: T.business.id, chekId: chek.id })
      )
    )
  );

  assert.equal(yuborilgan.length, 1, "mijozga faqat BITTA nusxa ketishi kerak");
  assert.equal(
    natijalar.filter((n: any) => n.holat === "YUBORILDI").length,
    1,
    "faqat bitta oqim yuborgan bo'lishi kerak"
  );
  assert.ok(
    natijalar.filter((n: any) => n.holat === "DUBLIKAT").length >= 3,
    "qolganlari dublikat deb qaytishi kerak"
  );

  const yozuvlar = await A(() =>
    rawPrisma.telegramNotification.findMany({
      where: { businessId: T.business.id, chekId: chek.id },
    })
  );
  assert.equal(yozuvlar.length, 1, "bitta satr qolishi kerak");
  assert.equal(yozuvlar[0].holat, "YUBORILDI");
  assert.equal(yozuvlar[0].bandAt, null, "yuborilgach band belgisi bo'shatilishi kerak");
});

test("13c. Yakka sotuvda ham kalit ishlaydi (chekId = NULL bo'lgan yo'l)", async () => {
  yuborilgan = [];
  const sotuv = await A(() =>
    omborSvc.createSale({
      businessId: T.business.id,
      productId: suv,
      miqdor: 3,
      tolovTuri: "naqd",
      contactId: mijoz,
      mijozNomi: "Akmal Optom",
      mijozSaqla: true,
      sana: "2026-09-05",
      userId: T.user.id,
    })
  );
  assert.equal(yuborilgan.length, 1);

  const yozuv = await A(() =>
    rawPrisma.telegramNotification.findFirst({
      where: { businessId: T.business.id, saleId: sotuv.id },
    })
  );
  assert.equal(yozuv.idempotencyKey, `SALE:${sotuv.id}:SALE_CREATED:1`);

  // Takroriy hodisa — chekId NULL bo'lsa ham to'siladi.
  yuborilgan = [];
  const takror = await A(() =>
    xabarnomaSvc.buyurtmaXabarnomasi({
      businessId: T.business.id,
      saleId: sotuv.id,
      turi: "SALE_CREATED",
    })
  );
  assert.equal(takror.holat, "DUBLIKAT");
  assert.equal(yuborilgan.length, 0);
});

// ---------------------------------------------------------------------------
// 14. Multi-tenant izolyatsiya
// ---------------------------------------------------------------------------

test("14. Tenant izolyatsiyasi: begona biznes xabarnomani ko'ra ham, yubora ham olmaydi", async () => {
  const chek = await A(() =>
    rawPrisma.posChek.findFirst({
      where: { businessId: T.business.id },
      orderBy: { createdAt: "desc" },
    })
  );

  // Boshqa tenant o'sha chek bo'yicha holatni o'qiy olmaydi.
  const holat = await B(() =>
    tgQueries.buyurtmaTelegramHolati(T2.business.id, { chekId: chek.id })
  );
  assert.equal(holat.holat, "ULANMAGAN", "begona tenantga xabarnoma ko'rinmasligi kerak");

  // Va qayta yubora ham olmaydi.
  await assert.rejects(
    () => B(() => xabarnomaSvc.xabarnomaniQaytaYubor({ businessId: T2.business.id, chekId: chek.id })),
    /topilmadi/i
  );

  // Ulanish tokeni ham begona mijozga berilmaydi.
  await assert.rejects(
    () => B(() => mijozTgSvc.ulanishTokeniYarat(T2.business.id, mijoz)),
    /topilmadi/i
  );
});

test("14b. Bir chatId ikki biznesda alohida mijoz bo'la oladi, ma'lumot aralashmaydi", async () => {
  const m2 = await rawPrisma.contact.create({
    data: {
      businessId: T2.business.id,
      ism: "Akmal (boshqa do'kon)",
      createdBy: T2.user.id,
      telegramChatId: "555000111",
      telegramUlanganAt: new Date(),
    },
  });
  const royxat = await mijozTgSvc.chatMijozlari("555000111");
  assert.equal(royxat.length, 2, "bir chat ikki biznesda mijoz bo'lishi mumkin");
  const bizneslar = new Set(royxat.map((r: any) => r.businessId));
  assert.ok(bizneslar.has(T.business.id) && bizneslar.has(T2.business.id));
  assert.ok(royxat.every((r: any) => r.id !== undefined));
  await rawPrisma.contact.delete({ where: { id: m2.id } });
});

// ---------------------------------------------------------------------------
// 15. Katalog narxi keyin o'zgargan holat
// ---------------------------------------------------------------------------

test("15. Katalog narxi va nomi o'zgarsa ham eski buyurtma o'zgarmaydi", async () => {
  yuborilgan = [];
  const chek = await buyurtma({ satrlar: [{ productId: cola, miqdor: 20 }], tolovTuri: "naqd" });
  assert.match(oxirgi(), /20 dona × 12 000 so'm/);

  // Ertasiga katalogda narx, nom va birlik o'zgardi.
  await rawPrisma.product.update({
    where: { id: cola },
    data: { sotuvNarx: 13_000, nomi: "Coca-Cola 1.5L (yangi)", birlik: "quti" },
  });

  yuborilgan = [];
  await A(() => xabarnomaSvc.xabarnomaniQaytaYubor({ businessId: T.business.id, chekId: chek.id }));
  const m = oxirgi();
  assert.match(m, /Coca-Cola 1\.5L\n   20 dona × 12 000 so'm/, "eski nom, birlik va narx saqlanishi kerak");
  assert.ok(!/13 000/.test(m), "yangi katalog narxi eski buyurtmaga tushmasligi kerak");
  assert.match(m, /💰 Jami: 240 000 so'm/);
});

// ---------------------------------------------------------------------------
// 16. Ulanish tokeni — bir martalik va boshqa mijozga o'tmaydi
// ---------------------------------------------------------------------------

test("16. Ulanish tokeni bir martalik va faqat o'z kartochkasiga ulaydi", async () => {
  const yangi = await rawPrisma.contact.create({
    data: { businessId: T.business.id, ism: "Yangi Optom", createdBy: T.user.id },
  });

  const { token, havola } = await A(() =>
    mijozTgSvc.ulanishTokeniYarat(T.business.id, yangi.id)
  );
  assert.match(havola, /^https:\/\/t\.me\/BalansaBot\?start=mijoz_/);

  const birinchi = await mijozTgSvc.tokenBilanUla(token, "777000222", "akmal");
  assert.equal(birinchi.ok, true);
  assert.equal(birinchi.contact.id, yangi.id);

  // BIR MARTALIK: o'sha token ikkinchi marta ishlamaydi.
  const ikkinchi = await mijozTgSvc.tokenBilanUla(token, "777000333", null);
  assert.equal(ikkinchi.ok, false);
  assert.equal(ikkinchi.sabab, "not_found");

  // Shu biznesda bitta chat ikkinchi kartochkaga bog'lanmaydi.
  const boshqa = await rawPrisma.contact.create({
    data: { businessId: T.business.id, ism: "Boshqa Optom", createdBy: T.user.id },
  });
  const { token: t2 } = await A(() => mijozTgSvc.ulanishTokeniYarat(T.business.id, boshqa.id));
  const uchinchi = await mijozTgSvc.tokenBilanUla(t2, "777000222", null);
  assert.equal(uchinchi.ok, false);
  assert.equal(uchinchi.sabab, "chat_band");
});

// ---------------------------------------------------------------------------
// 17. UI holati
// ---------------------------------------------------------------------------

test("17. Cheklar ro'yxati Telegram holatini bitta so'rovda qaytaradi", async () => {
  const cheklar = await A(() => posQueries.listPosCheklar(T.business.id, 100));
  const ulangan = cheklar.filter((c: any) => c.mijozUlangan);
  assert.ok(ulangan.length > 0, "ulangan mijozli cheklar bo'lishi kerak");
  assert.ok(
    ulangan.some((c: any) => c.telegram.holat === "YUBORILDI" && c.telegram.sentAt),
    "yuborilgan cheklarda vaqt ko'rinishi kerak"
  );
  // Ulanmagan mijozli chekda holat ULANMAGAN bo'ladi.
  assert.ok(
    cheklar.some((c: any) => !c.mijozUlangan && c.telegram.holat === "ULANMAGAN"),
    "ulanmagan mijozli chek ULANMAGAN holatda bo'lishi kerak"
  );
});

test("18. Yakka sotuv (OMBOR moduli) ham mijozga yuboriladi", async () => {
  yuborilgan = [];
  const sotuv = await A(() =>
    omborSvc.createSale({
      businessId: T.business.id,
      productId: guruch,
      miqdor: 40,
      tolovTuri: "naqd",
      contactId: mijoz,
      mijozNomi: "Akmal Optom",
      mijozSaqla: true,
      sana: "2026-09-05",
      userId: T.user.id,
    })
  );
  assert.equal(yuborilgan.length, 1);
  const m = oxirgi();
  assert.match(m, /Guruch\n   40 kg × 8 500 so'm/);
  assert.match(m, /💰 Jami: 340 000 so'm/);

  const holat = await A(() =>
    tgQueries.buyurtmaTelegramHolati(T.business.id, { saleId: sotuv.id })
  );
  assert.equal(holat.holat, "YUBORILDI");
});
