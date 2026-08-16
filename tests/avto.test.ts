/**
 * AVTO REJIMI va IKKI TOMONLAMA QARZDORLIK TESTLARI.
 * createAvtoMashina (naqd/qarzga), sof foyda, createDebt, qarzTolov
 * ikki yo'nalishda (kirim/chiqim), getDebtTotals, AVTO tarifi, tenant izolyatsiyasi.
 * Ishga tushirish: npm run test:avto
 */
process.env.DATABASE_URL = "file:./prisma/test-avto.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let inventory: any;
let qarz: any;
let queries: any;
let plans: any;
let registry: any;
let biznesTuri: any;

let tA: any;
let tB: any;

before(async () => {
  rmSync("prisma/test-avto.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  inventory = await import("@/lib/services/inventory");
  qarz = await import("@/lib/services/qarz");
  queries = await import("@/lib/queries/inventory");
  plans = await import("@/lib/billing/plans");
  registry = await import("@/lib/modules/registry");
  biznesTuri = await import("@/lib/biznesTuri");

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Avto A",
    ism: "A",
    login: "+998955555501",
    parol: "parol12345",
    biznesTuri: "avto",
    plan: "AVTO",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Avto B",
    ism: "B",
    login: "+998955555502",
    parol: "parol12345",
    biznesTuri: "avto",
    plan: "AVTO",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Tarif va rejim ----------

test("AVTO tarifi 200 000 so'm va MOLIYA+OMBOR modullari bilan mavjud", () => {
  const plan = plans.planByCode("AVTO");
  assert.ok(plan, "AVTO tarifi topilmadi");
  assert.equal(plan.oylikNarx, 200_000);
  assert.deepEqual(plan.modullar, ["MOLIYA", "OMBOR", "KUNLIK"]);
});

test("avto biznes omborli, avto rejimda va avto kategoriyalari bilan ochiladi", async () => {
  const business = await rawPrisma.business.findUnique({ where: { id: tA.business.id } });
  assert.equal(business.turi, "avto");
  assert.equal(business.omborli, true);

  const kategoriyalar = await rawPrisma.category.findMany({ where: { businessId: tA.business.id } });
  const nomlar = kategoriyalar.map((k: any) => k.nomi);
  assert.ok(nomlar.includes("Mashina xaridi"), "chiqimda 'Mashina xaridi' bo'lishi kerak");
  assert.ok(nomlar.includes("Rasmiylashtirish (MRB, notarius)"));
  assert.ok(nomlar.includes("Sotuv"));

  // OMBOR moduli darhol yoqilgan.
  const modul = await rawPrisma.tenantModule.findFirst({
    where: { tenantId: tA.tenant.id, code: "OMBOR", isActive: true },
  });
  assert.ok(modul, "OMBOR moduli yoqilmagan");
});

test("computeNav: avto rejimida yorliqlar Avtopark / Mashina sotish bo'ladi", () => {
  const items = registry.computeNav({
    rol: "OWNER",
    yoqilgan: new Set(["MOLIYA", "OMBOR", "BOSHQARUV"]),
    omborli: true,
    avto: true,
  });
  const byHref = Object.fromEntries(items.map((i: any) => [i.href, i.label]));
  assert.equal(byHref["/app/ombor"], "Avtopark");
  assert.equal(byHref["/app/sotuv"], "Mashina sotish");
  // Umumiy rejimda eski nomlar saqlanadi.
  const umumiy = registry.computeNav({
    rol: "OWNER",
    yoqilgan: new Set(["MOLIYA", "OMBOR"]),
    omborli: true,
  });
  assert.equal(umumiy.find((i: any) => i.href === "/app/ombor").label, "Ombor");
});

// ---------- Mashina qabul qilish ----------

test("naqdga olingan mashina: avtoparkka tushadi va chiqim yoziladi", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Malibu 2",
      olinganNarx: 200_000_000,
      sotuvNarx: 230_000_000,
      avtoYil: 2018,
      avtoRaqam: "01A123BC",
      avtoRang: "Oq",
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );
  assert.equal(mashina.miqdor, 1, "mashina avtoparkda turishi kerak");
  assert.equal(mashina.avtoYil, 2018);
  assert.equal(mashina.avtoRaqam, "01A123BC");

  const chiqim = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.findMany({
      where: { businessId: tA.business.id, turi: "chiqim" },
      include: { category: true },
    })
  );
  assert.equal(chiqim.length, 1);
  assert.equal(chiqim[0].summa, 200_000_000);
  assert.equal(chiqim[0].category.nomi, "Mashina xaridi");
});

test("qarzga olingan mashina: chiqim yozilmaydi, 'beriladigan' qarz ochiladi", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Cobalt",
      olinganNarx: 120_000_000,
      sotuvNarx: 135_000_000,
      avtoRaqam: "01B777CC",
      tolovTuri: "qarz",
      egasiNomi: "Sardor aka",
      egasiTel: "+998901112233",
      userId: tA.user.id,
    })
  );

  const qarzlar = await runWithTenant(tA.tenant.id, () =>
    prisma.debt.findMany({ where: { businessId: tA.business.id, turi: "beriladigan" } })
  );
  assert.equal(qarzlar.length, 1);
  assert.equal(qarzlar[0].mijozNomi, "Sardor aka");
  assert.equal(qarzlar[0].jamiSumma, 120_000_000);
  assert.equal(qarzlar[0].productId, mashina.id, "qarz mashinaga bog'lanishi kerak");

  // Qarzga olishda pul chiqmaydi — chiqim tranzaksiyalari soni o'zgarmaydi.
  const chiqimSoni = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.count({ where: { businessId: tA.business.id, turi: "chiqim" } })
  );
  assert.equal(chiqimSoni, 1, "qarzga olishda yangi chiqim yozilmasligi kerak");
});

test("egasi nomisiz qarzga olish rad etiladi", async () => {
  await assert.rejects(
    () =>
      runWithTenant(tA.tenant.id, () =>
        inventory.createAvtoMashina({
          businessId: tA.business.id,
          nomi: "Nexia",
          olinganNarx: 50_000_000,
          tolovTuri: "qarz",
          userId: tA.user.id,
        })
      ),
    /egasining ismi/
  );
});

// ---------- Sotuv va sof foyda ----------

test("naqd sotuv: kirim yoziladi va sof foyda = sotuv − olingan narx", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Malibu 2" } })
  );
  await runWithTenant(tA.tenant.id, () =>
    inventory.createSale({
      businessId: tA.business.id,
      productId: mashina.id,
      miqdor: 1,
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );

  const foyda = await runWithTenant(tA.tenant.id, () => queries.getProductProfitability(tA.business.id));
  const malibu = foyda.find((p: any) => p.nomi === "Malibu 2");
  assert.equal(malibu.daromad, 230_000_000);
  assert.equal(malibu.tannarx, 200_000_000);
  assert.equal(malibu.foyda, 30_000_000);
  assert.equal(malibu.marja, 13);

  const sotilgan = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findUnique({ where: { id: mashina.id } })
  );
  assert.equal(sotilgan.miqdor, 0, "sotilgan mashina avtoparkda qolmasligi kerak");
});

test("qarzga sotuv: 'olinadigan' qarz mashinaga bog'langan holda ochiladi", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Cobalt" } })
  );
  await runWithTenant(tA.tenant.id, () =>
    inventory.createSale({
      businessId: tA.business.id,
      productId: mashina.id,
      miqdor: 1,
      tolovTuri: "qarz",
      mijozNomi: "Jasur",
      mijozTel: "+998907776655",
      userId: tA.user.id,
    })
  );

  const qarz = await runWithTenant(tA.tenant.id, () =>
    prisma.debt.findFirst({ where: { businessId: tA.business.id, mijozNomi: "Jasur" } })
  );
  assert.equal(qarz.turi, "olinadigan");
  assert.equal(qarz.jamiSumma, 135_000_000);
  assert.equal(qarz.productId, mashina.id);
});

// ---------- Ikki tomonlama qarzdorlik ----------

test("getDebtTotals: olinadigan, beriladigan va sof holat to'g'ri hisoblanadi", async () => {
  const jami = await runWithTenant(tA.tenant.id, () => queries.getDebtTotals(tA.business.id));
  assert.equal(jami.olinadigan, 135_000_000, "Jasur qarzi");
  assert.equal(jami.beriladigan, 120_000_000, "Sardor akaga qarz");
  assert.equal(jami.sof, 15_000_000);
});

test("qarz to'lovi (olinadigan) kirim, (beriladigan) chiqim tranzaksiya yaratadi", async () => {
  const olinadigan = await runWithTenant(tA.tenant.id, () =>
    prisma.debt.findFirst({ where: { businessId: tA.business.id, turi: "olinadigan" } })
  );
  await runWithTenant(tA.tenant.id, () =>
    qarz.qarzTolov({
      businessId: tA.business.id,
      debtId: olinadigan.id,
      summa: 35_000_000,
      userId: tA.user.id,
    })
  );

  const beriladigan = await runWithTenant(tA.tenant.id, () =>
    prisma.debt.findFirst({ where: { businessId: tA.business.id, turi: "beriladigan" } })
  );
  const yopilgan = await runWithTenant(tA.tenant.id, () =>
    qarz.qarzTolov({
      businessId: tA.business.id,
      debtId: beriladigan.id,
      summa: 120_000_000,
      userId: tA.user.id,
    })
  );
  assert.equal(yopilgan.isYopilgan, true, "to'liq to'langan qarz yopilishi kerak");

  const txns = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.findMany({
      where: { businessId: tA.business.id },
      include: { category: true },
      orderBy: { createdAt: "desc" },
      take: 2,
    })
  );
  const qarzTolash = txns.find((t: any) => t.category.nomi === "Qarz to'lash");
  const qarzTolovi = txns.find((t: any) => t.category.nomi === "Qarz to'lovi");
  assert.ok(qarzTolash, "beriladigan qarz to'lovi chiqim sifatida yozilishi kerak");
  assert.equal(qarzTolash.turi, "chiqim");
  assert.equal(qarzTolash.summa, 120_000_000);
  assert.ok(qarzTolovi, "olinadigan qarz to'lovi kirim sifatida yozilishi kerak");
  assert.equal(qarzTolovi.turi, "kirim");
  assert.equal(qarzTolovi.summa, 35_000_000);

  const jami = await runWithTenant(tA.tenant.id, () => queries.getDebtTotals(tA.business.id));
  assert.equal(jami.olinadigan, 100_000_000);
  assert.equal(jami.beriladigan, 0);
});

test("createDebt: qo'lda ikki yo'nalishda qarz qo'shiladi, pul harakati yozilmaydi", async () => {
  const oldin = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.count({ where: { businessId: tA.business.id } })
  );
  await runWithTenant(tA.tenant.id, () =>
    inventory.createDebt({
      businessId: tA.business.id,
      turi: "beriladigan",
      mijozNomi: "Ustaxona",
      jamiSumma: 5_000_000,
      muddat: "2026-09-01",
      izoh: "Ta'mirlash uchun",
      userId: tA.user.id,
    })
  );
  const keyin = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.count({ where: { businessId: tA.business.id } })
  );
  assert.equal(keyin, oldin, "qo'lda qarz qo'shish tranzaksiya yaratmasligi kerak");

  const royxat = await runWithTenant(tA.tenant.id, () => queries.listDebts(tA.business.id));
  const ustaxona = royxat.find((d: any) => d.mijozNomi === "Ustaxona");
  assert.equal(ustaxona.turi, "beriladigan");
  assert.equal(ustaxona.qolgan, 5_000_000);
  assert.ok(ustaxona.muddat, "muddat saqlanishi kerak");
});

test("createDebt: to'langan summa qarzdan ko'p bo'lsa rad etiladi", async () => {
  await assert.rejects(
    () =>
      runWithTenant(tA.tenant.id, () =>
        inventory.createDebt({
          businessId: tA.business.id,
          turi: "olinadigan",
          mijozNomi: "Test",
          jamiSumma: 1_000_000,
          tolangan: 2_000_000,
          userId: tA.user.id,
        })
      ),
    /To'langan summa/
  );
});

// ---------- Izolyatsiya ----------

test("tenant izolyatsiyasi: B tenant A ning qarzlari va mashinalarini ko'rmaydi", async () => {
  const bQarzlar = await runWithTenant(tB.tenant.id, () => queries.listDebts(tB.business.id));
  assert.equal(bQarzlar.length, 0);

  const bJami = await runWithTenant(tB.tenant.id, () => queries.getDebtTotals(tB.business.id));
  assert.deepEqual(bJami, { olinadigan: 0, beriladigan: 0, sof: 0 });

  const bMahsulotlar = await runWithTenant(tB.tenant.id, () =>
    queries.listProducts(tB.business.id, { forKassir: false })
  );
  assert.equal(bMahsulotlar.length, 0);
});

// ---------- Matnlar ----------

test("omborMatn: avto rejimida Avtopark, umumiyda Ombor", () => {
  assert.equal(biznesTuri.omborMatn("avto").modul, "Avtopark");
  assert.equal(biznesTuri.omborMatn("umumiy").modul, "Ombor");
  assert.equal(biznesTuri.isAvto("avto"), true);
  assert.equal(biznesTuri.isAvto(null), false);
});

// ---------- Mashina xarajatlari (sof foyda = sotuv − olingan narx − xarajat) ----------

test("naqd xarajat: mashinaga bog'lanadi va chiqim tranzaksiya yoziladi", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Nexia 3",
      olinganNarx: 100_000_000,
      sotuvNarx: 118_000_000,
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );

  await runWithTenant(tA.tenant.id, () =>
    inventory.addProductExpense({
      businessId: tA.business.id,
      productId: mashina.id,
      turi: "tamirlash",
      summa: 3_000_000,
      izoh: "dvigatel",
      userId: tA.user.id,
    })
  );

  const xarajatlar = await runWithTenant(tA.tenant.id, () =>
    queries.listProductExpenses(tA.business.id, mashina.id)
  );
  assert.equal(xarajatlar.length, 1);
  assert.equal(xarajatlar[0].summa, 3_000_000);
  assert.equal(xarajatlar[0].qarzga, false);

  // Chiqim tranzaksiya "Mashina xarajati" kategoriyasida yozilgan bo'lishi kerak.
  const txn = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.findFirst({
      where: { businessId: tA.business.id, summa: 3_000_000, turi: "chiqim" },
      include: { category: true },
    })
  );
  assert.ok(txn, "chiqim tranzaksiya yozilmadi");
  assert.equal(txn.category.nomi, "Mashina xarajati");
});

test("qarzga xarajat: chiqim yozilmaydi, ustaga 'beriladigan' qarz ochiladi", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Nexia 3" } })
  );

  await runWithTenant(tA.tenant.id, () =>
    inventory.addProductExpense({
      businessId: tA.business.id,
      productId: mashina.id,
      turi: "boyoq",
      summa: 2_000_000,
      tolovTuri: "qarz",
      kimga: "Usta Aziz",
      userId: tA.user.id,
    })
  );

  const qarz = await runWithTenant(tA.tenant.id, () =>
    prisma.debt.findFirst({ where: { businessId: tA.business.id, mijozNomi: "Usta Aziz" } })
  );
  assert.equal(qarz.turi, "beriladigan");
  assert.equal(qarz.jamiSumma, 2_000_000);
  assert.equal(qarz.productId, mashina.id);

  const txn = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.findFirst({ where: { businessId: tA.business.id, summa: 2_000_000 } })
  );
  assert.equal(txn, null, "qarzga xarajatda pul harakati yozilmasligi kerak");
});

test("kimga to'lanishi ko'rsatilmasa qarzga xarajat rad etiladi", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Nexia 3" } })
  );
  await assert.rejects(
    () =>
      runWithTenant(tA.tenant.id, () =>
        inventory.addProductExpense({
          businessId: tA.business.id,
          productId: mashina.id,
          turi: "yuvish",
          summa: 100_000,
          tolovTuri: "qarz",
          userId: tA.user.id,
        })
      ),
    /kimga/i
  );
});

test("sof foyda xarajatlardan keyin hisoblanadi", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Nexia 3" } })
  );
  await runWithTenant(tA.tenant.id, () =>
    inventory.createSale({
      businessId: tA.business.id,
      productId: mashina.id,
      miqdor: 1,
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );

  const foyda = await runWithTenant(tA.tenant.id, () => queries.getProductProfitability(tA.business.id));
  const nexia = foyda.find((p: any) => p.nomi === "Nexia 3");
  assert.equal(nexia.daromad, 118_000_000);
  assert.equal(nexia.tannarx, 100_000_000);
  assert.equal(nexia.xarajat, 5_000_000, "3 mln ta'mirlash + 2 mln bo'yoq");
  // Xarajatsiz 18 mln ko'rinardi — aslida 13 mln.
  assert.equal(nexia.foyda, 13_000_000);
  assert.equal(nexia.marja, 11);
});

test("avtopark ro'yxatida har mashina bo'yicha xarajat ko'rinadi", async () => {
  const mahsulotlar = await runWithTenant(tA.tenant.id, () =>
    queries.listProducts(tA.business.id, { forKassir: false })
  );
  const nexia = mahsulotlar.find((p: any) => p.nomi === "Nexia 3");
  assert.equal(nexia.xarajat, 5_000_000);
  const malibu = mahsulotlar.find((p: any) => p.nomi === "Malibu 2");
  assert.equal(malibu.xarajat, 0, "xarajatsiz mashinada 0 bo'lishi kerak");
});

test("naqd xarajatni o'chirish bog'langan chiqimni ham bekor qiladi", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Spark",
      olinganNarx: 70_000_000,
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );
  const xarajat = await runWithTenant(tA.tenant.id, () =>
    inventory.addProductExpense({
      businessId: tA.business.id,
      productId: mashina.id,
      turi: "yuvish",
      summa: 150_000,
      userId: tA.user.id,
    })
  );

  await runWithTenant(tA.tenant.id, () =>
    inventory.deleteProductExpense({
      businessId: tA.business.id,
      expenseId: xarajat.id,
      userId: tA.user.id,
    })
  );

  const qolgan = await runWithTenant(tA.tenant.id, () =>
    queries.listProductExpenses(tA.business.id, mashina.id)
  );
  assert.equal(qolgan.length, 0);

  const txn = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.findFirst({ where: { businessId: tA.business.id, summa: 150_000 } })
  );
  assert.ok(txn.deletedAt, "bog'langan chiqim bekor qilinishi kerak");
});

test("tenant izolyatsiyasi: B tenant A ning mashinasiga xarajat yoza olmaydi", async () => {
  const aMashina = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findFirst({ where: { businessId: tA.business.id, nomi: "Spark" } })
  );
  await assert.rejects(() =>
    runWithTenant(tB.tenant.id, () =>
      inventory.addProductExpense({
        businessId: tB.business.id,
        productId: aMashina.id,
        turi: "tamirlash",
        summa: 1_000_000,
        userId: tB.user.id,
      })
    )
  );
});

// ---------- Kelishilgan narx bilan sotuv ----------

test("kelishilgan narx sotuvda ishlatiladi va kartochkada saqlanadi", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Tracker",
      olinganNarx: 180_000_000,
      sotuvNarx: 210_000_000, // reja
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );

  await runWithTenant(tA.tenant.id, () =>
    inventory.createSale({
      businessId: tA.business.id,
      productId: mashina.id,
      miqdor: 1,
      tolovTuri: "naqd",
      narx: 203_000_000, // savdolashib kelishildi
      userId: tA.user.id,
    })
  );

  const foyda = await runWithTenant(tA.tenant.id, () => queries.getProductProfitability(tA.business.id));
  const tracker = foyda.find((p: any) => p.nomi === "Tracker");
  assert.equal(tracker.daromad, 203_000_000);
  assert.equal(tracker.foyda, 23_000_000);

  const kartochka = await runWithTenant(tA.tenant.id, () =>
    prisma.product.findUnique({ where: { id: mashina.id } })
  );
  assert.equal(kartochka.sotuvNarx, 203_000_000, "haqiqiy narx kartochkada turishi kerak");

  // Naqd kirim ham kelishilgan summa bo'yicha yozilishi kerak.
  const kirim = await runWithTenant(tA.tenant.id, () =>
    prisma.transaction.findFirst({
      where: { businessId: tA.business.id, turi: "kirim", summa: 203_000_000 },
    })
  );
  assert.ok(kirim, "kirim kelishilgan summada yozilmadi");
});

test("narxsiz mashinani narx ko'rsatib sotish mumkin", async () => {
  const mashina = await runWithTenant(tA.tenant.id, () =>
    inventory.createAvtoMashina({
      businessId: tA.business.id,
      nomi: "Tico",
      olinganNarx: 30_000_000,
      // sotuvNarx qo'yilmagan
      tolovTuri: "naqd",
      userId: tA.user.id,
    })
  );

  // Narxsiz sotib bo'lmaydi.
  await assert.rejects(
    () =>
      runWithTenant(tA.tenant.id, () =>
        inventory.createSale({
          businessId: tA.business.id,
          productId: mashina.id,
          miqdor: 1,
          tolovTuri: "naqd",
          userId: tA.user.id,
        })
      ),
    /narx/i
  );

  // Narx ko'rsatilsa — sotiladi.
  await runWithTenant(tA.tenant.id, () =>
    inventory.createSale({
      businessId: tA.business.id,
      productId: mashina.id,
      miqdor: 1,
      tolovTuri: "naqd",
      narx: 35_000_000,
      userId: tA.user.id,
    })
  );
  const foyda = await runWithTenant(tA.tenant.id, () => queries.getProductProfitability(tA.business.id));
  assert.equal(foyda.find((p: any) => p.nomi === "Tico").foyda, 5_000_000);
});

// ---------- Oylik hisobotdagi avto bo'limi ----------

test("oylik hisobotda sotilgan mashinalar va sof foyda ko'rinadi", async () => {
  const report = await import("@/lib/queries/report");
  const { currentMonthString } = await import("@/lib/date");
  const oy = currentMonthString();

  const yakun = await runWithTenant(tA.tenant.id, () => report.getAvtoOylikYakun(tA.business.id, oy));
  assert.ok(yakun.jamiSotilgan >= 3, "shu oyda sotilgan mashinalar bo'lishi kerak");

  // Nexia 3: 118 sotildi, 100 olindi, 5 xarajat -> 13 sof foyda.
  const nexia = yakun.qatorlar.find((q: any) => q.nomi === "Nexia 3");
  assert.ok(nexia, "Nexia 3 hisobotda yo'q");
  assert.equal(nexia.olinganNarx, 100_000_000);
  assert.equal(nexia.xarajat, 5_000_000);
  assert.equal(nexia.sotilganNarx, 118_000_000);
  assert.equal(nexia.sofFoyda, 13_000_000);

  // Yakun har qator yig'indisiga teng bo'lishi kerak.
  assert.equal(
    yakun.jamiSofFoyda,
    yakun.qatorlar.reduce((a: number, q: any) => a + q.sofFoyda, 0)
  );
  assert.equal(
    yakun.jamiXarajat,
    yakun.qatorlar.reduce((a: number, q: any) => a + q.xarajat, 0)
  );

  // getMonthlyReport avto biznesda shu bo'limni qo'shadi.
  const toliq = await runWithTenant(tA.tenant.id, () => report.getMonthlyReport(tA.business.id, oy));
  assert.ok(toliq.avto, "avto biznesda hisobotda avto bo'limi bo'lishi kerak");
  assert.equal(toliq.avto.jamiSofFoyda, yakun.jamiSofFoyda);
});

test("umumiy biznes hisobotida avto bo'limi bo'lmaydi", async () => {
  const report = await import("@/lib/queries/report");
  const { currentMonthString } = await import("@/lib/date");
  const umumiy = await createTenantWithOwner({
    kompaniyaNomi: "Umumiy Do'kon",
    ism: "Egasi",
    login: "+998955555599",
    parol: "parol12345",
  });
  const toliq = await runWithTenant(umumiy.tenant.id, () =>
    report.getMonthlyReport(umumiy.business.id, currentMonthString())
  );
  assert.equal(toliq.avto, null);
});
