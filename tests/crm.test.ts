/**
 * CRM KUNLIK BUYURTMALAR TESTLARI.
 *
 * Qamrov: ensureStages, buyurtma yaratish (kategoriya + mijoz + sana),
 * kirimga o'tkazish (Kirim moduli bilan bitta kategoriya manbai),
 * DUBLIKAT KIRIMGA QARSHI HIMOYA (baza cheklovi darajasida), kunlik va
 * kategoriya statistikasi, tenant izolyatsiyasi, modul-rol matritsasi.
 *
 * Ishga tushirish: npm run test:crm
 */
process.env.DATABASE_URL = "file:./prisma/test-crm.db";

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
let crmStat: any;
let guard: any;
let ForbiddenError: any;
let BadRequestError: any;
let todayDateOnlyString: any;

let tA: any;
let tB: any;
/** "Onajon" — Disney Navoiy kirim kategoriyasi (A tenant). */
let katOnajon: any;
let katOtajon: any;

/** Qisqartma: A tenant kontekstida bajarish. */
const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tA.tenant.id, fn);

before(async () => {
  rmSync("prisma/test-crm.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  crm = await import("@/lib/crm/service");
  crmKirim = await import("@/lib/crm/kirim");
  crmStat = await import("@/lib/crm/statistika");
  guard = await import("@/lib/modules/guard");
  ({ ForbiddenError, BadRequestError } = await import("@/lib/auth/guard"));
  ({ todayDateOnlyString } = await import("@/lib/date"));

  tA = await createTenantWithOwner({ kompaniyaNomi: "CRM A", ism: "A", login: "+998944444401", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "CRM B", ism: "B", login: "+998944444402", parol: "parol12345" });
  // Ikkala tenant PRO tarifda (CRM ochiq) — modul yoqilgan.
  for (const t of [tA, tB]) {
    await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
    await rawPrisma.tenantModule.create({ data: { tenantId: t.tenant.id, code: "CRM", isActive: true } });
  }

  // KIRIM kategoriyalari — CRM aynan shulardan foydalanadi.
  katOnajon = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "Onajon", turi: "kirim" },
  });
  katOtajon = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "Otajon", turi: "kirim" },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("ensureStages: 5 ta standart bosqich yaratiladi (idempotent)", async () => {
  await A(() => crm.ensureStages(tA.business.id));
  await A(() => crm.ensureStages(tA.business.id));
  const stages = await A(() =>
    prisma.stage.findMany({ where: { businessId: tA.business.id }, orderBy: { tartib: "asc" } })
  );
  assert.equal(stages.length, 5);
  assert.deepEqual(
    stages.map((s: any) => s.nomi),
    ["Yangi", "Aloqa qilindi", "Taklif yuborildi", "Yutildi", "Yo'qotildi"]
  );
  assert.equal(stages.filter((s: any) => s.turi === "WON").length, 1);
});

test("createDeal: kategoriya, mijoz va sana bilan buyurtma yaratiladi", async () => {
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "Onajon Dekor",
      categoryId: katOnajon.id,
      summa: 500_000,
      kontaktIsm: "Ali",
      kontaktTel: "+998901112233",
      sana: "2026-08-25",
      izoh: "Ertalabki yetkazish",
      userId: tA.user.id,
    })
  );
  assert.equal(deal.contact.ism, "Ali");
  assert.equal(deal.category.nomi, "Onajon");
  assert.equal(deal.summa, 500_000);
  assert.equal(deal.sana.toISOString(), "2026-08-25T00:00:00.000Z");
  const stage = await rawPrisma.stage.findUnique({ where: { id: deal.stageId } });
  assert.equal(stage.nomi, "Yangi", "birinchi OPEN bosqichga tushadi");
  const acts = await A(() => prisma.activity.findMany({ where: { dealId: deal.id } }));
  assert.equal(acts.length, 1);
});

test("createDeal: chiqim kategoriyasi rad etiladi", async () => {
  const chiqim = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "CRM sinov chiqimi", turi: "chiqim" },
  });
  await assert.rejects(
    A(() =>
      crm.createDeal({
        businessId: tA.business.id,
        nomi: "Xato kategoriya",
        categoryId: chiqim.id,
        userId: tA.user.id,
      })
    ),
    BadRequestError
  );
});

test("createDeal: boshqa tenant kategoriyasi rad etiladi (IDOR)", async () => {
  const bKat = await rawPrisma.category.create({
    data: { businessId: tB.business.id, nomi: "Begona", turi: "kirim" },
  });
  await assert.rejects(
    A(() =>
      crm.createDeal({ businessId: tA.business.id, nomi: "Begona kat", categoryId: bKat.id, userId: tA.user.id })
    ),
    ForbiddenError
  );
});

test("createDeal: bir xil telefon — mijoz dublikat qilinmaydi", async () => {
  await A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "Yana buyurtma",
      categoryId: katOnajon.id,
      kontaktIsm: "Ali (2)",
      kontaktTel: "+998901112233",
      userId: tA.user.id,
    })
  );
  const contacts = await A(() => prisma.contact.findMany({ where: { tel: "+998901112233" } }));
  assert.equal(contacts.length, 1);
});

test("kirimgaKochirish: buyurtma kategoriyasi bilan kirim yoziladi", async () => {
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "Otajon Dekor",
      categoryId: katOtajon.id,
      summa: 700_000,
      kontaktIsm: "Vali",
      sana: "2026-08-25",
      userId: tA.user.id,
    })
  );

  const txn = await A(() =>
    crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: deal.id, userId: tA.user.id })
  );

  assert.equal(txn.turi, "kirim");
  assert.equal(txn.summa, 700_000);
  assert.equal(txn.categoryId, katOtajon.id, "kategoriya CRM va Kirimda AYNAN bir xil");
  assert.equal(txn.izoh, "Otajon Dekor — Vali");
  assert.equal(txn.sana.toISOString(), "2026-08-25T00:00:00.000Z", "kirim sanasi — buyurtma sanasi");

  const updated = await rawPrisma.deal.findUnique({ where: { id: deal.id } });
  assert.equal(updated.transactionId, txn.id);
});

test("DUBLIKAT HIMOYASI: ikkinchi o'tkazish rad etiladi, ikkinchi kirim yozilmaydi", async () => {
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "Dekor to'plami",
      categoryId: katOnajon.id,
      summa: 1_200_000,
      userId: tA.user.id,
    })
  );
  await A(() => crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: deal.id, userId: tA.user.id }));

  await assert.rejects(
    A(() => crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: deal.id, userId: tA.user.id })),
    BadRequestError
  );

  const soni = await rawPrisma.transaction.count({
    where: { businessId: tA.business.id, izoh: "Dekor to'plami" },
  });
  assert.equal(soni, 1, "faqat bitta kirim yozuvi qolishi shart");
});

test("DUBLIKAT HIMOYASI BAZADA: bitta kirimni ikki buyurtmaga bog'lab bo'lmaydi", async () => {
  const bir = await A(() =>
    crm.createDeal({ businessId: tA.business.id, nomi: "Bir", categoryId: katOnajon.id, summa: 100_000, userId: tA.user.id })
  );
  const ikki = await A(() =>
    crm.createDeal({ businessId: tA.business.id, nomi: "Ikki", categoryId: katOnajon.id, summa: 100_000, userId: tA.user.id })
  );
  const txn = await A(() =>
    crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: bir.id, userId: tA.user.id })
  );

  // Ilova kodini CHETLAB O'TIB, to'g'ridan-to'g'ri bazaga yozishga urinish.
  // UNIQUE cheklov shu yerda ishlashi shart — himoya faqat kodda emas.
  await assert.rejects(
    rawPrisma.deal.update({ where: { id: ikki.id }, data: { transactionId: txn.id } }),
    /[Uu]nique/
  );
});

test("kirimgaKochirish: summasiz buyurtma rad etiladi", async () => {
  const deal = await A(() =>
    crm.createDeal({ businessId: tA.business.id, nomi: "Narxsiz", categoryId: katOnajon.id, userId: tA.user.id })
  );
  await assert.rejects(
    A(() => crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: deal.id, userId: tA.user.id })),
    BadRequestError
  );
});

test("moveDeal WON + kirimYoz: eski yo'l ham bitta kirim yozadi", async () => {
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "Katta bitim",
      categoryId: katOnajon.id,
      summa: 2_000_000,
      userId: tA.user.id,
    })
  );
  const won = await A(() => prisma.stage.findFirst({ where: { businessId: tA.business.id, turi: "WON" } }));

  await A(() =>
    crm.moveDeal({ businessId: tA.business.id, dealId: deal.id, stageId: won.id, kirimYoz: true, userId: tA.user.id })
  );
  const updated = await rawPrisma.deal.findUnique({ where: { id: deal.id } });
  assert.ok(updated.transactionId, "transactionId yozilishi kerak");
  assert.ok(updated.yopilganAt);

  const txn = await rawPrisma.transaction.findUnique({
    where: { id: updated.transactionId },
    include: { category: true },
  });
  assert.equal(txn.summa, 2_000_000);
  assert.equal(txn.category.nomi, "Onajon");

  // Qayta WON'ga o'tkazishda ikkinchi kirim yozilmaydi.
  await A(() =>
    crm.moveDeal({ businessId: tA.business.id, dealId: deal.id, stageId: won.id, kirimYoz: true, userId: tA.user.id })
  );
  const soni = await rawPrisma.transaction.count({
    where: { businessId: tA.business.id, izoh: { contains: "Katta bitim" } },
  });
  assert.equal(soni, 1);
});

test("kategoriyasiz eski bitim: zaxira 'Sotuv' kategoriyasiga tushadi", async () => {
  const deal = await A(() =>
    crm.createDeal({ businessId: tA.business.id, nomi: "Eski uslub", summa: 300_000, userId: tA.user.id })
  );
  const txn = await A(() =>
    crmKirim.kirimgaKochirish({ businessId: tA.business.id, dealId: deal.id, userId: tA.user.id })
  );
  const cat = await rawPrisma.category.findUnique({ where: { id: txn.categoryId } });
  assert.equal(cat.nomi, "Sotuv");
  assert.equal(cat.turi, "kirim");
});

test("STATISTIKA: kunlik xulosa — jami, kirimga o'tgan va kutilayotgan", async () => {
  const xulosa = await A(() => crmStat.kunlikBuyurtmalar(tA.business.id, "2026-08-25"));
  // Shu kunda: "Onajon Dekor" 500 000 (kirimsiz) + "Otajon Dekor" 700 000 (kirimli).
  assert.equal(xulosa.soni, 2);
  assert.equal(xulosa.jami, 1_200_000);
  assert.equal(xulosa.kirimga, 700_000);
  assert.equal(xulosa.kutilmoqda, 500_000);
  assert.equal(xulosa.jami, xulosa.kirimga + xulosa.kutilmoqda, "uch raqam bir-biriga mos");
});

test("STATISTIKA: boshqa kunda shu buyurtmalar ko'rinmaydi", async () => {
  const xulosa = await A(() => crmStat.kunlikBuyurtmalar(tA.business.id, "2026-08-26"));
  assert.equal(xulosa.soni, 0);
  assert.equal(xulosa.jami, 0);
});

test("STATISTIKA: kategoriya kesimi — Onajon bo'yicha soni va summalar", async () => {
  const qatorlar = await A(() => crmStat.kategoriyaStatistikasi(tA.business.id));
  const onajon = qatorlar.find((q: any) => q.nomi === "Onajon");
  assert.ok(onajon, "Onajon qatori bo'lishi kerak");
  // Onajon buyurtmalari: 500 000 (kirimsiz), 0 (Yana buyurtma), 1 200 000,
  // 100 000 (Bir, kirimli), 100 000 (Ikki), 0 (Narxsiz), 2 000 000.
  assert.equal(onajon.jami, 3_900_000);
  assert.equal(onajon.kirimga, 3_300_000);
  assert.equal(onajon.kutilmoqda, 600_000);
  assert.equal(onajon.soni, 7);

  const otajon = qatorlar.find((q: any) => q.nomi === "Otajon");
  assert.equal(otajon.jami, 700_000);
  assert.equal(otajon.kirimga, 700_000);
  assert.equal(otajon.kutilmoqda, 0);
});

test("KIRIM MODULI: CRM yozuvi oddiy kirim sifatida ro'yxatga tushadi", async () => {
  const { listTransactions } = await import("@/lib/queries/transactions");
  const natija = await A(() =>
    listTransactions({ businessId: tA.business.id, turi: "kirim", categoryId: katOtajon.id, pageSize: 50 })
  );
  const crmYozuv = natija.items.find((t: any) => t.izoh === "Otajon Dekor — Vali");
  assert.ok(crmYozuv, "CRM yozuvi kategoriya filtriga TUSHISHI shart");
  assert.ok(crmYozuv.crmBuyurtma, "manba CRM ekani ko'rinishi kerak");
  assert.equal(crmYozuv.crmBuyurtma.nomi, "Otajon Dekor");
});

test("IZOLYATSIYA: A buyurtmasi B kontekstida ko'rinmaydi va ko'chirib bo'lmaydi", async () => {
  const aDeals = await A(() => prisma.deal.findMany());
  assert.ok(aDeals.length >= 2);

  const bDeals = await runWithTenant(tB.tenant.id, () => prisma.deal.findMany());
  assert.equal(bDeals.length, 0);

  const bKochirish = runWithTenant(tB.tenant.id, async () => {
    await crm.ensureStages(tB.business.id);
    const stage = await prisma.stage.findFirst({ where: { businessId: tB.business.id } });
    return crm.moveDeal({ businessId: tB.business.id, dealId: aDeals[0].id, stageId: stage.id, userId: tB.user.id });
  });
  await assert.rejects(bKochirish, ForbiddenError);
});

test("IZOLYATSIYA: A buyurtmasini B kirimga o'tkaza olmaydi", async () => {
  const aDeal = await A(() => prisma.deal.findFirst({ where: { transactionId: null } }));
  await assert.rejects(
    runWithTenant(tB.tenant.id, () =>
      crmKirim.kirimgaKochirish({ businessId: tB.business.id, dealId: aDeal.id, userId: tB.user.id })
    ),
    ForbiddenError
  );
});

test("modul-rol: SELLER CRM'ga kiradi, CASHIER kirmaydi", async () => {
  const ctx = (rol: string) => ({
    session: { rol },
    tenantId: tA.tenant.id,
    tenant: { ...tA.tenant, plan: "PRO" },
    access: { mode: "FULL" },
  });
  await A(() => guard.requireModule(ctx("SELLER"), "CRM"));
  await assert.rejects(async () => A(() => guard.requireModule(ctx("CASHIER"), "CRM")), ForbiddenError);
});

test("STANDARD tarifda CRM yoqilgan bo'lsa ham ochilmaydi", async () => {
  await rawPrisma.tenant.update({ where: { id: tB.tenant.id }, data: { plan: "STANDARD" } });
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tB.tenant.id } });
  const ctx = { session: { rol: "OWNER" }, tenantId: tB.tenant.id, tenant, access: { mode: "FULL" } };
  await assert.rejects(
    async () => runWithTenant(tB.tenant.id, () => guard.requireModule(ctx, "CRM")),
    ForbiddenError
  );
  // `todayDateOnlyString` importi ishlatiladi — sana yordamchilari mavjudligiga ishonch.
  assert.match(todayDateOnlyString(), /^\d{4}-\d{2}-\d{2}$/);
});
