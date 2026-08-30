/**
 * XODIM PLANI VA VAZIFALARI TESTLARI (Xodimlar bo'limi kengaytmasi).
 *
 * Qamrov: plan upsert (bir xodim + bir oy = bitta yozuv), oylar tarixi
 * buzilmasligi, foiz hisobi (100% dan oshishi ham), zakaz/savdo/kirim
 * natijalarining kirim tranzaksiyalaridan hisoblanishi (qarz to'lovi
 * chiqariladi — double counting yo'q), vazifa plani, kechikkan vazifa,
 * masulId ko'prigi, oddiy xodimning faqat-o'zi cheklovi, tenant
 * izolyatsiyasi, rasmUrl validatsiyasi va dashboard jamlari.
 *
 * Ishga tushirish: npm run test:xodim-plan
 */
process.env.DATABASE_URL = "file:./prisma/test-xodim-plan.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let txSvc: any;
let hr: any;
let planSvc: any;
let vazifaSvc: any;
let planQ: any;

let tA: any;
let tB: any;
let kat: any;
let aziz: any; // SELLER, xodimga bog'langan user
let azizX: any; // Employee (userId = aziz)
let dizayner: any; // Employee, userga bog'lanmagan

/** Tranzaksiyalar yoziladigan sobit oy (o'tgan oy — joriy sanaga bog'liq emas). */
const OY = "2026-07";

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tA.tenant.id, fn);
const B = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tB.tenant.id, fn);

before(async () => {
  rmSync("prisma/test-xodim-plan.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  txSvc = await import("@/lib/services/transactionService");
  hr = await import("@/lib/services/hr");
  planSvc = await import("@/lib/services/xodimPlan");
  vazifaSvc = await import("@/lib/services/xodimVazifa");
  planQ = await import("@/lib/queries/xodimPlan");

  tA = await createTenantWithOwner({ kompaniyaNomi: "Plan A", ism: "Direktor", login: "+998946666601", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "Plan B", ism: "B Direktor", login: "+998946666602", parol: "parol12345" });

  kat = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "Gullar", turi: "kirim" },
  });
  aziz = await rawPrisma.user.create({
    data: { ism: "Aziz", login: "xp_aziz", parolHash: "x", rol: "SELLER", tenantId: tA.tenant.id, businessId: tA.business.id },
  });

  azizX = await A(() =>
    hr.createEmployee(tA.business.id, {
      ism: "Aziz", lavozim: "Sotuvchi", stavka: 4_000_000, stavkaTuri: "oylik", userId: aziz.id,
    })
  );
  dizayner = await A(() =>
    hr.createEmployee(tA.business.id, {
      ism: "Dizayner", lavozim: "Dizayner", stavka: 3_000_000, stavkaTuri: "oylik",
    })
  );
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Rasm ----------

test("xodim rasmi: https havola saqlanadi, noto'g'ri havola rad etiladi", async () => {
  const x = await A(() =>
    hr.updateEmployee(tA.business.id, azizX.id, { rasmUrl: "https://misol.uz/aziz.jpg" })
  );
  assert.equal(x.rasmUrl, "https://misol.uz/aziz.jpg");

  await assert.rejects(
    A(() => hr.updateEmployee(tA.business.id, azizX.id, { rasmUrl: "javascript:alert(1)" })),
    /http/
  );

  const tozalandi = await A(() => hr.updateEmployee(tA.business.id, azizX.id, { rasmUrl: null }));
  assert.equal(tozalandi.rasmUrl, null);
});

// ---------- Plan CRUD ----------

test("plan upsert: bir xodim + bir oy = bitta yozuv, qayta kiritish ustiga yozadi", async () => {
  await A(() =>
    planSvc.upsertXodimPlan(tA.business.id, tA.user.id, {
      employeeId: azizX.id, oy: OY, planTuri: "zakaz", maqsad: 10,
    })
  );
  await A(() =>
    planSvc.upsertXodimPlan(tA.business.id, tA.user.id, {
      employeeId: azizX.id, oy: OY, planTuri: "zakaz", maqsad: 4,
    })
  );
  const soni = await rawPrisma.employeePlan.count({
    where: { businessId: tA.business.id, employeeId: azizX.id, oy: OY },
  });
  assert.equal(soni, 1, "bitta oyga bitta yozuv");
  const yozuv = await rawPrisma.employeePlan.findFirst({
    where: { employeeId: azizX.id, oy: OY },
  });
  assert.equal(yozuv.maqsad, 4);
});

test("har oy plani alohida: boshqa oy plani yangi yozuv ochadi, eskisi turadi", async () => {
  await A(() =>
    planSvc.upsertXodimPlan(tA.business.id, tA.user.id, {
      employeeId: azizX.id, oy: "2026-06", planTuri: "zakaz", maqsad: 2,
    })
  );
  const soni = await rawPrisma.employeePlan.count({
    where: { businessId: tA.business.id, employeeId: azizX.id },
  });
  assert.equal(soni, 2);
});

test("begona biznes xodimiga plan yozib bo'lmaydi (tenant izolyatsiyasi)", async () => {
  await assert.rejects(
    B(() =>
      planSvc.upsertXodimPlan(tB.business.id, tB.user.id, {
        employeeId: azizX.id, oy: OY, planTuri: "zakaz", maqsad: 5,
      })
    ),
    /topilmadi/
  );
});

// ---------- Zakaz/savdo/kirim manbalari ----------

test("zakaz/savdo/kirim natijalari kirim yozuvlaridan hisoblanadi, qarz to'lovi chiqariladi", async () => {
  // 2 ta naqd + 1 ta qarzga savdo (hammasi Azizga biriktiriladi).
  await A(() => txSvc.createTransaction(aziz.id, tA.business.id, {
    turi: "kirim", categoryId: kat.id, summa: 1_000_000, sana: "2026-07-05", tolovTuri: "naqd",
  }));
  await A(() => txSvc.createTransaction(aziz.id, tA.business.id, {
    turi: "kirim", categoryId: kat.id, summa: 500_000, sana: "2026-07-10", tolovTuri: "naqd",
  }));
  await A(() => txSvc.createTransaction(aziz.id, tA.business.id, {
    turi: "kirim", categoryId: kat.id, summa: 2_000_000, sana: "2026-07-15", tolovTuri: "qarz",
  }));

  // Qarz to'lovi yozuvi (alohida kirim tx + DebtPayment bog'lanishi).
  const tolovTx = await A(() => txSvc.createTransaction(aziz.id, tA.business.id, {
    turi: "kirim", categoryId: kat.id, summa: 800_000, sana: "2026-07-20", tolovTuri: "naqd",
  }));
  const qarz = await rawPrisma.debt.create({
    data: {
      businessId: tA.business.id, mijozNomi: "Karim", jamiSumma: 2_000_000,
      tolangan: 800_000, userId: aziz.id, turi: "olinadigan",
    },
  });
  await rawPrisma.debtPayment.create({
    data: {
      debtId: qarz.id, businessId: tA.business.id, summa: 800_000,
      userId: aziz.id, transactionId: tolovTx.id,
    },
  });

  const perf = await A(() => planQ.getXodimlarPerformance(tA.business.id, OY));
  const azizPerf = perf.xodimlar.find((x: any) => x.id === azizX.id);

  // Zakaz: 3 (to'lov yozuvi zakaz EMAS); savdo: 3.5 mln (qarzga savdo kiradi).
  assert.equal(azizPerf.zakazlar, 3);
  assert.equal(azizPerf.savdo, 3_500_000);
  // Kirim (kelgan pul): 1.0 + 0.5 + 0.8 (to'lov) = 2.3 mln; qarzga savdo kirmaydi.
  assert.equal(azizPerf.plan.planTuri, "zakaz");

  const kirimPlan = await A(() =>
    planSvc.upsertXodimPlan(tA.business.id, tA.user.id, {
      employeeId: azizX.id, oy: OY, planTuri: "kirim", maqsad: 2_300_000,
    })
  );
  const perf2 = await A(() => planQ.getXodimlarPerformance(tA.business.id, OY));
  const azizPerf2 = perf2.xodimlar.find((x: any) => x.id === azizX.id);
  assert.equal(azizPerf2.plan.natija, 2_300_000);
  assert.equal(azizPerf2.plan.foiz, 100);

  // Keyingi testlar uchun zakaz planiga qaytariladi (maqsad 4 → 75%).
  await A(() =>
    planSvc.upsertXodimPlan(tA.business.id, tA.user.id, {
      employeeId: azizX.id, oy: OY, planTuri: "zakaz", maqsad: 4,
    })
  );
  assert.ok(kirimPlan.id);
});

test("foiz to'g'ri hisoblanadi va 100% dan oshadi", async () => {
  const perf = await A(() => planQ.getXodimlarPerformance(tA.business.id, OY));
  const azizPerf = perf.xodimlar.find((x: any) => x.id === azizX.id);
  assert.equal(azizPerf.plan.foiz, 75, "3/4 = 75%");

  await A(() =>
    planSvc.upsertXodimPlan(tA.business.id, tA.user.id, {
      employeeId: azizX.id, oy: OY, planTuri: "zakaz", maqsad: 2,
    })
  );
  const perf2 = await A(() => planQ.getXodimlarPerformance(tA.business.id, OY));
  const azizPerf2 = perf2.xodimlar.find((x: any) => x.id === azizX.id);
  assert.equal(azizPerf2.plan.foiz, 150, "3/2 = 150% — chegara yo'q");
});

test("savdo summasi plani: natija savdodan olinadi", async () => {
  await A(() =>
    planSvc.upsertXodimPlan(tA.business.id, tA.user.id, {
      employeeId: azizX.id, oy: OY, planTuri: "savdo", maqsad: 7_000_000,
    })
  );
  const perf = await A(() => planQ.getXodimlarPerformance(tA.business.id, OY));
  const azizPerf = perf.xodimlar.find((x: any) => x.id === azizX.id);
  assert.equal(azizPerf.plan.natija, 3_500_000);
  assert.equal(azizPerf.plan.foiz, 50);
});

test("userga bog'lanmagan xodimda zakaz/savdo 0 bo'ladi", async () => {
  const perf = await A(() => planQ.getXodimlarPerformance(tA.business.id, OY));
  const d = perf.xodimlar.find((x: any) => x.id === dizayner.id);
  assert.equal(d.zakazlar, 0);
  assert.equal(d.savdo, 0);
});

// ---------- Vazifalar ----------

test("vazifa yaratish: masulId ko'prigi (userli xodim → user, usersiz → bergan)", async () => {
  const v1 = await A(() =>
    vazifaSvc.createXodimVazifa(tA.business.id, tA.user.id, {
      employeeId: azizX.id, nomi: "5 ta mijoz bilan gaplashish", muhimlik: "yuqori",
    })
  );
  assert.equal(v1.masulId, aziz.id, "userli xodim vazifasi user zimmasida");
  assert.equal(v1.employeeId, azizX.id);

  const v2 = await A(() =>
    vazifaSvc.createXodimVazifa(tA.business.id, tA.user.id, {
      employeeId: dizayner.id, nomi: "Banner dizayni", muhimlik: "orta",
    })
  );
  assert.equal(v2.masulId, tA.user.id, "usersiz xodim vazifasi berganda qoladi");
});

test("vazifa plani: oy ichida bajarilganlar sanaladi, foiz va progress to'g'ri", async () => {
  const joriyOy = new Date().toISOString().slice(0, 7);
  const v = await A(() =>
    vazifaSvc.createXodimVazifa(tA.business.id, tA.user.id, {
      employeeId: dizayner.id, nomi: "Logo yangilash", muhimlik: "past",
    })
  );
  await A(() => vazifaSvc.updateXodimVazifa(tA.business.id, v.id, { holat: "BAJARILDI" }));

  await A(() =>
    planSvc.upsertXodimPlan(tA.business.id, tA.user.id, {
      employeeId: dizayner.id, oy: joriyOy, planTuri: "vazifa", maqsad: 2,
    })
  );
  const perf = await A(() => planQ.getXodimlarPerformance(tA.business.id, joriyOy));
  const d = perf.xodimlar.find((x: any) => x.id === dizayner.id);
  assert.equal(d.plan.natija, 1, "faqat BAJARILDI sanaladi");
  assert.equal(d.plan.foiz, 50);
  assert.equal(d.vazifa.jami, 2, "banner + logo joriy oyga tegishli");
  assert.equal(d.vazifa.bajarildi, 1);
});

test("kechikkan vazifa alohida ko'rinadi, BEKOR jami hisobiga kirmaydi", async () => {
  const joriyOy = new Date().toISOString().slice(0, 7);
  const kech = await A(() =>
    vazifaSvc.createXodimVazifa(tA.business.id, tA.user.id, {
      employeeId: dizayner.id, nomi: "Eski mijozga follow-up", muddat: "2026-01-05",
    })
  );
  const bekor = await A(() =>
    vazifaSvc.createXodimVazifa(tA.business.id, tA.user.id, {
      employeeId: dizayner.id, nomi: "Keraksiz ish",
    })
  );
  await A(() => vazifaSvc.updateXodimVazifa(tA.business.id, bekor.id, { holat: "BEKOR" }));

  const perf = await A(() => planQ.getXodimlarPerformance(tA.business.id, joriyOy));
  const d = perf.xodimlar.find((x: any) => x.id === dizayner.id);
  assert.equal(d.vazifa.kechikkan, 1);

  const royxat = await A(() => vazifaSvc.listXodimVazifalari(tA.business.id, dizayner.id));
  const kechDto = royxat.find((r: any) => r.id === kech.id);
  assert.equal(kechDto.kechikkan, true);
  // Muddati yanvardagi vazifa YANVAR oyiga tegishli (joriy oy jamiga kirmaydi),
  // BEKOR ham kirmaydi — jami avvalgi 2 taligicha qoladi.
  assert.equal(d.vazifa.jami, 2, "o'tgan oy muddatli va BEKOR joriy oy jamiga kirmaydi");
});

test("oddiy xodim faqat o'z vazifasi holatini o'zgartiradi (faqatHolat rejimi)", async () => {
  const v = await A(() =>
    vazifaSvc.createXodimVazifa(tA.business.id, tA.user.id, {
      employeeId: azizX.id, nomi: "3 ta zakazni yopish",
    })
  );
  assert.equal(await A(() => vazifaSvc.vazifaEgasimi(tA.business.id, v.id, aziz.id)), true);
  assert.equal(await A(() => vazifaSvc.vazifaEgasimi(tA.business.id, v.id, tA.user.id)), false);

  const yangilandi = await A(() =>
    vazifaSvc.updateXodimVazifa(
      tA.business.id, v.id, { holat: "BAJARILDI", nomi: "O'zgartirilgan nom" }, true
    )
  );
  assert.equal(yangilandi.holat, "BAJARILDI");
  assert.equal(yangilandi.nomi, "3 ta zakazni yopish", "faqatHolat rejimida nom o'zgarmaydi");
  assert.ok(yangilandi.bajarildiAt);
});

test("begona tenant vazifalarini ko'ra olmaydi va yarata olmaydi", async () => {
  await assert.rejects(
    B(() => vazifaSvc.listXodimVazifalari(tB.business.id, azizX.id)),
    /topilmadi/
  );
  await assert.rejects(
    B(() =>
      vazifaSvc.createXodimVazifa(tB.business.id, tB.user.id, {
        employeeId: azizX.id, nomi: "Begona vazifa",
      })
    ),
    /topilmadi/
  );
});

// ---------- Tarix va dashboard ----------

test("plan tarixi: o'tgan oy foizi keyingi oy plani o'zgarsa buzilmaydi", async () => {
  const tarix = await A(() => planQ.getXodimPlanTarixi(tA.business.id, azizX.id));
  const iyun = tarix.find((r: any) => r.oy === "2026-06");
  const iyul = tarix.find((r: any) => r.oy === OY);
  assert.equal(iyun.maqsad, 2, "iyun plani o'z holicha");
  assert.equal(iyun.natija, 0, "iyunda savdo yo'q");
  assert.equal(iyul.planTuri, "savdo");
  assert.equal(iyul.foiz, 50, "iyul o'z oyi oralig'ida hisoblanadi");
});

test("dashboard jamlari: o'rtacha, 100%+, ortda, eng yaxshi", async () => {
  // Iyulda: Aziz — savdo 50%; Dizaynerga ham iyul plani beriladi (vazifa, 0/1 = 0%).
  await A(() =>
    planSvc.upsertXodimPlan(tA.business.id, tA.user.id, {
      employeeId: dizayner.id, oy: OY, planTuri: "vazifa", maqsad: 1,
    })
  );
  const perf = await A(() => planQ.getXodimlarPerformance(tA.business.id, OY));
  const d = perf.dashboard;
  assert.equal(d.faolXodim, 2);
  assert.equal(d.ortachaFoiz, 25, "(50 + 0) / 2");
  assert.equal(d.bajarganlar, 0);
  assert.equal(d.ortda, 2);
  assert.equal(d.engYaxshi.id, azizX.id);
  assert.equal(d.engYaxshi.foiz, 50);
});

test("boshqa biznes statistikaga aralashmaydi (izolyatsiya)", async () => {
  const perfB = await B(() => planQ.getXodimlarPerformance(tB.business.id, OY));
  assert.equal(perfB.xodimlar.length, 0);
});

test("plan o'chiriladi (faqat o'z biznesiniki)", async () => {
  const plan = await rawPrisma.employeePlan.findFirst({
    where: { employeeId: dizayner.id, oy: OY },
  });
  await assert.rejects(B(() => planSvc.deleteXodimPlan(tB.business.id, plan.id)), /topilmadi/);
  await A(() => planSvc.deleteXodimPlan(tA.business.id, plan.id));
  const qoldi = await rawPrisma.employeePlan.count({ where: { id: plan.id } });
  assert.equal(qoldi, 0);
});

test("jami kirim/chiqim o'zgarmagan (plan moduli pul yozmaydi)", async () => {
  const chiqim = await rawPrisma.transaction.count({
    where: { businessId: tA.business.id, turi: "chiqim" },
  });
  assert.equal(chiqim, 0, "plan/vazifa moduli hech qanday tranzaksiya yozmaydi");
});
