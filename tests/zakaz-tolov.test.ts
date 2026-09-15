/**
 * ZAKAZ TO'LOVI — ZALOG QARZ EMAS, "YUTILDI" PUL YOZMAYDI.
 *
 * Topshiriqdagi 9 ta qabul testi:
 *   1. 750 000 zakaz + 200 000 Click → to'langan 200k, qoldiq 550k,
 *      QARZ 0 va "Yutildi" BLOK;
 *   2. keyin 550 000 naqd → to'langan 750k, qoldiq 0, "Yutildi" ochiq;
 *   3. 50k naqd + 250k click → IKKALASI ham bazada va hisobda, jami 300k;
 *   4. qisman to'langan zakazni yutish — SERVER bloklaydi;
 *   5. to'liq to'langan zakaz yutilganda kirim DUBLIKAT bo'lmaydi;
 *   6. zalog berilganda avtomatik Debt YARATILMAYDI;
 *   7. bitta zakazga 4 marta to'lov — oldingilari yo'qolmaydi;
 *   8. qayta o'qishda (refresh) jamlar o'zgarmaydi;
 *   9. bir vaqtda ikki so'rov — dublikat to'lov/kirim yuzaga kelmaydi.
 * Qo'shimcha: qoldiqni ATAYLAB qarzga yopish yo'li ochiq qoladi.
 *
 * Ishga tushirish: npm run test:zakaz-tolov
 */
process.env.DATABASE_URL = "file:./prisma/test-zakaz-tolov.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let crm: any;
let yakunlash: any;
let tolovQoshish: any;
let tolovOqish: any;
let pipeline: any;
let BadRequestError: any;
let todayTashkentDateOnlyString: any;

let t: any;
let kat: any;
let naqdKassa: any;
let kartaKassa: any;
let bugun: string;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(t.tenant.id, fn);

/** To'lovsiz zakaz — pul keyin, alohida amal bilan qo'shiladi. */
async function zakaz(nomi: string, summa: number) {
  return A(() =>
    crm.createDeal({
      businessId: t.business.id,
      nomi,
      summa,
      categoryId: kat.id,
      sana: bugun,
      userId: t.user.id,
    })
  );
}

/** Zakazga bitta to'lov qo'shish (kirim o'sha zahoti yoziladi). */
async function tolov(dealId: string, kanal: string, summa: number) {
  return A(() =>
    tolovQoshish.zakazgaTolovQoshish({
      businessId: t.business.id,
      dealId,
      userId: t.user.id,
      kanal,
      summa,
    })
  );
}

/** Zakazning to'lov hisobi — brauzer ko'radigan AYNI raqamlar. */
async function hisob(dealId: string) {
  return A(() => tolovOqish.zakazTolovHisobi(t.business.id, dealId));
}

async function yakunla(dealId: string) {
  return A(() => yakunlash.zakazniYakunlash({ businessId: t.business.id, dealId, userId: t.user.id }));
}

/** Zakaz nomi bo'yicha yozilgan (o'chirilmagan) kirimlar. */
async function kirimlar(nomi: string) {
  return A(() =>
    prisma.transaction.findMany({
      where: { businessId: t.business.id, turi: "kirim", deletedAt: null, izoh: { contains: nomi } },
      select: { id: true, summa: true, tolovTuri: true, account: { select: { turi: true } } },
      orderBy: { summa: "desc" },
    })
  );
}

async function qarzSoni(dealId: string) {
  const d = await A(() => prisma.deal.findFirst({ where: { id: dealId }, select: { debtId: true } }));
  return d.debtId ? 1 : 0;
}

before(async () => {
  rmSync("prisma/test-zakaz-tolov.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  crm = await import("@/lib/crm/service");
  yakunlash = await import("@/lib/crm/yakunlash");
  tolovQoshish = await import("@/lib/crm/tolovQoshish");
  tolovOqish = await import("@/lib/crm/tolovOqish");
  pipeline = await import("@/lib/crm/pipeline");
  ({ BadRequestError } = await import("@/lib/auth/guard"));
  ({ todayTashkentDateOnlyString } = await import("@/lib/date"));

  bugun = todayTashkentDateOnlyString();
  t = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy",
    ism: "Direktor",
    login: "+998947777702",
    parol: "parol12345",
  });
  await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
  await rawPrisma.tenantModule.create({ data: { tenantId: t.tenant.id, code: "CRM", isActive: true } });

  kat = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Bantik", turi: "kirim" },
  });
  naqdKassa = await rawPrisma.account.findFirst({
    where: { businessId: t.business.id, turi: "naqd" },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
  });
  kartaKassa = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Karta / terminal", turi: "plastik", tartib: 2 },
  });
  assert.ok(naqdKassa && kartaKassa);
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// Sof qoidalar — bazasiz
// ---------------------------------------------------------------------------

test("QOIDA: qoldiq qarz emas; qarz faqat ataylab", () => {
  const { qarzUlushi, qoldiqSumma, yutishTosigi } = pipeline;

  // Qisman to'langan zakaz QARZ YARATMAYDI.
  assert.equal(qarzUlushi(750_000, 200_000, "click"), 0);
  assert.equal(qarzUlushi(750_000, 200_000, "aralash"), 0);
  assert.equal(qarzUlushi(750_000, 0, null), 0);
  // ATAYLAB qarzga yopilgan savdo — qoldiq qarzdorlikka.
  assert.equal(qarzUlushi(750_000, 200_000, "qarz"), 550_000);
  assert.equal(qarzUlushi(750_000, 0, "qarz"), 750_000);

  assert.equal(qoldiqSumma(750_000, 200_000), 550_000);
  assert.equal(qoldiqSumma(750_000, 800_000), 0, "qoldiq manfiy bo'lmaydi");

  // "Yutildi" to'sig'i.
  assert.ok(yutishTosigi(750_000, 200_000, "click"), "qisman to'langan — to'siq bor");
  assert.equal(yutishTosigi(750_000, 750_000, "aralash"), null, "to'liq to'langan — ochiq");
  assert.equal(yutishTosigi(750_000, 200_000, "qarz"), null, "ataylab qarzga — ochiq");
  assert.equal(yutishTosigi(0, 0, null), null, "narxsiz zakaz — avvalgidek");
  assert.ok(yutishTosigi(100_000, 150_000, "naqd"), "ortiqcha to'lov ham to'siq");
});

// ---------------------------------------------------------------------------
// TEST 1 va TEST 2 — zalog, keyin qolgani
// ---------------------------------------------------------------------------

test("TEST 1: 750 000 zakazga 200 000 Click — qoldiq 550k, qarz 0, Yutildi BLOK", async () => {
  const d = await zakaz("Z1 zalog", 750_000);
  const n = await tolov(d.id, "click", 200_000);

  assert.equal(n.tolangan, 200_000);
  assert.equal(n.qoldiq, 550_000);
  assert.equal(n.toliqTolandi, false);

  const h = await hisob(d.id);
  assert.equal(h.summa, 750_000);
  assert.equal(h.tolangan, 200_000, "to'langan = to'lovlar yig'indisi");
  assert.equal(h.qoldiq, 550_000);
  assert.equal(h.holati, "QISMAN");
  assert.equal(h.qarzQoldiq, 0, "QARZ 0 — zalog qarz emas");
  assert.equal(await qarzSoni(d.id), 0, "Debt yozuvi umuman ochilmadi");
  assert.ok(h.yutishTosigi, "Yutildi to'silgan");

  // Pul DARHOL kassada: Click qismi karta/hisob kassasiga.
  const k = await kirimlar("Z1 zalog");
  assert.equal(k.length, 1, "to'lov kelgan zahoti bitta kirim");
  assert.equal(k[0].summa, 200_000);
  assert.equal(k[0].tolovTuri, "click");
  assert.equal(k[0].account.turi, "plastik");

  // Backend ham bloklaydi (frontend disable yetarli emas).
  await assert.rejects(yakunla(d.id), BadRequestError);
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.notEqual(keyin.holat, "YUTILDI", "blok ishladi — holat o'zgarmadi");
});

test("TEST 2: qolgan 550 000 naqd kelgach — qoldiq 0, Yutildi ochiq", async () => {
  const d = await zakaz("Z2 toliq", 750_000);
  await tolov(d.id, "click", 200_000);
  const n = await tolov(d.id, "naqd", 550_000);

  assert.equal(n.tolangan, 750_000);
  assert.equal(n.qoldiq, 0);
  assert.equal(n.toliqTolandi, true);

  const h = await hisob(d.id);
  assert.equal(h.holati, "TOLANGAN");
  assert.equal(h.yutishTosigi, null);

  const y = await yakunla(d.id);
  assert.equal(y.qarzSumma, 0, "to'liq to'langan — qarz yo'q");
  assert.equal(await qarzSoni(d.id), 0);

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.holat, "YUTILDI");

  // Pul har kanal o'z kassasiga: 550k naqd + 200k karta.
  const k = await kirimlar("Z2 toliq");
  assert.equal(k.length, 2);
  assert.equal(k.reduce((s: number, x: any) => s + x.summa, 0), 750_000);
  assert.deepEqual(k.map((x: any) => x.account.turi).sort(), ["naqd", "plastik"]);
});

// ---------------------------------------------------------------------------
// TEST 3 — aralash to'lov yo'qolmaydi
// ---------------------------------------------------------------------------

test("TEST 3: 50k naqd + 250k click — ikkalasi ham bazada va hisobda", async () => {
  const d = await zakaz("Z3 aralash", 400_000);
  await tolov(d.id, "naqd", 50_000);
  await tolov(d.id, "click", 250_000);

  const satrlar = await A(() =>
    prisma.dealTolov.findMany({
      where: { businessId: t.business.id, dealId: d.id },
      select: { kanal: true, summa: true, transactionId: true },
      orderBy: { createdAt: "asc" },
    })
  );
  assert.equal(satrlar.length, 2, "ikkala to'lov ham BAZADA");
  assert.deepEqual(
    satrlar.map((s: any) => [s.kanal, s.summa]),
    [["naqd", 50_000], ["click", 250_000]]
  );
  assert.ok(satrlar.every((s: any) => s.transactionId), "har to'lov o'z kirimiga ega");

  const h = await hisob(d.id);
  assert.equal(h.tolangan, 300_000, "jami 300 000");
  assert.equal(h.tolovlar.length, 2, "ikkalasi ham UI ro'yxatida");
  assert.deepEqual(
    [...h.kanallar].sort((a: any, b: any) => a.kanal.localeCompare(b.kanal)),
    [
      { kanal: "click", summa: 250_000 },
      { kanal: "naqd", summa: 50_000 },
    ]
  );

  const k = await kirimlar("Z3 aralash");
  assert.equal(k.reduce((s: number, x: any) => s + x.summa, 0), 300_000);
});

// ---------------------------------------------------------------------------
// TEST 4 — blok SERVERDA, har yo'ldan
// ---------------------------------------------------------------------------

test("TEST 4: qisman to'langan zakaz Yutildi'ga HECH BIR yo'ldan o'tmaydi", async () => {
  const d = await zakaz("Z4 blok", 1_000_000);
  await tolov(d.id, "naqd", 400_000);

  // 1) To'g'ridan-to'g'ri yakunlash.
  await assert.rejects(yakunla(d.id), BadRequestError);

  // 2) Bosqichga sudrash (eski yo'l) ham shu tekshiruvdan o'tadi.
  const bosqichlar = await A(() => crm.pipelineBosqichlari(t.business.id));
  await assert.rejects(
    A(() =>
      crm.moveDeal({
        businessId: t.business.id,
        dealId: d.id,
        stageId: bosqichlar.YUTILDI,
        userId: t.user.id,
      })
    ),
    BadRequestError
  );

  // 3) To'g'ridan-to'g'ri YUTILDI bosqichida zakaz yaratish ham.
  await assert.rejects(
    A(() =>
      crm.createDeal({
        businessId: t.business.id,
        nomi: "Z4 yaratishda blok",
        summa: 500_000,
        tolangan: 100_000,
        tolovTuri: "naqd",
        categoryId: kat.id,
        sana: bugun,
        stageId: bosqichlar.YUTILDI,
        userId: t.user.id,
      })
    ),
    BadRequestError
  );

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.holat, "KUTILMOQDA");
  assert.equal(keyin.debtId, null, "blok qarz ham yaratmadi");
});

// ---------------------------------------------------------------------------
// TEST 5 — dublikat kirim yo'q
// ---------------------------------------------------------------------------

test("TEST 5: to'liq to'langan zakaz Yutildi — kirim DUBLIKAT bo'lmaydi", async () => {
  const d = await zakaz("Z5 dublikat", 2_200_000);
  await tolov(d.id, "click", 1_000_000);
  await tolov(d.id, "naqd", 1_200_000);

  const oldin = await kirimlar("Z5 dublikat");
  assert.equal(oldin.length, 2);
  assert.equal(oldin.reduce((s: number, x: any) => s + x.summa, 0), 2_200_000);

  await yakunla(d.id);
  await yakunla(d.id); // takror bosish

  const keyin = await kirimlar("Z5 dublikat");
  assert.equal(keyin.length, 2, "Yutildi YANGI kirim yaratmaydi");
  assert.equal(keyin.reduce((s: number, x: any) => s + x.summa, 0), 2_200_000, "jami o'zgarmadi");
});

// ---------------------------------------------------------------------------
// TEST 6 — zalog qarz yaratmaydi
// ---------------------------------------------------------------------------

test("TEST 6: zalog berilganda avtomatik Debt YARATILMAYDI", async () => {
  const d = await zakaz("Z6 zalog", 5_000_000);
  await tolov(d.id, "naqd", 1_000_000);

  const qarzlar = await A(() =>
    prisma.debt.findMany({ where: { businessId: t.business.id, izoh: { contains: "Z6 zalog" } } })
  );
  assert.equal(qarzlar.length, 0, "qarz yozuvi yo'q");
  assert.equal(await qarzSoni(d.id), 0);

  const h = await hisob(d.id);
  assert.equal(h.tolangan, 1_000_000);
  assert.equal(h.qoldiq, 4_000_000);
  assert.equal(h.qarzQoldiq, 0, "QOLDIQ ≠ QARZ");
});

test("ATAYLAB QARZGA: belgi qo'yilsa Yutildi ochiladi va qoldiq qarzdorlikka yoziladi", async () => {
  const d = await zakaz("Z6b qarzga", 5_000_000);
  await tolov(d.id, "naqd", 1_000_000);

  await A(() =>
    crm.zakazQarzBelgisi({ businessId: t.business.id, dealId: d.id, qarzga: true, userId: t.user.id })
  );
  const h = await hisob(d.id);
  assert.equal(h.qarzga, true);
  assert.equal(h.yutishTosigi, null, "ataylab qarzga yopilgan savdo yutiladi");

  const y = await yakunla(d.id);
  assert.equal(y.qarzSumma, 4_000_000, "qoldiq qarzdorlikka");
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id }, include: { debt: true } }));
  assert.equal(keyin.debt.jamiSumma, 4_000_000);
  assert.equal(keyin.debt.status, "OPEN");

  // Kirim esa faqat HAQIQATDA olingan pul — 1 000 000.
  const k = await kirimlar("Z6b qarzga");
  assert.equal(k.reduce((s: number, x: any) => s + x.summa, 0), 1_000_000);
});

// ---------------------------------------------------------------------------
// TEST 7 va TEST 8 — to'lovlar yo'qolmaydi
// ---------------------------------------------------------------------------

test("TEST 7: bitta zakazga 4 marta to'lov — oldingilari yo'qolmaydi", async () => {
  const d = await zakaz("Z7 kop tolov", 1_000_000);
  await tolov(d.id, "click", 50_000);
  await tolov(d.id, "naqd", 200_000);
  await tolov(d.id, "terminal", 250_000);
  const oxirgi = await tolov(d.id, "click", 500_000);

  assert.equal(oxirgi.tolangan, 1_000_000);
  const h = await hisob(d.id);
  assert.equal(h.tolovlar.length, 4, "to'rtala to'lov ham joyida");
  assert.deepEqual(
    h.tolovlar.map((x: any) => [x.kanal, x.summa]),
    [["click", 50_000], ["naqd", 200_000], ["terminal", 250_000], ["click", 500_000]]
  );
  assert.equal(h.tolangan, 1_000_000);
  assert.equal(h.qoldiq, 0);

  // Qoldiqdan ortiq to'lov rad etiladi.
  await assert.rejects(tolov(d.id, "naqd", 1), BadRequestError);
});

test("TEST 8: qayta o'qishda (refresh) jamlar o'zgarmaydi", async () => {
  const d = await zakaz("Z8 refresh", 600_000);
  await tolov(d.id, "naqd", 100_000);
  await tolov(d.id, "click", 200_000);

  const bir = await hisob(d.id);
  const ikki = await hisob(d.id);
  assert.deepEqual(ikki, bir, "ikki o'qish — bir xil javob");

  // Bazadagi yig'indi ham qatorlar bilan mos.
  const deal = await A(() =>
    prisma.deal.findFirst({ where: { id: d.id }, include: { tolovlar: true } })
  );
  assert.equal(deal.tolangan, 300_000);
  assert.equal(
    deal.tolovlar.reduce((s: number, x: any) => s + x.summa, 0),
    deal.tolangan,
    "Deal.tolangan — qatorlar YIG'INDISI"
  );
});

// ---------------------------------------------------------------------------
// TEST 9 — poyga
// ---------------------------------------------------------------------------

test("TEST 9: bir vaqtda ikki so'rov — dublikat to'lov/kirim yo'q", async () => {
  const d = await zakaz("Z9 poyga", 400_000);

  const natijalar = await Promise.allSettled([
    tolov(d.id, "naqd", 300_000),
    tolov(d.id, "naqd", 300_000),
  ]);
  const otgan = natijalar.filter((r) => r.status === "fulfilled").length;
  assert.equal(otgan, 1, "ikkinchi so'rov o'tmadi — qoldiqdan oshardi");

  const h = await hisob(d.id);
  assert.equal(h.tolangan, 300_000, "pul ikki marta hisoblanmadi");
  assert.equal(h.tolovlar.length, 1);

  const k = await kirimlar("Z9 poyga");
  assert.equal(k.length, 1, "dublikat kirim yozilmadi");
  assert.equal(k[0].summa, 300_000);
});

// ---------------------------------------------------------------------------
// Orqaga moslik — eski, QATORSIZ zakazlar
// ---------------------------------------------------------------------------

test("ESKI ZAKAZ: qatorsiz to'lov yo'qolmaydi — u qatorga ko'chadi va kirimga tushadi", async () => {
  // Eski yo'l: pul `Deal.tolangan` da, `DealTolov` qatori yo'q.
  const d = await A(() =>
    crm.createDeal({
      businessId: t.business.id,
      nomi: "Z11 eski uslub",
      summa: 700_000,
      tolangan: 200_000,
      tolovTuri: "naqd",
      categoryId: kat.id,
      sana: bugun,
      userId: t.user.id,
    })
  );
  const satrOldin = await A(() =>
    prisma.dealTolov.count({ where: { businessId: t.business.id, dealId: d.id } })
  );
  assert.equal(satrOldin, 0, "eski yo'l tegilmagan — qator yozilmaydi");

  // Yangi to'lov qo'shilganda eski 200 000 QATORGA ko'chadi.
  const n = await tolov(d.id, "click", 500_000);
  assert.equal(n.tolangan, 700_000, "eski pul qo'shilib hisoblandi");
  assert.equal(n.qoldiq, 0);

  const h = await hisob(d.id);
  assert.equal(h.tolovlar.length, 2, "eski to'lov ham ro'yxatda ko'rinadi");
  assert.equal(h.tolovlar.reduce((s: number, x: any) => s + x.summa, 0), 700_000);

  // Yakunlashda eski qism ham kirimga tushadi — hech qayerda yo'qolmaydi.
  await yakunla(d.id);
  const k = await kirimlar("Z11 eski uslub");
  assert.equal(k.reduce((s: number, x: any) => s + x.summa, 0), 700_000, "jami kirim = jami to'lov");
});

// ---------------------------------------------------------------------------
// To'lovni bekor qilish — xato kiritilgan pulni orqaga olish
// ---------------------------------------------------------------------------

test("BEKOR: to'lov o'chirilsa kirim savatga tushadi va jamlar qayta hisoblanadi", async () => {
  const d = await zakaz("Z10 bekor", 500_000);
  await tolov(d.id, "naqd", 100_000);
  const xato = await tolov(d.id, "click", 300_000);

  const n = await A(() =>
    tolovQoshish.zakazTolovniBekorQilish({
      businessId: t.business.id,
      dealId: d.id,
      tolovId: xato.tolovId,
      userId: t.user.id,
    })
  );
  assert.equal(n.tolangan, 100_000);
  assert.equal(n.qoldiq, 400_000);

  const kirim = await A(() => prisma.transaction.findFirst({ where: { id: xato.transactionId } }));
  assert.ok(kirim.deletedAt, "kirim YUMSHOQ o'chirildi — ledger izi qoladi");

  const h = await hisob(d.id);
  assert.equal(h.tolovlar.length, 1);
  assert.equal(h.tolangan, 100_000);
  assert.ok(h.transactionId, "qolgan to'lovning kirimi zakazga bog'langan");

  const k = await kirimlar("Z10 bekor");
  assert.equal(k.reduce((s: number, x: any) => s + x.summa, 0), 100_000);
});
