/**
 * CRM ZAKAZ PIPELINE TESTLARI.
 *
 * Qamrov (topshiriqdagi 8 stsenariy):
 *   1. Kelajak sanali zakaz  → KUTILAYOTGAN
 *   2. Bugungi sanali zakaz  → BUGUNGI (hech qanday cronsiz)
 *   3. Bugungi → Jarayonga o'tkazish
 *   4. Jarayonda + to'liq to'langan → YUTILDI, kirim to'liq summa
 *   5. Qarzga  → YUTILDI, kirim 0, qarzdorlik to'liq summa
 *   6. Qisman  → kirim to'langan qism, qarz qolgani
 *   7. Kechagi bajarilmagan zakaz yo'qolmaydi — KECHIKKAN
 *   8. Yutildi ikki marta → faqat bitta kirim (idempotentlik)
 * Qo'shimcha: tenant izolyatsiyasi, bosqich sinxroni, moliyaviy qulf.
 *
 * TUZATISHLAR (2026-09-03):
 *   A. YUTILDI qarzni AVTOMATIK ochmaydi — "Qarzga" faqat foydalanuvchi
 *      tanlaganda (`tolovTuri = "qarz"`); to'lov tanlanmagan zakazda kirim
 *      ham, qarz ham yozilmaydi.
 *   B. YUTILDI → DARHOL kirim: eski yo'l (bosqichga sudrash, WON bosqichda
 *      yaratish) ham yakunlash orqali; yutilgan zakazda to'lov keyin
 *      belgilansa kirim o'zi yoziladi; dublikat yo'q.
 *   C. TARTIB: yangi yaratilgan yoki holati hozirgina o'zgargan zakaz
 *      ro'yxat boshida (`updatedAt` DESC).
 *
 * Ishga tushirish: npm run test:crm-pipeline
 */
process.env.DATABASE_URL = "file:./prisma/test-crm-pipeline.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let crm: any;
let yakunlash: any;
let pipeline: any;
let BadRequestError: any;
let todayTashkentDateOnlyString: any;

let tA: any;
let tB: any;
let kat: any;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tA.tenant.id, fn);

const KUN_MS = 24 * 60 * 60 * 1000;
/** `bugun` dan `delta` kun nariga surilgan "YYYY-MM-DD". */
const kun = (bugun: string, delta: number) =>
  new Date(Date.parse(`${bugun}T00:00:00.000Z`) + delta * KUN_MS).toISOString().slice(0, 10);

/** Zakaz yaratish qisqartmasi. */
async function zakaz(
  nomi: string,
  opts: { summa?: number; tolangan?: number; sana: string; tolovTuri?: string | null; stageId?: string }
) {
  return A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi,
      categoryId: kat.id,
      summa: opts.summa ?? 0,
      tolangan: opts.tolangan ?? 0,
      // `null` — to'lov tanlanmagan (bot lead / eski yozuv); berilmasa naqd.
      tolovTuri: opts.tolovTuri === undefined ? "naqd" : opts.tolovTuri,
      sana: opts.sana,
      stageId: opts.stageId,
      kontaktIsm: `Mijoz ${nomi}`,
      userId: tA.user.id,
    })
  );
}

/** Zakazning kirim va qarz yozuvlari soni (izoh bo'yicha). */
async function moliyaSoni(nomi: string) {
  const kirim = await A(() =>
    prisma.transaction.count({ where: { businessId: tA.business.id, izoh: { contains: nomi }, deletedAt: null } })
  );
  const qarz = await A(() => prisma.debt.count({ where: { businessId: tA.business.id, izoh: { contains: nomi } } }));
  return { kirim, qarz };
}

/** Zakazning joriy doska ustuni (server hisobi bilan bir xil). */
async function ustun(dealId: string, bugun: string) {
  const d = await A(() => prisma.deal.findFirst({ where: { id: dealId } }));
  return crm.dealUstuni(d, bugun);
}

before(async () => {
  rmSync("prisma/test-crm-pipeline.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  crm = await import("@/lib/crm/service");
  yakunlash = await import("@/lib/crm/yakunlash");
  pipeline = await import("@/lib/crm/pipeline");
  ({ BadRequestError } = await import("@/lib/auth/guard"));
  ({ todayTashkentDateOnlyString } = await import("@/lib/date"));

  tA = await createTenantWithOwner({ kompaniyaNomi: "Disney Navoiy", ism: "Fayruza", login: "+998944444501", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "Boshqa biznes", ism: "B", login: "+998944444502", parol: "parol12345" });
  for (const t of [tA, tB]) {
    await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
    await rawPrisma.tenantModule.create({ data: { tenantId: t.tenant.id, code: "CRM", isActive: true } });
  }
  kat = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "O'yinchoqlar", turi: "kirim" },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// USTUN QOIDASI — sof funksiya (bazasiz, cronsiz)
// ---------------------------------------------------------------------------

test("USTUN QOIDASI: sana va holatdan hisoblanadi, saqlanmaydi", () => {
  const { zakazUstuni, kechikkanKun } = pipeline;
  // TEST 1: bugun 01.09, zakaz 10.09 → KUTILAYOTGAN.
  assert.equal(zakazUstuni("KUTILMOQDA", "2026-09-10", "2026-09-01"), "KUTILAYOTGAN");
  // TEST 2: bugun 10.09, zakaz 10.09 → BUGUNGI. Kun almashishining O'ZI
  // yetarli: bazada hech narsa o'zgarmaydi.
  assert.equal(zakazUstuni("KUTILMOQDA", "2026-09-10", "2026-09-10"), "BUGUNGI");
  // TEST 7: kechagi bajarilmagan zakaz yo'qolmaydi — KUTILAYOTGANda qoladi.
  assert.equal(zakazUstuni("KUTILMOQDA", "2026-09-01", "2026-09-02"), "KUTILAYOTGAN");
  assert.equal(kechikkanKun("KUTILMOQDA", "2026-09-01", "2026-09-02"), 1);
  // Yakunlangan zakaz kechikmaydi.
  assert.equal(kechikkanKun("YUTILDI", "2026-09-01", "2026-09-30"), 0);
  // Sanasiz zakaz ham yo'qolmaydi.
  assert.equal(zakazUstuni("KUTILMOQDA", null, "2026-09-02"), "KUTILAYOTGAN");
  // Holat sanadan USTUN: yutilgan zakaz "bugungi"ga qaytmaydi.
  assert.equal(zakazUstuni("YUTILDI", "2026-09-02", "2026-09-02"), "YUTILDI");
  assert.equal(zakazUstuni("JARAYONDA", "2026-09-10", "2026-09-02"), "JARAYONDA");
  assert.equal(zakazUstuni("YOQOTILDI", "2026-09-02", "2026-09-02"), "YOQOTILDI");
});

test("TO'LOV HOLATI: faqat foydalanuvchi tanlovidan — 'Qarzga' tolovTuri='qarz' bilan", () => {
  const { tolovHolati, kirimUlushi, qarzUlushi } = pipeline;
  assert.equal(tolovHolati(500_000, 500_000, "naqd"), "TOLANGAN");
  assert.equal(tolovHolati(500_000, 200_000, "click"), "QISMAN");
  assert.equal(tolovHolati(500_000, 0, "qarz"), "QARZ");
  // ESKI XATO: tolangan = 0 o'zi "Qarzga" edi. Endi tanlov yo'q — holat yo'q.
  assert.equal(tolovHolati(500_000, 0, null), "TANLANMAGAN");
  assert.equal(tolovHolati(500_000, 0, "naqd"), "TANLANMAGAN");
  assert.equal(tolovHolati(0, 0, "naqd"), "TANLANMAGAN", "narxsiz zakaz qarzga emas");
  // Pul olingan bo'lsa u "qarz" belgisidan ustun.
  assert.equal(tolovHolati(500_000, 200_000, "qarz"), "QISMAN");

  assert.equal(kirimUlushi(500_000, 200_000), 200_000);
  assert.equal(qarzUlushi(500_000, 200_000, "naqd"), 300_000, "qisman — qolgani qarz");
  assert.equal(qarzUlushi(500_000, 0, "qarz"), 500_000, "qarzga tanlangan — butun summa qarz");
  assert.equal(qarzUlushi(500_000, 0, null), 0, "tanlanmagan — qarz OCHILMAYDI");
  assert.equal(qarzUlushi(500_000, 0, "naqd"), 0, "naqd, lekin pul olinmagan — qarz emas");
  // To'langan summadan oshib ketsa ham kirim summadan oshmaydi.
  assert.equal(kirimUlushi(500_000, 900_000), 500_000);
  assert.equal(qarzUlushi(500_000, 900_000, "naqd"), 0);
});

// ---------------------------------------------------------------------------
// TEST 1-2: yangi zakazning ustuni
// ---------------------------------------------------------------------------

test("TEST 1: kelajak sanali zakaz KUTILAYOTGAN ustunida tug'iladi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Panda Masha (kelajak)", { summa: 300_000, tolangan: 300_000, sana: kun(bugun, 9) });
  assert.equal(d.holat, "KUTILMOQDA");
  assert.equal(await ustun(d.id, bugun), "KUTILAYOTGAN");
});

test("TEST 2: bugungi sanali zakaz DARHOL bugungi ustunida ko'rinadi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Panda Masha (bugun)", { summa: 300_000, tolangan: 300_000, sana: bugun });
  // Holat o'zgarmagan — faqat sana. Ustun esa allaqachon BUGUNGI.
  assert.equal(d.holat, "KUTILMOQDA");
  assert.equal(await ustun(d.id, bugun), "BUGUNGI");
});

test("SANA KELGANDA: bazaga hech narsa yozilmaydi, ustun O'ZI o'zgaradi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const ertaga = kun(bugun, 1);
  const d = await zakaz("Ertangi zakaz", { summa: 100_000, sana: ertaga });
  assert.equal(await ustun(d.id, bugun), "KUTILAYOTGAN");
  // "Ertaga" kelgan kunni SIMULATSIYA qilamiz — hech qanday yozuv yo'q.
  assert.equal(await ustun(d.id, ertaga), "BUGUNGI");
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.holat, "KUTILMOQDA", "holat tegilmagan — cron kerak emas");
});

// ---------------------------------------------------------------------------
// TEST 3: jarayonga o'tkazish
// ---------------------------------------------------------------------------

test("TEST 3: bugungi zakaz JARAYONDA ga o'tadi va bosqich sinxronlanadi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Jarayon sinovi", { summa: 400_000, tolangan: 400_000, sana: bugun });
  await A(() =>
    crm.holatniOzgartirish({ businessId: tA.business.id, dealId: d.id, holat: "JARAYONDA", userId: tA.user.id })
  );
  assert.equal(await ustun(d.id, bugun), "JARAYONDA");

  // Bosqich ko'zgusi: dashboard va AI analitikasi hali `Stage.turi` ni
  // o'qiydi, shuning uchun u ham yangilanishi shart.
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id }, include: { stage: true } }));
  assert.equal(keyin.stage.nomi, "Jarayonda");
  assert.equal(keyin.stage.turi, "OPEN", "jarayondagi zakaz hali ochiq bitim");
});

test("Bugungiga ko'chirish: SANA suriladi, holat tegilmaydi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Kelasi haftaga", { summa: 150_000, sana: kun(bugun, 7) });
  await A(() => crm.bugungaKochirish({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id, bugun }));
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.holat, "KUTILMOQDA");
  assert.equal(keyin.sana.toISOString(), `${bugun}T00:00:00.000Z`);
  assert.equal(await ustun(d.id, bugun), "BUGUNGI");
});

// ---------------------------------------------------------------------------
// TEST 4-6: yakunlash va moliyaviy taqsimot
// ---------------------------------------------------------------------------

test("TEST 4: to'liq to'langan zakaz — kirim to'liq summa, qarz yo'q", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("To'liq to'langan", { summa: 500_000, tolangan: 500_000, sana: bugun });
  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));

  assert.equal(n.yangiYakun, true);
  assert.equal(n.kirimSumma, 500_000);
  assert.equal(n.qarzSumma, 0);
  assert.equal(n.debtId, null, "qarz ochilmaydi");

  const keyin = await A(() =>
    prisma.deal.findFirst({ where: { id: d.id }, include: { transaction: true, stage: true } })
  );
  assert.equal(keyin.holat, "YUTILDI");
  assert.equal(keyin.stage.turi, "WON", "bosqich ko'zgusi sinxron");
  assert.equal(keyin.transaction.turi, "kirim");
  assert.equal(keyin.transaction.summa, 500_000);
  assert.equal(keyin.transaction.categoryId, kat.id, "kategoriya CRM va Kirimda bir xil");
  assert.equal(keyin.transaction.sotuvchiId, tA.user.id, "sotuvchi statistikasi zakaz mas'uliga yoziladi");
});

test("TEST 5: qarzga berilgan zakaz — kirim 0, qarzdorlik to'liq summa", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Qarzga", { summa: 500_000, tolangan: 0, sana: bugun, tolovTuri: "qarz" });
  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));

  assert.equal(n.kirimSumma, 0);
  assert.equal(n.qarzSumma, 500_000);
  assert.equal(n.transactionId, null, "qarzga savdo KIRIM yozmaydi — mavjud qarz moduli qoidasi");

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id }, include: { debt: true } }));
  assert.equal(keyin.holat, "YUTILDI", "yutildi — BIZNES yakuni, to'lov holati alohida");
  assert.equal(keyin.debt.jamiSumma, 500_000);
  assert.equal(keyin.debt.tolangan, 0);
  assert.equal(keyin.debt.status, "OPEN");
  assert.equal(keyin.debt.turi, "olinadigan");
  assert.equal(keyin.debt.categoryId, kat.id, "qarz zakaz kategoriyasi hisobiga yoziladi");
});

test("TEST 6: qisman to'lov — kirim to'langan qism, qarz qolgani", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Qisman", { summa: 500_000, tolangan: 200_000, sana: bugun });
  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));

  assert.equal(n.kirimSumma, 200_000);
  assert.equal(n.qarzSumma, 300_000);

  const keyin = await A(() =>
    prisma.deal.findFirst({ where: { id: d.id }, include: { transaction: true, debt: true } })
  );
  assert.equal(keyin.transaction.summa, 200_000, "faqat HAQIQATDA olingan pul kirimga");
  assert.equal(keyin.debt.jamiSumma, 300_000, "qolgani qarzdorlikka");
});

// ---------------------------------------------------------------------------
// TEST 7: kechikkan zakaz
// ---------------------------------------------------------------------------

test("TEST 7: kechagi bajarilmagan zakaz doskadan YO'QOLMAYDI", async () => {
  const bugun = todayTashkentDateOnlyString();
  const kecha = kun(bugun, -1);
  const d = await zakaz("Kechagi bajarilmagan", { summa: 250_000, sana: kecha });

  assert.equal(await ustun(d.id, bugun), "KUTILAYOTGAN", "bugungidan chiqib ketadi, lekin kutilayotganda qoladi");
  assert.equal(pipeline.kechikkanKun("KUTILMOQDA", kecha, bugun), 1);

  // Doskada ham chindan ko'rinadi (arxiv emas).
  const board = await A(() => crm.getBoard(tA.business.id));
  assert.ok(board.deals.some((x: any) => x.id === d.id), "kechikkan zakaz doskada qoladi");
});

// ---------------------------------------------------------------------------
// TEST 8: idempotentlik
// ---------------------------------------------------------------------------

test("TEST 8: yutildi ikki marta bosilsa ham FAQAT bitta kirim va bitta qarz", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Ikki marta bosildi", { summa: 800_000, tolangan: 300_000, sana: bugun });

  const bir = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  const ikki = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));

  assert.equal(bir.yangiYakun, true);
  assert.equal(ikki.yangiYakun, false, "takror bosish xato emas — ish allaqachon bajarilgan");
  assert.equal(ikki.transactionId, bir.transactionId);
  assert.equal(ikki.debtId, bir.debtId);

  const kirimSoni = await A(() =>
    prisma.transaction.count({ where: { businessId: tA.business.id, izoh: { contains: "Ikki marta bosildi" } } })
  );
  assert.equal(kirimSoni, 1, "bitta zakazdan bitta kirim");
  const qarzSoni = await A(() =>
    prisma.debt.count({ where: { businessId: tA.business.id, izoh: { contains: "Ikki marta bosildi" } } })
  );
  assert.equal(qarzSoni, 1, "bitta zakazdan bitta qarz");
});

test("DUBLIKAT QARZ BAZADA: bitta qarzni ikki zakazga bog'lab bo'lmaydi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const bir = await zakaz("Qarz bogi 1", { summa: 100_000, sana: bugun, tolovTuri: "qarz" });
  const ikki = await zakaz("Qarz bogi 2", { summa: 100_000, sana: bugun, tolovTuri: "qarz" });
  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: bir.id, userId: tA.user.id }));

  // Ilova kodini CHETLAB O'TIB bazaga yozishga urinish: UNIQUE cheklov
  // shu yerda ishlashi shart — himoya faqat kodda emas.
  await assert.rejects(
    rawPrisma.deal.update({ where: { id: ikki.id }, data: { debtId: n.debtId } }),
    /[Uu]nique/
  );
});

// ---------------------------------------------------------------------------
// Qulflar va izolyatsiya
// ---------------------------------------------------------------------------

test("YUTILGAN va moliyaga o'tgan zakaz ORQAGA qaytmaydi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Orqaga qaytmaydi", { summa: 200_000, tolangan: 200_000, sana: bugun });
  await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  await assert.rejects(
    A(() =>
      crm.holatniOzgartirish({ businessId: tA.business.id, dealId: d.id, holat: "JARAYONDA", userId: tA.user.id })
    ),
    BadRequestError
  );
});

test("To'langan summa zakaz narxidan oshsa rad etiladi", async () => {
  const bugun = todayTashkentDateOnlyString();
  await assert.rejects(
    zakaz("Oshib ketgan to'lov", { summa: 100_000, tolangan: 150_000, sana: bugun }),
    BadRequestError
  );
});

test("YO'QOTILDI arxivga tushadi — asosiy doskada ko'rinmaydi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Yo'qotilgan zakaz", { summa: 90_000, sana: bugun });
  await A(() =>
    crm.holatniOzgartirish({ businessId: tA.business.id, dealId: d.id, holat: "YOQOTILDI", userId: tA.user.id })
  );
  const doska = await A(() => crm.getBoard(tA.business.id));
  assert.ok(!doska.deals.some((x: any) => x.id === d.id), "arxiv asosiy doskada turmaydi");
  const arxiv = await A(() => crm.getBoard(tA.business.id, { yoqotilgan: true }));
  assert.ok(arxiv.deals.some((x: any) => x.id === d.id), "arxiv filtri bilan ochiladi");
});

test("IZOLYATSIYA: boshqa tenant zakazlari doskaga tushmaydi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const bKat = await rawPrisma.category.create({
    data: { businessId: tB.business.id, nomi: "B kirim", turi: "kirim" },
  });
  const bZakaz = await runWithTenant(tB.tenant.id, () =>
    crm.createDeal({
      businessId: tB.business.id,
      nomi: "B biznes zakazi",
      categoryId: bKat.id,
      summa: 999_000,
      sana: bugun,
      userId: tB.user.id,
    })
  );
  const doska = await A(() => crm.getBoard(tA.business.id));
  assert.ok(!doska.deals.some((x: any) => x.id === bZakaz.id), "Disney Navoiy doskasida begona zakaz yo'q");
});

test("FILTR: sana oralig'i va sotuvchi bo'yicha kesiladi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const uzoq = kun(bugun, 40);
  const d = await zakaz("Uzoq kelajak", { summa: 111_000, sana: uzoq });

  const faqatBugun = await A(() => crm.getBoard(tA.business.id, { from: bugun, to: bugun }));
  assert.ok(!faqatBugun.deals.some((x: any) => x.id === d.id));

  const oraliq = await A(() => crm.getBoard(tA.business.id, { from: uzoq, to: uzoq }));
  assert.ok(oraliq.deals.some((x: any) => x.id === d.id));

  const begona = await A(() => crm.getBoard(tA.business.id, { masulId: tB.user.id }));
  assert.equal(begona.deals.length, 0, "boshqa xodim filtri bo'sh natija beradi");
});

// ---------------------------------------------------------------------------
// A. YUTILDI QARZNI AVTOMATIK OCHMAYDI
// ---------------------------------------------------------------------------

test("A1: to'lovi tanlanmagan zakaz Yutildi — qarz ham, kirim ham YOZILMAYDI", async () => {
  const bugun = todayTashkentDateOnlyString();
  // Bot orqali kelgan lead / eski yozuv: tolovTuri yo'q, tolangan 0.
  const d = await zakaz("Tanlanmagan lead", { summa: 500_000, tolangan: 0, sana: bugun, tolovTuri: null });
  assert.equal(pipeline.tolovHolati(d.summa, d.tolangan, d.tolovTuri), "TANLANMAGAN");

  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  assert.equal(n.yangiYakun, true);
  assert.equal(n.kirimSumma, 0);
  assert.equal(n.qarzSumma, 0, "qarz avtomatik ochilmaydi");
  assert.equal(n.debtId, null);
  assert.equal(n.transactionId, null);

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.holat, "YUTILDI", "biznes yakuni baribir yoziladi");
  assert.equal(keyin.debtId, null);
  assert.deepEqual(await moliyaSoni("Tanlanmagan lead"), { kirim: 0, qarz: 0 });
});

test("A2: naqd tanlangan, lekin pul kiritilmagan (tolangan 0) — qarzga aylanmaydi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Naqd, pul yo'q", { summa: 300_000, tolangan: 0, sana: bugun, tolovTuri: "naqd" });
  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  assert.equal(n.qarzSumma, 0);
  assert.equal(n.debtId, null);
  assert.deepEqual(await moliyaSoni("Naqd, pul yo'q"), { kirim: 0, qarz: 0 });
});

test("A3: 'Qarzga' FAQAT foydalanuvchi tanlaganda — Debt to'g'ri, kirim yo'q", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Qarzga tanlandi", { summa: 700_000, tolangan: 0, sana: bugun, tolovTuri: "qarz" });
  assert.equal(pipeline.tolovHolati(d.summa, d.tolangan, d.tolovTuri), "QARZ");
  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  assert.equal(n.qarzSumma, 700_000);
  assert.equal(n.kirimSumma, 0);
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id }, include: { debt: true } }));
  assert.equal(keyin.debt.jamiSumma, 700_000);
  assert.equal(keyin.debt.tolangan, 0);
  assert.equal(keyin.debt.status, "OPEN");
  assert.deepEqual(await moliyaSoni("Qarzga tanlandi"), { kirim: 0, qarz: 1 });
});

// ---------------------------------------------------------------------------
// B. YUTILDI → DARHOL KIRIM (barcha yo'llardan, dublikatsiz)
// ---------------------------------------------------------------------------

test("B1: yutilgan zakazda to'lov KEYIN belgilansa — kirim darhol, alohida tugmasiz, dublikatsiz", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Keyin to'landi", { summa: 400_000, tolangan: 0, sana: bugun, tolovTuri: null });
  await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  assert.deepEqual(await moliyaSoni("Keyin to'landi"), { kirim: 0, qarz: 0 });

  // Foydalanuvchi tafsilot oynasida "To'liq to'langan / naqd" ni tanlab
  // saqladi (API PATCH aynan shu yozuvni qiladi, so'ng yakunlashni chaqiradi).
  await A(() => prisma.deal.update({ where: { id: d.id }, data: { tolangan: 400_000, tolovTuri: "naqd" } }));
  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  assert.equal(n.yangiYakun, true, "moliya endi yoziladi");
  assert.equal(n.kirimSumma, 400_000);
  assert.ok(n.transactionId);
  assert.equal(n.debtId, null);

  // Takror — hech narsa yozilmaydi.
  const qayta = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  assert.equal(qayta.yangiYakun, false);
  assert.equal(qayta.transactionId, n.transactionId);
  assert.deepEqual(await moliyaSoni("Keyin to'landi"), { kirim: 1, qarz: 0 });
});

test("B2: yutilgan zakazda keyin QISMAN belgilansa — to'langan qism kirim, qolgani qarz", async () => {
  const bugun = todayTashkentDateOnlyString();
  const d = await zakaz("Keyin qisman", { summa: 600_000, tolangan: 0, sana: bugun, tolovTuri: null });
  await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  await A(() => prisma.deal.update({ where: { id: d.id }, data: { tolangan: 250_000, tolovTuri: "click" } }));
  const n = await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  assert.equal(n.kirimSumma, 250_000);
  assert.equal(n.qarzSumma, 350_000);
  const keyin = await A(() =>
    prisma.deal.findFirst({ where: { id: d.id }, include: { transaction: true, debt: true } })
  );
  assert.equal(keyin.transaction.summa, 250_000);
  assert.equal(keyin.transaction.tolovTuri, "click");
  assert.equal(keyin.debt.jamiSumma, 350_000);
  assert.deepEqual(await moliyaSoni("Keyin qisman"), { kirim: 1, qarz: 1 });
});

test("B3: ESKI YO'L — WON bosqichga sudrash ham kirimni DARHOL yozadi, takrorida dublikat yo'q", async () => {
  const bugun = todayTashkentDateOnlyString();
  const won = await A(() => prisma.stage.findFirst({ where: { businessId: tA.business.id, turi: "WON" } }));
  const d = await zakaz("Sudrab yutildi", { summa: 350_000, tolangan: 350_000, sana: bugun });

  await A(() => crm.moveDeal({ businessId: tA.business.id, dealId: d.id, stageId: won.id, userId: tA.user.id }));
  const bir = await A(() => prisma.deal.findFirst({ where: { id: d.id }, include: { transaction: true } }));
  assert.equal(bir.holat, "YUTILDI");
  assert.ok(bir.transactionId, "kirim darhol yozildi — alohida 'kirimga o'tkazish' kerak emas");
  assert.equal(bir.transaction.summa, 350_000);

  await A(() => crm.moveDeal({ businessId: tA.business.id, dealId: d.id, stageId: won.id, kirimYoz: true, userId: tA.user.id }));
  assert.deepEqual(await moliyaSoni("Sudrab yutildi"), { kirim: 1, qarz: 0 });
});

test("B4: ESKI YO'L — WON + kirimYoz 'Qarzga' zakazda butun summani kirimga YOZMAYDI", async () => {
  const bugun = todayTashkentDateOnlyString();
  const won = await A(() => prisma.stage.findFirst({ where: { businessId: tA.business.id, turi: "WON" } }));
  const d = await zakaz("Sudrab qarzga", { summa: 450_000, tolangan: 0, sana: bugun, tolovTuri: "qarz" });
  await A(() =>
    crm.moveDeal({ businessId: tA.business.id, dealId: d.id, stageId: won.id, kirimYoz: true, userId: tA.user.id })
  );
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id }, include: { debt: true } }));
  assert.equal(keyin.transactionId, null, "qarzga savdo kirim yozmaydi");
  assert.equal(keyin.debt.jamiSumma, 450_000);
  assert.deepEqual(await moliyaSoni("Sudrab qarzga"), { kirim: 0, qarz: 1 });

  // Eski "kirimga o'tkazish" ham qarz ochilgan zakazni rad etadi — ikki
  // marta sanalmasin.
  const crmKirim = await import("@/lib/crm/kirim");
  await assert.rejects(
    A(() => crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id })),
    BadRequestError
  );
});

test("B5: 'kirimga o'tkazish' (eski yo'l) qarzga/qisman tanlangan zakazni rad etadi", async () => {
  const bugun = todayTashkentDateOnlyString();
  const crmKirim = await import("@/lib/crm/kirim");
  const qarz = await zakaz("Eski yo'l qarz", { summa: 100_000, tolangan: 0, sana: bugun, tolovTuri: "qarz" });
  await assert.rejects(
    A(() => crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: qarz.id, userId: tA.user.id })),
    BadRequestError
  );
  const qisman = await zakaz("Eski yo'l qisman", { summa: 100_000, tolangan: 40_000, sana: bugun });
  await assert.rejects(
    A(() => crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: qisman.id, userId: tA.user.id })),
    BadRequestError
  );
  assert.deepEqual(await moliyaSoni("Eski yo'l"), { kirim: 0, qarz: 0 });
});

test("B6: to'g'ridan-to'g'ri WON bosqichida yaratilgan zakaz — kirim darhol", async () => {
  const bugun = todayTashkentDateOnlyString();
  const won = await A(() => prisma.stage.findFirst({ where: { businessId: tA.business.id, turi: "WON" } }));
  const d = await zakaz("Yutilgan holda yaratildi", { summa: 200_000, tolangan: 200_000, sana: bugun, stageId: won.id });
  assert.equal(d.holat, "YUTILDI");
  assert.ok(d.transactionId, "yaratilishi bilan kirim yozildi");
  assert.deepEqual(await moliyaSoni("Yutilgan holda yaratildi"), { kirim: 1, qarz: 0 });
});

// ---------------------------------------------------------------------------
// USTUN ICHIDAGI TARTIB — eng oxirgi holatga o'tgan zakaz ENG TEPADA
// ---------------------------------------------------------------------------

test("TARTIB: 'Yutildi' ustuni holat vaqti bo'yicha KAMAYISH tartibida", () => {
  const { zakazlarniTartibla } = pipeline;
  // Uch zakaz ketma-ket yutildi: 09:45 → 10:20 → 11:05.
  // SANA ataylab teskari tartibda: sana bo'yicha saralash NOTO'G'RI javob
  // berardi (eng yangi yutilgani eng pastda qolardi) — aynan shu tuzatilyapti.
  const A_ = { holat: "YUTILDI", sana: "2026-09-01", holatAt: "2026-09-04T09:45:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" };
  const B_ = { holat: "YUTILDI", sana: "2026-09-02", holatAt: "2026-09-04T10:20:00.000Z", createdAt: "2026-08-02T00:00:00.000Z" };
  const C_ = { holat: "YUTILDI", sana: "2026-09-03", holatAt: "2026-09-04T11:05:00.000Z", createdAt: "2026-08-03T00:00:00.000Z" };

  const tartib = zakazlarniTartibla([A_, B_, C_], "YUTILDI", "2026-09-04");
  assert.deepEqual(
    tartib.map((z: any) => z.holatAt),
    [C_.holatAt, B_.holatAt, A_.holatAt],
    "eng oxirgi yutilgan zakaz eng tepada bo'lishi kerak"
  );

  // JARAYONDA ham ayni qoida: holatga oxirgi o'tgan tepada.
  const j1 = { holat: "JARAYONDA", sana: "2026-09-10", holatAt: "2026-09-04T08:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" };
  const j2 = { holat: "JARAYONDA", sana: "2026-09-05", holatAt: "2026-09-04T12:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" };
  assert.deepEqual(
    zakazlarniTartibla([j1, j2], "JARAYONDA", "2026-09-04").map((z: any) => z.holatAt),
    [j2.holatAt, j1.holatAt]
  );

  // KUTILAYOTGAN — REJA ustuni: eski qoida saqlanadi (kechikkan tepada,
  // keyin yaqin kun). Holat vaqti bu yerda tartibni O'ZGARTIRMAYDI.
  const k1 = { holat: "KUTILMOQDA", sana: "2026-09-01", holatAt: "2026-09-04T08:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" };
  const k2 = { holat: "KUTILMOQDA", sana: "2026-09-20", holatAt: "2026-09-04T12:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" };
  assert.deepEqual(
    zakazlarniTartibla([k2, k1], "KUTILAYOTGAN", "2026-09-04").map((z: any) => z.sana),
    ["2026-09-01", "2026-09-20"],
    "kechikkan zakaz kutilayotgan ustunning tepasida qoladi"
  );
});

test("TARTIB: eski yozuvda `holatAt` yo'q bo'lsa `yopilganAt`/`createdAt` ga qaytiladi", () => {
  const { holatVaqti } = pipeline;
  assert.equal(holatVaqti({ holat: "YUTILDI", sana: null, holatAt: "2026-09-04T11:00:00.000Z", yopilganAt: "2026-09-04T09:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" }), Date.parse("2026-09-04T11:00:00.000Z"));
  assert.equal(holatVaqti({ holat: "YUTILDI", sana: null, holatAt: null, yopilganAt: "2026-09-04T09:00:00.000Z", createdAt: "2026-08-01T00:00:00.000Z" }), Date.parse("2026-09-04T09:00:00.000Z"));
  assert.equal(holatVaqti({ holat: "KUTILMOQDA", sana: null, createdAt: "2026-08-01T00:00:00.000Z" }), Date.parse("2026-08-01T00:00:00.000Z"));
});

test("YAKUNLASH `holatAt` yozadi — endigina yutilgan zakaz doskada tepaga chiqadi", async () => {
  const bugun = todayTashkentDateOnlyString();
  // Sana bo'yicha tartib bilan YUTILISH tartibi ataylab TESKARI: sana bo'yicha
  // A → B → C, yutilish bo'yicha esa kutilgan natija C → B → A.
  const a = await zakaz("Tartib A", { summa: 100_000, tolangan: 100_000, sana: kun(bugun, -3) });
  const b = await zakaz("Tartib B", { summa: 100_000, tolangan: 100_000, sana: kun(bugun, -2) });
  const c = await zakaz("Tartib C", { summa: 100_000, tolangan: 100_000, sana: kun(bugun, -1) });

  const oldin = Date.now();
  for (const d of [a, b, c]) {
    await A(() => yakunlash.zakazniYakunlash({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id }));
  }

  const yozuv = await A(() => prisma.deal.findFirst({ where: { id: a.id } }));
  assert.ok(yozuv.holatAt, "yakunlash `holatAt` yozishi shart");
  assert.ok(yozuv.holatAt.getTime() >= oldin, "`holatAt` — yakunlash vaqti");

  // Vaqtlarni aniq belgilaymiz: test soniya ichida bajarilgani uchun
  // yozilgan vaqtlar teng bo'lib qolishi mumkin (tartib esa aniq sinalsin).
  const vaqt = (soat: string) => new Date(`${bugun}T${soat}:00.000Z`);
  await rawPrisma.deal.update({ where: { id: a.id }, data: { holatAt: vaqt("09:45") } });
  await rawPrisma.deal.update({ where: { id: b.id }, data: { holatAt: vaqt("10:20") } });
  await rawPrisma.deal.update({ where: { id: c.id }, data: { holatAt: vaqt("11:05") } });

  const doska = await A(() => crm.getBoard(tA.business.id));
  const yutilgan = doska.deals.filter((d: any) => [a.id, b.id, c.id].includes(d.id));
  const tartib = pipeline
    .zakazlarniTartibla(
      yutilgan.map((d: any) => ({
        id: d.id,
        holat: d.holat,
        sana: d.sana ? d.sana.toISOString().slice(0, 10) : null,
        holatAt: d.holatAt,
        yopilganAt: d.yopilganAt,
        createdAt: d.createdAt,
      })),
      "YUTILDI",
      bugun
    )
    .map((d: any) => d.id);
  assert.deepEqual(tartib, [c.id, b.id, a.id], "eng oxirgi yutilgan zakaz eng tepada");
});
