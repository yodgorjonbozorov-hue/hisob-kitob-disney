/**
 * XODIM KATEGORIYALARI VA ZAKAZ-XODIM BIRIKTIRUVI TESTLARI.
 *
 * Qamrov: kategoriya CRUD (dublikat nom, tartib, aktiv/noaktiv), a'zolik,
 * CRM buyurtmaga xodim biriktirish (a'zolik majburiy, sotuvchi → mas'ul
 * sinxroni), CRM→Kirim BIR MARTA (dublikat rad), kategoriya analitikasi
 * (KPI, reyting, davr filtri, plan), kirim yozilgach biriktiruv qulfi,
 * noaktiv kategoriya tarixining saqlanishi, eski (biriktiruvsiz)
 * buyurtmalar mosligi, tenant izolyatsiyasi va huquq matritsasi.
 *
 * Ishga tushirish: npm run test:xodim-kategoriya
 */
process.env.DATABASE_URL = "file:./prisma/test-xodim-kategoriya.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let crm: any;
let crmKirim: any;
let xk: any;
let analitika: any;
let effektivHuquqlar: any;
let ForbiddenError: any;
let BadRequestError: any;
let todayDateOnlyString: any;

let tA: any;
let tB: any;
let katBantik: any; // Kirim kategoriyasi (moliyaviy)
let aliUser: any;
let valiUser: any;
let ali: any; // Employee (userId = aliUser)
let vali: any;
let sardor: any; // Diktor — tizim hisobisiz
let jasur: any;
let bekzod: any;
let kSotuvchi: any; // EmployeeCategory (turi=sotuvchi)
let kDiktor: any;
let kShofer: any;
let kBTashuvchi: any; // B tenant kategoriyasi
let deal1: any; // Panda — asosiy stsenariy (16-talab)
let wonStage: any;
let lostStage: any;
let openStage: any;
let bugun: string;
let oyBoshi: string;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tA.tenant.id, fn);
const B = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tB.tenant.id, fn);

before(async () => {
  rmSync("prisma/test-xodim-kategoriya.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  crm = await import("@/lib/crm/service");
  crmKirim = await import("@/lib/crm/kirim");
  xk = await import("@/lib/services/xodimKategoriya");
  analitika = await import("@/lib/queries/kategoriyaAnalitika");
  ({ effektivHuquqlar } = await import("@/lib/permissions/tekshir"));
  ({ ForbiddenError, BadRequestError } = await import("@/lib/auth/guard"));
  ({ todayDateOnlyString } = await import("@/lib/date"));

  bugun = todayDateOnlyString();
  oyBoshi = `${bugun.slice(0, 7)}-01`;

  tA = await createTenantWithOwner({ kompaniyaNomi: "XK Disney", ism: "Direktor", login: "+998946666601", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "XK Boshqa", ism: "B Direktor", login: "+998946666602", parol: "parol12345" });
  for (const t of [tA, tB]) {
    await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
    await rawPrisma.tenantModule.create({ data: { tenantId: t.tenant.id, code: "CRM", isActive: true } });
  }

  katBantik = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "Bantik", turi: "kirim" },
  });

  aliUser = await rawPrisma.user.create({
    data: { ism: "Ali", login: "xk_ali", parolHash: "x", rol: "SELLER", tenantId: tA.tenant.id, businessId: tA.business.id },
  });
  valiUser = await rawPrisma.user.create({
    data: { ism: "Vali", login: "xk_vali", parolHash: "x", rol: "SELLER", tenantId: tA.tenant.id, businessId: tA.business.id },
  });

  ali = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Ali", userId: aliUser.id } });
  vali = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Vali", userId: valiUser.id } });
  sardor = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Sardor" } });
  jasur = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Jasur" } });
  bekzod = await rawPrisma.employee.create({ data: { businessId: tA.business.id, ism: "Bekzod" } });

  await A(() => crm.ensureStages(tA.business.id));
  const stages = await A(() => prisma.stage.findMany({ where: { businessId: tA.business.id } }));
  wonStage = stages.find((s: any) => s.turi === "WON");
  lostStage = stages.find((s: any) => s.turi === "LOST");
  openStage = stages.find((s: any) => s.turi === "OPEN");
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Kategoriya CRUD ----------

test("kategoriya yaratish: tartib avtomatik, dublikat nom rad etiladi", async () => {
  kSotuvchi = await A(() => xk.createKategoriya(tA.business.id, { nomi: "Sotuvchi", turi: "sotuvchi" }));
  kDiktor = await A(() => xk.createKategoriya(tA.business.id, { nomi: "Diktor", turi: "ijrochi" }));
  kShofer = await A(() => xk.createKategoriya(tA.business.id, { nomi: "Shofer", turi: "ijrochi" }));
  assert.equal(kSotuvchi.tartib, 0);
  assert.equal(kDiktor.tartib, 1);
  assert.equal(kShofer.tartib, 2);
  await assert.rejects(
    A(() => xk.createKategoriya(tA.business.id, { nomi: "Diktor", turi: "ijrochi" })),
    BadRequestError
  );
});

test("kategoriya tahriri: nom, tartib; boshqa tenantniki tahrirlab bo'lmaydi", async () => {
  const yangilandi = await A(() =>
    xk.updateKategoriya(tA.business.id, kShofer.id, { nomi: "Haydovchi", tartib: 5 })
  );
  assert.equal(yangilandi.nomi, "Haydovchi");
  assert.equal(yangilandi.tartib, 5);
  await A(() => xk.updateKategoriya(tA.business.id, kShofer.id, { nomi: "Shofer", tartib: 2 }));

  kBTashuvchi = await B(() => xk.createKategoriya(tB.business.id, { nomi: "Tashuvchi", turi: "ijrochi" }));
  // B kontekstida A kategoriyasi topilmaydi (tenant filtri + businessId sharti).
  await assert.rejects(
    B(() => xk.updateKategoriya(tB.business.id, kSotuvchi.id, { nomi: "Hujum" })),
    ForbiddenError
  );
});

test("tenant izolyatsiyasi: har biznes faqat o'z kategoriyalarini ko'radi", async () => {
  const aRoyxat = await A(() => xk.listKategoriyalar(tA.business.id));
  const bRoyxat = await B(() => xk.listKategoriyalar(tB.business.id));
  assert.deepEqual(aRoyxat.map((k: any) => k.nomi), ["Sotuvchi", "Diktor", "Shofer"]);
  assert.deepEqual(bRoyxat.map((k: any) => k.nomi), ["Tashuvchi"]);
});

// ---------- A'zolik ----------

test("a'zolik: saqlash to'liq almashtiradi, boshqa biznes xodimi rad", async () => {
  await A(() => xk.kategoriyaAzolariniSaqlash(tA.business.id, kSotuvchi.id, [ali.id, vali.id]));
  await A(() => xk.kategoriyaAzolariniSaqlash(tA.business.id, kDiktor.id, [sardor.id, jasur.id]));
  await A(() => xk.kategoriyaAzolariniSaqlash(tA.business.id, kShofer.id, [bekzod.id]));

  const bXodim = await rawPrisma.employee.create({ data: { businessId: tB.business.id, ism: "Begona" } });
  await assert.rejects(
    A(() => xk.kategoriyaAzolariniSaqlash(tA.business.id, kSotuvchi.id, [ali.id, bXodim.id])),
    ForbiddenError
  );

  // Almashtirish semantikasi: Vali chiqarilsa faqat Ali qoladi.
  await A(() => xk.kategoriyaAzolariniSaqlash(tA.business.id, kSotuvchi.id, [ali.id]));
  let royxat = await A(() => xk.listKategoriyalar(tA.business.id));
  assert.deepEqual(royxat.find((k: any) => k.id === kSotuvchi.id).azolar.map((a: any) => a.ism), ["Ali"]);
  await A(() => xk.kategoriyaAzolariniSaqlash(tA.business.id, kSotuvchi.id, [ali.id, vali.id]));
});

test("crm formasi: xodim faqat o'z kategoriyasining selektorida chiqadi", async () => {
  const forma = await A(() => xk.crmFormaKategoriyalari(tA.business.id));
  const sotuvchilar = forma.find((k: any) => k.id === kSotuvchi.id).azolar.map((a: any) => a.ism).sort();
  const diktorlar = forma.find((k: any) => k.id === kDiktor.id).azolar.map((a: any) => a.ism).sort();
  assert.deepEqual(sotuvchilar, ["Ali", "Vali"]);
  assert.deepEqual(diktorlar, ["Jasur", "Sardor"]);
  assert.ok(!diktorlar.includes("Bekzod"), "Shofer diktor selektorida chiqmaydi");
});

// ---------- CRM buyurtma biriktiruvi ----------

test("createDeal: xodimlar biriktiriladi, sotuvchi mas'ulni yetaklaydi (16-talab)", async () => {
  deal1 = await A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "Panda",
      summa: 500_000,
      categoryId: katBantik.id,
      sana: bugun,
      userId: tA.user.id,
      xodimlar: [
        { categoryId: kSotuvchi.id, employeeId: ali.id },
        { categoryId: kDiktor.id, employeeId: sardor.id },
        { categoryId: kShofer.id, employeeId: bekzod.id },
      ],
    })
  );
  assert.equal(deal1.masulId, aliUser.id, "sotuvchi (Ali) mas'ul bo'ldi — kirim statistikasi unga yoziladi");

  const biriktiruvlar = await A(() => xk.zakazXodimlari(tA.business.id, deal1.id));
  assert.equal(biriktiruvlar.length, 3);
  assert.deepEqual(
    biriktiruvlar.map((x: any) => `${x.kategoriyaNomi}:${x.ism}`),
    ["Sotuvchi:Ali", "Diktor:Sardor", "Shofer:Bekzod"]
  );
});

test("a'zo bo'lmagan xodim rad — buyurtma umuman yaratilmaydi", async () => {
  const oldin = await A(() => prisma.deal.count({ where: { businessId: tA.business.id } }));
  await assert.rejects(
    A(() =>
      crm.createDeal({
        businessId: tA.business.id,
        nomi: "Xato zakaz",
        summa: 100_000,
        categoryId: katBantik.id,
        sana: bugun,
        userId: tA.user.id,
        // Bekzod diktor emas — shofer.
        xodimlar: [{ categoryId: kDiktor.id, employeeId: bekzod.id }],
      })
    ),
    ForbiddenError
  );
  const keyin = await A(() => prisma.deal.count({ where: { businessId: tA.business.id } }));
  assert.equal(keyin, oldin, "xato ro'yxat bilan buyurtma ochilmadi");
});

// ---------- CRM → Kirim (bir marta) ----------

test("WON + kirim: 500 000 BIR marta yoziladi, sotuvchi Ali'ga tushadi", async () => {
  await A(() =>
    crm.moveDeal({ businessId: tA.business.id, dealId: deal1.id, stageId: wonStage.id, kirimYoz: true, userId: tA.user.id })
  );
  const yangilangan = await A(() => prisma.deal.findFirst({ where: { id: deal1.id, businessId: tA.business.id } }));
  assert.ok(yangilangan.transactionId, "kirim bog'landi");

  const txn = await A(() => prisma.transaction.findFirst({ where: { id: yangilangan.transactionId, businessId: tA.business.id } }));
  assert.equal(txn.summa, 500_000);
  assert.equal(txn.turi, "kirim");
  assert.equal(txn.sotuvchiId, aliUser.id, "kirim sotuvchisi — zakaz sotuvchisi (mas'ul)");
});

test("dublikat yakunlash: kirim IKKINCHI marta yozilmaydi", async () => {
  // To'g'ridan-to'g'ri qayta ko'chirish — xizmat qatlami rad etadi.
  await assert.rejects(
    A(() => crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: deal1.id, userId: tA.user.id })),
    BadRequestError
  );
  // Takroriy WON bosish — jimgina o'tadi, yangi kirim yo'q.
  await A(() =>
    crm.moveDeal({ businessId: tA.business.id, dealId: deal1.id, stageId: wonStage.id, kirimYoz: true, userId: tA.user.id })
  );
  const soni = await A(() => prisma.transaction.count({ where: { businessId: tA.business.id, turi: "kirim", deletedAt: null } }));
  assert.equal(soni, 1, "moliyaviy natija baribir +500 000 (bitta yozuv)");
});

test("kirim yozilgach zakaz xodimlari QULFLANADI (tarix o'zgarmaydi)", async () => {
  await assert.rejects(
    A(() => xk.zakazXodimlariniSaqlash(tA.business.id, deal1.id, [{ categoryId: kSotuvchi.id, employeeId: vali.id }])),
    BadRequestError
  );
  const biriktiruvlar = await A(() => xk.zakazXodimlari(tA.business.id, deal1.id));
  assert.equal(biriktiruvlar.length, 3, "tarixiy biriktiruv joyida");
});

// ---------- Analitika ----------

test("sotuvchi analitikasi: KPI, konversiya va summa bo'yicha reyting", async () => {
  // Vali: 300k WON (kirim yozilmagan — stage bo'yicha yutilgan sanaladi).
  await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Bantik kichik", summa: 300_000, categoryId: katBantik.id,
      sana: bugun, stageId: wonStage.id, userId: tA.user.id,
      xodimlar: [{ categoryId: kSotuvchi.id, employeeId: vali.id }],
    })
  );
  // Ali: 200k LOST.
  await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Bekor bo'lgan", summa: 200_000, categoryId: katBantik.id,
      sana: bugun, stageId: lostStage.id, userId: tA.user.id,
      xodimlar: [{ categoryId: kSotuvchi.id, employeeId: ali.id }],
    })
  );

  const a = await A(() =>
    analitika.getKategoriyaAnalitika({ businessId: tA.business.id, categoryId: kSotuvchi.id, from: oyBoshi, to: bugun })
  );
  assert.equal(a.kpi.jamiZakaz, 3);
  assert.equal(a.kpi.yutilganZakaz, 2);
  assert.equal(a.kpi.jamiSotuv, 800_000);
  assert.equal(a.kpi.konversiya, 67);
  assert.equal(a.kpi.engYaxshi.ism, "Ali");

  const [birinchi, ikkinchi] = a.xodimlar;
  assert.equal(birinchi.ism, "Ali");
  assert.equal(birinchi.orin, 1);
  assert.equal(birinchi.jami, 2);
  assert.equal(birinchi.yutilgan, 1);
  assert.equal(birinchi.yutqazilgan, 1);
  assert.equal(birinchi.summa, 500_000);
  assert.equal(ikkinchi.ism, "Vali");
  assert.equal(ikkinchi.summa, 300_000);
});

test("ijrochi analitikasi: bajarilgan ish soni bo'yicha reyting", async () => {
  for (const nomi of ["Efir 1", "Efir 2"]) {
    await A(() =>
      crm.createDeal({
        businessId: tA.business.id, nomi, summa: 100_000, categoryId: katBantik.id,
        sana: bugun, stageId: wonStage.id, userId: tA.user.id,
        xodimlar: [{ categoryId: kDiktor.id, employeeId: jasur.id }],
      })
    );
  }
  const a = await A(() =>
    analitika.getKategoriyaAnalitika({ businessId: tA.business.id, categoryId: kDiktor.id, from: oyBoshi, to: bugun })
  );
  // Jasur 2 ta bajarilgan, Sardor 1 ta (Panda) — Jasur birinchi.
  assert.equal(a.kpi.yutilganZakaz, 3);
  assert.equal(a.kpi.engYaxshi.ism, "Jasur");
  assert.equal(a.kpi.ortachaZakaz, 2, "3 bajarilgan / 2 qatnashgan xodim");
  assert.equal(a.xodimlar[0].ism, "Jasur");
  assert.equal(a.xodimlar[0].yutilgan, 2);
  assert.equal(a.xodimlar[1].ism, "Sardor");
  assert.equal(a.xodimlar[1].yutilgan, 1);
});

test("davr filtri: boshqa oydagi zakaz tanlangan davrga kirmaydi", async () => {
  await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Iyul zakazi", summa: 400_000, categoryId: katBantik.id,
      sana: "2026-07-15", stageId: wonStage.id, userId: tA.user.id,
      xodimlar: [{ categoryId: kSotuvchi.id, employeeId: ali.id }],
    })
  );
  const iyul = await A(() =>
    analitika.getKategoriyaAnalitika({ businessId: tA.business.id, categoryId: kSotuvchi.id, from: "2026-07-01", to: "2026-07-31" })
  );
  assert.equal(iyul.kpi.jamiZakaz, 1);
  assert.equal(iyul.kpi.jamiSotuv, 400_000);

  const buOy = await A(() =>
    analitika.getKategoriyaAnalitika({ businessId: tA.business.id, categoryId: kSotuvchi.id, from: oyBoshi, to: bugun })
  );
  assert.equal(buOy.kpi.jamiSotuv, 800_000, "iyul zakazi bu oyga qo'shilmadi");
});

test("oylik plan: savdo plani mavjud kirim dvigatelidan hisoblanadi", async () => {
  await rawPrisma.employeePlan.create({
    data: {
      businessId: tA.business.id, employeeId: ali.id, oy: bugun.slice(0, 7),
      planTuri: "savdo", maqsad: 1_000_000, userId: tA.user.id,
    },
  });
  const a = await A(() =>
    analitika.getKategoriyaAnalitika({ businessId: tA.business.id, categoryId: kSotuvchi.id, from: oyBoshi, to: bugun })
  );
  const aliQator = a.xodimlar.find((x: any) => x.ism === "Ali");
  // Kirimga o'tgan yagona zakaz — Panda (500k): natija 500k, foiz 50.
  assert.equal(aliQator.plan.natija, 500_000);
  assert.equal(aliQator.plan.foiz, 50);
});

test("xodim detali: KPI, reyting o'rni va zakazlar lentasi", async () => {
  const d = await A(() =>
    analitika.getXodimKategoriyaDetal({
      businessId: tA.business.id, employeeId: ali.id, categoryId: kSotuvchi.id, from: oyBoshi, to: bugun,
    })
  );
  assert.equal(d.xodim.ism, "Ali");
  assert.equal(d.orin, 1);
  assert.equal(d.stat.jami, 2);
  assert.equal(d.stat.yutilgan, 1);
  assert.equal(d.stat.summa, 500_000);
  assert.equal(d.zakazlar.length, 2);
  const panda = d.zakazlar.find((z: any) => z.nomi === "Panda");
  assert.equal(panda.kirimBor, true);
  assert.equal(panda.kategoriyaNomi, "Sotuvchi");
});

// ---------- Noaktiv kategoriya va tarix ----------

test("noaktiv kategoriya: yangi biriktiruv rad, tarixiy analitika qoladi", async () => {
  await A(() => xk.updateKategoriya(tA.business.id, kShofer.id, { aktiv: false }));

  await assert.rejects(
    A(() =>
      crm.createDeal({
        businessId: tA.business.id, nomi: "Yangi shofer zakazi", summa: 50_000, categoryId: katBantik.id,
        sana: bugun, userId: tA.user.id,
        xodimlar: [{ categoryId: kShofer.id, employeeId: bekzod.id }],
      })
    ),
    ForbiddenError
  );

  // Tablarda ko'rinmaydi, lekin tarixiy hisobot ochiladi.
  const tablar = await A(() => analitika.listKategoriyaTablari(tA.business.id));
  assert.ok(!tablar.some((t: any) => t.id === kShofer.id));
  const a = await A(() =>
    analitika.getKategoriyaAnalitika({ businessId: tA.business.id, categoryId: kShofer.id, from: oyBoshi, to: bugun })
  );
  assert.equal(a.xodimlar.find((x: any) => x.ism === "Bekzod").yutilgan, 1, "Panda qatnashuvi saqlangan");

  await A(() => xk.updateKategoriya(tA.business.id, kShofer.id, { aktiv: true }));
});

test("eski (biriktiruvsiz) buyurtma to'liq amalda qoladi", async () => {
  const eski = await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Eski uslub", summa: 150_000, categoryId: katBantik.id,
      sana: bugun, userId: tA.user.id,
    })
  );
  assert.equal((await A(() => xk.zakazXodimlari(tA.business.id, eski.id))).length, 0);
  const board = await A(() => crm.getBoard(tA.business.id));
  assert.ok(board.deals.some((d: any) => d.id === eski.id), "doska eski uslubdagi buyurtmani ochadi");
});

// ---------- Izolyatsiya va huquqlar ----------

test("tenant izolyatsiyasi: B kontekstida A biriktiruvlari va analitikasi yo'q", async () => {
  const bRows = await B(() => prisma.dealEmployee.findMany({}));
  assert.equal(bRows.length, 0);
  const a = await B(() =>
    analitika.getKategoriyaAnalitika({ businessId: tB.business.id, categoryId: kSotuvchi.id, from: oyBoshi, to: bugun })
  );
  assert.equal(a, null, "A kategoriyasi B biznesida topilmaydi");
});

test("huquq matritsasi: samaradorlik hisoboti faqat boshqaruvchiga", async () => {
  assert.ok(!effektivHuquqlar({ rol: "SELLER" }).has("hisobot.korish"));
  assert.ok(!effektivHuquqlar({ rol: "CASHIER" }).has("hisobot.korish"));
  assert.ok(effektivHuquqlar({ rol: "OWNER" }).has("hisobot.korish"));
  assert.ok(effektivHuquqlar({ rol: "ADMIN" }).has("hisobot.korish"));
});
