/**
 * ZAKAZ JAMOASI VA XODIMLAR ANALITIKASI TESTLARI (Disney Navoiy oqimi).
 *
 * Qamrov (topshiriqdagi 40-46 stsenariylar + himoyalar):
 *  40. zakaz yaratish: sotuvchi + animator + shofyor + 2 videochi + bezakchi + dizayner;
 *  41. analitika: har xodimga 1 qatnashuv, kompaniya zakaz soni 1;
 *  42. dublikat: hech narsa o'zgartirmay saqlash — hech kimga +1 emas;
 *  43. xodim almashtirish: eskisi statistikadan chiqadi, yangisi kiradi;
 *  44. multi-select: uchta videochi — uchalasida 1 tadan, zakaz 1 ta;
 *  45. biznes izolyatsiyasi: B xodimi A zakaziga biriktirilmaydi;
 *  46. oy filtri: o'tgan oy zakazi joriy oy KPI'siga qo'shilmaydi;
 *  + kopXodim/zakazgaBiriktiriladi bayroqlari, sifat nazorati (baho),
 *    baho diff saqlashda yo'qolmasligi, jamoa huquqi.
 *
 * Ishga tushirish: npm run test:zakaz-jamoasi
 */
process.env.DATABASE_URL = "file:./prisma/test-zakaz-jamoasi.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let crm: any;
let xk: any;
let jamoa: any;
let bahoXizmat: any;
let analitika: any;
let jamoaKpi: any;
let ForbiddenError: any;
let BadRequestError: any;
let todayDateOnlyString: any;

let tA: any;
let tB: any;
let katBantik: any;
let dostonUser: any;
let doston: any;
let jajon: any;
let ilhom: any;
let fayruza: any;
let sardor: any;
let bekzod: any;
let akmal: any;
let madina: any;
let kSotuvchi: any;
let kAnimator: any;
let kShofyor: any;
let kDiktor: any;
let kVideochi: any;
let kBezakchi: any;
let kDizayner: any;
let kAdmin: any;
let kBVideochi: any;
let bXodim: any;
let panda: any;
let wonStage: any;
let bugun: string;
let oyBoshi: string;
let otganOy: { from: string; to: string };

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tA.tenant.id, fn);
const B = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tB.tenant.id, fn);

/** Xodimning lavozim KPI qatori (joriy oy). */
async function kpi(employeeId: string, categoryId: string, davr = { from: oyBoshi, to: bugun }) {
  const xarita = await A(() => jamoaKpi.getXodimlarJamoaKpi(tA.business.id, davr));
  return xarita.get(employeeId)?.kpi.find((k: any) => k.categoryId === categoryId) ?? null;
}

before(async () => {
  rmSync("prisma/test-zakaz-jamoasi.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  crm = await import("@/lib/crm/service");
  xk = await import("@/lib/services/xodimKategoriya");
  jamoa = await import("@/lib/services/zakazJamoasi");
  bahoXizmat = await import("@/lib/services/zakazBaho");
  analitika = await import("@/lib/queries/kategoriyaAnalitika");
  jamoaKpi = await import("@/lib/queries/xodimJamoaKpi");
  ({ ForbiddenError, BadRequestError } = await import("@/lib/auth/guard"));
  ({ todayDateOnlyString } = await import("@/lib/date"));

  bugun = todayDateOnlyString();
  oyBoshi = `${bugun.slice(0, 7)}-01`;
  const otganOxiri = new Date(new Date(`${oyBoshi}T00:00:00.000Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
  otganOy = { from: `${otganOxiri.slice(0, 7)}-01`, to: otganOxiri };

  tA = await createTenantWithOwner({ kompaniyaNomi: "ZJ Disney Navoiy", ism: "Direktor", login: "+998947777701", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "ZJ Boshqa", ism: "B Direktor", login: "+998947777702", parol: "parol12345" });
  for (const t of [tA, tB]) {
    await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
    await rawPrisma.tenantModule.create({ data: { tenantId: t.tenant.id, code: "CRM", isActive: true } });
  }

  katBantik = await rawPrisma.category.create({ data: { businessId: tA.business.id, nomi: "Tabrik", turi: "kirim" } });
  dostonUser = await rawPrisma.user.create({
    data: { ism: "Doston Disney", login: "zj_doston", parolHash: "x", rol: "SELLER", tenantId: tA.tenant.id, businessId: tA.business.id },
  });

  const xodim = (ism: string, userId?: string) =>
    rawPrisma.employee.create({ data: { businessId: tA.business.id, ism, userId } });
  doston = await xodim("Doston Disney", dostonUser.id);
  jajon = await xodim("Jajon");
  ilhom = await xodim("Ilhom");
  fayruza = await xodim("Fayruza");
  sardor = await xodim("Sardor");
  bekzod = await xodim("Bekzod");
  akmal = await xodim("Akmal");
  madina = await xodim("Madina");
  bXodim = await rawPrisma.employee.create({ data: { businessId: tB.business.id, ism: "Begona" } });

  const kat = (data: any) => A(() => xk.createKategoriya(tA.business.id, data));
  kSotuvchi = await kat({ nomi: "Sotuvchi", turi: "sotuvchi" });
  kAnimator = await kat({ nomi: "Animator / Igrushka", turi: "ijrochi", kopXodim: true });
  kShofyor = await kat({ nomi: "Shofyor", turi: "ijrochi" });
  kDiktor = await kat({ nomi: "Diktor", turi: "ijrochi" });
  kVideochi = await kat({ nomi: "Videochi", turi: "ijrochi", kopXodim: true });
  kBezakchi = await kat({ nomi: "Bezakchi", turi: "ijrochi", kopXodim: true });
  kDizayner = await kat({ nomi: "Dizayner", turi: "ijrochi" });
  kAdmin = await kat({ nomi: "Administrator", turi: "ijrochi", zakazgaBiriktiriladi: false });
  kBVideochi = await B(() => xk.createKategoriya(tB.business.id, { nomi: "Videochi", turi: "ijrochi", kopXodim: true }));

  const azo = (k: any, ids: string[]) => A(() => xk.kategoriyaAzolariniSaqlash(tA.business.id, k.id, ids));
  await azo(kSotuvchi, [doston.id]);
  await azo(kAnimator, [jajon.id]);
  // Ilhom BIR NECHTA lavozimda: Shofyor + Videochi (10-talab).
  await azo(kShofyor, [ilhom.id, jajon.id]);
  await azo(kDiktor, [fayruza.id]);
  await azo(kVideochi, [sardor.id, bekzod.id, ilhom.id]);
  await azo(kBezakchi, [akmal.id, bekzod.id]);
  await azo(kDizayner, [madina.id]);
  await azo(kAdmin, [madina.id]);
  await B(() => xk.kategoriyaAzolariniSaqlash(tB.business.id, kBVideochi.id, [bXodim.id]));

  await A(() => crm.ensureStages(tA.business.id));
  const stages = await A(() => prisma.stage.findMany({ where: { businessId: tA.business.id } }));
  wonStage = stages.find((s: any) => s.turi === "WON");
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Lavozim sozlamalari ----------

test("lavozim bayroqlari: forma ro'yxatida Administrator chiqmaydi, selektorda faqat o'z a'zolari", async () => {
  const forma = await A(() => xk.crmFormaKategoriyalari(tA.business.id));
  const nomlar = forma.map((k: any) => k.nomi);
  assert.ok(!nomlar.includes("Administrator"), "zakazga biriktirilmaydigan lavozim formada yo'q");
  assert.ok(nomlar.includes("Sotuvchi") && nomlar.includes("Videochi"));
  const videochi = forma.find((k: any) => k.id === kVideochi.id);
  assert.equal(videochi.kopXodim, true);
  assert.deepEqual(videochi.azolar.map((a: any) => a.ism).sort(), ["Bekzod", "Ilhom", "Sardor"]);
  const shofyor = forma.find((k: any) => k.id === kShofyor.id);
  assert.ok(!shofyor.azolar.some((a: any) => a.ism === "Sardor"), "Sardor shofyor selektorida chiqmaydi (11-talab)");
});

test("nofaol xodim yangi zakazga tanlanmaydi, lavozim a'zoligi saqlanadi", async () => {
  await rawPrisma.employee.update({ where: { id: fayruza.id }, data: { isActive: false } });
  const forma = await A(() => xk.crmFormaKategoriyalari(tA.business.id));
  assert.equal(forma.find((k: any) => k.id === kDiktor.id).azolar.length, 0);
  await rawPrisma.employee.update({ where: { id: fayruza.id }, data: { isActive: true } });
});

// ---------- 40. Zakaz yaratish ----------

test("40: Panda Masha — sotuvchi + 6 lavozimli jamoa (2 videochi) saqlanadi", async () => {
  panda = await A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "Panda Masha",
      summa: 500_000,
      categoryId: katBantik.id,
      sana: bugun,
      userId: tA.user.id,
      sotuvchiId: doston.id,
      kontaktIsm: "Zebo",
      xodimlar: [
        { categoryId: kAnimator.id, employeeId: jajon.id },
        { categoryId: kShofyor.id, employeeId: ilhom.id },
        { categoryId: kDiktor.id, employeeId: fayruza.id },
        { categoryId: kVideochi.id, employeeId: sardor.id },
        { categoryId: kVideochi.id, employeeId: bekzod.id },
        { categoryId: kBezakchi.id, employeeId: akmal.id },
        { categoryId: kDizayner.id, employeeId: madina.id },
      ],
    })
  );
  assert.equal(panda.masulId, dostonUser.id, "sotuvchi (Doston) mas'ul bo'ldi — eski maydon mos");
  const biriktiruvlar = await A(() => jamoa.zakazXodimlari(tA.business.id, panda.id));
  assert.equal(biriktiruvlar.length, 8, "sotuvchi + 7 jamoa a'zosi");
  const videochilar = biriktiruvlar.filter((x: any) => x.categoryId === kVideochi.id).map((x: any) => x.ism).sort();
  assert.deepEqual(videochilar, ["Bekzod", "Sardor"]);
});

test("kopXodim=false lavozimga ikki xodim rad, zakazga biriktirilmaydigan lavozim rad", async () => {
  await assert.rejects(
    A(() =>
      jamoa.zakazXodimlariniTekshir(tA.business.id, [
        { categoryId: kShofyor.id, employeeId: ilhom.id },
        { categoryId: kShofyor.id, employeeId: jajon.id },
      ])
    ),
    BadRequestError
  );
  await assert.rejects(
    A(() => jamoa.zakazXodimlariniTekshir(tA.business.id, [{ categoryId: kAdmin.id, employeeId: madina.id }])),
    BadRequestError
  );
});

// ---------- 41. Analitika: participation, zakaz soni 1 ----------

test("41: yutilganda har xodimga 1 qatnashuv, kompaniya zakaz soni 1", async () => {
  await A(() => crm.moveDeal({ businessId: tA.business.id, dealId: panda.id, stageId: wonStage.id, userId: tA.user.id }));

  const sotuv = await kpi(doston.id, kSotuvchi.id);
  assert.equal(sotuv.jami, 1);
  assert.equal(sotuv.yutilgan, 1);
  assert.equal(sotuv.summa, 500_000, "sotuvchiga +500 000 sotuv");
  for (const [x, k] of [
    [jajon, kAnimator], [ilhom, kShofyor], [fayruza, kDiktor], [sardor, kVideochi],
    [bekzod, kVideochi], [akmal, kBezakchi], [madina, kDizayner],
  ]) {
    const q = await kpi(x.id, k.id);
    assert.equal(q.jami, 1, `${x.ism} → 1 qatnashuv`);
    assert.equal(q.yutilgan, 1, `${x.ism} → 1 bajarilgan`);
  }
  // Ilhom videochi sifatida qatnashmagan — o'sha lavozimda 0.
  assert.equal((await kpi(ilhom.id, kVideochi.id)).jami, 0);

  const zakazSoni = await A(() => prisma.deal.count({ where: { businessId: tA.business.id, deletedAt: null } }));
  assert.equal(zakazSoni, 1, "8 xodim qatnashgan zakaz kompaniya hisobida 1 ta");
});

// ---------- 42. Dublikat ----------

test("42: hech narsani o'zgartirmay saqlash — biriktiruv id'lari va KPI o'zgarmaydi", async () => {
  const oldin = await A(() => jamoa.zakazXodimlari(tA.business.id, panda.id));
  const ijrochilar = oldin
    .filter((x: any) => x.kategoriyaTuri !== "sotuvchi")
    .map((x: any) => ({ categoryId: x.categoryId, employeeId: x.employeeId }));
  await A(() => jamoa.zakazXodimlariniSaqlash(tA.business.id, panda.id, ijrochilar, tA.user.id));
  const keyin = await A(() => jamoa.zakazXodimlari(tA.business.id, panda.id));
  assert.deepEqual(keyin.map((x: any) => x.id).sort(), oldin.map((x: any) => x.id).sort(), "qatorlar qayta yozilmadi");
  assert.equal((await kpi(sardor.id, kVideochi.id)).jami, 1, "Sardorga ikkinchi +1 tushmadi");
  const lenta = await A(() => prisma.activity.count({ where: { businessId: tA.business.id, dealId: panda.id, matn: { contains: "jamoasi o'zgardi" } } }));
  assert.equal(lenta, 0, "o'zgarish bo'lmagani uchun lentaga yozilmadi");
});

test("baza darajasida dublikat: bir xil biriktiruv ikki marta yozilmaydi (UNIQUE)", async () => {
  await assert.rejects(
    rawPrisma.dealEmployee.create({
      data: { businessId: tA.business.id, dealId: panda.id, categoryId: kVideochi.id, employeeId: sardor.id },
    })
  );
});

// ---------- 43. Xodim almashtirish ----------

test("43: Videochi Sardor → Ilhom: Sardor chiqadi, Ilhom kiradi, lentaga yoziladi", async () => {
  const oldin = await A(() => jamoa.zakazXodimlari(tA.business.id, panda.id));
  const ijrochilar = oldin
    .filter((x: any) => x.kategoriyaTuri !== "sotuvchi")
    .map((x: any) => ({ categoryId: x.categoryId, employeeId: x.employeeId === sardor.id ? ilhom.id : x.employeeId }));
  await A(() => jamoa.zakazXodimlariniSaqlash(tA.business.id, panda.id, ijrochilar, tA.user.id));

  assert.equal((await kpi(sardor.id, kVideochi.id)).jami, 0, "Sardor statistikasida zakaz qolmadi");
  assert.equal((await kpi(ilhom.id, kVideochi.id)).jami, 1, "Ilhom videochi sifatida +1");
  assert.equal((await kpi(ilhom.id, kShofyor.id)).jami, 1, "Ilhom shofyor sifatida ham 1 (bitta zakaz, ikki lavozim)");
  const lenta = await A(() => prisma.activity.findFirst({ where: { businessId: tA.business.id, dealId: panda.id, matn: { contains: "jamoasi o'zgardi" } }, orderBy: { createdAt: "desc" } }));
  assert.ok(lenta && lenta.matn.includes("chiqdi: Sardor") && lenta.matn.includes("qo'shildi: Ilhom"), "tarix: kim chiqdi, kim qo'shildi");
  const sotuvchi = await A(() => jamoa.zakazXodimlari(tA.business.id, panda.id));
  assert.ok(sotuvchi.some((x: any) => x.kategoriyaTuri === "sotuvchi" && x.employeeId === doston.id), "jamoa tahriri sotuvchini o'chirmadi");
  // Qaytaramiz.
  const qaytar = ijrochilar.map((x: any) => (x.categoryId === kVideochi.id && x.employeeId === ilhom.id ? { ...x, employeeId: sardor.id } : x));
  await A(() => jamoa.zakazXodimlariniSaqlash(tA.business.id, panda.id, qaytar, tA.user.id));
});

// ---------- 44. Multi-select ----------

test("44: uchta videochi — uchalasida 1 tadan qatnashuv, zakaz soni 1", async () => {
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Katta to'y", summa: 900_000, categoryId: katBantik.id,
      sana: bugun, stageId: wonStage.id, userId: tA.user.id, sotuvchiId: doston.id,
      xodimlar: [
        { categoryId: kVideochi.id, employeeId: sardor.id },
        { categoryId: kVideochi.id, employeeId: ilhom.id },
        { categoryId: kVideochi.id, employeeId: bekzod.id },
      ],
    })
  );
  const biriktiruvlar = await A(() => jamoa.zakazXodimlari(tA.business.id, deal.id));
  assert.equal(biriktiruvlar.filter((x: any) => x.categoryId === kVideochi.id).length, 3);
  // Sardor va Bekzod: Panda + Katta to'y; Ilhom videochi sifatida faqat Katta to'y
  // (Pandada u shofyor — 43-stsenariyda videochilik qaytarib olingan).
  assert.equal((await kpi(sardor.id, kVideochi.id)).jami, 2, "Sardor: Panda + Katta to'y");
  assert.equal((await kpi(bekzod.id, kVideochi.id)).jami, 2, "Bekzod: Panda + Katta to'y");
  assert.equal((await kpi(ilhom.id, kVideochi.id)).jami, 1, "Ilhom: faqat Katta to'y");
  const soni = await A(() => prisma.deal.count({ where: { businessId: tA.business.id, deletedAt: null } }));
  assert.equal(soni, 2, "ikki zakaz — uch videochi bo'lsa ham");
  const sotuv = await kpi(doston.id, kSotuvchi.id);
  assert.equal(sotuv.yutilgan, 2);
  assert.equal(sotuv.summa, 1_400_000);
});

// ---------- 45. Biznes izolyatsiyasi ----------

test("44b: to'rt animator + so'rovda takrorlangan xodim — 4 qatnashuv, zakaz soni 1", async () => {
  // Animator "kopXodim" — Videochidan boshqa lavozimda ham ko'p tanlov ishlaydi.
  // Jajon ATAYLAB yo'q: uning animator hisobi 46-stsenariyda tekshiriladi.
  const jamoaAzo = [ilhom, sardor, akmal, madina];
  await A(() =>
    xk.kategoriyaAzolariniSaqlash(tA.business.id, kAnimator.id, [jajon.id, ...jamoaAzo.map((x) => x.id)])
  );

  const oldingiZakaz = await A(() => prisma.deal.count({ where: { businessId: tA.business.id, deletedAt: null } }));
  const oldingiKpi = await Promise.all(jamoaAzo.map(async (x) => (await kpi(x.id, kAnimator.id)).jami));

  // Yutilgan QILINMAYDI: sotuvchi summasi boshqa stsenariylarda qat'iy tekshiriladi.
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "To'rt animatorli bayram", summa: 500_000, categoryId: katBantik.id,
      sana: bugun, userId: tA.user.id, sotuvchiId: doston.id,
      xodimlar: [
        ...jamoaAzo.map((x) => ({ categoryId: kAnimator.id, employeeId: x.id })),
        // ATAYLAB takror: bir xodim bir lavozimga ikki marta tushmasligi kerak.
        { categoryId: kAnimator.id, employeeId: ilhom.id },
      ],
    })
  );

  const animatorlar = (await A(() => jamoa.zakazXodimlari(tA.business.id, deal.id))).filter(
    (x: any) => x.categoryId === kAnimator.id
  );
  assert.equal(animatorlar.length, 4, "besh element yuborildi, to'rt yozuv — takror yig'ildi");
  assert.equal(new Set(animatorlar.map((x: any) => x.employeeId)).size, 4, "dublikat xodim yo'q");

  const keyingiKpi = await Promise.all(jamoaAzo.map(async (x) => (await kpi(x.id, kAnimator.id)).jami));
  for (let i = 0; i < jamoaAzo.length; i += 1) {
    assert.equal(keyingiKpi[i], oldingiKpi[i] + 1, "har animatorga aynan +1 qatnashuv");
  }

  const keyingiZakaz = await A(() => prisma.deal.count({ where: { businessId: tA.business.id, deletedAt: null } }));
  assert.equal(keyingiZakaz, oldingiZakaz + 1, "to'rt xodim bo'lsa ham kompaniya zakaz soni +1");
});

test("45: B biznes xodimi/lavozimi A zakaziga biriktirilmaydi", async () => {
  await assert.rejects(
    A(() => jamoa.zakazXodimlariniSaqlash(tA.business.id, panda.id, [{ categoryId: kVideochi.id, employeeId: bXodim.id }])),
    ForbiddenError
  );
  await assert.rejects(
    A(() => jamoa.zakazXodimlariniSaqlash(tA.business.id, panda.id, [{ categoryId: kBVideochi.id, employeeId: bXodim.id }])),
    ForbiddenError
  );
  // B kontekstidan A zakazi umuman ko'rinmaydi.
  await assert.rejects(
    B(() => jamoa.zakazXodimlariniSaqlash(tB.business.id, panda.id, [{ categoryId: kBVideochi.id, employeeId: bXodim.id }])),
    ForbiddenError
  );
  const bKpi = await B(() => jamoaKpi.getXodimlarJamoaKpi(tB.business.id, { from: oyBoshi, to: bugun }));
  assert.ok(!bKpi.has(sardor.id), "A xodimi B analitikasida yo'q");
  assert.equal((await kpi(sardor.id, kVideochi.id)).jami, 2, "A statistikasi buzilmadi");
});

// ---------- 46. Oy filtri ----------

test("46: o'tgan oy zakazi 'Bu oy' KPI'siga qo'shilmaydi", async () => {
  await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "O'tgan oy tabrigi", summa: 300_000, categoryId: katBantik.id,
      sana: otganOy.to, stageId: wonStage.id, userId: tA.user.id, sotuvchiId: doston.id,
      xodimlar: [{ categoryId: kAnimator.id, employeeId: jajon.id }],
    })
  );
  assert.equal((await kpi(jajon.id, kAnimator.id)).jami, 1, "bu oy: faqat Panda");
  assert.equal((await kpi(jajon.id, kAnimator.id, otganOy)).jami, 1, "o'tgan oy: faqat o'tgan oy zakazi");
  assert.equal((await kpi(doston.id, kSotuvchi.id)).summa, 1_400_000, "o'tgan oy sotuvi bu oyga qo'shilmadi");
});

// ---------- Sifat nazorati ----------

test("baho: faqat yutilgan zakaz baholanadi; servis + xodim bahosi saqlanadi", async () => {
  const ochiq = await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Hali ochiq", summa: 100_000, categoryId: katBantik.id,
      sana: bugun, userId: tA.user.id, sotuvchiId: doston.id,
    })
  );
  await assert.rejects(
    A(() => bahoXizmat.zakazBahosiniSaqlash({ businessId: tA.business.id, dealId: ochiq.id, userId: tA.user.id, data: { servisBahosi: 9 } })),
    BadRequestError
  );

  const biriktiruvlar = await A(() => jamoa.zakazXodimlari(tA.business.id, panda.id));
  const sardorQator = biriktiruvlar.find((x: any) => x.employeeId === sardor.id && x.categoryId === kVideochi.id);
  const natija = await A(() =>
    bahoXizmat.zakazBahosiniSaqlash({
      businessId: tA.business.id, dealId: panda.id, userId: tA.user.id,
      data: { servisBahosi: 9, etiroz: "Kechikdi", xodimBaholari: [{ id: sardorQator.id, baho: 8 }] },
    })
  );
  assert.equal(natija.servisBahosi, 9);
  assert.equal(natija.etiroz, "Kechikdi");
  assert.equal(natija.xodimlar.find((x: any) => x.id === sardorQator.id).baho, 8);

  // Ikkinchi saqlash yangi yozuv yaratmaydi (dealId UNIQUE) — yangilaydi.
  await A(() => bahoXizmat.zakazBahosiniSaqlash({ businessId: tA.business.id, dealId: panda.id, userId: tA.user.id, data: { servisBahosi: 10 } }));
  assert.equal(await rawPrisma.dealFeedback.count({ where: { dealId: panda.id } }), 1);
  assert.equal((await A(() => bahoXizmat.zakazBahosi(tA.business.id, panda.id))).etiroz, "Kechikdi", "berilmagan maydon tegilmadi");
});

test("baho: xodim profilida o'rtacha baho; diff saqlash bahoni yo'qotmaydi", async () => {
  const q = await kpi(sardor.id, kVideochi.id);
  assert.equal(q.ortachaBaho, 8);
  assert.equal(q.bahoSoni, 1);
  const a = await A(() =>
    analitika.getKategoriyaAnalitika({ businessId: tA.business.id, categoryId: kVideochi.id, from: oyBoshi, to: bugun })
  );
  assert.equal(a.xodimlar.find((x: any) => x.employeeId === sardor.id).ortachaBaho, 8);
  assert.equal(a.kpi.ortachaBaho, 8);

  // Jamoada faqat dizaynerni almashtiramiz — Sardor qatori (va bahosi) o'z joyida qoladi.
  const oldin = await A(() => jamoa.zakazXodimlari(tA.business.id, panda.id));
  const ijrochilar = oldin
    .filter((x: any) => x.kategoriyaTuri !== "sotuvchi" && x.categoryId !== kDizayner.id)
    .map((x: any) => ({ categoryId: x.categoryId, employeeId: x.employeeId }));
  await A(() => jamoa.zakazXodimlariniSaqlash(tA.business.id, panda.id, ijrochilar, tA.user.id));
  assert.equal((await kpi(sardor.id, kVideochi.id)).ortachaBaho, 8, "baho saqlanib qoldi");
  assert.equal((await kpi(madina.id, kDizayner.id)).jami, 0, "dizayner chiqarildi");
});

test("baho: B biznes biriktiruvi id'siga baho tushmaydi", async () => {
  const bDeal = await B(() =>
    crm.createDeal({
      businessId: tB.business.id, nomi: "B zakaz", summa: 50_000, sana: bugun, userId: tB.user.id,
      xodimlar: [{ categoryId: kBVideochi.id, employeeId: bXodim.id }],
    })
  );
  const bQator = await rawPrisma.dealEmployee.findFirst({ where: { dealId: bDeal.id } });
  await assert.rejects(
    A(() =>
      bahoXizmat.zakazBahosiniSaqlash({
        businessId: tA.business.id, dealId: panda.id, userId: tA.user.id,
        data: { xodimBaholari: [{ id: bQator.id, baho: 1 }] },
      })
    ),
    ForbiddenError
  );
  assert.equal((await rawPrisma.dealEmployee.findUnique({ where: { id: bQator.id } })).baho, null);
});

// ---------- Huquq ----------

test("jamoa huquqi: huquqsiz foydalanuvchi faqat o'z (yakunlanmagan) zakazini o'zgartiradi", async () => {
  const ozi = await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Doston zakazi", summa: 10_000, categoryId: katBantik.id,
      sana: bugun, userId: dostonUser.id, sotuvchiId: doston.id,
    })
  );
  const ruxsat = (dealId: string, userId: string, huquqBor = false) =>
    A(() => jamoa.jamoaOzgartiraOladimi({ businessId: tA.business.id, dealId, userId, huquqBor }));
  assert.equal(await ruxsat(ozi.id, dostonUser.id), true, "o'z zakazi, ochiq");
  // YUTILDI endi to'siq emas: eski zakaz attributionini tuzatish ish oqimi.
  assert.equal(await ruxsat(panda.id, dostonUser.id), true, "yutilgan bo'lsa ham O'Z zakazi — tuzatsa bo'ladi");
  assert.equal(await ruxsat(ozi.id, tA.user.id), false, "boshqaning zakazi, huquq yo'q");
  assert.equal(await ruxsat(ozi.id, tA.user.id, true), true, "crm.jamoa bilan — ha");
});

test("kirim yozilgach jamoa OCHIQ qoladi, pul yozuvi esa tegilmaydi", async () => {
  // AVVAL: kirim yozilgan zakaz jamoasi butunlay qulflangan edi. ENDI
  // attribution tuzatish qo'llab-quvvatlanadi (xodimlar tarixni to'ldirib
  // chiqadi), pul esa alohida yo'lda qulf: bu funksiya `Transaction` ga
  // umuman tegmaydi.
  const crmKirim = await import("@/lib/crm/kirim");
  await A(() => crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: panda.id, userId: tA.user.id }));
  const oldin = await A(() =>
    prisma.transaction.aggregate({
      where: { businessId: tA.business.id, turi: "kirim", deletedAt: null },
      _sum: { summa: true },
      _count: true,
    })
  );

  const hozirgi = await A(() => jamoa.zakazXodimlari(tA.business.id, panda.id));
  const ijrochilar = hozirgi
    .filter((x: any) => x.kategoriyaTuri !== "sotuvchi")
    .map((x: any) => ({ categoryId: x.categoryId, employeeId: x.employeeId }));
  await A(() =>
    jamoa.zakazXodimlariniSaqlash(
      tA.business.id,
      panda.id,
      [...ijrochilar, { categoryId: kBezakchi.id, employeeId: akmal.id }],
      tA.user.id
    )
  );
  const keyin = await A(() => jamoa.zakazXodimlari(tA.business.id, panda.id));
  assert.ok(
    keyin.some((x: any) => x.categoryId === kBezakchi.id && x.employeeId === akmal.id),
    "kirimli zakazga bezakchi qo'shildi"
  );

  const kirimKeyin = await A(() =>
    prisma.transaction.aggregate({
      where: { businessId: tA.business.id, turi: "kirim", deletedAt: null },
      _sum: { summa: true },
      _count: true,
    })
  );
  assert.equal(kirimKeyin._count, oldin._count, "kirim yozuvlari soni o'zgarmadi");
  assert.equal(kirimKeyin._sum.summa, oldin._sum.summa, "kirim summasi o'zgarmadi");
});

test("avto-tanlash yo'q: sotuvchi yuborilmasa zakaz SOTUVCHISIZ tug'iladi", async () => {
  // dostonUser sotuvchi lavozimida (kSotuvchi a'zosi), lekin `sotuvchiId`
  // yuborilmagani uchun server uni O'ZI tanlab qo'ymasligi kerak: umumiy
  // kompyuterda kirgan hisob zakazni kim sotganini bildirmaydi.
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Sotuvchisiz zakaz", summa: 200_000, categoryId: katBantik.id,
      sana: bugun, userId: dostonUser.id,
    })
  );
  const biriktiruvlar = await A(() => jamoa.zakazXodimlari(tA.business.id, deal.id));
  assert.equal(
    biriktiruvlar.filter((x: any) => x.kategoriyaTuri === "sotuvchi").length,
    0,
    "kirgan foydalanuvchidan sotuvchi TAXMIN QILINMAYDI"
  );
});

test("kirim yozilgan zakazda ham xodim attribution tahrirlanadi (pul tegilmaydi)", async () => {
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Kirimli tarixiy zakaz", summa: 400_000, tolangan: 400_000,
      categoryId: katBantik.id, sana: bugun, stageId: wonStage.id, userId: tA.user.id, sotuvchiId: doston.id,
    })
  );
  // WON bosqichida yaratilgan va to'liq to'langan zakazga kirim DARHOL
  // yoziladi (`lib/crm/yakunlash.ts`) — alohida "kirimga o'tkazish" yo'q.
  assert.ok(deal.transactionId, "yaratilishi bilan kirim yozildi");
  const kirimOldin = await A(() =>
    prisma.transaction.aggregate({ where: { businessId: tA.business.id, turi: "kirim", deletedAt: null }, _sum: { summa: true }, _count: true })
  );

  // Endi ijrochilarni to'ldirib chiqamiz — bu ATTRIBUTION tuzatishi.
  await A(() =>
    jamoa.zakazXodimlariniSaqlash(tA.business.id, deal.id, [
      { categoryId: kVideochi.id, employeeId: sardor.id },
      { categoryId: kVideochi.id, employeeId: bekzod.id },
    ], tA.user.id)
  );
  const biriktiruvlar = await A(() => jamoa.zakazXodimlari(tA.business.id, deal.id));
  assert.equal(biriktiruvlar.filter((x: any) => x.categoryId === kVideochi.id).length, 2, "kirimli zakazga videochi qo'shildi");
  assert.ok(
    biriktiruvlar.some((x: any) => x.kategoriyaTuri === "sotuvchi" && x.employeeId === doston.id),
    "sotuvchi saqlanib qoldi"
  );

  const kirimKeyin = await A(() =>
    prisma.transaction.aggregate({ where: { businessId: tA.business.id, turi: "kirim", deletedAt: null }, _sum: { summa: true }, _count: true })
  );
  assert.equal(kirimKeyin._count, kirimOldin._count, "kirim yozuvlari soni o'zgarmadi");
  assert.equal(kirimKeyin._sum.summa, kirimOldin._sum.summa, "kirim summasi o'zgarmadi");
});

test("tasdiqlanmagan biriktiruv KPI'ga kirmaydi; saqlansa TASDIQLANADI", async () => {
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id, nomi: "Taxmin qilingan zakaz", summa: 150_000, categoryId: katBantik.id,
      sana: bugun, stageId: wonStage.id, userId: tA.user.id, sotuvchiId: doston.id,
    })
  );
  // Mashina TAXMINI: tasdiqlanmagan videochi biriktiruvi (migratsiya naqshi).
  await rawPrisma.dealEmployee.create({
    data: { businessId: tA.business.id, dealId: deal.id, categoryId: kVideochi.id, employeeId: ilhom.id, tasdiqlangan: false },
  });
  const oldin = (await kpi(ilhom.id, kVideochi.id)).jami;

  const yana = (await kpi(ilhom.id, kVideochi.id)).jami;
  assert.equal(yana, oldin, "tasdiqlanmagan qator KPI'ni oshirmadi");

  // Odam ochib SAQLADI — ayni tanlov qoldirildi, demak tasdiqladi.
  await A(() =>
    jamoa.zakazXodimlariniSaqlash(tA.business.id, deal.id, [
      { categoryId: kVideochi.id, employeeId: ilhom.id },
    ], tA.user.id)
  );
  const qator = await rawPrisma.dealEmployee.findFirst({
    where: { businessId: tA.business.id, dealId: deal.id, categoryId: kVideochi.id, employeeId: ilhom.id },
    select: { tasdiqlangan: true, tasdiqlaganUserId: true },
  });
  assert.equal(qator?.tasdiqlangan, true, "saqlash tasdiqladi");
  assert.equal(qator?.tasdiqlaganUserId, tA.user.id, "kim tasdiqlagani yozildi");
  assert.equal((await kpi(ilhom.id, kVideochi.id)).jami, oldin + 1, "tasdiqlangach KPI'ga kirdi");
});
