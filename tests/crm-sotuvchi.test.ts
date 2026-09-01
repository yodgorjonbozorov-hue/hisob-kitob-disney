/**
 * CRM ZAKAZ SOTUVCHISI VA SOTUVCHI STATISTIKASI TESTLARI.
 *
 * Qamrov (prompt 36-bo'limi): avto-tanlash, owner tomonidan sotuvchi
 * tanlash, createdBy ↔ sotuvchi farqi, konversiya, qarzga sotilgan zakaz
 * (yutilgan ≠ puli kelgan), to'liq to'langach bonus bazasiga tushishi,
 * biznesler aro biriktirishning rad etilishi, nofaol sotuvchi tarixi,
 * sotuvchini almashtirish huquqi, majburiy sotuvchi sozlamasi, o'chirilgan
 * zakazning statistikaga kirmasligi va reyting tartibi.
 *
 * Ishga tushirish: npm run test:crm-sotuvchi
 */
process.env.DATABASE_URL = "file:./prisma/test-crm-sotuvchi.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let biznesYarat: any;
let crm: any;
let crmKirim: any;
let xk: any;
let zs: any;
let kpiQ: any;
let qarz: any;
let ForbiddenError: any;
let BadRequestError: any;
let todayDateOnlyString: any;

let tA: any; // Disney Navoiy
let tB: any; // boshqa tenant
let biznesA2: any; // A tenantining IKKINCHI biznesi
let katBantik: any;
let kSotuvchi: any;
let kDekorator: any;
let kSotuvchiA2: any;
let fayruzaUser: any;
let suhrobUser: any;
let fayruza: any; // Employee (userId = fayruzaUser)
let suhrob: any;
let rustam: any; // sotuvchi, tizim hisobisiz
let doston: any; // dekorator — sotuvchi EMAS
let nofaol: any; // keyin nofaol qilinadi
let sardorA2: any; // A2 biznesining sotuvchisi
let wonStage: any;
let lostStage: any;
let openStage: any;
let bugun: string;
let oyBoshi: string;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tA.tenant.id, fn);
const B = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tB.tenant.id, fn);

/** Davr — joriy oy boshidan bugungacha (barcha testlar shu oraliqda ishlaydi). */
const davr = () => ({ from: oyBoshi, to: bugun });

/** Qisqartma: zakaz yaratish. */
async function zakaz(opts: {
  nomi: string;
  summa: number;
  userId: string;
  sotuvchiId?: string | null;
  stageId?: string | null;
  huquq?: boolean;
}) {
  return A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: opts.nomi,
      summa: opts.summa,
      categoryId: katBantik.id,
      sana: bugun,
      userId: opts.userId,
      sotuvchiId: opts.sotuvchiId ?? undefined,
      stageId: opts.stageId ?? undefined,
      ...(opts.huquq === undefined ? {} : { sotuvchiTanlashHuquqi: opts.huquq }),
    })
  );
}

/** Bitta sotuvchining KPI qatori (davr — joriy oy). */
async function kpi(employeeId: string) {
  const hammasi = await A(() => kpiQ.getSotuvchilarKpi({ businessId: tA.business.id, ...davr() }));
  return hammasi.sotuvchilar.find((s: any) => s.employeeId === employeeId);
}

before(async () => {
  rmSync("prisma/test-crm-sotuvchi.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ biznesYarat } = await import("@/lib/services/biznesYaratish"));
  crm = await import("@/lib/crm/service");
  crmKirim = await import("@/lib/crm/kirim");
  xk = await import("@/lib/services/xodimKategoriya");
  zs = await import("@/lib/services/zakazSotuvchi");
  kpiQ = await import("@/lib/queries/sotuvchiKpi");
  qarz = await import("@/lib/services/qarz");
  ({ ForbiddenError, BadRequestError } = await import("@/lib/auth/guard"));
  ({ todayDateOnlyString } = await import("@/lib/date"));

  bugun = todayDateOnlyString();
  oyBoshi = `${bugun.slice(0, 7)}-01`;

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy",
    ism: "Direktor",
    login: "+998946777701",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Boshqa kompaniya",
    ism: "B Direktor",
    login: "+998946777702",
    parol: "parol12345",
  });
  for (const t of [tA, tB]) {
    await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
    await rawPrisma.tenantModule.create({ data: { tenantId: t.tenant.id, code: "CRM", isActive: true } });
  }

  // A tenantining IKKINCHI biznesi — biznesler aro tekshiruv uchun.
  biznesA2 = await A(() =>
    biznesYarat({ nomi: "Disney Buxoro" }, { tenantId: tA.tenant.id, plan: "PRO" })
  );

  katBantik = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "Bantik", turi: "kirim" },
  });

  fayruzaUser = await rawPrisma.user.create({
    data: { ism: "Fayruza", login: "cs_fayruza", parolHash: "x", rol: "SELLER", tenantId: tA.tenant.id, businessId: tA.business.id },
  });
  suhrobUser = await rawPrisma.user.create({
    data: { ism: "Suhrob", login: "cs_suhrob", parolHash: "x", rol: "SELLER", tenantId: tA.tenant.id, businessId: tA.business.id },
  });

  fayruza = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Fayruza", userId: fayruzaUser.id } });
  suhrob = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Suhrob", userId: suhrobUser.id } });
  rustam = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Rustam" } });
  doston = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Doston" } });
  nofaol = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Nodira" } });
  sardorA2 = await rawPrisma.employee.create({ data: { businessId: biznesA2.id, ism: "Sardor" } });

  kSotuvchi = await A(() => xk.createKategoriya(tA.business.id, { nomi: "Sotuvchi", turi: "sotuvchi" }));
  kDekorator = await A(() => xk.createKategoriya(tA.business.id, { nomi: "Dekorator", turi: "ijrochi" }));
  kSotuvchiA2 = await A(() => xk.createKategoriya(biznesA2.id, { nomi: "Sotuvchi", turi: "sotuvchi" }));

  await A(() =>
    xk.kategoriyaAzolariniSaqlash(tA.business.id, kSotuvchi.id, [fayruza.id, suhrob.id, rustam.id, nofaol.id])
  );
  await A(() => xk.kategoriyaAzolariniSaqlash(tA.business.id, kDekorator.id, [doston.id]));
  await A(() => xk.kategoriyaAzolariniSaqlash(biznesA2.id, kSotuvchiA2.id, [sardorA2.id]));

  await A(() => crm.ensureStages(tA.business.id));
  const stages = await A(() => prisma.stage.findMany({ where: { businessId: tA.business.id } }));
  wonStage = stages.find((s: any) => s.turi === "WON");
  lostStage = stages.find((s: any) => s.turi === "LOST");
  openStage = stages.find((s: any) => s.turi === "OPEN");
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Sotuvchilar ro'yxati (2-talab) ----------

test("dropdown: faqat faol sotuvchilar — dekorator va direktor chiqmaydi", async () => {
  const royxat = await A(() => zs.sotuvchilarRoyxati(tA.business.id));
  assert.deepEqual(
    royxat.map((s: any) => s.ism).sort(),
    ["Fayruza", "Nodira", "Rustam", "Suhrob"]
  );
  assert.ok(!royxat.some((s: any) => s.ism === "Doston"), "dekorator sotuvchi ro'yxatiga tushmaydi");
});

// ---------- TEST 1: avto-tanlash ----------

test("TEST 1: Fayruza o'z hisobidan zakaz yaratdi → sotuvchi avtomatik Fayruza", async () => {
  const d = await zakaz({ nomi: "Onajon Dekor", summa: 400_000, userId: fayruzaUser.id });
  const sotuvchi = await A(() => zs.zakazSotuvchisi(tA.business.id, d.id));
  assert.equal(sotuvchi.employeeId, fayruza.id, "sotuvchi o'zini qayta tanlamaydi");
  assert.equal(d.masulId, fayruzaUser.id, "mas'ul ham sotuvchiga sinxronlandi");
});

// ---------- TEST 2: owner boshqa sotuvchini tanlaydi ----------

test("TEST 2: Direktor zakaz kiritdi, sotuvchi Suhrob → statistika Suhrobga", async () => {
  await zakaz({ nomi: "Panda Masha", summa: 300_000, userId: tA.user.id, sotuvchiId: suhrob.id, huquq: true });
  const s = await kpi(suhrob.id);
  assert.equal(s.olingan.soni, 1);
  assert.equal(s.olingan.summa, 300_000);
});

// ---------- TEST 3: createdBy ≠ sotuvchi ----------

test("TEST 3: createdBy Direktor, sotuvchi Fayruza → zakaz Fayruzaga hisoblanadi", async () => {
  const d = await zakaz({
    nomi: "Sharlar to'plami",
    summa: 250_000,
    userId: tA.user.id,
    sotuvchiId: fayruza.id,
    huquq: true,
  });

  // CRM'ga kim kiritgani — faoliyat lentasida (createdBy).
  const act = await A(() =>
    prisma.activity.findFirst({ where: { businessId: tA.business.id, dealId: d.id, turi: "tizim" } })
  );
  assert.equal(act.userId, tA.user.id, "CRM'ga Direktor kiritdi");

  const f = await kpi(fayruza.id);
  assert.equal(f.olingan.soni, 2, "Fayruzada 2 ta zakaz (avto + shu)");

  const direktorniki = await A(() =>
    prisma.dealEmployee.count({ where: { businessId: tA.business.id, dealId: d.id, employeeId: suhrob.id } })
  );
  assert.equal(direktorniki, 0, "zakaz kiritgan odamga yozilmadi");
});

// ---------- TEST 4: konversiya ----------

test("TEST 4: 10 zakaz (7 yutildi, 3 yo'qotildi) → konversiya 70%", async () => {
  for (let i = 0; i < 7; i++) {
    const d = await zakaz({ nomi: `R-won-${i}`, summa: 100_000, userId: tA.user.id, sotuvchiId: rustam.id, huquq: true });
    await A(() => prisma.deal.update({ where: { id: d.id }, data: { stageId: wonStage.id } }));
  }
  for (let i = 0; i < 3; i++) {
    const d = await zakaz({ nomi: `R-lost-${i}`, summa: 100_000, userId: tA.user.id, sotuvchiId: rustam.id, huquq: true });
    await A(() => prisma.deal.update({ where: { id: d.id }, data: { stageId: lostStage.id } }));
  }
  const r = await kpi(rustam.id);
  assert.equal(r.olingan.soni, 10);
  assert.equal(r.yutilgan.soni, 7);
  assert.equal(r.yoqotilgan.soni, 3);
  assert.equal(r.konversiya, 70);
});

test("konversiya maxrajida JARAYONDAGI zakaz qatnashmaydi", async () => {
  const d = await zakaz({ nomi: "R-ochiq", summa: 500_000, userId: tA.user.id, sotuvchiId: rustam.id, huquq: true, stageId: openStage.id });
  const r = await kpi(rustam.id);
  assert.equal(r.jarayonda.soni, 1);
  assert.equal(r.konversiya, 70, "ochiq zakaz konversiyani pasaytirmaydi");
  await A(() => prisma.deal.update({ where: { id: d.id }, data: { deletedAt: new Date() } }));

  const keyin = await kpi(rustam.id);
  assert.equal(keyin.jarayonda.soni, 0, "o'chirilgan zakaz statistikadan chiqadi (31-talab)");
});

// ---------- TEST 5 va 6: qarzga sotilgan zakaz ----------

let qarzZakaz: any;
let qarzYozuv: any;

test("TEST 5: 700k qarzga yopildi → yutilgan 700k, puli kelgan 0, bonus 0", async () => {
  qarzZakaz = await zakaz({
    nomi: "Qarzga bantik",
    summa: 700_000,
    userId: tA.user.id,
    sotuvchiId: suhrob.id,
    huquq: true,
  });
  await A(() =>
    crm.moveDeal({ businessId: tA.business.id, dealId: qarzZakaz.id, stageId: wonStage.id, userId: tA.user.id })
  );
  const txn = await A(() =>
    crmKirim.kirimgaKochirish({
      businessId: tA.business.id,
      dealId: qarzZakaz.id,
      userId: tA.user.id,
      tolovTuri: "qarz",
    })
  );

  // Qarz ko'prigi — `Debt.manbaTransactionId` (scripts/qarz-migratsiya.ts
  // deploy paytida aynan shu yozuvni ochadi).
  qarzYozuv = await rawPrisma.debt.create({
    data: {
      businessId: tA.business.id,
      turi: "olinadigan",
      mijozNomi: "Zebo",
      jamiSumma: 700_000,
      tolangan: 0,
      status: "OPEN",
      isYopilgan: false,
      sana: new Date(`${bugun}T00:00:00.000Z`),
      manbaTransactionId: txn.id,
      userId: tA.user.id,
    },
  });

  const s = await kpi(suhrob.id);
  assert.equal(s.yutilgan.summa, 700_000, "yutilgan sotuv — 700 000");
  assert.equal(s.puliKelgan, 0, "pul hali kelmadi");
  assert.equal(s.bonusAsosi, 0, "bonus hisoblanmaydi");
  assert.equal(s.qarzdagi, 700_000);
});

test("TEST 5b (18-talab): qisman to'langan zakaz ham bonus bazasiga kirmaydi", async () => {
  await A(() =>
    qarz.qarzTolov({
      businessId: tA.business.id,
      debtId: qarzYozuv.id,
      userId: tA.user.id,
      summa: 300_000,
      sana: bugun,
      tolovTuri: "naqd",
    })
  );
  const s = await kpi(suhrob.id);
  assert.equal(s.yutilgan.summa, 700_000, "yutilgan summa o'zgarmaydi");
  assert.equal(s.puliKelgan, 0, "qisman to'lov bonusni ochmaydi");
  assert.equal(s.qismanTolangan, 300_000, "kelgan pul ko'rinadi");
});

test("TEST 6: qarz to'liq yopilgach puli kelgan sotuv +700 000", async () => {
  await A(() =>
    qarz.qarzTolov({
      businessId: tA.business.id,
      debtId: qarzYozuv.id,
      userId: tA.user.id,
      summa: 400_000,
      sana: bugun,
      tolovTuri: "naqd",
    })
  );
  const s = await kpi(suhrob.id);
  assert.equal(s.puliKelgan, 700_000, "qarz yopilgach butun summa bazaga tushdi");
  assert.equal(s.bonusAsosi, 700_000);
  assert.equal(s.qarzdagi, 0);
});

test("naqd yopilgan zakaz darhol 'puli kelgan' bo'ladi", async () => {
  const d = await zakaz({ nomi: "Naqd bantik", summa: 200_000, userId: tA.user.id, sotuvchiId: fayruza.id, huquq: true });
  await A(() => crm.moveDeal({ businessId: tA.business.id, dealId: d.id, stageId: wonStage.id, userId: tA.user.id }));
  await A(() =>
    crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id, tolovTuri: "naqd" })
  );
  const f = await kpi(fayruza.id);
  assert.equal(f.puliKelgan, 200_000);
});

// ---------- TEST 7: biznesler aro ----------

test("TEST 7: boshqa biznes xodimini sotuvchi qilib bo'lmaydi", async () => {
  await assert.rejects(
    zakaz({ nomi: "Chet zakaz", summa: 100_000, userId: tA.user.id, sotuvchiId: sardorA2.id, huquq: true }),
    ForbiddenError,
    "A2 biznesining xodimi A biznesining zakaziga biriktirilmaydi"
  );
});

test("tenant izolyatsiyasi: B kontekstida A sotuvchilari ko'rinmaydi", async () => {
  const royxat = await B(() => zs.sotuvchilarRoyxati(tA.business.id));
  assert.equal(royxat.length, 0);
});

// ---------- TEST 8: nofaol sotuvchi ----------

test("TEST 8: nofaol sotuvchi dropdownda yo'q, tarixi esa saqlanadi", async () => {
  const d = await zakaz({ nomi: "Nodira zakazi", summa: 150_000, userId: tA.user.id, sotuvchiId: nofaol.id, huquq: true });
  await rawPrisma.employee.update({ where: { id: nofaol.id }, data: { isActive: false } });

  const royxat = await A(() => zs.sotuvchilarRoyxati(tA.business.id));
  assert.ok(!royxat.some((s: any) => s.id === nofaol.id), "nofaol xodim yangi zakaz ro'yxatida yo'q");

  const sotuvchi = await A(() => zs.zakazSotuvchisi(tA.business.id, d.id));
  assert.equal(sotuvchi.ism, "Nodira", "tarixiy zakazda nomi qolgan");
  assert.equal(sotuvchi.isActive, false);

  const n = await kpi(nofaol.id);
  assert.equal(n.olingan.soni, 1, "tarixiy statistika yo'qolmadi");

  await assert.rejects(
    zakaz({ nomi: "Yangi nofaol", summa: 100_000, userId: tA.user.id, sotuvchiId: nofaol.id, huquq: true }),
    BadRequestError,
    "nofaol xodimga yangi zakaz yozilmaydi"
  );
});

// ---------- TEST 9: sotuvchini almashtirish huquqi ----------

test("TEST 9: huquqsiz foydalanuvchi boshqa sotuvchini tanlay olmaydi", async () => {
  await assert.rejects(
    zakaz({ nomi: "Ruxsatsiz", summa: 100_000, userId: fayruzaUser.id, sotuvchiId: suhrob.id, huquq: false }),
    ForbiddenError
  );
  // O'z nomiga yozish esa huquqsiz ham ishlaydi.
  const d = await zakaz({ nomi: "O'ziniki", summa: 100_000, userId: fayruzaUser.id, sotuvchiId: fayruza.id, huquq: false });
  const s = await A(() => zs.zakazSotuvchisi(tA.business.id, d.id));
  assert.equal(s.employeeId, fayruza.id);
});

test("sotuvchini almashtirish: audit izi va kirim sotuvchisi sinxronlanadi", async () => {
  const d = await zakaz({ nomi: "Almashtiriladigan", summa: 500_000, userId: tA.user.id, sotuvchiId: fayruza.id, huquq: true });
  await A(() => crm.moveDeal({ businessId: tA.business.id, dealId: d.id, stageId: wonStage.id, userId: tA.user.id }));
  const txn = await A(() =>
    crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: d.id, userId: tA.user.id, tolovTuri: "naqd" })
  );
  assert.equal(txn.sotuvchiId, fayruzaUser.id);

  await A(() =>
    zs.sotuvchiniOzgartirish({
      businessId: tA.business.id,
      dealId: d.id,
      employeeId: suhrob.id,
      userId: tA.user.id,
    })
  );

  const yangi = await A(() => zs.zakazSotuvchisi(tA.business.id, d.id));
  assert.equal(yangi.employeeId, suhrob.id);

  const yangilanganTxn = await A(() => prisma.transaction.findFirst({ where: { id: txn.id, businessId: tA.business.id } }));
  assert.equal(yangilanganTxn.sotuvchiId, suhrobUser.id, "kirim sotuvchisi ham o'tdi");

  const bitta = await A(() =>
    prisma.dealEmployee.count({
      where: { businessId: tA.business.id, dealId: d.id, category: { turi: "sotuvchi" } },
    })
  );
  assert.equal(bitta, 1, "zakazda bitta sotuvchi qoladi");

  const izoh = await A(() =>
    prisma.activity.findFirst({
      where: { businessId: tA.business.id, dealId: d.id, turi: "tizim", matn: { contains: "Sotuvchi o'zgardi" } },
    })
  );
  assert.ok(izoh, "lentaga yozildi");

  // Avtomatik audit ham "deal" nomi bilan yozadi — bizga AYNAN sotuvchi
  // almashtirish yozuvi kerak (`sotuvchiEmployeeId` maydoni bo'yicha).
  const audit = await A(() =>
    prisma.auditLog.findFirst({
      where: {
        businessId: tA.business.id,
        entity: "deal",
        entityId: d.id,
        action: "update",
        before: { contains: "sotuvchiEmployeeId" },
      },
      orderBy: { createdAt: "desc" },
    })
  );
  assert.ok(audit, "audit jurnaliga yozildi");
  assert.ok(String(audit.before).includes("Fayruza"), "eski sotuvchi saqlandi");
  assert.ok(String(audit.after).includes("Suhrob"), "yangi sotuvchi saqlandi");
});

// ---------- 6-talab: majburiy sotuvchi ----------

test("sozlama: sotuvchi majburiy bo'lsa tanlanmagan zakaz rad etiladi", async () => {
  assert.equal(await A(() => zs.sotuvchiMajburiymi(tA.business.id)), false, "standart holatda majburiy emas");

  await rawPrisma.hrSetting.create({
    data: { businessId: tA.business.id, crmSotuvchiMajburiy: true },
  });
  assert.equal(await A(() => zs.sotuvchiMajburiymi(tA.business.id)), true);

  // Direktorning xodim profili yo'q — avto-tanlash ishlamaydi.
  await assert.rejects(
    zakaz({ nomi: "Sotuvchisiz", summa: 100_000, userId: tA.user.id, huquq: true }),
    (e: any) => e instanceof BadRequestError && e.message === "Buyurtmani olgan sotuvchini tanlang"
  );

  // Sotuvchi tanlansa — o'tadi.
  const d = await zakaz({ nomi: "Sotuvchili", summa: 100_000, userId: tA.user.id, sotuvchiId: rustam.id, huquq: true });
  assert.ok(d.id);

  await rawPrisma.hrSetting.updateMany({
    where: { businessId: tA.business.id },
    data: { crmSotuvchiMajburiy: false },
  });
});

// ---------- 23-talab: reyting ----------

test("reyting: 'puli kelgan sotuv' bo'yicha tartiblanadi", async () => {
  const hammasi = await A(() => kpiQ.getSotuvchilarKpi({ businessId: tA.business.id, ...davr() }));
  const orinlar = hammasi.sotuvchilar.map((s: any) => s.orin);
  assert.deepEqual(orinlar, [...orinlar].sort((a: number, b: number) => a - b), "o'rinlar ketma-ket");

  for (let i = 1; i < hammasi.sotuvchilar.length; i++) {
    assert.ok(
      hammasi.sotuvchilar[i - 1].puliKelgan >= hammasi.sotuvchilar[i].puliKelgan,
      "reyting puli kelgan sotuv bo'yicha kamayib boradi"
    );
  }
  assert.equal(hammasi.sotuvchilar[0].employeeId, suhrob.id, "Suhrob — 700 000 puli kelgan");
});

test("sotuvchi tafsiloti: KPI, reyting o'rni va zakazlar lentasi", async () => {
  const detal = await A(() =>
    kpiQ.getSotuvchiDetal({ businessId: tA.business.id, employeeId: rustam.id, ...davr() })
  );
  assert.equal(detal.sotuvchi.ism, "Rustam");
  assert.equal(detal.kpi.yutilgan.soni, 7);
  assert.equal(detal.kpi.konversiya, 70);
  assert.ok(detal.orin !== 0 || detal.kpi.orin > 0);
  assert.ok(detal.zakazlar.length >= 10, "zakazlar lentasi to'ldi");
  assert.ok(detal.zakazlar.every((z: any) => ["TOLIQ", "QISMAN", "TOLANMAGAN"].includes(z.tolovHolati)));
});

test("konversiya funksiyasi qayta ishlatiladigan va sof", () => {
  assert.equal(kpiQ.konversiyaHisobla(17, 3), 85);
  assert.equal(kpiQ.konversiyaHisobla(7, 3), 70);
  assert.equal(kpiQ.konversiyaHisobla(0, 0), 0, "natijasiz davr 0% beradi, NaN emas");
});
