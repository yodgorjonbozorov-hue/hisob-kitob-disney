/**
 * BOSHQARUV PANELI TESTLARI (/app).
 *
 * Panel yangilanganda qo'shilgan hisob-kitoblar shu yerda qamrab olinadi:
 * kassa qoldig'i, pul oqimi seriyasi, bugungi holat, "diqqat talab qiladi"
 * ogohlantirishlari va deterministik insight dvigateli.
 *
 * Har testda IKKI TENANT bor va B tenantda ataylab BOSHQA (kattaroq)
 * summalar turadi — izolyatsiya buzilsa raqam darhol o'zgaradi.
 *
 * Ishga tushirish: npm run test:panel
 */
process.env.DATABASE_URL = "file:./prisma/test-panel.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let panel: any;
let dashboard: any;
let qarz: any;
let insight: any;
let sana: any;

const TA = "t_pn_a";
const TB = "t_pn_b";
const BIZ_A = "biz_pn_a";
const BIZ_B = "biz_pn_b";
const USER_A = "u_pn_a";
const USER_B = "u_pn_b";

/** Bugun va kecha — Toshkent kuni bo'yicha (panel shu bilan ishlaydi). */
let BUGUN = "";
let KECHA = "";
let ERTAGA = "";
/** Bugungi oy va oldingi oy ("YYYY-MM"). */
let OY = "";
let OLDINGI_OY = "";

const KUN_MS = 24 * 60 * 60 * 1000;
const kun = (s: string) => new Date(`${s}T00:00:00.000Z`);
const surish = (s: string, n: number) =>
  new Date(kun(s).getTime() + n * KUN_MS).toISOString().slice(0, 10);

before(async () => {
  rmSync("prisma/test-panel.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  panel = await import("@/lib/queries/dashboardPanel");
  dashboard = await import("@/lib/queries/dashboard");
  qarz = await import("@/lib/queries/qarz");
  insight = await import("@/lib/services/dashboardInsight");
  sana = await import("@/lib/date");

  BUGUN = sana.todayTashkentDateOnlyString();
  KECHA = surish(BUGUN, -1);
  ERTAGA = surish(BUGUN, 1);
  OY = BUGUN.slice(0, 7);
  OLDINGI_OY = sana.shiftMonthString(OY, -1);

  for (const [t, biz, user, login] of [
    [TA, BIZ_A, USER_A, "pn_a"],
    [TB, BIZ_B, USER_B, "pn_b"],
  ] as const) {
    await rawPrisma.tenant.create({ data: { id: t, name: t, slug: t, status: "ACTIVE" } });
    await rawPrisma.business.create({ data: { id: biz, nomi: biz, tenantId: t, omborli: true } });
    await rawPrisma.user.create({
      data: { id: user, ism: "U", login, parolHash: "x", rol: "OWNER", tenantId: t, businessId: biz },
    });
    await rawPrisma.category.create({
      data: { id: `c_${biz}_k1`, nomi: "Savdo", turi: "kirim", businessId: biz },
    });
    await rawPrisma.category.create({
      data: { id: `c_${biz}_k2`, nomi: "Ijara", turi: "kirim", businessId: biz },
    });
    await rawPrisma.category.create({
      data: { id: `c_${biz}_c1`, nomi: "Oylik", turi: "chiqim", businessId: biz },
    });
    // Naqd va plastik kassa — "Kassada" kartasining turlar kesimi uchun.
    await rawPrisma.account.create({
      data: { id: `a_${biz}_naqd`, businessId: biz, nomi: "Naqd", turi: "naqd" },
    });
    await rawPrisma.account.create({
      data: { id: `a_${biz}_plastik`, businessId: biz, nomi: "Plastik", turi: "plastik" },
    });
  }

  const yoz = (
    biz: string,
    user: string,
    turi: "kirim" | "chiqim",
    summa: number,
    s: string,
    qoshimcha: Record<string, unknown> = {}
  ) =>
    rawPrisma.transaction.create({
      data: {
        turi,
        categoryId: turi === "kirim" ? `c_${biz}_k1` : `c_${biz}_c1`,
        businessId: biz,
        summa,
        sana: kun(s),
        userId: user,
        accountId: `a_${biz}_naqd`,
        ...qoshimcha,
      },
    });

  // --- A tenant, JORIY OY -------------------------------------------------
  // Bugun: 5 mln kirim (naqd) + 2 mln kirim (plastik kassa) − 3 mln chiqim.
  await yoz(BIZ_A, USER_A, "kirim", 5_000_000, BUGUN);
  await yoz(BIZ_A, USER_A, "kirim", 2_000_000, BUGUN, { accountId: `a_${BIZ_A}_plastik` });
  await yoz(BIZ_A, USER_A, "chiqim", 3_000_000, BUGUN);
  // Kecha: 1 mln kirim (Ijara kategoriyasi).
  await yoz(BIZ_A, USER_A, "kirim", 1_000_000, KECHA, { categoryId: `c_${BIZ_A}_k2` });
  // Qarzga yozilgan kirim — PUL EMAS, hech qaysi jamiga kirmasligi shart.
  // `accountId: null` — bu ISHLAB CHIQARISHDAGI holat: `createTransaction`
  // qarz yozuvini hech qaysi kassaga bog'lamaydi (lib/services/transactionService.ts).
  await yoz(BIZ_A, USER_A, "kirim", 90_000_000, BUGUN, { tolovTuri: "qarz", accountId: null });
  // Yumshoq o'chirilgan yozuv — u ham hech qayerda ko'rinmasligi kerak.
  const ochirilgan = await yoz(BIZ_A, USER_A, "kirim", 70_000_000, BUGUN);
  await rawPrisma.transaction.update({
    where: { id: ochirilgan.id },
    data: { deletedAt: new Date() },
  });

  // --- A tenant, OLDINGI OY (taqqoslash uchun) ----------------------------
  await yoz(BIZ_A, USER_A, "kirim", 4_000_000, `${OLDINGI_OY}-15`);
  await yoz(BIZ_A, USER_A, "chiqim", 1_000_000, `${OLDINGI_OY}-16`);

  // --- B tenant: ataylab boshqa (katta) summalar --------------------------
  await yoz(BIZ_B, USER_B, "kirim", 888_000_000, BUGUN);
  await yoz(BIZ_B, USER_B, "chiqim", 111_000_000, BUGUN);

  // --- Kassalararo o'tkazma: naqddan plastikka 1 mln (bajarildi) ----------
  await rawPrisma.accountTransfer.create({
    data: {
      businessId: BIZ_A,
      fromAccountId: `a_${BIZ_A}_naqd`,
      toAccountId: `a_${BIZ_A}_plastik`,
      summa: 1_000_000,
      sana: kun(BUGUN),
      userId: USER_A,
      holat: "bajarildi",
    },
  });
  // Qabul qilinmagan o'tkazma — "diqqat" ogohlantirishi (qoldiqqa kirmaydi).
  await rawPrisma.accountTransfer.create({
    data: {
      businessId: BIZ_A,
      fromAccountId: `a_${BIZ_A}_naqd`,
      toAccountId: `a_${BIZ_A}_plastik`,
      summa: 300_000,
      sana: kun(BUGUN),
      userId: USER_A,
      holat: "kutilmoqda",
    },
  });

  // --- Qarzlar ------------------------------------------------------------
  // Muddati o'tgan (menga qarzdor): 2 mln, 500 ming to'langan.
  await rawPrisma.debt.create({
    data: {
      businessId: BIZ_A,
      turi: "olinadigan",
      mijozNomi: "Aziz",
      jamiSumma: 2_000_000,
      tolangan: 500_000,
      sana: kun(surish(BUGUN, -40)),
      muddat: kun(surish(BUGUN, -10)),
      userId: USER_A,
    },
  });
  // Bugun yozilgan qarz — "Bugungi holat" dagi qator.
  await rawPrisma.debt.create({
    data: {
      businessId: BIZ_A,
      turi: "olinadigan",
      mijozNomi: "Bekzod",
      jamiSumma: 800_000,
      sana: kun(BUGUN),
      userId: USER_A,
    },
  });
  // Yopilgan qarz — jamiga ham, ogohlantirishga ham KIRMAYDI.
  await rawPrisma.debt.create({
    data: {
      businessId: BIZ_A,
      turi: "olinadigan",
      mijozNomi: "Dilshod",
      jamiSumma: 5_000_000,
      tolangan: 5_000_000,
      isYopilgan: true,
      status: "PAID",
      sana: kun(KECHA),
      muddat: kun(surish(BUGUN, -5)),
      userId: USER_A,
    },
  });
  await rawPrisma.debt.create({
    data: {
      businessId: BIZ_B,
      turi: "olinadigan",
      mijozNomi: "Boshqa tenant",
      jamiSumma: 999_000_000,
      sana: kun(BUGUN),
      muddat: kun(surish(BUGUN, -3)),
      userId: USER_B,
    },
  });

  // --- CRM ----------------------------------------------------------------
  await rawPrisma.stage.createMany({
    data: [
      { id: `st_${BIZ_A}_open`, businessId: BIZ_A, nomi: "Yangi", turi: "OPEN", tartib: 0 },
      { id: `st_${BIZ_A}_won`, businessId: BIZ_A, nomi: "Yutildi", turi: "WON", tartib: 1 },
    ],
  });
  // Bugun kelgan buyurtma, muddati BUGUN va hali ochiq — follow-up alerti.
  await rawPrisma.deal.create({
    data: {
      businessId: BIZ_A,
      nomi: "Buyurtma 1",
      summa: 1_500_000,
      stageId: `st_${BIZ_A}_open`,
      masulId: USER_A,
      sana: kun(BUGUN),
      muddat: kun(BUGUN),
    },
  });
  // Bugun yutilgan buyurtma (kecha kelgan) — "yangi" ga kirmaydi, "yutilgan" ga kiradi.
  await rawPrisma.deal.create({
    data: {
      businessId: BIZ_A,
      nomi: "Buyurtma 2",
      summa: 3_000_000,
      stageId: `st_${BIZ_A}_won`,
      masulId: USER_A,
      sana: kun(KECHA),
      yopilganAt: kun(BUGUN),
    },
  });

  // --- Vazifalar ----------------------------------------------------------
  await rawPrisma.task.create({
    data: {
      businessId: BIZ_A,
      nomi: "Muddati o'tgan vazifa",
      holat: "OCHIQ",
      masulId: USER_A,
      createdBy: USER_A,
      muddat: kun(surish(BUGUN, -2)),
    },
  });
  await rawPrisma.task.create({
    data: {
      businessId: BIZ_A,
      nomi: "Bajarilgan vazifa",
      holat: "BAJARILDI",
      masulId: USER_A,
      createdBy: USER_A,
      muddat: kun(surish(BUGUN, -3)),
    },
  });

  // --- Ombor --------------------------------------------------------------
  // Tugagan mahsulot (chegara qo'yilmagan bo'lsa ham aniq holat).
  await rawPrisma.product.create({
    data: { businessId: BIZ_A, nomi: "Tugagan", miqdor: 0, minQoldiq: 0, birlik: "dona" },
  });
  // Chegarasi qo'yilgan va undan kam qolgan mahsulot.
  await rawPrisma.product.create({
    data: { businessId: BIZ_A, nomi: "Kam qolgan", miqdor: 2, minQoldiq: 5, birlik: "dona" },
  });
  // Chegara QO'YILMAGAN va qoldiq kichik — bu ogohlantirish BERMAYDI
  // (sobit "5 dona" chegarasi o'ylab topilmaydi).
  await rawPrisma.product.create({
    data: { businessId: BIZ_A, nomi: "Chegarasiz", miqdor: 3, minQoldiq: 0, birlik: "dona" },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// KPI: kirim / chiqim / sof foyda / oldingi davr
// ---------------------------------------------------------------------------

test("KPI: jami kirim, chiqim va sof foyda qarzsiz va o'chirilmaganlardan hisoblanadi", async () => {
  const s = await runWithTenant(TA, () => dashboard.getMonthSummary(BIZ_A, OY));
  assert.equal(s.jamiKirim, 8_000_000, "qarz (90 mln) va o'chirilgan (70 mln) kirmasligi kerak");
  assert.equal(s.jamiChiqim, 3_000_000);
  assert.equal(s.sofFoyda, 5_000_000);
});

test("KPI: oldingi davr bilan taqqoslash foizi to'g'ri", async () => {
  const s = await runWithTenant(TA, () => dashboard.getMonthSummary(BIZ_A, OY));
  assert.equal(s.prevMonth.jamiKirim, 4_000_000);
  assert.equal(s.prevMonth.sofFoyda, 3_000_000);
  // 4 mln -> 8 mln = +100%
  assert.equal(Math.round(s.changePct.kirim), 100);
  // 1 mln -> 3 mln = +200%
  assert.equal(Math.round(s.changePct.chiqim), 200);
  // 3 mln -> 5 mln = +66.7%
  assert.equal(Math.round(s.changePct.sofFoyda), 67);
});

// ---------------------------------------------------------------------------
// KASSADA
// ---------------------------------------------------------------------------

test("Kassada: joriy qoldiq ledgerdan, tur bo'yicha kesim bilan", async () => {
  const k = await runWithTenant(TA, () => panel.getKassaXulosa(BIZ_A));
  // KASSA QOLDIG'I — BUTUN DAVR, oy kesimi EMAS: joriy oy ham, oldingi oy
  // ham qo'shiladi (karta "joriy holat" ni ko'rsatadi, oylik oqimni emas).
  // Qarzga yozilgan 90 mln kassaga TUSHMAGAN (accountId null), yumshoq
  // o'chirilgan 70 mln esa hech qayerda hisobga olinmaydi.
  //
  // Naqd: 5 (bugun) + 1 (kecha) + 4 (o'tgan oy)
  //       − 3 (bugungi chiqim) − 1 (o'tgan oy chiqimi) − 1 (chiqqan transfer).
  const naqd = k.bolimlar.find((b: any) => b.turi === "naqd");
  const plastik = k.bolimlar.find((b: any) => b.turi === "plastik");
  assert.equal(
    naqd.qoldiq,
    5_000_000 + 1_000_000 + 4_000_000 - 3_000_000 - 1_000_000 - 1_000_000
  );
  assert.equal(plastik.qoldiq, 2_000_000 + 1_000_000, "kirgan transfer qoldiqqa qo'shiladi");
  assert.equal(k.jami, naqd.qoldiq + plastik.qoldiq);
  assert.equal(k.kassaSoni, 2);
  assert.equal(k.bolimlar[0].turi, "naqd", "bo'limlar kamayish tartibida");
});

test("Kassada: boshqa tenant kassasi ko'rinmaydi", async () => {
  const a = await runWithTenant(TA, () => panel.getKassaXulosa(BIZ_A));
  const b = await runWithTenant(TB, () => panel.getKassaXulosa(BIZ_B));
  assert.notEqual(a.jami, b.jami);
  assert.equal(b.jami, 888_000_000 - 111_000_000);
});

test("Kassada: faol bo'lmagan kassa qoldiqqa kirmaydi", async () => {
  await rawPrisma.account.update({
    where: { id: `a_${BIZ_A}_plastik` },
    data: { isActive: false },
  });
  const k = await runWithTenant(TA, () => panel.getKassaXulosa(BIZ_A));
  assert.equal(k.kassaSoni, 1);
  assert.ok(!k.bolimlar.some((b: any) => b.turi === "plastik"));
  await rawPrisma.account.update({
    where: { id: `a_${BIZ_A}_plastik` },
    data: { isActive: true },
  });
});

// ---------------------------------------------------------------------------
// QARZDORLIK
// ---------------------------------------------------------------------------

test("Menga qarzdor: faqat ochiq qarzlar qoldig'i va qarzdorlar soni", async () => {
  const j = await runWithTenant(TA, () => qarz.getQarzJamlari(BIZ_A));
  // (2 000 000 − 500 000) + 800 000; yopilgan 5 mln kirmaydi.
  assert.equal(j.olinadigan, 2_300_000);
  assert.equal(j.olinadiganSoni, 2);
  assert.equal(j.beriladigan, 0);
});

// ---------------------------------------------------------------------------
// PUL OQIMI GRAFIGI
// ---------------------------------------------------------------------------

test("Pul oqimi: kunlik seriya 92 nuqta, bo'sh kunlar ham qoladi", async () => {
  const o = await runWithTenant(TA, () => panel.getPulOqimi(BIZ_A, BUGUN));
  assert.equal(o.kunlik.length, panel.OQIM_KUNLAR);
  assert.equal(o.oylik.length, panel.OQIM_OYLAR);
  assert.equal(o.kunlik[o.kunlik.length - 1].kalit, BUGUN, "oxirgi nuqta — so'ralgan kun");
  assert.equal(o.oylik[o.oylik.length - 1].kalit, OY);
});

test("Pul oqimi: bugungi nuqta kirim/chiqim/sof — qarz va o'chirilgansiz", async () => {
  const o = await runWithTenant(TA, () => panel.getPulOqimi(BIZ_A, BUGUN));
  const bugun = o.kunlik[o.kunlik.length - 1];
  assert.deepEqual(
    { kirim: bugun.kirim, chiqim: bugun.chiqim, sof: bugun.sof },
    { kirim: 7_000_000, chiqim: 3_000_000, sof: 4_000_000 }
  );
  const kecha = o.kunlik[o.kunlik.length - 2];
  assert.deepEqual({ kirim: kecha.kirim, chiqim: kecha.chiqim }, { kirim: 1_000_000, chiqim: 0 });
});

test("Pul oqimi: oylik seriya oy xulosasi bilan mos", async () => {
  const o = await runWithTenant(TA, () => panel.getPulOqimi(BIZ_A, BUGUN));
  const s = await runWithTenant(TA, () => dashboard.getMonthSummary(BIZ_A, OY));
  const joriy = o.oylik[o.oylik.length - 1];
  assert.equal(joriy.kirim, s.jamiKirim, "grafik va KPI bitta raqamni ko'rsatishi shart");
  assert.equal(joriy.chiqim, s.jamiChiqim);
  assert.equal(joriy.sof, s.sofFoyda);
});

test("Pul oqimi: boshqa tenant yozuvlari seriyaga tushmaydi", async () => {
  const a = await runWithTenant(TA, () => panel.getPulOqimi(BIZ_A, BUGUN));
  const b = await runWithTenant(TB, () => panel.getPulOqimi(BIZ_B, BUGUN));
  assert.equal(a.kunlik[a.kunlik.length - 1].kirim, 7_000_000);
  assert.equal(b.kunlik[b.kunlik.length - 1].kirim, 888_000_000);
});

// ---------------------------------------------------------------------------
// TOP 5 KATEGORIYA
// ---------------------------------------------------------------------------

test("Kategoriya taqsimoti kamayish tartibida va foizlari real", async () => {
  const kirimlar = await runWithTenant(TA, () =>
    dashboard.getCategoryBreakdown(BIZ_A, OY, "kirim")
  );
  assert.equal(kirimlar[0].nomi, "Savdo");
  assert.equal(kirimlar[0].summa, 7_000_000);
  assert.equal(kirimlar[1].nomi, "Ijara");
  assert.equal(kirimlar[1].summa, 1_000_000);
  // Foizlar jami 100 ga teng — progress barlar shu qiymatdan chiziladi.
  assert.equal(Math.round(kirimlar.reduce((a: number, c: any) => a + c.foiz, 0)), 100);
  // TOP 5 dan keyin "Barchasini ko'rish" uchun to'liq ro'yxat qaytadi.
  assert.equal(kirimlar.length, 2);
});

// ---------------------------------------------------------------------------
// BUGUNGI HOLAT
// ---------------------------------------------------------------------------

test("Bugungi holat: kirim, chiqim va sof natija", async () => {
  const h = await runWithTenant(TA, () =>
    panel.getBugungiHolat(BIZ_A, BUGUN, { crm: false, qarz: false })
  );
  assert.equal(h.kirim, 7_000_000);
  assert.equal(h.chiqim, 3_000_000);
  assert.equal(h.sof, 4_000_000);
});

test("Bugungi holat: CRM va qarz YOPIQ bo'lsa bloklar null", async () => {
  const h = await runWithTenant(TA, () =>
    panel.getBugungiHolat(BIZ_A, BUGUN, { crm: false, qarz: false })
  );
  assert.equal(h.crm, null);
  assert.equal(h.qarzBugun, null);
});

test("Bugungi holat: CRM va qarz OCHIQ bo'lsa real raqamlar keladi", async () => {
  const h = await runWithTenant(TA, () =>
    panel.getBugungiHolat(BIZ_A, BUGUN, { crm: true, qarz: true })
  );
  assert.equal(h.crm.yangi, 1, "faqat bugun kelgan buyurtma");
  assert.equal(h.crm.yutilgan, 1);
  assert.equal(h.crm.yutilganSumma, 3_000_000);
  assert.equal(h.qarzBugun.soni, 1);
  assert.equal(h.qarzBugun.summa, 800_000);
});

// ---------------------------------------------------------------------------
// DIQQAT TALAB QILADI
// ---------------------------------------------------------------------------

const HAMMASI_OCHIQ = { qarz: true, kassa: true, ombor: true, crm: true, vazifalar: true };

test("Alertlar: muddati o'tgan qarz, o'tkazma, CRM, vazifa va ombor", async () => {
  const a = await runWithTenant(TA, () =>
    panel.getDiqqatAlertlari(BIZ_A, BUGUN, HAMMASI_OCHIQ)
  );
  const kodlar = a.map((x: any) => x.kod);
  assert.ok(kodlar.includes("qarz-muddat"));
  assert.ok(kodlar.includes("kassa-otkazma"));
  assert.ok(kodlar.includes("crm-bugun"));
  assert.ok(kodlar.includes("vazifa-muddat"));
  assert.ok(kodlar.includes("ombor-tugadi"));
  assert.ok(kodlar.includes("ombor-kam"));
  // Yopilgan qarzning muddati o'tgan bo'lsa ham ogohlantirish bermaydi.
  const qarzAlert = a.find((x: any) => x.kod === "qarz-muddat");
  assert.equal(qarzAlert.matn, "1 ta qarz muddati o'tgan");
});

test("Alertlar: chegarasi qo'yilmagan mahsulot 'kam qoldi' bermaydi", async () => {
  const a = await runWithTenant(TA, () =>
    panel.getDiqqatAlertlari(BIZ_A, BUGUN, HAMMASI_OCHIQ)
  );
  const kam = a.find((x: any) => x.kod === "ombor-kam");
  assert.equal(kam.matn, "1 ta mahsulot minimal qoldiqdan kam", "faqat minQoldiq qo'yilgani");
});

test("Alertlar: modul yopiq bo'lsa o'sha ogohlantirish umuman chiqmaydi", async () => {
  const faqatQarz = await runWithTenant(TA, () =>
    panel.getDiqqatAlertlari(BIZ_A, BUGUN, {
      qarz: true,
      kassa: false,
      ombor: false,
      crm: false,
      vazifalar: false,
    })
  );
  assert.deepEqual(faqatQarz.map((x: any) => x.kod), ["qarz-muddat"]);

  const hech = await runWithTenant(TA, () =>
    panel.getDiqqatAlertlari(BIZ_A, BUGUN, {
      qarz: false,
      kassa: false,
      ombor: false,
      crm: false,
      vazifalar: false,
    })
  );
  assert.equal(hech.length, 0, "huquqsiz foydalanuvchi hech qanday alert ko'rmaydi");
});

test("Alertlar: boshqa tenantning muddati o'tgan qarzi ko'rinmaydi", async () => {
  const a = await runWithTenant(TA, () =>
    panel.getDiqqatAlertlari(BIZ_A, BUGUN, HAMMASI_OCHIQ)
  );
  const qarzAlert = a.find((x: any) => x.kod === "qarz-muddat");
  // B tenantda 999 mln muddati o'tgan qarz bor — u yerda ko'rinmasligi shart.
  assert.ok(!qarzAlert.qoshimcha.includes("999"));
  const b = await runWithTenant(TB, () =>
    panel.getDiqqatAlertlari(BIZ_B, BUGUN, HAMMASI_OCHIQ)
  );
  assert.equal(b.find((x: any) => x.kod === "qarz-muddat").matn, "1 ta qarz muddati o'tgan");
});

// ---------------------------------------------------------------------------
// INSIGHT (deterministik, sof funksiya)
// ---------------------------------------------------------------------------

test("Insight: yozuv bo'lmasa xulosa yasalmaydi", () => {
  const bosh = {
    month: "2026-08",
    jamiKirim: 0,
    jamiChiqim: 0,
    sofFoyda: 0,
    prevMonth: { jamiKirim: 0, jamiChiqim: 0, sofFoyda: 0 },
    changePct: { kirim: null, chiqim: null, sofFoyda: null },
  };
  const out = insight.insightlarniHisobla({
    xulosa: bosh,
    kirimKategoriyalar: [],
    chiqimKategoriyalar: [],
  });
  assert.equal(out.length, 0, "bo'sh ma'lumotdan sun'iy xulosa chiqmasligi kerak");
});

test("Insight: kirim pasayishi va eng katta kategoriyalar aniq aytiladi", () => {
  const out = insight.insightlarniHisobla({
    xulosa: {
      month: "2026-08",
      jamiKirim: 78_000_000,
      jamiChiqim: 30_000_000,
      sofFoyda: 48_000_000,
      prevMonth: { jamiKirim: 100_000_000, jamiChiqim: 30_000_000, sofFoyda: 70_000_000 },
      changePct: { kirim: -22, chiqim: 0, sofFoyda: -31.4 },
    },
    kirimKategoriyalar: [
      { categoryId: "1", nomi: "Hovli bezaklari", summa: 49_500_000, foiz: 63.5 },
      { categoryId: "2", nomi: "Ijara", summa: 28_500_000, foiz: 36.5 },
    ],
    chiqimKategoriyalar: [{ categoryId: "3", nomi: "Yodgor", summa: 18_000_000, foiz: 60 }],
  });
  const kodlar = out.map((i: any) => i.kod);
  assert.ok(kodlar.includes("kirim-ozgarish"));
  assert.ok(kodlar.includes("sof-ozgarish"));
  assert.ok(out.length <= insight.INSIGHT_MAKS, "blok ro'yxatga aylanib ketmasligi kerak");
  const kirimMatn = out.find((i: any) => i.kod === "kirim-ozgarish").matn;
  assert.ok(kirimMatn.includes("22.0%"), kirimMatn);
  assert.ok(kirimMatn.includes("kamaygan"), kirimMatn);
  // Chiqim o'zgarmagan (0%) — u haqda xulosa CHIQMASLIGI kerak.
  assert.ok(!kodlar.includes("chiqim-ozgarish"), "shovqin darajasidagi farq aytilmaydi");
});

test("Insight: zarar birinchi o'rinda aytiladi", () => {
  const out = insight.insightlarniHisobla({
    xulosa: {
      month: "2026-08",
      jamiKirim: 10_000_000,
      jamiChiqim: 14_000_000,
      sofFoyda: -4_000_000,
      prevMonth: { jamiKirim: 10_000_000, jamiChiqim: 8_000_000, sofFoyda: 2_000_000 },
      changePct: { kirim: 0, chiqim: 75, sofFoyda: -300 },
    },
    kirimKategoriyalar: [],
    chiqimKategoriyalar: [],
  });
  assert.equal(out[0].kod, "sof-zarar");
  assert.equal(out[0].ton, "salbiy");
});

test("Insight: real KPI'dan hisoblangan xulosa panel raqamlariga mos", async () => {
  const s = await runWithTenant(TA, () => dashboard.getMonthSummary(BIZ_A, OY));
  const kirimlar = await runWithTenant(TA, () =>
    dashboard.getCategoryBreakdown(BIZ_A, OY, "kirim")
  );
  const chiqimlar = await runWithTenant(TA, () =>
    dashboard.getCategoryBreakdown(BIZ_A, OY, "chiqim")
  );
  const out = insight.insightlarniHisobla({
    xulosa: s,
    kirimKategoriyalar: kirimlar,
    chiqimKategoriyalar: chiqimlar,
  });
  const kirimKat = out.find((i: any) => i.kod === "kirim-kategoriya");
  assert.ok(kirimKat.matn.includes("Savdo"), kirimKat.matn);
  assert.ok(kirimKat.matn.includes("7 mln"), kirimKat.matn);
});
