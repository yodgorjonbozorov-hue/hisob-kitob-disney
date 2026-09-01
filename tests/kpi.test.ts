/**
 * XODIMLAR KPI MODULI — INTEGRATSIYA TESTLARI (baza bilan).
 *
 * Qamrov:
 *  · standart to'plamning idempotent seed'i (5 vazifa, presetlar, foizlar);
 *  · SOTUV manbai: to'liq to'langan / qisman to'langan / bekor qilingan
 *    zakazlarning bonusga kirishi qoidasi;
 *  · ball ayirish, KUNLIK LIMIT (server tomonda) va kritik holat istisnosi;
 *  · qaytarish (reversal) — asl yozuv tarixda qoladi, ikki marta qaytarilmaydi;
 *  · ballning FAQAT vazifa haqiga ta'sir qilishi;
 *  · oyni yopish → snapshot → manba o'zgarsa ham raqam siljimasligi;
 *  · TENANT IZOLYATSIYASI: B tenant A tenantning KPI ma'lumotini ko'rmaydi.
 *
 * Ishga tushirish: npm run test:kpi
 */
process.env.DATABASE_URL = "file:./prisma/test-kpi.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let txSvc: any;
let hr: any;
let qarzSvc: any;
let sozlama: any;
let vazifaSvc: any;
let ballSvc: any;
let oylikSvc: any;
let payrollSvc: any;
let sotuvSvc: any;

let tA: any;
let tB: any;
let katA: any;
let aziz: any;
let azizX: any;
let bXodim: any;

/** Sobit oy — joriy sanaga bog'lanmaydi. */
const OY = "2026-07";
const SANA = "2026-07-10";
const mln = (n: number) => n * 1_000_000;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tA.tenant.id, fn);
const B = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tB.tenant.id, fn);

/** Kirim yozuvi — sotuvchi `aziz`, berilgan to'lov turi bilan. */
async function kirim(summa: number, tolovTuri: string, sana = SANA) {
  return A(() =>
    txSvc.createTransaction(aziz.id, tA.business.id, {
      turi: "kirim",
      categoryId: katA.id,
      summa,
      sana,
      tolovTuri,
      sotuvchiId: aziz.id,
    })
  );
}

before(async () => {
  rmSync("prisma/test-kpi.db", { force: true });
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
  qarzSvc = await import("@/lib/services/qarz");
  sozlama = await import("@/lib/kpi/sozlama");
  vazifaSvc = await import("@/lib/kpi/vazifa");
  ballSvc = await import("@/lib/kpi/ball");
  oylikSvc = await import("@/lib/kpi/oylik");
  payrollSvc = await import("@/lib/kpi/payroll");
  sotuvSvc = await import("@/lib/kpi/sotuv");

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy", ism: "Umar", login: "+998946667001", parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Boshqa biznes", ism: "B Direktor", login: "+998946667002", parol: "parol12345",
  });

  katA = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "KPI sinov zakazi", turi: "kirim" },
  });
  aziz = await rawPrisma.user.create({
    data: {
      ism: "Aziz", login: "kpi_aziz", parolHash: "x", rol: "SELLER",
      tenantId: tA.tenant.id, businessId: tA.business.id,
    },
  });

  azizX = await A(() =>
    hr.createEmployee(tA.business.id, {
      ism: "Aziz", lavozim: "Sotuvchi", stavka: 0, stavkaTuri: "oylik", userId: aziz.id,
    })
  );
  bXodim = await B(() =>
    hr.createEmployee(tB.business.id, { ism: "B xodimi", stavka: 0, stavkaTuri: "oylik" })
  );
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Standart to'plam (seed) ----------

test("standart to'plam birinchi murojaatda yaratiladi va IDEMPOTENT", async () => {
  const s1 = await A(() => sozlama.kpiSozlamasi(tA.business.id));
  assert.equal(s1.mavsumPlan, mln(100));
  assert.equal(s1.mavsumsizPlan, mln(80));
  assert.equal(s1.planBonus, mln(1));
  assert.equal(s1.boshlangichBall, 100);
  assert.equal(s1.kunlikLimit, 5);
  assert.equal(s1.intervallar.length, 4);
  assert.equal(s1.ballQoidalari.length, 6);

  // Ikkinchi chaqiriq yangi to'plam YARATMAYDI.
  await A(() => sozlama.kpiSozlamasi(tA.business.id));
  const vazifalar = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  assert.equal(vazifalar.length, 5, "standart 5 vazifa, dublikatsiz");
  assert.equal(vazifalar[0].oylikHaq, mln(1));
  assert.equal(vazifalar[2].oylikHaq, 500_000, "bir kun oldin topshirish — 500 ming");

  const presetlar = await A(() => vazifaSvc.listPresetlar(tA.business.id));
  assert.ok(presetlar.some((p: any) => p.sabab.includes("Yolg'on") && p.kritik && p.ball === 25));
  assert.ok(presetlar.some((p: any) => p.sabab.includes("CRMga kiritilmagan") && p.ball === 3));
});

test("mavsum plani oyga qarab tanlanadi", async () => {
  const s = await A(() => sozlama.kpiSozlamasi(tA.business.id));
  assert.equal(sozlama.standartPlan("2026-07", s), mln(100), "iyul — mavsum");
  assert.equal(sozlama.standartPlan("2026-04", s), mln(80), "aprel — mavsumsiz");
  assert.equal(sozlama.standartPlan("2026-01", s), mln(80), "yanvar — mavsumsiz");
});

// ---------- Sotuv manbai ----------

test("SOTUV: to'liq to'langan kiradi, qarzga savdo KIRMAYDI", async () => {
  await kirim(mln(40), "naqd");
  await kirim(mln(20), "click");
  await kirim(mln(500), "qarz"); // pul kelmagan — bonusga kirmasligi kerak

  const jam = await A(() => sotuvSvc.sotuvJamlari(tA.business.id, OY));
  assert.equal(jam.get(aziz.id)?.summa, mln(60), "faqat naqd+click");
  assert.equal(jam.get(aziz.id)?.zakazlar, 2);
});

test("SOTUV: bekor qilingan (o'chirilgan) zakaz chiqariladi", async () => {
  const t = await kirim(mln(10), "naqd");
  let jam = await A(() => sotuvSvc.sotuvJamlari(tA.business.id, OY));
  assert.equal(jam.get(aziz.id)?.summa, mln(70));

  await A(() => rawPrisma.transaction.update({ where: { id: t.id }, data: { deletedAt: new Date() } }));
  jam = await A(() => sotuvSvc.sotuvJamlari(tA.business.id, OY));
  assert.equal(jam.get(aziz.id)?.summa, mln(60), "bekor qilingan zakaz bonusdan chiqadi");
});

test("SOTUV: qisman to'langan qarz KIRMAYDI, to'liq yopilgach KIRADI", async () => {
  const qarz = await A(() =>
    qarzSvc.createQarz({
      businessId: tA.business.id, userId: aziz.id, turi: "olinadigan",
      mijozNomi: "Mijoz", jamiSumma: mln(10), sana: SANA, masulId: aziz.id,
    })
  );

  // Qisman to'lov — qarz hali PAID emas, demak bonusga kirmaydi.
  await A(() =>
    qarzSvc.qarzTolov({
      businessId: tA.business.id, debtId: qarz.id, userId: aziz.id,
      summa: mln(4), sana: SANA, tolovTuri: "naqd",
    })
  );
  let jam = await A(() => sotuvSvc.sotuvJamlari(tA.business.id, OY));
  assert.equal(jam.get(aziz.id)?.summa, mln(60), "qisman to'langan qarz bonusga kirmaydi");

  // Qolganini to'laymiz — qarz PAID bo'ladi va IKKALA to'lov ham kiradi.
  await A(() =>
    qarzSvc.qarzTolov({
      businessId: tA.business.id, debtId: qarz.id, userId: aziz.id,
      summa: mln(6), sana: SANA, tolovTuri: "naqd",
    })
  );
  jam = await A(() => sotuvSvc.sotuvJamlari(tA.business.id, OY));
  assert.equal(jam.get(aziz.id)?.summa, mln(70), "qarz to'liq yopilgach to'lovlar kiradi");
});

test("SOTUV: QISMAN to'langan CRM zakazining to'langan qismi ham bonusga kirmaydi", async () => {
  // lib/crm/yakunlash.ts qisman to'langan zakazda to'langan qismini KIRIM,
  // qolganini QARZDORLIK qilib yozadi. O'sha kirim bonusga kirib ketsa,
  // yarim to'langan zakaz uchun bonus berilgan bo'lardi — qolgan qismi esa
  // hech qachon kelmasligi mumkin.
  //
  // Test o'zidan keyin TOZALAB ketadi: keyingi testlar jami sotuvga tayanadi.
  const jami = async () =>
    (await A(() => sotuvSvc.sotuvJamlari(tA.business.id, OY))).get(aziz.id)?.summa ?? 0;
  const oldin = await jami();

  const qarz = await A(() =>
    qarzSvc.createQarz({
      businessId: tA.business.id, userId: aziz.id, turi: "olinadigan",
      mijozNomi: "Qisman mijoz", jamiSumma: mln(30), sana: SANA, masulId: aziz.id,
    })
  );
  const kirimYozuvi = await kirim(mln(20), "naqd");
  const stage = await rawPrisma.stage.create({
    data: { businessId: tA.business.id, nomi: "KPI sinov bosqichi", tartib: 99 },
  });
  const zakaz = await rawPrisma.deal.create({
    data: {
      businessId: tA.business.id, nomi: "Qisman to'langan zakaz", summa: mln(50),
      stageId: stage.id, masulId: aziz.id, sana: new Date(`${SANA}T00:00:00.000Z`),
      transactionId: kirimYozuvi.id, debtId: qarz.id, tolangan: mln(20),
    },
  });

  assert.equal(await jami(), oldin, "qarzi ochiq zakazning to'langan qismi bonusga kirmaydi");

  // Qarz to'liq yopilgach — o'sha kirim ham, to'lov yozuvi ham bonusga kiradi.
  await A(() =>
    qarzSvc.qarzTolov({
      businessId: tA.business.id, debtId: qarz.id, userId: aziz.id,
      summa: mln(30), sana: SANA, tolovTuri: "naqd",
    })
  );
  assert.equal(await jami(), oldin + mln(50), "zakaz yopilgach to'liq summa kiradi");

  // ---- tozalash ----
  const tolovlar = await rawPrisma.debtPayment.findMany({ where: { debtId: qarz.id } });
  await rawPrisma.deal.delete({ where: { id: zakaz.id } });
  await rawPrisma.debtPayment.deleteMany({ where: { debtId: qarz.id } });
  await rawPrisma.debt.delete({ where: { id: qarz.id } });
  await rawPrisma.transaction.deleteMany({
    where: {
      id: { in: [kirimYozuvi.id, ...tolovlar.map((t: any) => t.transactionId).filter(Boolean)] },
    },
  });
  await rawPrisma.stage.delete({ where: { id: stage.id } });
  assert.equal(await jami(), oldin, "tozalashdan keyin jami avvalgi holatga qaytadi");
});

test("SOTUV: to'lov turi BO'SH eski yozuv ham hisobga kiradi (NULL tuzog'i)", async () => {
  // `tolovTuri` null — sxemada "eski yozuvlar" holati. SQL'da NULL bilan
  // taqqoslash ROST bermagani uchun sodda `NOT` filtri bunday yozuvni
  // JIMGINA tashlab ketardi va bonus kam hisoblanardi.
  const oldin = await A(() => sotuvSvc.sotuvJamlari(tA.business.id, OY));
  const oldingi = oldin.get(aziz.id)?.summa ?? 0;

  const eski = await rawPrisma.transaction.create({
    data: {
      turi: "kirim", categoryId: katA.id, businessId: tA.business.id,
      summa: mln(5), sana: new Date(`${SANA}T00:00:00.000Z`),
      userId: aziz.id, sotuvchiId: aziz.id, tolovTuri: null,
    },
  });

  const keyin = await A(() => sotuvSvc.sotuvJamlari(tA.business.id, OY));
  assert.equal(keyin.get(aziz.id)?.summa, oldingi + mln(5), "eski yozuv yo'qolmaydi");

  await rawPrisma.transaction.delete({ where: { id: eski.id } });
});

// ---------- Ball ----------

test("ball: biriktirilmagan vazifaga ayirib bo'lmaydi", async () => {
  const [v1] = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  await assert.rejects(
    () => A(() => ballSvc.ballAyir({
      businessId: tA.business.id, employeeId: azizX.id, taskId: v1.id,
      userId: aziz.id, userIsm: "Umar", sana: SANA, ball: 3, sabab: "Sinov",
    })),
    /biriktirilmagan/
  );
});

test("ball: biriktirilgach 100 dan boshlanadi va ayiriladi", async () => {
  const vazifalar = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  for (const v of vazifalar) {
    await A(() => vazifaSvc.biriktiruvOzgartir({
      businessId: tA.business.id, taskId: v.id, employeeId: azizX.id, aktiv: true, userId: aziz.id,
    }));
  }

  const n = await A(() => ballSvc.ballAyir({
    businessId: tA.business.id, employeeId: azizX.id, taskId: vazifalar[1].id,
    userId: aziz.id, userIsm: "Umar", sana: SANA, ball: 3,
    sabab: "CRMga kiritilmagan zakas",
  }));
  assert.equal(n.ballOldin, 100, "yangi oy 100 dan boshlanadi");
  assert.equal(n.ballKeyin, 97);
  assert.equal(n.oy, OY);
});

test("KUNLIK LIMIT: oddiy jarimada bir kunda 5 balldan oshmaydi (server tomonda)", async () => {
  const vazifalar = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  const v = vazifalar[1]; // bugun allaqachon 3 ball ayrilgan

  // Yana 2 ball — limitga TENG, o'tadi.
  await A(() => ballSvc.ballAyir({
    businessId: tA.business.id, employeeId: azizX.id, taskId: v.id,
    userId: aziz.id, userIsm: "Umar", sana: SANA, ball: 2, sabab: "Summada xatolik",
  }));

  // Uchinchisi limitdan oshadi — RAD ETILADI.
  await assert.rejects(
    () => A(() => ballSvc.ballAyir({
      businessId: tA.business.id, employeeId: azizX.id, taskId: v.id,
      userId: aziz.id, userIsm: "Umar", sana: SANA, ball: 1, sabab: "Yana bir xato",
    })),
    /Kunlik limit/
  );
});

test("KUNLIK LIMIT: kritik (ishonch) holati limitdan TASHQARIDA", async () => {
  const vazifalar = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  const v = vazifalar[1]; // limit allaqachon to'lgan

  const n = await A(() => ballSvc.ballAyir({
    businessId: tA.business.id, employeeId: azizX.id, taskId: v.id,
    userId: aziz.id, userIsm: "Umar", sana: SANA, ball: 25,
    sabab: "Yolg'on ma'lumot berish", kritik: true,
  }));
  assert.equal(n.ballOldin, 95);
  assert.equal(n.ballKeyin, 70, "kritik jarima limitga qaramay o'tadi");
});

test("KUNLIK LIMIT: keyingi kunda limit yangilanadi", async () => {
  const vazifalar = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  const n = await A(() => ballSvc.ballAyir({
    businessId: tA.business.id, employeeId: azizX.id, taskId: vazifalar[1].id,
    userId: aziz.id, userIsm: "Umar", sana: "2026-07-11", ball: 4,
    sabab: "Kunlik hisobot tashlanmadi",
  }));
  assert.equal(n.ballKeyin, 66);
});

test("ball keyingi oyga KO'CHMAYDI — yangi oy 100 dan boshlanadi", async () => {
  const vazifalar = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  const n = await A(() => ballSvc.ballAyir({
    businessId: tA.business.id, employeeId: azizX.id, taskId: vazifalar[1].id,
    userId: aziz.id, userIsm: "Umar", sana: "2026-08-03", ball: 2, sabab: "Avgustdagi xato",
  }));
  assert.equal(n.ballOldin, 100, "avgust o'z hisobidan boshlanadi");
  assert.equal(n.oy, "2026-08");
});

test("QAYTARISH: asl yozuv tarixda qoladi, ball tiklanadi, ikki marta qaytarib bo'lmaydi", async () => {
  const tarix = await A(() => ballSvc.ballTarixi(tA.business.id, azizX.id, OY));
  const kritikYozuv = tarix.find((t: any) => t.kritik && t.turi === "jarima");
  assert.ok(kritikYozuv, "kritik yozuv topilishi kerak");

  const n = await A(() => ballSvc.ballQaytar({
    businessId: tA.business.id, logId: kritikYozuv.id,
    userId: aziz.id, userIsm: "Umar", izoh: "Xato kiritilgan edi",
  }));
  assert.equal(n.ballKeyin, n.ballOldin + 25, "25 ball qaytdi");

  const keyin = await A(() => ballSvc.ballTarixi(tA.business.id, azizX.id, OY));
  const asl = keyin.find((t: any) => t.id === kritikYozuv.id);
  assert.ok(asl, "ASL yozuv tarixdan YO'QOLMAYDI");
  assert.equal(asl.qaytarilgan, true, "asl yozuv qaytarilgan deb belgilanadi");
  assert.ok(keyin.some((t: any) => t.turi === "qaytarish" && t.ball === 25));

  await assert.rejects(
    () => A(() => ballSvc.ballQaytar({
      businessId: tA.business.id, logId: kritikYozuv.id, userId: aziz.id, userIsm: "Umar",
    })),
    /allaqachon qaytarilgan/
  );
});

// ---------- To'liq oylik hisobi ----------

test("oylik hisobi: har vazifa o'z balli bilan, jami to'g'ri", async () => {
  const n = await A(() => oylikSvc.hisoblaXodim(tA.business.id, azizX.id, OY));
  assert.ok(n);
  const h = n.hisob;

  assert.equal(h.sotuv, mln(70));
  assert.equal(h.plan, mln(100), "iyul — mavsum plani");
  assert.equal(h.planBajarildi, false);
  assert.equal(h.planBonusi, 0, "plan bajarilmagan — bonus yo'q");
  assert.equal(h.sotuvBonusi, 1_700_000, "40mln×2% + 30mln×3%");
  assert.equal(h.holat, "QORALAMA");
  assert.equal(h.yakuniy, false);

  // 5 vazifa: biri 91 ball, qolgani 100.
  // 91 = 100 − 3 − 2 − 25(kritik) − 4 + 25(qaytarilgan kritik).
  assert.equal(h.vazifalar.length, 5);
  const buzilgan = h.vazifalar.find((v: any) => v.ball !== 100);
  assert.equal(buzilgan.ball, 91, "jarimalar va qaytarish yig'indisi: -9 ball");
  assert.equal(buzilgan.yoqotilgan, 9, "\"bu oy: -9 ball\" ko'rsatkichi");
  assert.equal(buzilgan.foiz, 10_000, "91 ball → 100%");
  assert.equal(buzilgan.hisoblangan, buzilgan.oylikHaq, "100% — to'liq haq");

  // Qolgan 4 tasi 100 ball → 110%.
  const toliqlar = h.vazifalar.filter((v: any) => v.ball === 100);
  assert.equal(toliqlar.length, 4);
  for (const v of toliqlar) {
    assert.equal(v.foiz, 11_000);
    assert.equal(v.hisoblangan, Math.round(v.oylikHaq * 1.1));
  }

  const kutilgan = h.vazifalar.reduce((s: number, v: any) => s + v.hisoblangan, 0);
  assert.equal(h.vazifaHaqi, kutilgan);
  assert.equal(h.jami, h.vazifaHaqi + h.sotuvBonusi + h.planBonusi);
});

test("KUNLIK LIMIT: qaytarilgan jarima limitni band qilmaydi", async () => {
  const vazifalar = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  const v = vazifalar[3]; // hali tegilmagan vazifa
  const kun = "2026-07-15";

  // Limitni to'liq band qilamiz (5 ball).
  const xato = await A(() => ballSvc.ballAyir({
    businessId: tA.business.id, employeeId: azizX.id, taskId: v.id,
    userId: aziz.id, userIsm: "Umar", sana: kun, ball: 5, sabab: "Xato kiritildi",
  }));

  // Limit to'lgan — yangi jarima o'tmaydi.
  await assert.rejects(
    () => A(() => ballSvc.ballAyir({
      businessId: tA.business.id, employeeId: azizX.id, taskId: v.id,
      userId: aziz.id, userIsm: "Umar", sana: kun, ball: 1, sabab: "To'g'ri sabab",
    })),
    /Kunlik limit/
  );

  // Xatoni qaytaramiz — endi o'sha kuni to'g'risini yozish MUMKIN bo'lishi kerak.
  await A(() => ballSvc.ballQaytar({
    businessId: tA.business.id, logId: xato.id, userId: aziz.id, userIsm: "Umar",
  }));

  const togri = await A(() => ballSvc.ballAyir({
    businessId: tA.business.id, employeeId: azizX.id, taskId: v.id,
    userId: aziz.id, userIsm: "Umar", sana: kun, ball: 3, sabab: "To'g'ri sabab",
  }));
  assert.equal(togri.ballKeyin, 97, "qaytarilgandan keyin ball tiklanib, 3 ball ayrildi");
});

test("sotuv oshsa plan bonusi qo'shiladi va bonus progressiv o'sadi", async () => {
  await kirim(mln(80), "naqd"); // jami 150 mln

  const n = await A(() => oylikSvc.hisoblaXodim(tA.business.id, azizX.id, OY));
  const h = n!.hisob;
  assert.equal(h.sotuv, mln(150));
  assert.equal(h.planBajarildi, true);
  assert.equal(h.planBonusi, mln(1));
  assert.equal(h.sotuvBonusi, 5_100_000, "progressiv: 800k+1.2m+1.6m+1.5m");
  assert.equal(h.planFoizi, 150);
  assert.equal(h.bonusQatorlari.length, 4, "breakdown qatorlari ko'rinadi");
});

test("xodim plani (override) standart planning o'rnini bosadi", async () => {
  await A(() => vazifaSvc.sotuvPlaniBelgila({
    businessId: tA.business.id, employeeId: azizX.id, oy: OY,
    maqsad: mln(120), userId: aziz.id,
  }));
  let h = (await A(() => oylikSvc.hisoblaXodim(tA.business.id, azizX.id, OY)))!.hisob;
  assert.equal(h.plan, mln(120));
  assert.equal(h.planBajarildi, true, "150 ≥ 120");

  await A(() => vazifaSvc.sotuvPlaniBelgila({
    businessId: tA.business.id, employeeId: azizX.id, oy: OY,
    maqsad: mln(200), userId: aziz.id,
  }));
  h = (await A(() => oylikSvc.hisoblaXodim(tA.business.id, azizX.id, OY)))!.hisob;
  assert.equal(h.planBonusi, 0, "200 mln plan bajarilmadi");

  // null — override olib tashlanadi, standart plan qaytadi.
  await A(() => vazifaSvc.sotuvPlaniBelgila({
    businessId: tA.business.id, employeeId: azizX.id, oy: OY, maqsad: null, userId: aziz.id,
  }));
  h = (await A(() => oylikSvc.hisoblaXodim(tA.business.id, azizX.id, OY)))!.hisob;
  assert.equal(h.plan, mln(100));
});

// ---------- Oyni yopish ----------

test("oyni yopish: snapshot yoziladi va manba o'zgarsa ham SILJIMAYDI", async () => {
  const oldin = (await A(() => oylikSvc.hisoblaXodim(tA.business.id, azizX.id, OY)))!.hisob;

  const payroll = await A(() => payrollSvc.oyniYop({
    businessId: tA.business.id, employeeId: azizX.id, oy: OY, userId: aziz.id,
  }));
  assert.equal(payroll.jami, oldin.jami);
  assert.equal(payroll.holat, "HISOBLANDI");

  // Manbani o'zgartiramiz: yangi katta zakaz.
  await kirim(mln(50), "naqd");

  const keyin = (await A(() => oylikSvc.hisoblaXodim(tA.business.id, azizX.id, OY)))!.hisob;
  assert.equal(keyin.yakuniy, true);
  assert.equal(keyin.sotuv, oldin.sotuv, "yopilgan oy sotuvi o'zgarmaydi");
  assert.equal(keyin.jami, oldin.jami, "yopilgan oylik o'zgarmaydi");
  assert.equal(keyin.vazifalar.length, 5, "snapshot qatorlari saqlangan");
});

test("yopilgan oyga ball yozib bo'lmaydi", async () => {
  const vazifalar = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  await assert.rejects(
    () => A(() => ballSvc.ballAyir({
      businessId: tA.business.id, employeeId: azizX.id, taskId: vazifalar[0].id,
      userId: aziz.id, userIsm: "Umar", sana: "2026-07-20", ball: 2, sabab: "Kech",
    })),
    /yopilgan/
  );
});

test("oylik zanjiri: tasdiq → to'lov, tartib buzilmaydi", async () => {
  const p = await rawPrisma.kpiPayroll.findFirst({
    where: { businessId: tA.business.id, employeeId: azizX.id, oy: OY },
  });

  // Tasdiqlanmagan oylikni to'landi deb belgilab bo'lmaydi.
  await assert.rejects(
    () => A(() => payrollSvc.oylikTolandi({ businessId: tA.business.id, payrollId: p.id, userId: aziz.id })),
    /tasdiqlang/
  );

  const tasdiq = await A(() => payrollSvc.oylikTasdiqla({
    businessId: tA.business.id, payrollId: p.id, userId: aziz.id,
  }));
  assert.equal(tasdiq.holat, "TASDIQLANDI");
  assert.ok(tasdiq.tasdiqlanganAt);

  const tolov = await A(() => payrollSvc.oylikTolandi({
    businessId: tA.business.id, payrollId: p.id, userId: aziz.id,
  }));
  assert.equal(tolov.holat, "TOLANDI");
  assert.equal(tolov.tolanganSumma, tasdiq.jami);
  assert.ok(tolov.tolanganAt);
});

test("to'langan oylikni qayta ochib va tuzatib bo'lmaydi", async () => {
  const p = await rawPrisma.kpiPayroll.findFirst({
    where: { businessId: tA.business.id, employeeId: azizX.id, oy: OY },
  });
  await assert.rejects(
    () => A(() => payrollSvc.oyniQaytaOch({ businessId: tA.business.id, payrollId: p.id })),
    /To'langan/
  );
  await assert.rejects(
    () => A(() => payrollSvc.tuzatishQosh({
      businessId: tA.business.id, payrollId: p.id, summa: -100_000,
      sabab: "Ushlab qolish", userId: aziz.id, userIsm: "Umar",
    })),
    /To'langan/
  );
});

test("tuzatish qatori jamini o'zgartiradi, snapshot raqamlari tegilmaydi", async () => {
  // Avgust oyini yopamiz (u hali to'lanmagan).
  const p = await A(() => payrollSvc.oyniYop({
    businessId: tA.business.id, employeeId: azizX.id, oy: "2026-08", userId: aziz.id,
  }));
  const aslVazifaHaqi = p.vazifaHaqi;

  const keyin = await A(() => payrollSvc.tuzatishQosh({
    businessId: tA.business.id, payrollId: p.id, summa: -250_000,
    sabab: "Yetishmovchilik", userId: aziz.id, userIsm: "Umar",
  }));
  assert.equal(keyin.tuzatish, -250_000);
  assert.equal(keyin.vazifaHaqi, aslVazifaHaqi, "snapshot raqami tegilmaydi");
  assert.equal(keyin.jami, p.jami - 250_000);

  const royxat = await A(() => payrollSvc.tuzatishlar(tA.business.id, p.id));
  assert.equal(royxat.length, 1);
  assert.equal(royxat[0].sabab, "Yetishmovchilik");
  assert.equal(royxat[0].userIsm, "Umar");
});

// ---------- Tenant izolyatsiyasi ----------

test("TENANT IZOLYATSIYASI: B tenant A tenantning KPI ma'lumotini KO'RMAYDI", async () => {
  const bHisob = await B(() => oylikSvc.hisoblaBarchasi(tB.business.id, OY));
  assert.equal(bHisob.xodimlar.length, 1, "faqat o'z xodimi");
  assert.equal(bHisob.xodimlar[0].employeeId, bXodim.id);
  assert.equal(bHisob.xodimlar[0].sotuv, 0, "A tenantning sotuvi ko'rinmaydi");

  const bVazifalar = await B(() => vazifaSvc.listVazifalar(tB.business.id));
  const aVazifalar = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  const aIdlar = new Set(aVazifalar.map((v: any) => v.id));
  assert.ok(!bVazifalar.some((v: any) => aIdlar.has(v.id)), "vazifalar aralashmaydi");

  // B tenant A tenantning ball tarixini ko'ra olmaydi.
  const bTarix = await B(() => ballSvc.ballTarixi(tB.business.id, azizX.id, OY));
  assert.equal(bTarix.length, 0);
});

test("TENANT IZOLYATSIYASI: B tenant A tenantning vazifasini o'zgartira olmaydi", async () => {
  const [aVazifa] = await A(() => vazifaSvc.listVazifalar(tA.business.id));
  await assert.rejects(
    () => B(() => vazifaSvc.vazifaYangila(tB.business.id, aVazifa.id, { oylikHaq: 1 })),
    /topilmadi/
  );
  await assert.rejects(
    () => B(() => vazifaSvc.biriktiruvOzgartir({
      businessId: tB.business.id, taskId: aVazifa.id, employeeId: bXodim.id,
      aktiv: true, userId: tB.user.id,
    })),
    /topilmadi/
  );
});

test("TENANT IZOLYATSIYASI: B tenant A tenantning oyligiga tegina olmaydi", async () => {
  const aPayroll = await rawPrisma.kpiPayroll.findFirst({
    where: { businessId: tA.business.id, oy: "2026-08" },
  });
  await assert.rejects(
    () => B(() => payrollSvc.oylikTasdiqla({
      businessId: tB.business.id, payrollId: aPayroll.id, userId: tB.user.id,
    })),
    /topilmadi/
  );
});
