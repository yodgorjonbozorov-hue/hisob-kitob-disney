/**
 * XODIMLAR STATISTIKASI TESTLARI (kirimda sotuvchi/xodim).
 *
 * Qamrov: kirimda sotuvchi saqlanishi (default — yozuvchining o'zi), boshqa
 * xodim nomiga yozish huquqi (faqat boshqaruvchi), sotuvchi shu biznesga
 * tegishliligi, CRM buyurtmasi kirimga o'tganda mas'ulga biriktirilishi va
 * BIR MARTA sanalishi, davr/kategoriya/to'lov filtrlari, eski (sotuvchisiz)
 * yozuvlarning userId orqali hisobga tushishi, qarz to'lovlarining
 * chiqarilishi, tenant izolyatsiyasi va `hisobot.korish` huquq qoidasi.
 *
 * Ishga tushirish: npm run test:xodim-statistika
 */
process.env.DATABASE_URL = "file:./prisma/test-xodim-statistika.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let svc: any; // transactionService
let sotuvchiSvc: any;
let stat: any; // queries/xodimStatistika
let crm: any;
let crmKirim: any;
let ForbiddenError: any;
let effektivHuquqlar: any;

let tA: any;
let tB: any;
let kat: any; // "Hovli bezaklari" (kirim)
let katDekor: any; // "Dekoratsiya" (kirim)
/** Sotuvchilar (A tenant): Aziz va Jasur. */
let aziz: any;
let jasur: any;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tA.tenant.id, fn);
const B = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(tB.tenant.id, fn);

before(async () => {
  rmSync("prisma/test-xodim-statistika.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  svc = await import("@/lib/services/transactionService");
  sotuvchiSvc = await import("@/lib/services/sotuvchi");
  stat = await import("@/lib/queries/xodimStatistika");
  crm = await import("@/lib/crm/service");
  crmKirim = await import("@/lib/crm/kirim");
  ({ ForbiddenError } = await import("@/lib/auth/guard"));
  ({ effektivHuquqlar } = await import("@/lib/permissions/tekshir"));

  tA = await createTenantWithOwner({ kompaniyaNomi: "Xodim A", ism: "Direktor", login: "+998945555501", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "Xodim B", ism: "B Direktor", login: "+998945555502", parol: "parol12345" });

  kat = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "Hovli bezaklari", turi: "kirim" },
  });
  katDekor = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "Dekoratsiya", turi: "kirim" },
  });

  aziz = await rawPrisma.user.create({
    data: { ism: "Aziz", login: "xs_aziz", parolHash: "x", rol: "SELLER", tenantId: tA.tenant.id, businessId: tA.business.id },
  });
  jasur = await rawPrisma.user.create({
    data: { ism: "Jasur", login: "xs_jasur", parolHash: "x", rol: "SELLER", tenantId: tA.tenant.id, businessId: tA.business.id },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("kirim: sotuvchi berilmasa yozuvchining o'ziga yoziladi", async () => {
  const txn = await A(() =>
    svc.createTransaction(aziz.id, tA.business.id, {
      turi: "kirim",
      categoryId: kat.id,
      summa: 1_200_000,
      sana: "2026-08-29",
      tolovTuri: "naqd",
      izoh: "Hovli dekor zakazi",
    })
  );
  assert.equal(txn.sotuvchiId, aziz.id, "default — kirituvchining o'zi");
  assert.equal(txn.sotuvchi.ism, "Aziz");
});

test("sotuvchiniHalQil: oddiy sotuvchi boshqa xodim nomiga yoza olmaydi", async () => {
  await assert.rejects(
    A(() =>
      sotuvchiSvc.sotuvchiniHalQil({ userId: aziz.id, rol: "SELLER" }, tA.business.id, {
        turi: "kirim",
        sotuvchiId: jasur.id,
      })
    ),
    ForbiddenError
  );
  // O'zini yoki bo'sh qiymatni berish — muammosiz.
  assert.equal(
    await A(() =>
      sotuvchiSvc.sotuvchiniHalQil({ userId: aziz.id, rol: "SELLER" }, tA.business.id, {
        turi: "kirim",
        sotuvchiId: aziz.id,
      })
    ),
    aziz.id
  );
});

test("sotuvchiniHalQil: boshqaruvchi istalgan biznes xodimini tanlaydi, chiqimda null", async () => {
  const tanlangan = await A(() =>
    sotuvchiSvc.sotuvchiniHalQil({ userId: tA.user.id, rol: "OWNER" }, tA.business.id, {
      turi: "kirim",
      sotuvchiId: jasur.id,
    })
  );
  assert.equal(tanlangan, jasur.id);

  const chiqim = await A(() =>
    sotuvchiSvc.sotuvchiniHalQil({ userId: tA.user.id, rol: "OWNER" }, tA.business.id, {
      turi: "chiqim",
      sotuvchiId: jasur.id,
    })
  );
  assert.equal(chiqim, null, "chiqimda sotuvchi yozilmaydi");
});

test("izolyatsiya: boshqa tenant/biznes xodimi sotuvchi bo'la olmaydi", async () => {
  // Boshqa TENANT foydalanuvchisi — tenant-scoped prisma uni topmaydi.
  await assert.rejects(
    A(() =>
      sotuvchiSvc.sotuvchiniHalQil({ userId: tA.user.id, rol: "OWNER" }, tA.business.id, {
        turi: "kirim",
        sotuvchiId: tB.user.id,
      })
    ),
    ForbiddenError
  );

  // Shu tenant ichida BOSHQA biznesga biriktirilgan xodim ham o'tmaydi.
  const boshqaBiznes = await rawPrisma.business.create({
    data: { nomi: "A ikkinchi", tenantId: tA.tenant.id },
  });
  const begona = await rawPrisma.user.create({
    data: { ism: "Begona", login: "xs_begona", parolHash: "x", rol: "SELLER", tenantId: tA.tenant.id },
  });
  await rawPrisma.userBusiness.create({ data: { userId: begona.id, businessId: boshqaBiznes.id } });
  await assert.rejects(
    A(() =>
      sotuvchiSvc.sotuvchiniHalQil({ userId: tA.user.id, rol: "OWNER" }, tA.business.id, {
        turi: "kirim",
        sotuvchiId: begona.id,
      })
    ),
    ForbiddenError
  );

  // Xodimlar ro'yxati ham biznes chegarasida: begona ko'rinmaydi.
  const royxat = await A(() => sotuvchiSvc.listBiznesXodimlari(tA.business.id));
  assert.ok(royxat.some((x: any) => x.id === aziz.id));
  assert.ok(!royxat.some((x: any) => x.id === begona.id));
});

test("chiqimda sotuvchi saqlanmaydi (service darajasida ham)", async () => {
  const chiqimKat = await rawPrisma.category.create({
    data: { businessId: tA.business.id, nomi: "Xarajat", turi: "chiqim" },
  });
  const txn = await A(() =>
    svc.createTransaction(tA.user.id, tA.business.id, {
      turi: "chiqim",
      categoryId: chiqimKat.id,
      summa: 50_000,
      sana: "2026-08-29",
      tolovTuri: "naqd",
      sotuvchiId: aziz.id, // ataylab berilgan — baribir yozilmaydi
    })
  );
  assert.equal(txn.sotuvchiId, null);
});

test("CRM → Kirim: sotuvchi buyurtma MAS'ULI, zakaz BIR marta sanaladi", async () => {
  await A(() => crm.ensureStages(tA.business.id));
  const deal = await A(() =>
    crm.createDeal({
      businessId: tA.business.id,
      nomi: "Hovli dekor zakazi",
      categoryId: kat.id,
      summa: 2_000_000,
      sana: "2026-08-28",
      userId: jasur.id, // mas'ul — Jasur
    })
  );

  // Ko'chirishni DIREKTOR bosadi — kirim baribir Jasurga yoziladi.
  const txn = await A(() =>
    crmKirim.kirimgaKochirish({
      businessId: tA.business.id,
      dealId: deal.id,
      userId: tA.user.id,
      tolovTuri: "naqd",
    })
  );
  assert.equal(txn.sotuvchiId, jasur.id, "sotuvchi — buyurtma mas'uli");

  // Ikkinchi ko'chirish rad etiladi — dublikat kirim ham, dublikat zakaz ham yo'q.
  await assert.rejects(
    A(() =>
      crmKirim.kirimgaKochirish({
        businessId: tA.business.id,
        dealId: deal.id,
        userId: tA.user.id,
      })
    )
  );

  const s = await A(() =>
    stat.getXodimlarStatistika({ businessId: tA.business.id, from: "2026-08-28", to: "2026-08-28" })
  );
  const jasurQator = s.xodimlar.find((x: any) => x.id === jasur.id);
  assert.equal(jasurQator.zakazlar, 1, "CRM buyurtma + kirim = BITTA zakaz");
  assert.equal(jasurQator.summa, 2_000_000);
});

test("statistika: KPI, reyting, ulush va eski (sotuvchisiz) yozuvlar", async () => {
  // Jasurga yana bitta savdo (30-avg) va Azizga eski uslubdagi yozuv:
  // sotuvchiId NULL — statistika userId orqali hisobga oladi.
  await A(() =>
    svc.createTransaction(jasur.id, tA.business.id, {
      turi: "kirim",
      categoryId: katDekor.id,
      summa: 850_000,
      sana: "2026-08-30",
      tolovTuri: "click",
    })
  );
  await rawPrisma.transaction.create({
    data: {
      turi: "kirim",
      categoryId: kat.id,
      businessId: tA.business.id,
      summa: 700_000,
      sana: new Date("2026-08-30T00:00:00.000Z"),
      userId: aziz.id,
      sotuvchiId: null, // eski yozuv
    },
  });

  const s = await A(() =>
    stat.getXodimlarStatistika({ businessId: tA.business.id, from: "2026-08-01", to: "2026-08-31" })
  );
  // Aziz: 1.2M (29-avg) + 0.7M (eski) = 1.9M / 2 zakaz.
  // Jasur: 2.0M (CRM) + 0.85M = 2.85M / 2 zakaz.
  const a = s.xodimlar.find((x: any) => x.id === aziz.id);
  const j = s.xodimlar.find((x: any) => x.id === jasur.id);
  assert.equal(a.zakazlar, 2);
  assert.equal(a.summa, 1_900_000);
  assert.equal(j.zakazlar, 2);
  assert.equal(j.summa, 2_850_000);
  assert.equal(j.ortacha, 1_425_000);
  assert.equal(s.jamiZakaz, 4);
  assert.equal(s.jamiSumma, 4_750_000);
  assert.equal(s.xodimlar[0].id, jasur.id, "reyting summa bo'yicha");
  assert.equal(j.ulush, 60);
  assert.equal(a.ulush, 40);
  assert.equal(s.topSumma.id, jasur.id);

  // Davr filtri: faqat 29-avg — faqat Azizning 1.2M yozuvi.
  const bir = await A(() =>
    stat.getXodimlarStatistika({ businessId: tA.business.id, from: "2026-08-29", to: "2026-08-29" })
  );
  assert.equal(bir.jamiZakaz, 1);
  assert.equal(bir.jamiSumma, 1_200_000);
  assert.equal(bir.topZakaz.id, aziz.id);
});

test("qarz to'lovi kirimlari statistikaga KIRMAYDI (ikki marta sanalmaydi)", async () => {
  // Qarz to'lovi sifatida yozilgan kirim (tizim yozuvi, sotuvchisiz).
  const tolovTxn = await rawPrisma.transaction.create({
    data: {
      turi: "kirim",
      categoryId: kat.id,
      businessId: tA.business.id,
      summa: 300_000,
      sana: new Date("2026-08-30T00:00:00.000Z"),
      userId: aziz.id,
    },
  });
  const qarz = await rawPrisma.debt.create({
    data: {
      businessId: tA.business.id,
      mijozNomi: "Qarzdor",
      jamiSumma: 300_000,
      tolangan: 300_000,
      userId: aziz.id,
    },
  });
  await rawPrisma.debtPayment.create({
    data: {
      debtId: qarz.id,
      businessId: tA.business.id,
      summa: 300_000,
      userId: aziz.id,
      transactionId: tolovTxn.id,
    },
  });

  const s = await A(() =>
    stat.getXodimlarStatistika({ businessId: tA.business.id, from: "2026-08-01", to: "2026-08-31" })
  );
  const a = s.xodimlar.find((x: any) => x.id === aziz.id);
  assert.equal(a.zakazlar, 2, "to'lov yozuvi zakaz emas");
  assert.equal(a.summa, 1_900_000, "to'lov summasi savdoga qo'shilmaydi");
});

test("xodim detali: yozuvlar, kategoriya va to'lov filtrlari", async () => {
  const d = await A(() =>
    stat.getXodimDetal({
      businessId: tA.business.id,
      xodimId: jasur.id,
      from: "2026-08-01",
      to: "2026-08-31",
    })
  );
  assert.equal(d.xodim.ism, "Jasur");
  assert.equal(d.stat.zakazlar, 2);
  assert.equal(d.stat.summa, 2_850_000);
  assert.equal(d.stat.ortacha, 1_425_000);
  assert.equal(d.items.length, 2);

  const dekor = await A(() =>
    stat.getXodimDetal({
      businessId: tA.business.id,
      xodimId: jasur.id,
      from: "2026-08-01",
      to: "2026-08-31",
      categoryId: katDekor.id,
    })
  );
  assert.equal(dekor.stat.zakazlar, 1);
  assert.equal(dekor.stat.summa, 850_000);

  const click = await A(() =>
    stat.getXodimDetal({
      businessId: tA.business.id,
      xodimId: jasur.id,
      from: "2026-08-01",
      to: "2026-08-31",
      tolov: "click",
    })
  );
  assert.equal(click.stat.zakazlar, 1);
  assert.equal(click.stat.summa, 850_000);
});

test("tenant izolyatsiyasi: B tenant statistikasida A ma'lumoti yo'q", async () => {
  const s = await B(() =>
    stat.getXodimlarStatistika({ businessId: tB.business.id, from: "2026-08-01", to: "2026-08-31" })
  );
  assert.equal(s.jamiZakaz, 0);
  assert.equal(s.jamiSumma, 0);
  assert.equal(s.xodimlar.length, 0);

  // A xodimining detali B biznesi bilan so'ralsa — bo'sh (biznes sharti).
  const d = await B(() =>
    stat.getXodimDetal({ businessId: tB.business.id, xodimId: jasur.id, from: "2026-08-01", to: "2026-08-31" })
  );
  assert.equal(d.stat.zakazlar, 0);
  assert.equal(d.items.length, 0);
});

test("huquq: hisobot.korish sotuvchi/kassirda YO'Q, OWNER/ADMIN da BOR", async () => {
  // API va sahifa aynan shu huquq bilan yopilgan (xodimlar-statistika routelari).
  assert.ok(!effektivHuquqlar({ rol: "SELLER" }).has("hisobot.korish"));
  assert.ok(!effektivHuquqlar({ rol: "CASHIER" }).has("hisobot.korish"));
  assert.ok(effektivHuquqlar({ rol: "OWNER" }).has("hisobot.korish"));
  assert.ok(effektivHuquqlar({ rol: "ADMIN" }).has("hisobot.korish"));
});

test("mavjud hisob-kitoblar o'zgarmagan: jami kirim/chiqim avvalgidek", async () => {
  const { listTransactions } = await import("@/lib/queries/transactions");
  const r = await A(() =>
    listTransactions({ businessId: tA.business.id, from: "2026-08-01", to: "2026-08-31" })
  );
  // Kirim: 1.2M + 2.0M + 0.85M + 0.7M (eski) + 0.3M (qarz to'lovi) = 5.05M
  assert.equal(r.totals.jamiKirim, 5_050_000);
  assert.equal(r.totals.jamiChiqim, 50_000);
  assert.equal(r.totals.sof, 5_000_000);
});
