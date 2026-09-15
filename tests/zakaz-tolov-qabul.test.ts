/**
 * ZAKAZ TO'LOV TIZIMI — QABUL TESTLARI.
 *
 * Topshiriqdagi to'qqiz stsenariy, aynan shu tartibda:
 *   1. 750 000 zakazga 200 000 click — to'langan 200k, qoldiq 550k, QARZ 0,
 *      "Yutildi" BLOKLANADI;
 *   2. keyin 550 000 naqd — to'langan 750k, qoldiq 0, "Yutildi" ruxsat;
 *   3. 50 000 naqd + 250 000 click — IKKALASI ham bazada va hisobda (300k);
 *   4. qisman to'langan zakazni "Yutildi" qilish — BACKEND bloklaydi;
 *   5. to'liq to'langan zakaz "Yutildi" — kirim DUBLIKAT bo'lmaydi;
 *   6. zalog berish — avtomatik Debt YARATILMAYDI;
 *   7. bitta zakazga 4 marta to'lov — oldingilari yo'qolmaydi;
 *   8. qayta o'qishda (sahifa yangilanishi) raqamlar o'zgarmaydi;
 *   9. bir vaqtda ikki so'rov — dublikat to'lov/kirim yuzaga kelmaydi.
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
let tolovQoshish: any;
let yakunlash: any;
let pipeline: any;
let BadRequestError: any;
let todayTashkentDateOnlyString: any;

let t: any;
let kat: any;
let bugun: string;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(t.tenant.id, fn);

/** To'lovsiz zakaz (zalog keyin qo'shiladi). */
async function zakaz(nomi: string, summa: number, opts: { tolovTuri?: string | null } = {}) {
  return A(() =>
    crm.createDeal({
      businessId: t.business.id,
      nomi,
      summa,
      categoryId: kat.id,
      sana: bugun,
      userId: t.user.id,
      kontaktIsm: `Mijoz ${nomi}`,
      ...(opts.tolovTuri === undefined ? {} : { tolovTuri: opts.tolovTuri }),
    })
  );
}

async function tolov(dealId: string, kanal: string, summa: number) {
  return A(() =>
    tolovQoshish.zakazgaTolovQoshish({ businessId: t.business.id, dealId, userId: t.user.id, kanal, summa })
  );
}

async function hisob(dealId: string) {
  return A(() => tolovQoshish.zakazTolovHisobi(t.business.id, dealId));
}

async function yakunla(dealId: string, qarzgaYopish = false) {
  return A(() =>
    yakunlash.zakazniYakunlash({ businessId: t.business.id, dealId, userId: t.user.id, qarzgaYopish })
  );
}

/** Zakaz bo'yicha yozilgan (o'chirilmagan) kirim yozuvlari. */
async function kirimlar(nomi: string) {
  return A(() =>
    prisma.transaction.findMany({
      where: { businessId: t.business.id, turi: "kirim", deletedAt: null, izoh: { contains: nomi } },
      select: { id: true, summa: true, tolovTuri: true, izoh: true },
      orderBy: { summa: "desc" },
    })
  );
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
  tolovQoshish = await import("@/lib/crm/tolovQoshish");
  yakunlash = await import("@/lib/crm/yakunlash");
  pipeline = await import("@/lib/crm/pipeline");
  ({ BadRequestError } = await import("@/lib/auth/guard"));
  ({ todayTashkentDateOnlyString } = await import("@/lib/date"));

  bugun = todayTashkentDateOnlyString();
  t = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy",
    ism: "Direktor",
    login: "+998947777801",
    parol: "parol12345",
  });
  await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
  await rawPrisma.tenantModule.create({ data: { tenantId: t.tenant.id, code: "CRM", isActive: true } });

  kat = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Bantik", turi: "kirim" },
  });
  await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Karta / terminal", turi: "plastik", tartib: 2 },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// TEST 1: 750 000 zakaz, 200 000 click — qoldiq QARZ EMAS, Yutildi bloklanadi
// ---------------------------------------------------------------------------

test("TEST 1: zalog 200 000 — to'langan 200k, qoldiq 550k, qarz 0, Yutildi BLOK", async () => {
  const d = await zakaz("Q1 zalog", 750_000);
  await tolov(d.id, "click", 200_000);

  const h = await hisob(d.id);
  assert.equal(h.summa, 750_000);
  assert.equal(h.tolangan, 200_000, "to'langan = to'lovlar yig'indisi");
  assert.equal(h.qoldiq, 550_000, "qolgani QOLDIQ");
  assert.equal(h.holati, "QISMAN");

  const deal = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(deal.debtId, null, "QARZ 0 — qoldiq avtomatik qarzga tushmaydi");
  assert.equal(deal.tolangan, 200_000);
  assert.notEqual(deal.holat, "YUTILDI", "zakaz jarayonda qoladi");

  // Ochiq qarz yozuvi umuman yo'q.
  const qarzSoni = await A(() =>
    prisma.debt.count({ where: { businessId: t.business.id, izoh: { contains: "Q1 zalog" } } })
  );
  assert.equal(qarzSoni, 0);

  // BACKEND BLOKI — xabarda aniq qoldiq ko'rsatiladi.
  await assert.rejects(
    yakunla(d.id),
    (e: any) => e instanceof BadRequestError && e.message.includes("550000")
  );

  // Pul esa REAL kelgani uchun kirimda TURADI (Yutildini kutmaydi).
  const k = await kirimlar("Q1 zalog");
  assert.equal(k.length, 1);
  assert.equal(k[0].summa, 200_000);
  assert.equal(k[0].tolovTuri, "click");
});

// ---------------------------------------------------------------------------
// TEST 2: qolgan 550 000 naqd — to'liq to'landi, Yutildi ruxsat
// ---------------------------------------------------------------------------

test("TEST 2: qolgan 550 000 naqd kelgach — qoldiq 0 va Yutildi RUXSAT", async () => {
  const d = await zakaz("Q2 toliq", 750_000);
  await tolov(d.id, "click", 200_000);
  await tolov(d.id, "naqd", 550_000);

  const h = await hisob(d.id);
  assert.equal(h.tolangan, 750_000);
  assert.equal(h.qoldiq, 0);
  assert.equal(h.holati, "TOLANGAN");
  assert.equal(h.tolovlar.length, 2, "ikkala to'lov ham saqlandi");

  const n = await yakunla(d.id);
  assert.equal(n.yangiYakun, true);
  assert.equal(n.qarzSumma, 0, "to'liq to'langan zakazda qarz yo'q");
  assert.equal(n.debtId, null);

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.holat, "YUTILDI");
});

// ---------------------------------------------------------------------------
// TEST 3: aralash to'lov — 50 000 naqd + 250 000 click, ikkalasi ham qoladi
// ---------------------------------------------------------------------------

test("TEST 3: 50 000 naqd + 250 000 click — IKKALASI bazada va hisobda", async () => {
  const d = await zakaz("Q3 aralash", 400_000);
  await tolov(d.id, "naqd", 50_000);
  await tolov(d.id, "click", 250_000);

  // 1. BAZADA ikkala qator ham bor.
  const satrlar = await A(() =>
    prisma.dealTolov.findMany({
      where: { businessId: t.business.id, dealId: d.id },
      orderBy: { createdAt: "asc" },
      select: { kanal: true, summa: true, transactionId: true },
    })
  );
  assert.deepEqual(
    satrlar.map((x: any) => `${x.kanal}:${x.summa}`),
    ["naqd:50000", "click:250000"],
    "click to'lovi yo'qolmaydi"
  );

  // 2. HISOBDA (API javobi / UI manbai) ham ikkalasi.
  const h = await hisob(d.id);
  assert.equal(h.tolovlar.length, 2);
  assert.equal(h.tolangan, 300_000, "jami to'langan = 50k + 250k");
  assert.equal(h.qoldiq, 100_000);

  // 3. KIRIMDA har kanal alohida yozuv bilan, o'z kassasiga.
  const k = await kirimlar("Q3 aralash");
  assert.equal(k.length, 2);
  assert.deepEqual(k.map((x: any) => x.summa), [250_000, 50_000]);
  assert.deepEqual(k.map((x: any) => x.tolovTuri).sort(), ["click", "naqd"]);

  // 4. `Deal.tolangan` keshi ham qatorlar bilan bir xil.
  const deal = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(deal.tolangan, 300_000);
  assert.equal(deal.tolovTuri, "aralash");
});

// ---------------------------------------------------------------------------
// TEST 4: qisman to'langan zakazni Yutildi qilish — BACKEND bloklaydi
// ---------------------------------------------------------------------------

test("TEST 4: qisman to'langan zakaz — backend bloklaydi (frontend disable yetarli emas)", async () => {
  const d = await zakaz("Q4 blok", 2_200_000);
  await tolov(d.id, "click", 1_000_000);

  // Xizmat qatlami — API PATCH shu funksiyani chaqiradi.
  await assert.rejects(
    yakunla(d.id),
    (e: any) => e instanceof BadRequestError && e.message.includes("1200000")
  );

  // ESKI YO'L (bosqichga sudrash) ham bloklanadi — teshik qolmasin.
  const won = await A(() => prisma.stage.findFirst({ where: { businessId: t.business.id, turi: "WON" } }));
  await assert.rejects(
    A(() => crm.moveDeal({ businessId: t.business.id, dealId: d.id, stageId: won.id, userId: t.user.id })),
    BadRequestError
  );

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.notEqual(keyin.holat, "YUTILDI");
  assert.equal(keyin.debtId, null);

  // ORTIQCHA TO'LOV ham jimgina o'tmaydi.
  assert.equal(pipeline.yutildiTekshiruvi(100_000, 150_000, "naqd").mumkin, false);

  // Qolgani kelgach — yakunlash ochiladi.
  await tolov(d.id, "naqd", 1_200_000);
  const n = await yakunla(d.id);
  assert.equal(n.yangiYakun, true);
  assert.equal(n.qarzSumma, 0);
});

// ---------------------------------------------------------------------------
// TEST 5: to'liq to'langan zakaz Yutildi — kirim DUBLIKAT bo'lmaydi
// ---------------------------------------------------------------------------

test("TEST 5: Yutildi kirim YARATMAYDI — 2 200 000 ikkinchi marta yozilmaydi", async () => {
  const d = await zakaz("Q5 dublikat", 2_200_000);
  await tolov(d.id, "click", 1_000_000);
  await tolov(d.id, "naqd", 1_200_000);

  const oldin = await kirimlar("Q5 dublikat");
  assert.equal(oldin.length, 2);
  assert.equal(oldin.reduce((s: number, x: any) => s + x.summa, 0), 2_200_000);

  const n = await yakunla(d.id);
  assert.equal(n.yangiKirimSoni, 0, "Yutildi — status, moliyaviy amal emas");

  // Takror bosish ham hech narsa yozmaydi.
  const qayta = await yakunla(d.id);
  assert.equal(qayta.yangiYakun, false);

  const keyin = await kirimlar("Q5 dublikat");
  assert.equal(keyin.length, 2, "kirim soni o'zgarmadi — dublikat yo'q");
  assert.equal(
    keyin.reduce((s: number, x: any) => s + x.summa, 0),
    2_200_000,
    "jami kirim ham ikki barobar bo'lib ketmadi"
  );
});

// ---------------------------------------------------------------------------
// TEST 6: zalog berish — avtomatik Debt YARATILMAYDI
// ---------------------------------------------------------------------------

test("TEST 6: 5 000 000 zakazga 1 000 000 zalog — Debt yaratilmaydi", async () => {
  const d = await zakaz("Q6 zalog", 5_000_000);
  await tolov(d.id, "naqd", 1_000_000);

  const qarzSoni = await A(() =>
    prisma.debt.count({ where: { businessId: t.business.id, izoh: { contains: "Q6 zalog" } } })
  );
  assert.equal(qarzSoni, 0, "zalog berilgani qarz degani EMAS");

  const h = await hisob(d.id);
  assert.equal(h.tolangan, 1_000_000);
  assert.equal(h.qoldiq, 4_000_000);

  const deal = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(deal.debtId, null);
  // "Qarz" ustuni sharti ham ochiq qarz yozuviga bog'langan, qoldiqqa emas.
  assert.equal(pipeline.zakazQarzdormi(null), false);

  // QARZ FAQAT ANIQ TANLOV BILAN: nasiyaga yopilganda.
  const n = await yakunla(d.id, true);
  assert.equal(n.qarzSumma, 4_000_000);
  const qarz = await A(() => prisma.debt.findFirst({ where: { id: n.debtId } }));
  assert.equal(qarz.jamiSumma, 4_000_000);
  assert.equal(qarz.turi, "olinadigan");
});

// ---------------------------------------------------------------------------
// TEST 7: bir zakazga 4 marta to'lov — oldingilari yo'qolmaydi
// ---------------------------------------------------------------------------

test("TEST 7: to'rt marta turli to'lov — barchasi alohida saqlanadi", async () => {
  const d = await zakaz("Q7 kop tolov", 1_000_000);
  await tolov(d.id, "click", 50_000);
  await tolov(d.id, "naqd", 200_000);
  await tolov(d.id, "terminal", 250_000);
  await tolov(d.id, "click", 500_000);

  const h = await hisob(d.id);
  assert.equal(h.tolovlar.length, 4, "oldingi to'lovlar yo'qolmadi");
  assert.deepEqual(
    h.tolovlar.map((x: any) => `${x.kanal}:${x.summa}`),
    ["click:50000", "naqd:200000", "terminal:250000", "click:500000"]
  );
  assert.equal(h.tolangan, 1_000_000);
  assert.equal(h.qoldiq, 0);

  // Kanal kesimidagi yig'indi: naqd 200k, click 550k, terminal 250k.
  const kanalJami = h.tolovlar.reduce((m: Record<string, number>, x: any) => {
    m[x.kanal] = (m[x.kanal] ?? 0) + x.summa;
    return m;
  }, {});
  assert.deepEqual(kanalJami, { click: 550_000, naqd: 200_000, terminal: 250_000 });

  // Har to'lov o'z kirimini yozdi — jami ham to'g'ri.
  const k = await kirimlar("Q7 kop tolov");
  assert.equal(k.length, 4);
  assert.equal(k.reduce((s: number, x: any) => s + x.summa, 0), 1_000_000);
});

// ---------------------------------------------------------------------------
// TEST 8: qayta o'qishda (sahifa yangilanishi) raqamlar o'zgarmaydi
// ---------------------------------------------------------------------------

test("TEST 8: qayta o'qishda to'lovlar va jami hisob O'ZGARMAYDI", async () => {
  const d = await zakaz("Q8 barqaror", 900_000);
  await tolov(d.id, "naqd", 400_000);
  await tolov(d.id, "click", 300_000);

  const birinchi = await hisob(d.id);

  // "Sahifa yangilandi / qayta kirildi" — yangi tenant konteksti, yangi o'qish.
  const ikkinchi = await hisob(d.id);
  assert.deepEqual(ikkinchi, birinchi, "hisob bir xil qaytadi");

  // Doska kartochkasi o'qiydigan kesh ham AYNI raqamni beradi.
  const deal = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(deal.tolangan, birinchi.tolangan, "`Deal.tolangan` keshi qatorlar bilan bir xil");
  assert.equal(deal.summa - deal.tolangan, birinchi.qoldiq);

  // Doska sahifasi ham shu zakazni AYNI raqamlar bilan qaytaradi.
  const sahifa = await A(() =>
    crm.ustunSahifasi(t.business.id, "BUGUNGI", {}, { bugun, limit: 50 })
  );
  const kartochka = sahifa.deals.find((x: any) => x.id === d.id);
  assert.ok(kartochka, "zakaz doskada ko'rinadi");
  assert.equal(kartochka.tolangan, 700_000);
  assert.equal(kartochka.tolovlar.length, 2, "doskadagi kartochka ham ikkala to'lovni ko'radi");
});

// ---------------------------------------------------------------------------
// TEST 9: bir vaqtda ikki so'rov — dublikat to'lov/kirim bo'lmaydi
// ---------------------------------------------------------------------------

test("TEST 9: parallel ikki to'lov so'rovi — faqat bittasi o'tadi", async () => {
  const d = await zakaz("Q9 poyga", 300_000);

  // Ayni bitta to'lov ikki marta yuborildi (ikki marta bosilgan tugma).
  const natijalar = await Promise.allSettled([
    tolov(d.id, "naqd", 300_000),
    tolov(d.id, "naqd", 300_000),
  ]);
  const otgan = natijalar.filter((r) => r.status === "fulfilled");
  assert.equal(otgan.length, 1, "ikkinchi so'rov rad etiladi (qoldiq yoki poyga sharti)");

  const h = await hisob(d.id);
  assert.equal(h.tolovlar.length, 1, "dublikat to'lov qatori yo'q");
  assert.equal(h.tolangan, 300_000, "jami ikki barobar bo'lib ketmadi");

  const k = await kirimlar("Q9 poyga");
  assert.equal(k.length, 1, "dublikat kirim yozuvi ham yo'q");
  assert.equal(k[0].summa, 300_000);

  // Parallel YAKUNLASH ham bitta yakun beradi (holat CAS sharti).
  const yakunlar = await Promise.allSettled([yakunla(d.id), yakunla(d.id)]);
  const yangi = yakunlar.filter((r) => r.status === "fulfilled" && (r as any).value.yangiYakun === true);
  assert.equal(yangi.length, 1, "zakaz ROSA BIR MARTA yakunlanadi");
  assert.equal((await kirimlar("Q9 poyga")).length, 1, "yakunlash yangi kirim yaratmadi");

  // Faoliyat lentasida ham bitta "Yutildi" yozuvi.
  const yakunYozuvi = await A(() =>
    prisma.activity.count({
      where: { businessId: t.business.id, dealId: d.id, matn: { contains: "Yutildi" } },
    })
  );
  assert.equal(yakunYozuvi, 1, "dublikat faoliyat yozuvi ham yo'q");
});

// ---------------------------------------------------------------------------
// QO'SHIMCHA: xato yozilgan to'lovni olib tashlash (direktor)
// ---------------------------------------------------------------------------

test("TUZATISH: xato to'lov olib tashlanadi — kirim savatga, hisob qayta hisoblanadi", async () => {
  const d = await zakaz("Q10 tuzatish", 500_000);
  await tolov(d.id, "naqd", 100_000);
  const xato = await tolov(d.id, "click", 400_000);

  await A(() =>
    tolovQoshish.zakazTolovniOchirish({
      businessId: t.business.id,
      dealId: d.id,
      tolovId: xato.tolovId,
      userId: t.user.id,
    })
  );

  const h = await hisob(d.id);
  assert.equal(h.tolovlar.length, 1, "faqat xato qator o'chdi");
  assert.equal(h.tolangan, 100_000);
  assert.equal(h.qoldiq, 400_000);

  // Kirim YUMSHOQ o'chirildi: kassa qoldig'idan chiqdi, savatda qoldi.
  const ochirilgan = await A(() =>
    prisma.transaction.findFirst({ where: { id: xato.transactionId } })
  );
  assert.ok(ochirilgan.deletedAt, "kirim savatga o'tdi (butunlay o'chmadi)");
  assert.equal((await kirimlar("Q10 tuzatish")).length, 1, "kassada faqat bitta kirim qoldi");

  // Zakaz endi yana to'liq to'lanishi mumkin.
  await tolov(d.id, "naqd", 400_000);
  const n = await yakunla(d.id);
  assert.equal(n.yangiYakun, true);
  assert.equal(n.qarzSumma, 0);
});

// ---------------------------------------------------------------------------
// ORQAGA MOSLIK: qatorsiz ESKI zakazga yangi to'lov qo'shish
// ---------------------------------------------------------------------------

test("ESKI ZAKAZ: pul `Deal.tolangan` da — yangi to'lov eskisini YO'QOTMAYDI", async () => {
  // Qatorlar paydo bo'lishidan oldingi yozuv: pul faqat `Deal.tolangan` da.
  const d = await A(() =>
    crm.createDeal({
      businessId: t.business.id,
      nomi: "Q11 eski uslub",
      summa: 900_000,
      tolangan: 200_000,
      tolovTuri: "naqd",
      categoryId: kat.id,
      sana: bugun,
      userId: t.user.id,
    })
  );
  const satrSoni = await A(() =>
    prisma.dealTolov.count({ where: { businessId: t.business.id, dealId: d.id } })
  );
  assert.equal(satrSoni, 0, "eski yo'lda qator yozilmaydi");

  // Yangi to'lov qo'shilganda eski summa ledgerga KO'CHADI, tushib qolmaydi.
  await tolov(d.id, "click", 700_000);

  const h = await hisob(d.id);
  assert.equal(h.tolangan, 900_000, "eski 200k + yangi 700k");
  assert.equal(h.qoldiq, 0);
  assert.equal(h.tolovlar.length, 2, "eski summa o'z qatoriga ko'chdi");
  assert.deepEqual(
    h.tolovlar.map((x: any) => `${x.kanal}:${x.summa}`),
    ["naqd:200000", "click:700000"]
  );

  // `Deal.tolangan` keshi ham qatorlar bilan bir xil.
  const deal = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(deal.tolangan, 900_000);

  // To'liq to'langani uchun yakunlash mumkin va eski qism ham kirimga tushadi.
  const n = await yakunla(d.id);
  assert.equal(n.yangiYakun, true);
  assert.equal(n.qarzSumma, 0);
  const k = await kirimlar("Q11 eski uslub");
  assert.equal(k.reduce((sum: number, x: any) => sum + x.summa, 0), 900_000, "jami kirim to'liq");
});
