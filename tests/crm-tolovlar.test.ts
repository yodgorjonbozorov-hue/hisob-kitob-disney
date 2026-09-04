/**
 * ZAKAZDA ARALASH TO'LOV — naqd + click + terminal, qolgani qarz.
 *
 * Qamrov (topshiriqdagi 7 stsenariy):
 *   1. 100% naqd — bitta kirim, naqd kassaga;
 *   2. 50% naqd + 50% click — IKKI kirim, har biri O'Z kassasiga;
 *   3. naqd + click + terminal — uch kirim, naqd kassa faqat naqd qismga oshadi;
 *   4. to'langan qism + qarz — kirim faqat to'langan qism, qolgani Debt;
 *   5. to'lovlar yig'indisi zakazdan oshsa — BLOK;
 *   6. Yutildi qayta bosilsa — dublikat kirim YO'Q;
 *   7. qarz keyin yopilsa — o'sha payt yangi kirim yoziladi.
 * Qo'shimcha: eski (bir kanalli) zakazlar buzilmasligi, zakaz SONI aralash
 * to'lovda ham bitta bo'lib qolishi (KPI/statistika), eski "kirimga
 * o'tkazish" yo'lining aralash to'lovni rad etishi.
 *
 * Ishga tushirish: npm run test:crm-tolovlar
 */
process.env.DATABASE_URL = "file:./prisma/test-crm-tolovlar.db";

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
let crmKirim: any;
let yakunlash: any;
let qarz: any;
let tolovlar: any;
let xodimStat: any;
let BadRequestError: any;
let todayTashkentDateOnlyString: any;

let t: any;
let kat: any;
/** Naqd kassa va karta (plastik) kassasi — pul qaysi ledgerga tushishi shu yerda ko'rinadi. */
let naqdKassa: any;
let kartaKassa: any;
let bugun: string;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(t.tenant.id, fn);

/** Aralash to'lovli zakaz yaratish. */
async function zakaz(nomi: string, summa: number, satrlar: Array<{ kanal: string; summa: number }>, opts: { tolovTuri?: string | null } = {}) {
  return A(() =>
    crm.createDeal({
      businessId: t.business.id,
      nomi,
      summa,
      categoryId: kat.id,
      sana: bugun,
      userId: t.user.id,
      tolovlar: satrlar,
      ...(opts.tolovTuri === undefined ? {} : { tolovTuri: opts.tolovTuri }),
    })
  );
}

/** Zakaz bo'yicha yozilgan kirimlar (kassa turi bilan). */
async function kirimlar(nomi: string) {
  return A(() =>
    prisma.transaction.findMany({
      where: { businessId: t.business.id, turi: "kirim", deletedAt: null, izoh: { contains: nomi } },
      select: { id: true, summa: true, izoh: true, tolovTuri: true, account: { select: { nomi: true, turi: true } } },
      orderBy: { summa: "desc" },
    })
  );
}

/** Kassa qoldig'i — shu kassaga tushgan kirimlar yig'indisi. */
async function kassaKirimi(accountId: string) {
  const agg = await A(() =>
    prisma.transaction.aggregate({
      where: { businessId: t.business.id, accountId, turi: "kirim", deletedAt: null },
      _sum: { summa: true },
    })
  );
  return agg._sum.summa ?? 0;
}

async function yakunla(dealId: string) {
  return A(() => yakunlash.zakazniYakunlash({ businessId: t.business.id, dealId, userId: t.user.id }));
}

before(async () => {
  rmSync("prisma/test-crm-tolovlar.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  crm = await import("@/lib/crm/service");
  crmKirim = await import("@/lib/crm/kirim");
  yakunlash = await import("@/lib/crm/yakunlash");
  qarz = await import("@/lib/services/qarz");
  tolovlar = await import("@/lib/crm/tolovlar");
  xodimStat = await import("@/lib/queries/xodimStatistika");
  ({ BadRequestError } = await import("@/lib/auth/guard"));
  ({ todayTashkentDateOnlyString } = await import("@/lib/date"));

  bugun = todayTashkentDateOnlyString();
  t = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy",
    ism: "Direktor",
    login: "+998947777701",
    parol: "parol12345",
  });
  await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
  await rawPrisma.tenantModule.create({ data: { tenantId: t.tenant.id, code: "CRM", isActive: true } });

  kat = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Bantik", turi: "kirim" },
  });
  // Biznesda ikki kassa: NAQD (ro'yxatdan o'tishda ochilgani) va KARTA.
  // "Naqd kassa faqat naqd qismga oshsin" talabi aynan shu ikkovi bilan
  // o'lchanadi.
  naqdKassa = await rawPrisma.account.findFirst({
    where: { businessId: t.business.id, turi: "naqd" },
    orderBy: [{ tartib: "asc" }, { createdAt: "asc" }],
  });
  assert.ok(naqdKassa, "biznesda naqd kassa bo'lishi kerak");
  kartaKassa = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Karta / terminal", turi: "plastik", tartib: 2 },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// Sof funksiyalar
// ---------------------------------------------------------------------------

test("KANAL → MOLIYA: naqd naqdga, click/terminal/boshqa karta-hisobga", () => {
  const { kanalTolovTuri, tolovlarJami, tolovTuriBelgisi, ARALASH } = tolovlar;
  assert.equal(kanalTolovTuri("naqd"), "naqd");
  assert.equal(kanalTolovTuri("click"), "click");
  assert.equal(kanalTolovTuri("terminal"), "click", "terminal — naqd EMAS, karta/hisob yo'nalishi");
  assert.equal(kanalTolovTuri("boshqa"), "click");

  assert.equal(tolovlarJami([{ kanal: "naqd", summa: 300_000 }, { kanal: "click", summa: 400_000 }]), 700_000);
  assert.equal(tolovTuriBelgisi([{ kanal: "naqd", summa: 100 }], null), "naqd", "bir kanal — o'sha kanal");
  assert.equal(
    tolovTuriBelgisi([{ kanal: "naqd", summa: 1 }, { kanal: "click", summa: 1 }], null),
    ARALASH
  );
  assert.equal(tolovTuriBelgisi([], "qarz"), "qarz", "qatorsiz — tanlov saqlanadi");
  assert.equal(tolovTuriBelgisi([], null), null);
});

// ---------------------------------------------------------------------------
// TEST 1: 100% naqd
// ---------------------------------------------------------------------------

test("TEST 1: 100% naqd — bitta kirim, naqd kassaga, qarz yo'q", async () => {
  const d = await zakaz("T1 naqd", 500_000, [{ kanal: "naqd", summa: 500_000 }]);
  assert.equal(d.tolangan, 500_000, "to'langan qatorlardan hisoblanadi");
  assert.equal(d.tolovTuri, "naqd");

  const n = await yakunla(d.id);
  assert.equal(n.kirimSumma, 500_000);
  assert.equal(n.qarzSumma, 0);
  assert.equal(n.debtId, null);

  const k = await kirimlar("T1 naqd");
  assert.equal(k.length, 1, "bir kanal — bitta kirim");
  assert.equal(k[0].summa, 500_000);
  assert.equal(k[0].tolovTuri, "naqd");
  assert.equal(k[0].account.turi, "naqd", "naqd kassaga tushdi");
});

// ---------------------------------------------------------------------------
// TEST 2: 50% naqd + 50% click
// ---------------------------------------------------------------------------

test("TEST 2: 50% naqd + 50% click — ikki kirim, har biri o'z kassasiga", async () => {
  const naqdOldin = await kassaKirimi(naqdKassa.id);
  const kartaOldin = await kassaKirimi(kartaKassa.id);

  const d = await zakaz("T2 aralash", 1_000_000, [
    { kanal: "naqd", summa: 500_000 },
    { kanal: "click", summa: 500_000 },
  ]);
  assert.equal(d.tolangan, 1_000_000);
  assert.equal(d.tolovTuri, "aralash");

  const n = await yakunla(d.id);
  assert.equal(n.kirimSumma, 1_000_000);
  assert.equal(n.qarzSumma, 0, "to'liq to'langan — qarz yo'q");

  const k = await kirimlar("T2 aralash");
  assert.equal(k.length, 2, "har kanal uchun alohida kirim");
  assert.deepEqual(k.map((x: any) => x.tolovTuri).sort(), ["click", "naqd"]);

  assert.equal(await kassaKirimi(naqdKassa.id), naqdOldin + 500_000, "naqd kassa faqat naqd qismga oshdi");
  assert.equal(await kassaKirimi(kartaKassa.id), kartaOldin + 500_000, "click qismi karta kassasiga tushdi");
});

// ---------------------------------------------------------------------------
// TEST 3: naqd + click + terminal
// ---------------------------------------------------------------------------

test("TEST 3: naqd + click + terminal — uch kirim, naqd kassa faqat naqd qismga oshadi", async () => {
  const naqdOldin = await kassaKirimi(naqdKassa.id);
  const kartaOldin = await kassaKirimi(kartaKassa.id);

  const d = await zakaz("T3 uch kanal", 900_000, [
    { kanal: "naqd", summa: 300_000 },
    { kanal: "click", summa: 400_000 },
    { kanal: "terminal", summa: 200_000 },
  ]);
  const n = await yakunla(d.id);
  assert.equal(n.kirimSumma, 900_000);
  assert.equal(n.qarzSumma, 0);

  const k = await kirimlar("T3 uch kanal");
  assert.equal(k.length, 3);
  assert.deepEqual(k.map((x: any) => x.summa), [400_000, 300_000, 200_000]);

  assert.equal(await kassaKirimi(naqdKassa.id), naqdOldin + 300_000, "naqd kassa faqat 300 000 ga oshdi");
  assert.equal(
    await kassaKirimi(kartaKassa.id),
    kartaOldin + 600_000,
    "click + terminal karta/hisob kassasiga tushdi"
  );

  // Kanal nomi kirim izohida ko'rinadi — hisobotda qaysi qism ekani bilinsin.
  const izohlar = k.map((x: any) => x.izoh ?? "");
  assert.ok(izohlar.some((i: string) => i.includes("Terminal")), "izohda kanal nomi bor");
});

// ---------------------------------------------------------------------------
// TEST 4: to'langan qism + qarz
// ---------------------------------------------------------------------------

test("TEST 4: 1 000 000 zakaz, 900 000 to'landi — kirim 900 000, qarz 100 000", async () => {
  const d = await zakaz("T4 qoldiq", 1_000_000, [
    { kanal: "naqd", summa: 300_000 },
    { kanal: "click", summa: 400_000 },
    { kanal: "terminal", summa: 200_000 },
  ]);
  const n = await yakunla(d.id);
  assert.equal(n.kirimSumma, 900_000, "faqat REAL to'langan qism kirimga");
  assert.equal(n.qarzSumma, 100_000, "qoldiq — qarzdorlik");

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id }, include: { debt: true } }));
  assert.equal(keyin.debt.jamiSumma, 100_000);
  assert.equal(keyin.debt.status, "OPEN");
  assert.equal(keyin.debt.turi, "olinadigan");

  const k = await kirimlar("T4 qoldiq");
  assert.equal(k.reduce((s: number, x: any) => s + x.summa, 0), 900_000, "kirimlar yig'indisi = to'langan qism");
});

// ---------------------------------------------------------------------------
// TEST 5: yig'indi zakazdan oshsa BLOK
// ---------------------------------------------------------------------------

test("TEST 5: to'lovlar yig'indisi zakaz summasidan oshsa — rad etiladi", async () => {
  await assert.rejects(
    zakaz("T5 oshib ketdi", 500_000, [
      { kanal: "naqd", summa: 300_000 },
      { kanal: "click", summa: 300_000 },
    ]),
    BadRequestError
  );
  const bor = await A(() => prisma.deal.count({ where: { businessId: t.business.id, nomi: "T5 oshib ketdi" } }));
  assert.equal(bor, 0, "rad etilgan zakaz umuman yaratilmaydi");

  // Manfiy va nol summa ham o'tmaydi.
  await assert.rejects(zakaz("T5 nol", 100_000, [{ kanal: "naqd", summa: 0 }]), BadRequestError);
  await assert.rejects(zakaz("T5 kanal", 100_000, [{ kanal: "qarz", summa: 10_000 }]), BadRequestError);
});

// ---------------------------------------------------------------------------
// TEST 6: takroriy Yutildi — dublikat kirim yo'q
// ---------------------------------------------------------------------------

test("TEST 6: Yutildi qayta bosilsa dublikat kirim yo'q", async () => {
  const d = await zakaz("T6 takror", 600_000, [
    { kanal: "naqd", summa: 200_000 },
    { kanal: "click", summa: 400_000 },
  ]);
  const bir = await yakunla(d.id);
  const ikki = await yakunla(d.id);
  assert.equal(bir.yangiYakun, true);
  assert.equal(ikki.yangiYakun, false, "takror bosish — ish allaqachon bajarilgan");

  const k = await kirimlar("T6 takror");
  assert.equal(k.length, 2, "kanal soni qancha bo'lsa — shuncha kirim, ko'p emas");
  assert.equal(k.reduce((s: number, x: any) => s + x.summa, 0), 600_000);

  // Baza darajasidagi himoya: bitta to'lov qatoriga ikkinchi kirim bog'lanmaydi.
  const satr = await A(() =>
    prisma.dealTolov.findFirst({ where: { businessId: t.business.id, dealId: d.id } })
  );
  const boshqaTx = k.find((x: any) => x.id !== satr.transactionId);
  await assert.rejects(
    rawPrisma.dealTolov.update({ where: { id: satr.id }, data: { transactionId: boshqaTx.id } }),
    /[Uu]nique/
  );
});

// ---------------------------------------------------------------------------
// TEST 7: qarz keyin yopilsa — yangi kirim
// ---------------------------------------------------------------------------

test("TEST 7: qarz to'langanda o'sha payt yangi kirim yoziladi", async () => {
  const d = await zakaz("T7 qarz yopildi", 800_000, [{ kanal: "naqd", summa: 500_000 }]);
  const n = await yakunla(d.id);
  assert.equal(n.kirimSumma, 500_000);
  assert.equal(n.qarzSumma, 300_000);

  const kirimOldin = await kirimlar("T7 qarz yopildi");
  assert.equal(kirimOldin.length, 1);

  // Qarz to'liq to'lanadi — qarz moduli o'z kirimini yozadi (to'lov sanasi bilan).
  await A(() =>
    qarz.qarzTolov({
      businessId: t.business.id,
      debtId: n.debtId,
      summa: 300_000,
      sana: bugun,
      tolovTuri: "naqd",
      userId: t.user.id,
    })
  );
  const debt = await A(() => prisma.debt.findFirst({ where: { id: n.debtId } }));
  assert.equal(debt.tolangan, 300_000);
  assert.equal(debt.status, "PAID");

  const tolovlarRoyxati = await A(() =>
    prisma.debtPayment.findMany({
      where: { businessId: t.business.id, debtId: n.debtId },
      select: { summa: true, transactionId: true },
    })
  );
  assert.equal(tolovlarRoyxati.length, 1);
  assert.ok(tolovlarRoyxati[0].transactionId, "qarz to'lovi KIRIM yozuvi bilan keldi");
  const qarzKirimi = await A(() =>
    prisma.transaction.findFirst({ where: { id: tolovlarRoyxati[0].transactionId } })
  );
  assert.equal(qarzKirimi.turi, "kirim");
  assert.equal(qarzKirimi.summa, 300_000, "qarz yopilganda o'sha payt yangi kirim yozildi");

  // Zakazning O'Z kirimi takrorlanmadi: yangi yozuv — qarz to'lovi
  // (u alohida hisoblanadi, sanasi ham to'lov kuni).
  const keyingiKirimlar = await kirimlar("T7 qarz yopildi");
  const zakazniki = keyingiKirimlar.filter((x: any) => x.id !== tolovlarRoyxati[0].transactionId);
  assert.equal(zakazniki.length, kirimOldin.length, "zakaz kirimlari takrorlanmadi");
});

// ---------------------------------------------------------------------------
// Orqaga moslik va sanoq
// ---------------------------------------------------------------------------

test("ORQAGA MOSLIK: qatorsiz (bir kanalli) eski zakaz avvalgidek ishlaydi", async () => {
  const d = await A(() =>
    crm.createDeal({
      businessId: t.business.id,
      nomi: "Eski uslub",
      summa: 400_000,
      tolangan: 400_000,
      tolovTuri: "naqd",
      categoryId: kat.id,
      sana: bugun,
      userId: t.user.id,
    })
  );
  const satrSoni = await A(() => prisma.dealTolov.count({ where: { businessId: t.business.id, dealId: d.id } }));
  assert.equal(satrSoni, 0, "qator yozilmaydi — eski yo'l tegilmagan");

  const n = await yakunla(d.id);
  assert.equal(n.kirimSumma, 400_000);
  const k = await kirimlar("Eski uslub");
  assert.equal(k.length, 1);
  assert.equal(k[0].tolovTuri, "naqd");

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.ok(keyin.transactionId, "eski bog'lanish (Deal.transactionId) saqlanadi");
});

test("ZAKAZ SONI: aralash to'lov statistikada BITTA zakaz bo'lib qoladi", async () => {
  const oldin = await A(() =>
    xodimStat.getXodimlarStatistika({ businessId: t.business.id, from: bugun, to: bugun })
  );
  const d = await zakaz("Sanoq sinovi", 300_000, [
    { kanal: "naqd", summa: 100_000 },
    { kanal: "click", summa: 100_000 },
    { kanal: "terminal", summa: 100_000 },
  ]);
  await yakunla(d.id);
  const keyin = await A(() =>
    xodimStat.getXodimlarStatistika({ businessId: t.business.id, from: bugun, to: bugun })
  );
  assert.equal(
    keyin.jamiZakaz,
    oldin.jamiZakaz + 1,
    "uch kirim yozuvi — bitta zakaz (yozuv soni emas)"
  );
  const summa = (r: any) => r.xodimlar.reduce((s: number, x: any) => s + x.summa, 0);
  assert.equal(summa(keyin), summa(oldin) + 300_000, "summa esa uchala yozuvdan");
});

test("Aralash to'lovli zakaz eski 'kirimga o'tkazish' yo'lidan o'tmaydi", async () => {
  const d = await zakaz("Eski yo'l bloki", 200_000, [
    { kanal: "naqd", summa: 100_000 },
    { kanal: "click", summa: 100_000 },
  ]);
  await assert.rejects(
    A(() => crmKirim.kirimgaKochirish({ businessId: t.business.id, dealId: d.id, userId: t.user.id })),
    BadRequestError,
    "butun summa bitta kassaga yozilmasin"
  );
});

test("TAHRIR: to'lovlar almashtiriladi, moliyaga o'tgach QULFLANADI", async () => {
  const d = await zakaz("Tahrir sinovi", 500_000, [{ kanal: "naqd", summa: 100_000 }]);

  await A(() =>
    crm.zakazTolovlariniAlmashtirish({
      businessId: t.business.id,
      dealId: d.id,
      tolovlar: [
        { kanal: "naqd", summa: 200_000 },
        { kanal: "terminal", summa: 300_000 },
      ],
    })
  );
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id }, include: { tolovlar: true } }));
  assert.equal(keyin.tolangan, 500_000, "yig'indi qatorlar bilan birga yangilandi");
  assert.equal(keyin.tolovTuri, "aralash");
  assert.equal(keyin.tolovlar.length, 2);

  // Oshib ketgan tahrir ham rad etiladi.
  await assert.rejects(
    A(() =>
      crm.zakazTolovlariniAlmashtirish({
        businessId: t.business.id,
        dealId: d.id,
        tolovlar: [{ kanal: "naqd", summa: 600_000 }],
      })
    ),
    BadRequestError
  );

  await yakunla(d.id);
  await assert.rejects(
    A(() =>
      crm.zakazTolovlariniAlmashtirish({
        businessId: t.business.id,
        dealId: d.id,
        tolovlar: [{ kanal: "naqd", summa: 10_000 }],
      })
    ),
    BadRequestError,
    "moliyaga o'tgan zakaz to'lovi qulflanadi"
  );
});

// ---------------------------------------------------------------------------
// DOSKA SAHIFALASHI — 10 tadan, "Yana ko'rsatish" serverdan
// ---------------------------------------------------------------------------

test("SAHIFALASH: ustun 10 tadan qaytadi, kursor bilan qolgani keladi", async () => {
  // 23 ta kutilayotgan zakaz — uch sahifa (10 + 10 + 3).
  const kelajak = new Date(Date.parse(`${bugun}T00:00:00.000Z`) + 5 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  for (let i = 0; i < 23; i++) {
    await A(() =>
      crm.createDeal({
        businessId: t.business.id,
        nomi: `Sahifa ${String(i).padStart(2, "0")}`,
        summa: 10_000,
        categoryId: kat.id,
        sana: kelajak,
        userId: t.user.id,
      })
    );
  }

  const birinchi = await A(() =>
    crm.ustunSahifasi(t.business.id, "KUTILAYOTGAN", {}, { bugun })
  );
  assert.equal(birinchi.deals.length, 10, "birinchi sahifa — 10 ta");
  assert.ok(birinchi.kursor, "yana zakaz bor");
  assert.ok(birinchi.jami >= 23, "sarlavha soni SAHIFADAN emas, butun ustundan");

  const ikkinchi = await A(() =>
    crm.ustunSahifasi(t.business.id, "KUTILAYOTGAN", {}, { bugun, kursor: birinchi.kursor })
  );
  assert.equal(ikkinchi.deals.length, 10);

  const uchinchi = await A(() =>
    crm.ustunSahifasi(t.business.id, "KUTILAYOTGAN", {}, { bugun, kursor: ikkinchi.kursor })
  );
  assert.ok(uchinchi.deals.length > 0 && uchinchi.deals.length <= 10);

  // Sahifalar KESISHMAYDI va takrorlanmaydi — kursor barqaror.
  const idlar = [...birinchi.deals, ...ikkinchi.deals, ...uchinchi.deals].map((d: any) => d.id);
  assert.equal(new Set(idlar).size, idlar.length, "bir zakaz ikki sahifada chiqmaydi");
});

test("SAHIFALASH: ustun sharti va tartibi — yutilgan zakaz tepada", async () => {
  const yutilgan = await A(() =>
    crm.ustunSahifasi(t.business.id, "YUTILDI", {}, { bugun, limit: 50 })
  );
  assert.ok(yutilgan.deals.length > 0);
  assert.ok(
    yutilgan.deals.every((d: any) => d.holat === "YUTILDI"),
    "ustun sharti bazada qo'llanadi"
  );
  // Tartib: holatAt kamayish bo'yicha (eng oxirgi yutilgani birinchi).
  const vaqtlar = yutilgan.deals.map((d: any) => (d.holatAt ?? d.createdAt).getTime());
  const tartibli = [...vaqtlar].sort((a, b) => b - a);
  assert.deepEqual(vaqtlar, tartibli, "eng oxirgi yutilgan zakaz tepada");

  // Kutilayotgan ustunida yutilgan zakaz YO'Q (ustunlar kesishmaydi).
  const kutilayotgan = await A(() =>
    crm.ustunSahifasi(t.business.id, "KUTILAYOTGAN", {}, { bugun, limit: 50 })
  );
  assert.ok(kutilayotgan.deals.every((d: any) => d.holat === "KUTILMOQDA"));
});

test("SAHIFALASH: filtr bilan ham ishlaydi (to'lov holati ham)", async () => {
  const qarzli = await A(() =>
    crm.ustunSahifasi(t.business.id, "YUTILDI", { tolov: "QISMAN" }, { bugun, limit: 5 })
  );
  assert.ok(
    qarzli.deals.every((d: any) => d.tolangan > 0 && d.tolangan < d.summa),
    "faqat qisman to'langanlar"
  );
  assert.equal(qarzli.jami, qarzli.deals.length >= 5 ? qarzli.jami : qarzli.deals.length);

  // Begona kategoriya filtri — bo'sh natija (va kursor yo'q).
  const bosh = await A(() =>
    crm.ustunSahifasi(t.business.id, "YUTILDI", { categoryId: "yoq-kategoriya" }, { bugun })
  );
  assert.equal(bosh.deals.length, 0);
  assert.equal(bosh.kursor, null);
  assert.equal(bosh.jami, 0);
});
