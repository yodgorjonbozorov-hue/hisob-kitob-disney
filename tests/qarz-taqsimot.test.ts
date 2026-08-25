/**
 * QARZ TO'LOVI TAQSIMOTI VA KATEGORIYA ATRIBUTSIYASI.
 *
 * Bu fayl `qarzdorTolov` xizmatini isbotlaydi — bitta to'lov MIJOZNING bir
 * nechta ochiq qarzi ustiga taqsimlanadigan yo'l. Uch invariant tekshiriladi:
 *
 *   1. TAQSIMLASH QOIDASI — eng eski ochiq qarzdan boshlab (FIFO);
 *   2. KATEGORIYA — qarz qaysi kategoriyadan chiqqan bo'lsa, to'lovdan
 *      keladigan KIRIM ham aynan o'sha kategoriyaga tushadi. Bitta 1,2 mln
 *      to'lov uchta turli kategoriyadagi qarzni yopsa, kirim ham uchga
 *      bo'linadi;
 *   3. ACCOUNTING — qarz yaratish kirim EMAS; faqat to'langan summa
 *      "Jami kirim"ga tushadi. Qolgani to'lanmaguncha kirim emas.
 *
 * Ishga tushirish: npm run test:qarz-taqsimot
 */
process.env.DATABASE_URL = "file:./prisma/test-qarz-taqsimot.db";

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
let dashboardQ: any;
let accountsQ: any;
let inventorySvc: any;

let T: any;
let naqdKassa: any;

/** Qarz sanalari — taqsimot AYNAN shu tartibda ketishi kerak. */
const SANA_A = "2026-08-10";
const SANA_B = "2026-08-15";
const SANA_C = "2026-08-20";
const TOLOV_SANA = "2026-08-25";

function A<T2>(fn: () => Promise<T2>): Promise<T2> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

/** Berilgan oydagi kirim/chiqim jamlanmasi. */
function jamlar(from: string, to: string) {
  return A(async () =>
    txQueries.listTransactions({ businessId: T.business.id, from, to, pageSize: 200 })
  );
}

/** Kategoriya bo'yicha kirim kesimi — {nomi: summa}. */
async function kategoriyaKesimi(oy: string): Promise<Record<string, number>> {
  const rows = await A(async () => dashboardQ.getCategoryBreakdown(T.business.id, oy, "kirim"));
  const natija: Record<string, number> = {};
  for (const r of rows) natija[r.nomi] = (natija[r.nomi] ?? 0) + r.summa;
  return natija;
}

/** Bitta qarzdorning ochiq qarzlari — eng eskisidan. */
async function ochiqQarzlar(kalit: string) {
  const t = await A(async () => qarzQ.getQarzdorTafsilot(T.business.id, "olinadigan", kalit));
  return t.ochiqQarzlar;
}

before(async () => {
  rmSync("prisma/test-qarz-taqsimot.db", { force: true });
  rmSync("prisma/test-qarz-taqsimot.db-journal", { force: true });
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
  dashboardQ = await import("@/lib/queries/dashboard");
  accountsQ = await import("@/lib/queries/accounts");
  inventorySvc = await import("@/lib/services/inventory");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Taqsimot test",
    ism: "Direktor",
    login: "+998900000202",
    parol: "parol12345",
  });

  const kassalar = await A(async () => accountsQ.listAccounts(T.business.id));
  naqdKassa = kassalar[0];
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// TEST 34 — uch qarz, bitta to'lov, eng eskisidan taqsimlash
// ---------------------------------------------------------------------------

let yodgorKalit = "";
let katA = "";
let katB = "";
let katC = "";

test("SETUP: Yodgorda uch qarz — 500k + 1 mln + 2 mln = 3,5 mln", async () => {
  katA = await A(async () => inventorySvc.ensureCategory(T.business.id, "Bantik", "kirim"));
  katB = await A(async () =>
    inventorySvc.ensureCategory(T.business.id, "Dekoratsiya", "kirim")
  );
  katC = await A(async () =>
    inventorySvc.ensureCategory(T.business.id, "Hovli bezaklari", "kirim")
  );

  const umumiy = {
    businessId: T.business.id,
    userId: T.user.id,
    turi: "olinadigan" as const,
    mijozNomi: "Yodgor",
    mijozTel: "+998913320008",
  };
  await A(async () =>
    qarzSvc.createQarz({ ...umumiy, jamiSumma: 500_000, sana: SANA_A, categoryId: katA })
  );
  await A(async () =>
    qarzSvc.createQarz({ ...umumiy, jamiSumma: 1_000_000, sana: SANA_B, categoryId: katB })
  );
  await A(async () =>
    qarzSvc.createQarz({ ...umumiy, jamiSumma: 2_000_000, sana: SANA_C, categoryId: katC })
  );

  const qarzdorlar = await A(async () => qarzQ.listQarzdorlar(T.business.id));
  assert.equal(qarzdorlar.length, 1, "uch qarz BITTA qarzdor sifatida ko'rinishi kerak");
  assert.equal(qarzdorlar[0].qarz, 3_500_000);
  assert.equal(qarzdorlar[0].ochiqSoni, 3);
  yodgorKalit = qarzdorlar[0].kalit;

  // ACCOUNTING INVARIANT: 3,5 mln qarz — 0 kirim.
  const oy = await jamlar("2026-08-01", "2026-08-31");
  assert.equal(oy.totals.jamiKirim, 0, "qarzga savdo kirim EMAS");
  const qoldiq = await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));
  assert.equal(qoldiq, 0, "kassaga pul tushmasligi kerak");
});

test("TEST 34: 1,2 mln to'lov eng eski qarzdan boshlab taqsimlanadi", async () => {
  const natija = await A(async () =>
    qarzSvc.qarzdorTolov({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      kalit: yodgorKalit,
      summa: 1_200_000,
      sana: TOLOV_SANA,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      idempotencyKey: "taqsimot-kalit-0001",
    })
  );

  assert.equal(natija.usul, "eng-eski");
  assert.equal(natija.summa, 1_200_000);
  assert.equal(natija.yangiTolov, true);
  assert.equal(natija.bolaklar.length, 2, "1,2 mln ikkita qarzga tegishi kerak");
  assert.equal(natija.yopilganSoni, 1, "faqat A qarzi to'liq yopiladi");
  assert.equal(natija.qolgan, 2_300_000);

  // A → 500k yopildi; B → 700k to'landi, 300k qoldi; C → tegilmadi.
  assert.equal(natija.bolaklar[0].summa, 500_000);
  assert.equal(natija.bolaklar[0].qolgan, 0);
  assert.equal(natija.bolaklar[0].status, "PAID");
  assert.equal(natija.bolaklar[1].summa, 700_000);
  assert.equal(natija.bolaklar[1].qolgan, 300_000);
  assert.equal(natija.bolaklar[1].status, "PARTIALLY_PAID");

  const ochiq = await ochiqQarzlar(yodgorKalit);
  assert.equal(ochiq.length, 2, "A yopilgach ikkita ochiq qarz qoladi");
  assert.equal(ochiq[0].qolgan, 300_000, "B da 300k qolishi kerak");
  assert.equal(ochiq[1].qolgan, 2_000_000, "C ga tegilmagan bo'lishi kerak");

  const qarzdorlar = await A(async () => qarzQ.listQarzdorlar(T.business.id));
  assert.equal(qarzdorlar[0].qarz, 2_300_000);
  assert.equal(qarzdorlar[0].ochiqSoni, 2);
});

test("TEST 10: kirim har qarzning O'Z kategoriyasiga taqsimlanadi", async () => {
  const kesim = await kategoriyaKesimi("2026-08");
  assert.equal(kesim["Bantik"], 500_000, "A qarzi Bantik kategoriyasiga tushishi kerak");
  assert.equal(kesim["Dekoratsiya"], 700_000, "B qarzi Dekoratsiya kategoriyasiga");
  assert.equal(kesim["Hovli bezaklari"], undefined, "C ga to'lov tegmagan");
  assert.equal(
    kesim["Qarz to'lovi"],
    undefined,
    "kategoriyali qarz zaxira 'Qarz to'lovi' ustuniga tushmasligi kerak"
  );
});

test("TEST 9: to'langan summa — AYNAN o'sha summa Jami Kirimga tushadi", async () => {
  const oy = await jamlar("2026-08-01", "2026-08-31");
  assert.equal(oy.totals.jamiKirim, 1_200_000, "faqat to'langan qism kirim");

  // Kirim TO'LOV sanasi bilan yozilgan (qarz berilgan kun emas).
  const berilganKun = await jamlar(SANA_A, SANA_A);
  assert.equal(berilganKun.totals.jamiKirim, 0);
  const tolovKun = await jamlar(TOLOV_SANA, TOLOV_SANA);
  assert.equal(tolovKun.totals.jamiKirim, 1_200_000);

  // Kassa ham aynan shuncha oshdi.
  const qoldiq = await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));
  assert.equal(qoldiq, 1_200_000);

  // Qolgan 2,3 mln hali kirim EMAS.
  const xulosa = await A(async () => dashboardQ.getMonthSummary(T.business.id, "2026-08"));
  assert.equal(xulosa.jamiKirim, 1_200_000);
});

// ---------------------------------------------------------------------------
// TEST 36 — takror bosish
// ---------------------------------------------------------------------------

test("TEST 36: ayni kalit bilan takror yuborilsa ikki marta yozilmaydi", async () => {
  const oldinKirim = (await jamlar("2026-08-01", "2026-08-31")).totals.jamiKirim;
  const oldinQoldiq = await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));
  const oldinSoni = await A(async () =>
    prisma.debtPayment.count({ where: { businessId: T.business.id } })
  );

  const takror = await A(async () =>
    qarzSvc.qarzdorTolov({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      kalit: yodgorKalit,
      summa: 1_200_000,
      sana: TOLOV_SANA,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      idempotencyKey: "taqsimot-kalit-0001",
    })
  );

  assert.equal(takror.yangiTolov, false, "takror so'rov yangi to'lov yozmasligi kerak");
  assert.equal(takror.summa, 1_200_000, "mavjud to'lov qaytariladi");

  const keyinKirim = (await jamlar("2026-08-01", "2026-08-31")).totals.jamiKirim;
  assert.equal(keyinKirim, oldinKirim, "Jami Kirim ikki marta oshmasligi kerak");
  const keyinQoldiq = await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));
  assert.equal(keyinQoldiq, oldinQoldiq, "kassa ikki marta oshmasligi kerak");
  const keyinSoni = await A(async () =>
    prisma.debtPayment.count({ where: { businessId: T.business.id } })
  );
  assert.equal(keyinSoni, oldinSoni, "yangi to'lov yozuvi paydo bo'lmasligi kerak");

  const qarzdorlar = await A(async () => qarzQ.listQarzdorlar(T.business.id));
  assert.equal(qarzdorlar[0].qarz, 2_300_000, "qarz ikki marta kamaymasligi kerak");
});

test("takror so'rov TO'LIQ yopilgan qarzdan keyin ham ikkinchi to'lov yozmaydi", async () => {
  // Kalit taqsimotdan OLDIN tekshirilishining sababi shu holat: birinchi
  // so'rov A va B ni to'liq yopib qo'ysa, ikkinchi so'rov ochiq qarzlarni
  // qaytadan o'qib C ga yozib yuborardi.
  const kalit = "aniq-yopilish-kaliti-01";
  await A(async () =>
    qarzSvc.qarzdorTolov({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      kalit: yodgorKalit,
      summa: 300_000, // B ni AYNAN yopadi
      sana: TOLOV_SANA,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      idempotencyKey: kalit,
    })
  );
  const oldinQarz = (await A(async () => qarzQ.listQarzdorlar(T.business.id)))[0].qarz;
  assert.equal(oldinQarz, 2_000_000, "B yopilgach faqat C qoladi");

  const takror = await A(async () =>
    qarzSvc.qarzdorTolov({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      kalit: yodgorKalit,
      summa: 300_000,
      sana: TOLOV_SANA,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      idempotencyKey: kalit,
    })
  );
  assert.equal(takror.yangiTolov, false);
  const keyinQarz = (await A(async () => qarzQ.listQarzdorlar(T.business.id)))[0].qarz;
  assert.equal(keyinQarz, 2_000_000, "C ga xato to'lov yozilmasligi kerak");
});

// ---------------------------------------------------------------------------
// TEST 22 — overpayment jim qabul qilinmaydi
// ---------------------------------------------------------------------------

test("TEST 22: jami qarzdan ortiq to'lov aniq xato bilan rad etiladi", async () => {
  await assert.rejects(
    () =>
      A(async () =>
        qarzSvc.qarzdorTolov({
          businessId: T.business.id,
          userId: T.user.id,
          turi: "olinadigan",
          kalit: yodgorKalit,
          summa: 5_000_000, // qoldiq 2 mln
          sana: TOLOV_SANA,
          tolovTuri: "naqd",
        })
      ),
    /jami qarzidan ko'p/,
    "ortiqcha to'lov jimgina qabul qilinmasligi kerak"
  );

  for (const yomon of [0, -100_000, 1500.5]) {
    await assert.rejects(
      () =>
        A(async () =>
          qarzSvc.qarzdorTolov({
            businessId: T.business.id,
            userId: T.user.id,
            turi: "olinadigan",
            kalit: yodgorKalit,
            summa: yomon,
            sana: TOLOV_SANA,
          })
        ),
      `${yomon} summa rad etilishi kerak`
    );
  }
});

// ---------------------------------------------------------------------------
// Qo'lda taqsimlash
// ---------------------------------------------------------------------------

test("qo'lda taqsimlash: xodim qaysi qarzga qancha yozilishini o'zi tanlaydi", async () => {
  const umumiy = {
    businessId: T.business.id,
    userId: T.user.id,
    turi: "olinadigan" as const,
    mijozNomi: "Sardor",
    mijozTel: "+998913320009",
  };
  await A(async () =>
    qarzSvc.createQarz({ ...umumiy, jamiSumma: 400_000, sana: SANA_A, categoryId: katA })
  );
  await A(async () =>
    qarzSvc.createQarz({ ...umumiy, jamiSumma: 600_000, sana: SANA_C, categoryId: katC })
  );
  const sardor = (await A(async () => qarzQ.listQarzdorlar(T.business.id))).find(
    (q: any) => q.ism === "Sardor"
  );
  const ochiq = await ochiqQarzlar(sardor.kalit);
  const yangiroq = ochiq.find((q: any) => q.jamiSumma === 600_000);

  // Eng eski A(400k) turgan bo'lsa ham, pul AYNAN yangi qarzga yoziladi.
  const natija = await A(async () =>
    qarzSvc.qarzdorTolov({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      kalit: sardor.kalit,
      summa: 600_000,
      sana: TOLOV_SANA,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      taqsimot: [{ debtId: yangiroq.id, summa: 600_000 }],
      idempotencyKey: "qolda-taqsimot-0001",
    })
  );
  assert.equal(natija.usul, "qolda");
  assert.equal(natija.bolaklar.length, 1);
  assert.equal(natija.bolaklar[0].debtId, yangiroq.id);
  assert.equal(natija.bolaklar[0].qolgan, 0);

  const qolgan = await ochiqQarzlar(sardor.kalit);
  assert.equal(qolgan.length, 1);
  assert.equal(qolgan[0].qolgan, 400_000, "eski qarz tegilmagan qolishi kerak");

  // Kirim Hovli bezaklari kategoriyasiga tushdi (yangi qarzning kategoriyasi).
  const kesim = await kategoriyaKesimi("2026-08");
  assert.equal(kesim["Hovli bezaklari"], 600_000);
});

test("qo'lda taqsimot yig'indisi summaga teng bo'lmasa rad etiladi", async () => {
  const sardor = (await A(async () => qarzQ.listQarzdorlar(T.business.id))).find(
    (q: any) => q.ism === "Sardor"
  );
  const ochiq = await ochiqQarzlar(sardor.kalit);
  await assert.rejects(
    () =>
      A(async () =>
        qarzSvc.qarzdorTolov({
          businessId: T.business.id,
          userId: T.user.id,
          turi: "olinadigan",
          kalit: sardor.kalit,
          summa: 400_000,
          taqsimot: [{ debtId: ochiq[0].id, summa: 300_000 }],
        })
      ),
    /yig'indisi/,
    "pul yo'qoladigan taqsimot o'tmasligi kerak"
  );
});

// ---------------------------------------------------------------------------
// TEST 35 — "Men qarzdorman" alohida oqim
// ---------------------------------------------------------------------------

test("TEST 35: ta'minotchiga to'lov CHIQIM bo'ladi, Jami Kirimga tushmaydi", async () => {
  const oldin = await jamlar("2026-08-01", "2026-08-31");

  await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "beriladigan",
      mijozNomi: "Ta'minotchi MChJ",
      jamiSumma: 3_000_000,
      sana: SANA_A,
    })
  );
  const kreditor = (await A(async () => qarzQ.listQarzdorlar(T.business.id))).find(
    (q: any) => q.turi === "beriladigan"
  );
  assert.equal(kreditor.qarz, 3_000_000);

  const natija = await A(async () =>
    qarzSvc.qarzdorTolov({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "beriladigan",
      kalit: kreditor.kalit,
      summa: 1_000_000,
      sana: TOLOV_SANA,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      idempotencyKey: "taminotchi-kalit-001",
    })
  );
  assert.equal(natija.qolgan, 2_000_000, "ta'minotchi qarzi 3 mln → 2 mln");

  const keyin = await jamlar("2026-08-01", "2026-08-31");
  assert.equal(keyin.totals.jamiKirim, oldin.totals.jamiKirim, "bu to'lov KIRIM emas");
  assert.equal(
    keyin.totals.jamiChiqim,
    oldin.totals.jamiChiqim + 1_000_000,
    "Jami Chiqim 1 mln oshishi kerak"
  );

  const txn = await A(async () =>
    prisma.transaction.findUnique({
      where: { id: natija.bolaklar[0].transactionId },
      include: { category: true },
    })
  );
  assert.equal(txn.turi, "chiqim");
  assert.equal(txn.category.nomi, "Qarz to'lash");
  assert.equal(txn.category.turi, "chiqim");
});

test("TEST 26: 'menga qarzdor' va 'men qarzdorman' jamlari aralashmaydi", async () => {
  const jamlari = await A(async () => qarzQ.getQarzJamlari(T.business.id));
  assert.equal(jamlari.beriladigan, 2_000_000, "biznes majburiyati alohida");
  assert.equal(
    jamlari.olinadigan,
    2_400_000,
    "Yodgor 2 mln + Sardor 400k — kreditor qarzi bunga qo'shilmaydi"
  );
  assert.equal(jamlari.sof, 400_000, "sof = olinadigan − beriladigan");
});

// ---------------------------------------------------------------------------
// Tenant izolyatsiyasi
// ---------------------------------------------------------------------------

test("boshqa tenantning qarzdoriga to'lov qilib bo'lmaydi", async () => {
  const B = await createTenantWithOwner({
    kompaniyaNomi: "Begona",
    ism: "Begona egasi",
    login: "+998900000203",
    parol: "parol12345",
  });

  // B tenanti A ning biznes IDsi bilan to'lov qilishga urinadi.
  await assert.rejects(
    () =>
      runWithTenant(
        B.tenant.id,
        async () =>
          qarzSvc.qarzdorTolov({
            businessId: T.business.id,
            userId: B.user.id,
            turi: "olinadigan",
            kalit: yodgorKalit,
            summa: 100_000,
          }),
        { userId: B.user.id, ism: "Begona egasi" }
      ),
    /tegishli emas/,
    "begona biznesga to'lov o'tmasligi kerak"
  );

  // A ning qarzi o'zgarmagan.
  const qarzdorlar = await A(async () => qarzQ.listQarzdorlar(T.business.id));
  const yodgor = qarzdorlar.find((q: any) => q.ism === "Yodgor");
  assert.equal(yodgor.qarz, 2_000_000);
});

// ---------------------------------------------------------------------------
// YAKUNIY INVARIANT — qarz to'liq yopilgach tarix saqlanadi
// ---------------------------------------------------------------------------

test("TEST 11: qarz to'liq yopilganda yozuv o'chmaydi, tarix saqlanadi", async () => {
  await A(async () =>
    qarzSvc.qarzdorTolov({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      kalit: yodgorKalit,
      summa: 2_000_000,
      sana: TOLOV_SANA,
      tolovTuri: "click",
      idempotencyKey: "yakuniy-tolov-kalit-1",
    })
  );

  const qarzdorlar = await A(async () => qarzQ.listQarzdorlar(T.business.id));
  assert.equal(
    qarzdorlar.find((q: any) => q.ism === "Yodgor"),
    undefined,
    "qarzi qolmagan mijoz ochiq qarzdorlar ro'yxatidan chiqadi"
  );

  // Lekin yozuvlar joyida — tarix o'chirilmaydi.
  const tafsilot = await A(async () =>
    qarzQ.getQarzdorTafsilot(T.business.id, "olinadigan", yodgorKalit)
  );
  assert.equal(tafsilot.jamiBerilgan, 3_500_000, "original summalar saqlanadi");
  assert.equal(tafsilot.jamiTolangan, 3_500_000);
  assert.equal(tafsilot.jamiQarz, 0);
  assert.equal(tafsilot.ochiqQarzlar.length, 0);

  const qarzlar = await A(async () =>
    prisma.debt.findMany({ where: { businessId: T.business.id, mijozNomi: "Yodgor" } })
  );
  assert.equal(qarzlar.length, 3, "uch qarz yozuvi ham saqlanib qolishi kerak");
  for (const q of qarzlar) {
    assert.equal(q.status, "PAID");
    assert.equal(q.isYopilgan, true);
    assert.equal(q.tolangan, q.jamiSumma);
  }

  // YAKUNIY ACCOUNTING: 3,5 mln qarz → 3,5 mln kirim, ortiqchasi yo'q.
  const kesim = await kategoriyaKesimi("2026-08");
  assert.equal(kesim["Bantik"], 500_000);
  assert.equal(kesim["Dekoratsiya"], 1_000_000);
  assert.equal(kesim["Hovli bezaklari"], 2_600_000, "Yodgor 2 mln + Sardor 600k");
  const jamiKirim = Object.values(kesim).reduce((a, b) => a + b, 0);
  assert.equal(jamiKirim, 4_100_000, "3,5 mln (Yodgor) + 600k (Sardor)");
});
