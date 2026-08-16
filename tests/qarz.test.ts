/**
 * QARZ TIZIMI TESTLARI.
 *
 * Asosiy invariant (buzilsa mahsulot yolg'on hisobot beradi):
 *
 *   Qarzga savdo  →  Debt +N,  kirim 0,  sof balans O'ZGARMAYDI
 *   Qarz to'lovi  →  kirim +N (TO'LOV SANASI bilan), qoldiq −N
 *   qolgan = jamiSumma − tolangan;  qolgan = 0 → status PAID
 *
 * Ishga tushirish: npm run test:qarz
 */
process.env.DATABASE_URL = "file:./prisma/test-qarz.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let qarzSvc: any;
let qarzQ: any;
let txQueries: any;
let dashboard: any;
let shiftQ: any;
let accountsQ: any;
let validation: any;

let T: any;
let naqdKassa: any;
let clickKassa: any;
let qarzId = "";

const BERILGAN_SANA = "2026-08-16";
const TOLOV_SANA_1 = "2026-08-18";
const TOLOV_SANA_2 = "2026-08-26";

function A<T2>(fn: () => Promise<T2>): Promise<T2> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

/** Berilgan oy uchun ro'yxat jamlanmasi (Yozuvlar sahifasidagi footer). */
function jamlar(from: string, to: string) {
  return A(async () =>
    txQueries.listTransactions({ businessId: T.business.id, from, to, pageSize: 100 })
  );
}

before(async () => {
  rmSync("prisma/test-qarz.db", { force: true });
  rmSync("prisma/test-qarz.db-journal", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  qarzSvc = await import("@/lib/services/qarz");
  qarzQ = await import("@/lib/queries/qarz");
  txQueries = await import("@/lib/queries/transactions");
  dashboard = await import("@/lib/queries/dashboard");
  shiftQ = await import("@/lib/queries/shift");
  accountsQ = await import("@/lib/queries/accounts");
  validation = await import("@/lib/validation/qarz");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Qarz test",
    ism: "Direktor",
    login: "+998900000101",
    parol: "parol12345",
  });

  const kassalar = await A(async () => accountsQ.listAccounts(T.business.id));
  naqdKassa = kassalar[0];
  const accounts = await import("@/lib/services/accounts");
  clickKassa = await A(async () =>
    accounts.createAccount(T.business.id, { nomi: "Terminal", turi: "plastik" })
  );
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// Telefon normalizatsiyasi
// ---------------------------------------------------------------------------

test("telefon raqami yagona ko'rinishga keltiriladi", () => {
  const n = validation.telNormalize;
  assert.equal(n("90 123 45 67"), "+998901234567");
  assert.equal(n("+998 90 123-45-67"), "+998901234567");
  assert.equal(n("998901234567"), "+998901234567");
  assert.equal(n("12345"), null, "qisqa raqam rad etiladi");
  assert.equal(validation.telKorinish("+998901234567"), "+998 90 123 45 67");
});

test("qarz yaratishda mijoz va telefon majburiy (olinadigan)", () => {
  const s = validation.createQarzSchema;
  assert.equal(s.safeParse({ turi: "olinadigan", jamiSumma: 1000 }).success, false);
  assert.equal(
    s.safeParse({ turi: "olinadigan", mijozNomi: "Ali", jamiSumma: 1000 }).success,
    false,
    "telefonsiz o'tmasligi kerak"
  );
  assert.equal(s.safeParse({ turi: "olinadigan", mijozNomi: "Ali", mijozTel: "901234567", jamiSumma: 0 }).success, false, "0 summa rad etiladi");
  assert.equal(s.safeParse({ turi: "olinadigan", mijozNomi: "Ali", mijozTel: "901234567", jamiSumma: -5 }).success, false, "manfiy summa rad etiladi");
  const ok = s.safeParse({ turi: "olinadigan", mijozNomi: "Ali", mijozTel: "90 123 45 67", jamiSumma: 1000 });
  assert.equal(ok.success, true);
  assert.equal(ok.data.mijozTel, "+998901234567");
});

// ---------------------------------------------------------------------------
// TEST 1 — 10 mln qarz yaratish: kirim 0, balans o'zgarmaydi
// ---------------------------------------------------------------------------

test("TEST 1: qarz yaratilganda kirim 0 va balans o'zgarmaydi", async () => {
  const oldingi = await jamlar("2026-08-01", "2026-08-31");
  const oldingiQoldiq = await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));

  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      mijozNomi: "Ali Valiyev",
      mijozTel: "+998901234567",
      jamiSumma: 10_000_000,
      sana: BERILGAN_SANA,
    })
  );
  qarzId = qarz.id;

  assert.equal(qarz.jamiSumma, 10_000_000);
  assert.equal(qarz.tolangan, 0);
  assert.equal(qarz.status, "OPEN");
  assert.equal(qarz.isYopilgan, false);

  // Qarz yaratilishi HECH QANDAY tranzaksiya yozmasligi kerak.
  const txSoni = await A(async () =>
    prisma.transaction.count({ where: { businessId: T.business.id } })
  );
  assert.equal(txSoni, 0, "qarz tranzaksiya yaratmasligi kerak");

  const keyingi = await jamlar("2026-08-01", "2026-08-31");
  assert.equal(keyingi.totals.jamiKirim, oldingi.totals.jamiKirim, "kirim o'zgarmasligi kerak");
  assert.equal(keyingi.totals.sof, oldingi.totals.sof, "sof balans o'zgarmasligi kerak");

  const qoldiq = await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));
  assert.equal(qoldiq, oldingiQoldiq, "kassa qoldig'i o'zgarmasligi kerak");

  // Dashboard (oylik xulosa) ham qarzni daromadga qo'shmasligi kerak.
  const xulosa = await A(async () => dashboard.getMonthSummary(T.business.id, "2026-08"));
  assert.equal(xulosa.jamiKirim, 0);
  assert.equal(xulosa.sofFoyda, 0);

  // Lekin qarz Qarzlar modulida KO'RINISHI shart.
  const royxat = await A(async () => qarzQ.listQarzlar(T.business.id));
  assert.equal(royxat.length, 1);
  assert.equal(royxat[0].qolgan, 10_000_000);
  assert.equal(royxat[0].mijozNomi, "Ali Valiyev");
});

// ---------------------------------------------------------------------------
// TEST 2 — 3 mln naqd to'lov
// ---------------------------------------------------------------------------

test("TEST 2: 3 mln naqd to'lov → kirim +3 mln, qoldiq 7 mln, PARTIALLY_PAID", async () => {
  const natija = await A(async () =>
    qarzSvc.qarzTolov({
      businessId: T.business.id,
      debtId: qarzId,
      userId: T.user.id,
      summa: 3_000_000,
      sana: TOLOV_SANA_1,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      idempotencyKey: "tolov-1-kalit-aaaa",
    })
  );

  assert.equal(natija.tolangan, 3_000_000);
  assert.equal(natija.qolgan, 7_000_000);
  assert.equal(natija.status, "PARTIALLY_PAID");
  assert.equal(natija.isYopilgan, false);
  assert.equal(natija.yangiTolov, true);

  // Kirim tranzaksiyasi yaratilgan va TO'LOV SANASI bilan.
  const txn = await A(async () =>
    prisma.transaction.findUnique({ where: { id: natija.transactionId } })
  );
  assert.equal(txn.turi, "kirim");
  assert.equal(txn.summa, 3_000_000);
  assert.equal(txn.accountId, naqdKassa.id);
  assert.equal(
    txn.sana.toISOString().slice(0, 10),
    TOLOV_SANA_1,
    "kirim sanasi TO'LOV sanasi bo'lishi kerak"
  );

  // Naqd kassa qoldig'i o'sdi.
  const qoldiqlar = await A(async () => accountsQ.getAccountBalances(T.business.id));
  const n = qoldiqlar.find((q: any) => q.id === naqdKassa.id);
  assert.equal(n.qoldiq, 3_000_000);
});

// ---------------------------------------------------------------------------
// TEST 5 — kirim SANASI: berilgan kun emas, to'langan kun
// ---------------------------------------------------------------------------

test("TEST 5: qarz berilgan kun hisobotiga kirim tushmaydi", async () => {
  // 16-avgust: qarz berilgan kun — kirim 0 bo'lishi shart.
  const berilganKun = await jamlar(BERILGAN_SANA, BERILGAN_SANA);
  assert.equal(berilganKun.totals.jamiKirim, 0, "qarz berilgan kunda kirim bo'lmasligi kerak");
  assert.equal(berilganKun.totals.sof, 0);

  // 18-avgust: to'lov kuni — kirim 3 mln.
  const tolovKun = await jamlar(TOLOV_SANA_1, TOLOV_SANA_1);
  assert.equal(tolovKun.totals.jamiKirim, 3_000_000);
  assert.equal(tolovKun.totals.sof, 3_000_000);

  // Kun yakunidagi "kutilgan naqd" ham faqat to'lov kunida ko'rinadi.
  const kutilgan16 = await A(async () => shiftQ.getExpectedCash(T.business.id, BERILGAN_SANA));
  const kutilgan18 = await A(async () => shiftQ.getExpectedCash(T.business.id, TOLOV_SANA_1));
  assert.equal(kutilgan16, 0);
  assert.equal(kutilgan18, 3_000_000);
});

// ---------------------------------------------------------------------------
// TEST 4 — takror bosish (idempotentlik)
// ---------------------------------------------------------------------------

test("TEST 4: bir kalit bilan ikki marta yuborilsa balans ikki marta oshmaydi", async () => {
  const oldingiTxSoni = await A(async () =>
    prisma.transaction.count({ where: { businessId: T.business.id, turi: "kirim" } })
  );

  const takror = await A(async () =>
    qarzSvc.qarzTolov({
      businessId: T.business.id,
      debtId: qarzId,
      userId: T.user.id,
      summa: 3_000_000,
      sana: TOLOV_SANA_1,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      idempotencyKey: "tolov-1-kalit-aaaa", // AYNI kalit
    })
  );

  assert.equal(takror.yangiTolov, false, "takror so'rov yangi to'lov yozmasligi kerak");
  assert.equal(takror.tolangan, 3_000_000, "to'langan summa oshmasligi kerak");
  assert.equal(takror.qolgan, 7_000_000);

  const yangiTxSoni = await A(async () =>
    prisma.transaction.count({ where: { businessId: T.business.id, turi: "kirim" } })
  );
  assert.equal(yangiTxSoni, oldingiTxSoni, "ikkinchi kirim yozilmasligi kerak");

  const tolovSoni = await A(async () =>
    prisma.debtPayment.count({ where: { businessId: T.business.id, debtId: qarzId } })
  );
  assert.equal(tolovSoni, 1, "faqat bitta to'lov yozuvi bo'lishi kerak");

  const qoldiqlar = await A(async () => accountsQ.getAccountBalances(T.business.id));
  const n = qoldiqlar.find((q: any) => q.id === naqdKassa.id);
  assert.equal(n.qoldiq, 3_000_000, "kassa qoldig'i ikki marta oshmasligi kerak");
});

// ---------------------------------------------------------------------------
// TEST 3 — qolgan 7 mln Click orqali
// ---------------------------------------------------------------------------

test("TEST 3: qolgan 7 mln Click orqali → qoldiq 0, status PAID", async () => {
  const natija = await A(async () =>
    qarzSvc.qarzTolov({
      businessId: T.business.id,
      debtId: qarzId,
      userId: T.user.id,
      summa: 7_000_000,
      sana: TOLOV_SANA_2,
      tolovTuri: "click",
      accountId: clickKassa.id,
      idempotencyKey: "tolov-2-kalit-bbbb",
    })
  );

  assert.equal(natija.tolangan, 10_000_000);
  assert.equal(natija.qolgan, 0);
  assert.equal(natija.status, "PAID");
  assert.equal(natija.isYopilgan, true);

  const txn = await A(async () =>
    prisma.transaction.findUnique({ where: { id: natija.transactionId } })
  );
  assert.equal(txn.tolovTuri, "click");
  assert.equal(txn.accountId, clickKassa.id);
  assert.equal(txn.sana.toISOString().slice(0, 10), TOLOV_SANA_2);

  const qoldiqlar = await A(async () => accountsQ.getAccountBalances(T.business.id));
  assert.equal(qoldiqlar.find((q: any) => q.id === clickKassa.id).qoldiq, 7_000_000);

  // Invariant: jami kirim = to'langan qarz (boshqa yozuv yo'q).
  const oy = await jamlar("2026-08-01", "2026-08-31");
  assert.equal(oy.totals.jamiKirim, 10_000_000);
  assert.equal(oy.totals.sof, 10_000_000);
});

test("yopilgan qarzga yana to'lov qilib bo'lmaydi", async () => {
  await assert.rejects(
    () =>
      A(async () =>
        qarzSvc.qarzTolov({
          businessId: T.business.id,
          debtId: qarzId,
          userId: T.user.id,
          summa: 1_000,
          idempotencyKey: "tolov-3-kalit-cccc",
        })
      ),
    /allaqachon yopilgan/
  );
});

// ---------------------------------------------------------------------------
// Validatsiya va chegaralar
// ---------------------------------------------------------------------------

test("to'lov qolgan qarzdan ko'p bo'lsa rad etiladi", async () => {
  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      mijozNomi: "Vali Aliyev",
      mijozTel: "+998901112233",
      jamiSumma: 1_000_000,
      sana: BERILGAN_SANA,
    })
  );

  await assert.rejects(
    () =>
      A(async () =>
        qarzSvc.qarzTolov({
          businessId: T.business.id,
          debtId: qarz.id,
          userId: T.user.id,
          summa: 1_500_000,
          idempotencyKey: "ortiqcha-kalit-dddd",
        })
      ),
    /qolgan qarzdan ko'p/
  );

  await assert.rejects(
    () =>
      A(async () =>
        qarzSvc.qarzTolov({
          businessId: T.business.id,
          debtId: qarz.id,
          userId: T.user.id,
          summa: -100,
          idempotencyKey: "manfiy-kalit-eeee",
        })
      ),
    /musbat/
  );
});

test("bekor qilingan qarzga to'lov qilib bo'lmaydi va u ochiq qarzdan chiqadi", async () => {
  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      mijozNomi: "Xato yozuv",
      mijozTel: "+998901112244",
      jamiSumma: 500_000,
      sana: BERILGAN_SANA,
    })
  );

  const oldingi = await A(async () => qarzQ.getQarzDashboard(T.business.id));

  const bekor = await A(async () =>
    qarzSvc.qarzBekor({
      businessId: T.business.id,
      debtId: qarz.id,
      userId: T.user.id,
      sabab: "Xato kiritilgan",
    })
  );
  assert.equal(bekor.status, "CANCELLED");
  assert.equal(bekor.isYopilgan, true);

  const keyingi = await A(async () => qarzQ.getQarzDashboard(T.business.id));
  assert.equal(
    keyingi.ochiqJami,
    oldingi.ochiqJami - 500_000,
    "bekor qilingan qarz ochiq qarzdan chiqishi kerak"
  );

  await assert.rejects(
    () =>
      A(async () =>
        qarzSvc.qarzTolov({
          businessId: T.business.id,
          debtId: qarz.id,
          userId: T.user.id,
          summa: 100_000,
          idempotencyKey: "bekor-kalit-ffff",
        })
      ),
    /Bekor qilingan/
  );
});

test("to'lovi bor qarzni bekor qilib bo'lmaydi", async () => {
  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      mijozNomi: "Qisman to'lagan",
      mijozTel: "+998901112255",
      jamiSumma: 800_000,
      sana: BERILGAN_SANA,
    })
  );
  await A(async () =>
    qarzSvc.qarzTolov({
      businessId: T.business.id,
      debtId: qarz.id,
      userId: T.user.id,
      summa: 200_000,
      sana: TOLOV_SANA_1,
      tolovTuri: "naqd",
      idempotencyKey: "qisman-kalit-gggg",
    })
  );

  await assert.rejects(
    () =>
      A(async () =>
        qarzSvc.qarzBekor({
          businessId: T.business.id,
          debtId: qarz.id,
          userId: T.user.id,
          sabab: "Fikrimdan qaytdim",
        })
      ),
    /bekor qilib bo'lmaydi/
  );
});

// ---------------------------------------------------------------------------
// Tafsilot va tarix
// ---------------------------------------------------------------------------

test("qarz tafsilotida to'lov tarixi sana va usul bilan ko'rinadi", async () => {
  const t = await A(async () => qarzQ.getQarzTafsilot(T.business.id, qarzId));
  assert.equal(t.tolovlar.length, 2);
  assert.equal(t.tolovlar[0].summa, 3_000_000);
  assert.equal(t.tolovlar[0].tolovTuri, "naqd");
  assert.equal(t.tolovlar[0].sana.slice(0, 10), TOLOV_SANA_1);
  assert.equal(t.tolovlar[1].summa, 7_000_000);
  assert.equal(t.tolovlar[1].tolovTuri, "click");
  assert.equal(t.tolovlar[1].sana.slice(0, 10), TOLOV_SANA_2);
  assert.equal(t.status, "PAID");
  assert.equal(t.qolgan, 0);
  // Audit: kim yaratdi, kim qabul qildi.
  assert.equal(t.yaratgan, "Direktor");
  assert.equal(t.tolovlar[0].userIsm, "Direktor");
  assert.equal(t.masulIsm, "Direktor");

  // INVARIANT: qolgan = jamiSumma − to'lovlar yig'indisi.
  const yigindi = t.tolovlar.reduce((a: number, p: any) => a + p.summa, 0);
  assert.equal(t.jamiSumma - yigindi, t.qolgan);
});

// ---------------------------------------------------------------------------
// Eski yozuvlar: tolovTuri="qarz" tranzaksiyasi kirimga kirmaydi
// ---------------------------------------------------------------------------

test("eski 'tolovTuri=qarz' kirim yozuvi sof balansga qo'shilmaydi", async () => {
  const { createTransaction } = await import("@/lib/services/transactionService");
  const cat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: T.business.id, turi: "kirim" } })
  );

  const oldingi = await jamlar("2026-09-01", "2026-09-30");
  await A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi: "kirim",
      categoryId: cat.id,
      summa: 5_000_000,
      sana: "2026-09-10",
      tolovTuri: "qarz",
    })
  );
  const keyingi = await jamlar("2026-09-01", "2026-09-30");

  assert.equal(keyingi.totals.jamiKirim, oldingi.totals.jamiKirim, "jami kirim oshmasligi kerak");
  assert.equal(keyingi.totals.sof, oldingi.totals.sof, "sof balans oshmasligi kerak");
  assert.equal(keyingi.totals.naqdKirim, oldingi.totals.naqdKirim, "naqd oshmasligi kerak");
  assert.equal(keyingi.totals.clickKirim, oldingi.totals.clickKirim, "click oshmasligi kerak");
  assert.equal(keyingi.totals.qarzKirim, 5_000_000, "qarz bo'limida ko'rinishi kerak");

  // Oylik xulosa ham oshmasligi kerak.
  const xulosa = await A(async () => dashboard.getMonthSummary(T.business.id, "2026-09"));
  assert.equal(xulosa.jamiKirim, 0);
  assert.equal(xulosa.sofFoyda, 0);

  // Kategoriya taqsimotida ham yo'q.
  const taqsimot = await A(async () =>
    dashboard.getCategoryBreakdown(T.business.id, "2026-09", "kirim")
  );
  assert.equal(taqsimot.reduce((a: number, c: any) => a + c.summa, 0), 0);
});

/**
 * ENG XAVFLI REGRESSIYA. `tolovTuri` ESKI yozuvlarda NULL. Agar filtr
 * `tolovTuri <> 'qarz'` shaklida yozilsa, SQL'da `NULL <> 'qarz'` → NULL
 * bo'ladi va BARCHA eski yozuvlar hisobotlardan jimgina yo'qolardi.
 */
test("tolovTuri NULL bo'lgan eski kirim hisobotdan YO'QOLMAYDI", async () => {
  const { createTransaction } = await import("@/lib/services/transactionService");
  const cat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: T.business.id, turi: "kirim" } })
  );
  const txn = await A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi: "kirim",
      categoryId: cat.id,
      summa: 900_000,
      sana: "2026-10-05",
      // tolovTuri ATAYLAB berilmaydi — bazada NULL bo'ladi (eski yozuv holati).
    })
  );
  assert.equal(txn.tolovTuri, null, "yozuv haqiqatan tolovTuri'siz bo'lishi kerak");

  const oy = await jamlar("2026-10-01", "2026-10-31");
  assert.equal(oy.totals.jamiKirim, 900_000, "NULL to'lov turli yozuv kirimda qolishi kerak");
  assert.equal(oy.totals.sof, 900_000);

  const xulosa = await A(async () => dashboard.getMonthSummary(T.business.id, "2026-10"));
  assert.equal(xulosa.jamiKirim, 900_000, "oylik xulosada ham qolishi kerak");

  const kutilgan = await A(async () => shiftQ.getExpectedCash(T.business.id, "2026-10-05"));
  assert.equal(kutilgan, 900_000, "kun yakunida ham qolishi kerak");

  const kunlar = await A(async () => dashboard.getDailyDynamics(T.business.id, "2026-10"));
  assert.equal(kunlar.find((k: any) => k.date === "2026-10-05")?.kirim, 900_000);
});

test("oddiy naqd kirim esa avvalgidek hisoblanadi (regressiya)", async () => {
  const { createTransaction } = await import("@/lib/services/transactionService");
  const cat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: T.business.id, turi: "kirim" } })
  );
  await A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi: "kirim",
      categoryId: cat.id,
      summa: 1_200_000,
      sana: "2026-09-11",
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
    })
  );

  const oy = await jamlar("2026-09-01", "2026-09-30");
  assert.equal(oy.totals.jamiKirim, 1_200_000);
  assert.equal(oy.totals.naqdKirim, 1_200_000);
  assert.equal(oy.totals.sof, 1_200_000);

  const xulosa = await A(async () => dashboard.getMonthSummary(T.business.id, "2026-09"));
  assert.equal(xulosa.jamiKirim, 1_200_000);
});

// ---------------------------------------------------------------------------
// Dashboard ko'rsatkichlari
// ---------------------------------------------------------------------------

test("qarz dashboardi ochiq qarz va muddati o'tganlarni to'g'ri sanaydi", async () => {
  const d = await A(async () => qarzQ.getQarzDashboard(T.business.id));
  // Ochiq: "Vali Aliyev" 1 mln + "Qisman to'lagan" 600 ming = 1.6 mln.
  assert.equal(d.ochiqJami, 1_600_000);
  assert.equal(d.mijozlarSoni, 2);
  assert.equal(d.beriladiganJami, 0);
});
