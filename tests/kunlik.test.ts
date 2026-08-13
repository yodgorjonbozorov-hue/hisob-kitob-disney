/**
 * KUNLIK HISOBOT TESTLARI.
 *
 * Asosiy invariantlar:
 *  - bir biznes + bir sana = bitta hisobot (parallel kiritishda ham);
 *  - jami = naqd + click + qarz, har mutatsiyada bazadan qayta jamlanadi;
 *  - tasdiqlangan kunga yozib/o'zgartirib bo'lmaydi, qayta tasdiqlash rad;
 *  - tasdiqlash — faqat tayinlangan direktor (yo'q bo'lsa boshqaruvchi);
 *  - yangi kun 0 dan boshlanadi, eski kunlar tarixda qoladi;
 *  - tenant izolyatsiyasi.
 *
 * Ishga tushirish: npm run test:kunlik
 */
process.env.DATABASE_URL = "file:./prisma/test-kunlik.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let kunlikSvc: any;
let kunlikQ: any;
let validation: any;
let date: any;
let createTenantWithOwner: any;

let tA: any;
let tB: any;
let kassir: any;
let bugun: string;

function A(fn: () => unknown): Promise<any> {
  return runWithTenant(tA.tenant.id, fn, { userId: tA.user.id, ism: "A egasi" });
}
function B(fn: () => unknown): Promise<any> {
  return runWithTenant(tB.tenant.id, fn, { userId: tB.user.id, ism: "B egasi" });
}

const egaAktor = () => ({ userId: tA.user.id, ism: "A egasi", rol: "OWNER" });
const kassirAktor = () => ({ userId: kassir.id, ism: kassir.ism, rol: "CASHIER" });

before(async () => {
  rmSync("prisma/test-kunlik.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  kunlikSvc = await import("@/lib/services/kunlik");
  kunlikQ = await import("@/lib/queries/kunlik");
  validation = await import("@/lib/validation/kunlik");
  date = await import("@/lib/date");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Kunlik A",
    ism: "A egasi",
    login: "+998900000101",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Kunlik B",
    ism: "B egasi",
    login: "+998900000102",
    parol: "parol12345",
  });

  // Sana chegarasi guard'i (C-4) biznes yaratilishidan oldingi kunni rad etadi.
  // Testlar esa o'tgan sanalar bilan ishlaydi — biznes "eski" qilib belgilanadi.
  await rawPrisma.business.updateMany({
    where: { id: { in: [tA.business.id, tB.business.id] } },
    data: { createdAt: new Date("2020-01-01T00:00:00.000Z") },
  });

  // Kassir — keyinchalik direktor etib tayinlanadi (rol emas, tayinlov muhim).
  kassir = await rawPrisma.user.create({
    data: {
      ism: "Abdulloh Karimov",
      login: "+998900000103",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: tA.tenant.id,
      businessId: tA.business.id,
    },
  });

  bugun = kunlikSvc.kunlikBugun();
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Toshkent kun chegarasi ----------

test("todayTashkentDateOnlyString UTC+5 bo'yicha kunni beradi", () => {
  // 20:30 UTC = 01:30 Toshkent (ertasi kun)
  assert.equal(
    date.todayTashkentDateOnlyString(new Date("2026-08-11T20:30:00.000Z")),
    "2026-08-12"
  );
  // 18:00 UTC = 23:00 Toshkent (o'sha kun)
  assert.equal(
    date.todayTashkentDateOnlyString(new Date("2026-08-11T18:00:00.000Z")),
    "2026-08-11"
  );
});

// ---------- Zod ----------

test("0 va manfiy summa, noto'g'ri to'lov turi rad etiladi", () => {
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: 0, tolovTuri: "CASH" }).success, false);
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: -5, tolovTuri: "CASH" }).success, false);
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: 10.5, tolovTuri: "CASH" }).success, false);
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: 100, tolovTuri: "PAYPAL" }).success, false);
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: 100, tolovTuri: "CLICK" }).success, true);
});

// ---------- Tushum kiritish va jamlash ----------

test("tushum bugungi hisobotga tushadi, jami avtomatik hisoblanadi", async () => {
  await A(() => kunlikSvc.addKunlikTushum(tA.business.id, egaAktor(), { summa: 2_500_000, tolovTuri: "CASH" }));
  await A(() => kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa: 1_350_000, tolovTuri: "CLICK", izoh: "terminal" }));
  await A(() => kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa: 500_000, tolovTuri: "DEBT" }));

  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, 2_500_000);
  assert.equal(r.clickSumma, 1_350_000);
  assert.equal(r.qarzSumma, 500_000);
  assert.equal(r.jamiSumma, 4_350_000);
  assert.equal(r.holat, "OPEN");
  assert.equal(r.items.length, 3);
  // Kim kiritgani saqlanadi
  assert.equal(r.items.some((i: any) => i.userIsm === "Abdulloh Karimov"), true);
});

test("parallel kiritish dublikat hisobot ochmaydi (race)", async () => {
  const soni = 8;
  await Promise.all(
    Array.from({ length: soni }, (_, i) =>
      A(() => kunlikSvc.addKunlikTushum(tA.business.id, egaAktor(), { summa: 10_000 + i, tolovTuri: "CASH" }))
    )
  );
  const reportlar = await A(() =>
    prisma.dailyReport.findMany({ where: { businessId: tA.business.id } })
  );
  assert.equal(reportlar.length, 1);
  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.items.length, 3 + soni);
  const kutilgan = 4_350_000 + Array.from({ length: soni }, (_, i) => 10_000 + i).reduce((a, b) => a + b, 0);
  assert.equal(r.jamiSumma, kutilgan);
});

// ---------- Direktor tayinlanmaganda: boshqaruvchi fallback ----------

test("direktor yo'q bo'lsa boshqaruvchi tasdiqlaydi (bo'sh kun 0 bilan)", async () => {
  const r = await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, egaAktor(), "2026-08-01"));
  assert.equal(r.holat, "CONFIRMED");
  assert.equal(r.jamiSumma, 0);
  assert.equal(r.confirmedByIsm, "A egasi");
});

test("oddiy xodim tasdiqlay olmaydi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun)),
    /direktor/i
  );
});

test("kelajak kunni tasdiqlab bo'lmaydi", async () => {
  const ertaga = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() + 24 * 60 * 60 * 1000)
  );
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, egaAktor(), ertaga)),
    /kelajak/i
  );
});

// ---------- Direktor tayinlash ----------

test("begona tenant foydalanuvchisini direktor qilib bo'lmaydi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.setKunlikDirektor(tA.business.id, tB.user.id)),
    /topilmadi/i
  );
});

test("direktor tayinlanadi va almashtirilishi mumkin", async () => {
  await A(() => kunlikSvc.setKunlikDirektor(tA.business.id, kassir.id));
  const d = await A(() => kunlikQ.getKunlikDirektor(tA.business.id));
  assert.equal(d.direktorId, kassir.id);
  assert.equal(d.direktorIsm, "Abdulloh Karimov");
});

test("direktor tayinlangach boshqaruvchi tasdiqlay olmaydi, direktor tasdiqlaydi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, egaAktor(), bugun)),
    /direktor/i
  );

  const r = await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun));
  assert.equal(r.holat, "CONFIRMED");
  assert.equal(r.confirmedBy, kassir.id);
  assert.equal(r.confirmedByIsm, "Abdulloh Karimov");
  assert.ok(r.confirmedAt);
});

// ---------- Tasdiqlangan kun qulflanadi ----------

test("bir kunni qayta tasdiqlash rad etiladi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun)),
    /allaqachon tasdiqlangan/i
  );
});

test("tasdiqlangan kunga tushum kiritib bo'lmaydi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa: 1_000, tolovTuri: "CASH" })),
    /tasdiqlangan/i
  );
});

test("tasdiqlangan kun tushumini o'zgartirish/o'chirish rad etiladi", async () => {
  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  const id = r.items[0].id;
  await assert.rejects(
    () => A(() => kunlikSvc.updateKunlikTushum(tA.business.id, egaAktor(), id, { summa: 999 })),
    /tasdiqlangan/i
  );
  await assert.rejects(
    () => A(() => kunlikSvc.deleteKunlikTushum(tA.business.id, egaAktor(), id)),
    /tasdiqlangan/i
  );
});

// ---------- Qayta ochish va tuzatish ----------

test("qayta ochish: xodimga taqiq, direktor/boshqaruvchiga ruxsat; keyin tuzatiladi", async () => {
  const oddiyXodim = { userId: "yoq-user", ism: "Xodim", rol: "SELLER" as const };
  await assert.rejects(
    () => A(() => kunlikSvc.reopenKunlikReport(tA.business.id, oddiyXodim, bugun, "Test uchun qayta ochish")),
    /direktor|boshqaruvchi/i
  );

  const ochildi = await A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun, "Test uchun qayta ochish"));
  assert.equal(ochildi.holat, "OPEN");
  assert.equal(ochildi.confirmedBy, null);

  // Tuzatish: bitta tushum o'chiriladi — jami kamayadi (soft delete, tarixda qoladi)
  const r1 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  const oxirgi = r1.items[0];
  await A(() => kunlikSvc.deleteKunlikTushum(tA.business.id, egaAktor(), oxirgi.id));
  const r2 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r2.jamiSumma, r1.jamiSumma - oxirgi.summa);
  assert.equal(r2.items.length, r1.items.length - 1);
  const ochirilgan = await rawPrisma.dailyTransaction.findUnique({ where: { id: oxirgi.id } });
  assert.ok(ochirilgan.deletedAt);

  // Tahrirlash ham ishlaydi va qayta jamlanadi
  const t = r2.items[0];
  await A(() => kunlikSvc.updateKunlikTushum(tA.business.id, egaAktor(), t.id, { summa: t.summa + 1_000 }));
  const r3 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r3.jamiSumma, r2.jamiSumma + 1_000);

  // Kun qayta tasdiqlanadi
  const r4 = await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun));
  assert.equal(r4.holat, "CONFIRMED");
  assert.equal(r4.jamiSumma, r3.jamiSumma);
});

// ---------- Tarix va yangi kun ----------

test("tarix saqlanadi: eski kun o'z summasi bilan, boshqa kun unga ta'sir qilmaydi", async () => {
  const tarix = await A(() => kunlikQ.listKunlikTarix(tA.business.id));
  assert.equal(tarix.length, 2); // bugun + 2026-08-01
  assert.equal(tarix[0].sana, bugun);
  const eski = tarix.find((x: any) => x.sana === "2026-08-01");
  assert.equal(eski.jamiSumma, 0);
  assert.equal(eski.holat, "CONFIRMED");

  // Hisobot ochilmagan kun 0 dan boshlanadi (virtual DTO)
  const bosh = await A(() => kunlikQ.getKunlikReport(tA.business.id, "2026-08-05"));
  assert.equal(bosh.id, null);
  assert.equal(bosh.jamiSumma, 0);
  assert.equal(bosh.holat, "OPEN");
});

// ---------- Ruxsat matritsasi ----------

test("getKunlikRuxsat: direktor/boshqaruvchi/xodim to'g'ri ajratiladi", async () => {
  const ega = await A(() => kunlikSvc.getKunlikRuxsat(tA.business.id, egaAktor()));
  assert.equal(ega.boshqaruvchimi, true);
  assert.equal(ega.direktormi, false);
  assert.equal(ega.tasdiqlaydi, false); // direktor tayinlangan — ega tasdiqlamaydi
  assert.equal(ega.tahrirlaydi, true);
  assert.equal(ega.tarixniKoradi, true);

  const dir = await A(() => kunlikSvc.getKunlikRuxsat(tA.business.id, kassirAktor()));
  assert.equal(dir.direktormi, true);
  assert.equal(dir.tasdiqlaydi, true);
  assert.equal(dir.tarixniKoradi, true);

  const xodim = await A(() =>
    kunlikSvc.getKunlikRuxsat(tA.business.id, { userId: "boshqa", ism: "X", rol: "SELLER" })
  );
  assert.equal(xodim.tasdiqlaydi, false);
  assert.equal(xodim.tahrirlaydi, false);
  assert.equal(xodim.tarixniKoradi, false);
});

// ---------- Tenant izolyatsiyasi ----------

test("begona tenant kunlik hisobotni ko'rmaydi va yoza olmaydi", async () => {
  const soni = await B(() => prisma.dailyReport.count());
  assert.equal(soni, 0);

  const tarix = await B(() => kunlikQ.listKunlikTarix(tA.business.id));
  assert.equal(tarix.length, 0);

  await assert.rejects(
    () =>
      B(() =>
        kunlikSvc.addKunlikTushum(tA.business.id, { userId: tB.user.id, ism: "B egasi", rol: "OWNER" }, { summa: 1_000, tolovTuri: "CASH" })
      ),
    /tegishli emas|topilmadi/i
  );

  await assert.rejects(
    () => B(() => kunlikSvc.confirmKunlikReport(tA.business.id, { userId: tB.user.id, ism: "B egasi", rol: "OWNER" }, bugun)),
    /tegishli emas|topilmadi/i
  );
});

// ---------- Audit ----------

// ---------- Yozuvlar (Transaction) bilan avto-sinxron ----------

test("Yozuvlardan bugungi kirim kunlikka o'zi tushadi; boshqa sana va chiqim tushmaydi", async () => {
  const { createTransaction } = await import("@/lib/services/transactionService");

  // KUNLIK modulini tenant A uchun yoqamiz (sinxron modul yoqiqligini tekshiradi)
  await A(() => prisma.tenantModule.create({ data: { code: "KUNLIK", isActive: true } }));
  // Oldingi testlarda bugun tasdiqlangan edi — qayta ochamiz
  await A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun, "Test uchun qayta ochish"));
  const bosh = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));

  const kirimCat = await A(() =>
    prisma.category.findFirst({ where: { businessId: tA.business.id, turi: "kirim" } })
  );
  const chiqimCat = await A(() =>
    prisma.category.findFirst({ where: { businessId: tA.business.id, turi: "chiqim" } })
  );

  // 1) Bugungi kirim (naqd kassa) -> kunlikka CASH bo'lib tushadi
  const t1 = await A(() =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 700_000, sana: bugun,
    })
  );
  let r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, bosh.naqdSumma + 700_000);
  const ulangan = r.items.find((i: any) => i.yozuvdan);
  assert.ok(ulangan, "ulangan tushum ko'rinishi kerak");

  // 2) KECHAGI sanali kirim -> kunlikka TUSHMAYDI
  const kecha = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() - 24 * 60 * 60 * 1000)
  );
  await A(() =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 999_000, sana: kecha,
    })
  );
  r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, bosh.naqdSumma + 700_000, "kechagi kirim bugungi kunlikka qo'shilmasin");
  const kechaR = await A(() => kunlikQ.getKunlikReport(tA.business.id, kecha));
  assert.equal(kechaR.jamiSumma, 0, "kechagi kunlik ham ochilmasin");

  // 3) Bugungi CHIQIM -> kunlikka tushmaydi (kunlik faqat tushum)
  await A(() =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "chiqim", categoryId: chiqimCat.id, summa: 50_000, sana: bugun,
    })
  );
  r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.jamiSumma, bosh.jamiSumma + 700_000);

  // 4) Plastik kassaga kirim -> CLICK bo'lib tushadi
  const accountsSvc = await import("@/lib/services/accounts");
  const plastik = await A(() =>
    accountsSvc.createAccount(tA.business.id, { nomi: "Terminal", turi: "plastik" })
  );
  await A(() =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 300_000, sana: bugun, accountId: plastik.id,
    })
  );
  r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.clickSumma, bosh.clickSumma + 300_000);

  // 5) Ulangan tushumni kunlikdan o'chirib/tahrirlab bo'lmaydi — manba Yozuvlarda
  await assert.rejects(
    () => A(() => kunlikSvc.deleteKunlikTushum(tA.business.id, egaAktor(), ulangan.id)),
    /Yozuvlar/
  );
  await assert.rejects(
    () => A(() => kunlikSvc.updateKunlikTushum(tA.business.id, egaAktor(), ulangan.id, { summa: 1 })),
    /Yozuvlar/
  );

  // 6) Yozuv o'chirilsa -> kunlikdan ham chiqadi; tiklansa -> qaytadi
  await A(() => kunlikSvc.kunlikSinxron({ ...t1, deletedAt: new Date() }, null));
  r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, bosh.naqdSumma, "o'chirilgan yozuv kunlikdan chiqishi kerak");
  await A(() => kunlikSvc.kunlikSinxron({ ...t1, deletedAt: null }, "A egasi"));
  r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, bosh.naqdSumma + 700_000, "tiklangan yozuv kunlikka qaytishi kerak");

  // 7) Sana kechaga o'zgartirilsa -> kunlikdan chiqadi
  await A(() =>
    kunlikSvc.kunlikSinxron({ ...t1, sana: date.dateOnlyStringToUTCDate(kecha), deletedAt: null }, "A egasi")
  );
  r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, bosh.naqdSumma, "sanasi o'zgargan yozuv kunlikdan chiqishi kerak");
});

test("modul yoqilmagan tenantda sinxron ishlamaydi", async () => {
  const { createTransaction } = await import("@/lib/services/transactionService");
  const kirimCatB = await B(() =>
    prisma.category.findFirst({ where: { businessId: tB.business.id, turi: "kirim" } })
  );
  await B(() =>
    createTransaction(tB.user.id, tB.business.id, {
      turi: "kirim", categoryId: kirimCatB.id, summa: 500_000, sana: kunlikSvc.kunlikBugun(),
    })
  );
  const soni = await B(() => prisma.dailyReport.count());
  assert.equal(soni, 0, "KUNLIK yoqilmagan tenantda hisobot ochilmasin");
});

test("tasdiqlangan kunga sinxron tegmaydi, asosiy yozuv esa yoziladi", async () => {
  const { createTransaction } = await import("@/lib/services/transactionService");
  await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun));
  const oldin = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));

  const kirimCat = await A(() =>
    prisma.category.findFirst({ where: { businessId: tA.business.id, turi: "kirim" } })
  );
  const t = await A(() =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 111_000, sana: bugun,
    })
  );
  assert.ok(t.id, "asosiy yozuv baribir yozilishi kerak");

  const keyin = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(keyin.jamiSumma, oldin.jamiSumma, "yopilgan kun o'zgarmasin");
  assert.equal(keyin.items.length, oldin.items.length);
});

// ---------- Kassa topshirish (xodim -> direktor, pul nazorati) ----------

test("xodim kassani topshiradi: sanalgan naqd, farq, tushum qulfi, direktor tasdig'i", async () => {
  // Holat: bugun CONFIRMED (oldingi testdan) — tekshirish uchun qayta ochamiz.
  await A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun, "Test uchun qayta ochish"));
  const r0 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r0.holat, "OPEN");
  assert.equal(r0.sanalganNaqd, null, "qayta ochilganda topshiruv ham tozalanadi");

  // Xodim (sotuvchi/kassir) kassani topshiradi — tizim naqdidan 50 000 KAM sanadi.
  const sanalgan = r0.naqdSumma - 50_000;
  const topshirildi = await A(() =>
    kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), bugun, sanalgan)
  );
  assert.equal(topshirildi.holat, "SUBMITTED");
  assert.equal(topshirildi.sanalganNaqd, sanalgan);
  assert.equal(topshirildi.submittedByIsm, "Abdulloh Karimov");
  assert.ok(topshirildi.submittedAt);

  // DTO'da farq ko'rinadi: KAM = manfiy (pul yetishmayapti — nazorat signali)
  const dto = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(dto.holat, "SUBMITTED");
  assert.equal(dto.naqdFarq, -50_000);

  // Topshirilgan kunga tushum kiritib bo'lmaydi (raqamlar muzlagan)
  await assert.rejects(
    () => A(() => kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa: 1_000, tolovTuri: "CASH" })),
    /topshirilgan/i
  );

  // Yozuvlardan avto-sinxron ham topshirilgan kunga tegmaydi
  const { createTransaction } = await import("@/lib/services/transactionService");
  const kirimCat = await A(() =>
    prisma.category.findFirst({ where: { businessId: tA.business.id, turi: "kirim" } })
  );
  await A(() =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 77_000, sana: bugun,
    })
  );
  const dto2 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(dto2.jamiSumma, dto.jamiSumma, "topshirilgan kun o'zgarmasin");

  // Qayta topshirish rad etiladi
  await assert.rejects(
    () => A(() => kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), bugun, sanalgan)),
    /allaqachon.*topshirilgan/i
  );

  // Direktor SUBMITTED holatdan tasdiqlaydi; topshiruv ma'lumoti saqlanadi
  const tasdiq = await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun));
  assert.equal(tasdiq.holat, "CONFIRMED");
  assert.equal(tasdiq.sanalganNaqd, sanalgan, "sanalgan naqd tarixda qoladi");

  // Tasdiqlangan kunni qayta topshirib bo'lmaydi
  await assert.rejects(
    () => A(() => kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), bugun, sanalgan)),
    /tasdiqlangan/i
  );
});

test("kelajak kunni topshirib bo'lmaydi; tarixda topshiruv holati ko'rinadi", async () => {
  const ertaga = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() + 24 * 60 * 60 * 1000)
  );
  await assert.rejects(
    () => A(() => kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), ertaga, 0)),
    /kelajak/i
  );

  const tarix = await A(() => kunlikQ.listKunlikTarix(tA.business.id));
  const bugungisi = tarix.find((x: any) => x.sana === bugun);
  assert.equal(bugungisi.holat, "CONFIRMED");
  assert.equal(bugungisi.naqdFarq, -50_000, "farq tarix ro'yxatida ham ko'rinadi");
  assert.equal(bugungisi.submittedByIsm, "Abdulloh Karimov");
});

// ---------- Direktorga eslatma + ertasi kuni tasdiqlash ----------

test("tasdiqlanmagan o'tgan kun uchun direktorga Telegram eslatma boradi (tugma bilan)", async () => {
  const { sendKunlikEslatma } = await import("@/lib/reports/kunlikEslatma");

  // Direktor (kassir) Telegram ulagan; egasida ham Telegram bor — lekin
  // eslatma DIREKTORGA borishi kerak, boshqaruvchiga emas.
  await rawPrisma.user.update({ where: { id: kassir.id }, data: { telegramChatId: "111222" } });
  await rawPrisma.user.update({ where: { id: tA.user.id }, data: { telegramChatId: "999888" } });

  // Ikki kun oldingi OCHIQ kun (tushum bilan) — "esidan chiqqan" holat.
  const ikkiKunOldin = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() - 2 * 24 * 60 * 60 * 1000)
  );
  const eskiReport = await rawPrisma.dailyReport.create({
    data: {
      businessId: tA.business.id,
      sana: date.dateOnlyStringToUTCDate(ikkiKunOldin),
      naqdSumma: 150_000,
      jamiSumma: 150_000,
    },
  });
  await rawPrisma.dailyTransaction.create({
    data: {
      businessId: tA.business.id,
      reportId: eskiReport.id,
      summa: 150_000,
      tolovTuri: "CASH",
      userId: kassir.id,
      userIsm: kassir.ism,
    },
  });

  const yuborilgan: { chatId: string; text: string; opts: any }[] = [];
  const fakeApi = {
    sendMessage: async (chatId: string, text: string, opts?: unknown) => {
      yuborilgan.push({ chatId, text, opts });
      return {};
    },
  };

  const sent = await sendKunlikEslatma(fakeApi);
  assert.ok(sent >= 1, "kamida bitta eslatma yuborilishi kerak");

  const eslatma = yuborilgan.find((x) => x.text.includes("tasdiqlanmagan") || x.text.includes("Kunlik yakun"));
  assert.ok(eslatma, "eslatma matni topilishi kerak");
  assert.equal(eslatma.chatId, "111222", "eslatma aynan direktorga borishi kerak");
  assert.ok(!yuborilgan.some((x) => x.chatId === "999888"), "direktor bor — boshqaruvchiga bormasin");
  const tugma = eslatma.opts?.reply_markup?.inline_keyboard?.[0]?.[0];
  assert.ok(tugma?.callback_data?.startsWith("kht:ok:"), "bir bosishda tasdiqlash tugmasi bo'lsin");

  // Kuniga bir marta — ikkinchi chaqiruv hech narsa yubormaydi (dedupe).
  const qayta = await sendKunlikEslatma(fakeApi);
  assert.equal(qayta, 0);
});

test("direktor o'tgan (kechagi) kunni ham tasdiqlay oladi — esidan chiqqan bo'lsa", async () => {
  const ikkiKunOldin = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() - 2 * 24 * 60 * 60 * 1000)
  );
  const r = await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), ikkiKunOldin));
  assert.equal(r.holat, "CONFIRMED");
  assert.equal(r.jamiSumma, 150_000, "jami tushumlardan qayta jamlanadi");
  assert.equal(r.confirmedByIsm, "Abdulloh Karimov");
});

test("bildirishnomalar: tasdiqlanmagan kun ogohlantirishi direktorga ko'rinadi", async () => {
  const { getNotifications } = await import("@/lib/queries/notifications");

  // Yana bitta ochiq o'tgan kun yaratamiz (3 kun oldin, tushumli).
  const uchKunOldin = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() - 3 * 24 * 60 * 60 * 1000)
  );
  await rawPrisma.dailyReport.create({
    data: {
      businessId: tA.business.id,
      sana: date.dateOnlyStringToUTCDate(uchKunOldin),
      qarzSumma: 90_000,
      jamiSumma: 90_000,
    },
  });

  // Direktor (kassir) ko'radi
  const direktorniki = await A(() =>
    getNotifications(tA.business.id, { rol: "CASHIER", omborli: false, userId: kassir.id })
  );
  assert.ok(
    direktorniki.some((n: any) => n.title.includes("Kunlik yakun")),
    "direktor ogohlantirishni ko'rishi kerak"
  );

  // Oddiy xodim (direktor emas) ko'rmaydi
  const xodimniki = await A(() =>
    getNotifications(tA.business.id, { rol: "SELLER", omborli: false, userId: "boshqa-user" })
  );
  assert.ok(!xodimniki.some((n: any) => n.title.includes("Kunlik yakun")));

  // Boshqaruvchi ham ko'radi
  const eganiki = await A(() =>
    getNotifications(tA.business.id, { rol: "OWNER", omborli: false, userId: tA.user.id })
  );
  assert.ok(eganiki.some((n: any) => n.title.includes("Kunlik yakun")));
});

test("tushum va tasdiqlash audit jurnaliga tushadi", async () => {
  const loglar = await rawPrisma.auditLog.findMany({
    where: { businessId: tA.business.id, entity: { in: ["dailyTransaction", "dailyReport", "dailyReportSetting"] } },
  });
  assert.ok(loglar.some((l: any) => l.entity === "dailyTransaction" && l.action === "create"));
  assert.ok(loglar.some((l: any) => l.entity === "dailyTransaction" && l.action === "delete"));
  assert.ok(loglar.some((l: any) => l.entity === "dailyReport" && l.action === "update"));
  assert.ok(loglar.some((l: any) => l.entity === "dailyReportSetting"));
});

// ---------- Topshirish sana guard'i (C-4) ----------

test("oddiy xodim o'tgan kunni topshira olmaydi — faqat bugunni", async () => {
  const kecha = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() - 24 * 60 * 60 * 1000)
  );
  // Direktor etib tayinlanmagan oddiy xodim (SELLER).
  const xodim = { userId: "oddiy-xodim", ism: "Xodim", rol: "SELLER" as const };
  await assert.rejects(
    () => A(() => kunlikSvc.submitKunlikReport(tA.business.id, xodim, kecha, 0)),
    /bugungi kunni topshirish/i
  );

  // Direktor (tayinlangan) uchun o'tgan kunni topshirish ishlaydi —
  // 3 kun oldingi OPEN hisobot (oldingi testda yaratilgan) topshiriladi.
  const uchKunOldin = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() - 3 * 24 * 60 * 60 * 1000)
  );
  const r = await A(() => kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), uchKunOldin, 0));
  assert.equal(r.holat, "SUBMITTED");
});

test("biznes ochilishidan oldingi kunga hisobot ochilmaydi (soxta tarix)", async () => {
  // Biznes createdAt testda 2020-01-01 — undan oldingi sana rad etiladi.
  await assert.rejects(
    () => A(() => kunlikSvc.submitKunlikReport(tA.business.id, egaAktor(), "2019-12-31", 0)),
    /biznes ochilishidan oldin/i
  );
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), "2019-12-31")),
    /biznes ochilishidan oldin/i
  );
});

// ---------- Sotuv va qarz to'lovi kunlikka tushadi (C-3) ----------

test("naqd sotuv kunlik naqdiga tushadi; bekor qilinsa chiqadi", async () => {
  const inventory = await import("@/lib/services/inventory");

  // Bugun oldingi testlarda CONFIRMED bo'lgan — qayta ochamiz.
  await A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun, "Test uchun qayta ochish"));
  const r0 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));

  const product = await rawPrisma.product.create({
    data: {
      businessId: tA.business.id,
      nomi: "Guldasta",
      kelganNarx: 50_000,
      sotuvNarx: 100_000,
      miqdor: 10,
    },
  });

  const sotuv = await A(() =>
    inventory.createSale({
      businessId: tA.business.id,
      productId: product.id,
      miqdor: 2,
      tolovTuri: "naqd",
      userId: kassir.id,
    })
  );
  assert.ok(sotuv.transactionId, "naqd sotuv kirim tranzaksiya yozadi");

  let r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, r0.naqdSumma + 200_000, "sotuv kunlik naqdiga tushishi kerak");
  const ulangan = r.items.find((i: any) => i.yozuvdan && i.summa === 200_000);
  assert.ok(ulangan, "tushum 'Yozuvlardan' belgisi bilan ko'rinadi");

  // Sotuv bekor qilinsa — kunlikdan ham chiqadi va jami qayta hisoblanadi.
  await A(() =>
    inventory.cancelSale({
      businessId: tA.business.id,
      saleId: sotuv.id,
      sabab: "Xato kiritildi",
      userId: tA.user.id,
    })
  );
  r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, r0.naqdSumma, "bekor qilingan sotuv kunlikdan chiqishi kerak");
  assert.equal(r.jamiSumma, r0.jamiSumma);
});

test("qarz to'lovi (olinadigan, naqd kirim) kunlik naqdiga tushadi", async () => {
  const inventory = await import("@/lib/services/inventory");
  const r0 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));

  const qarz = await A(() =>
    inventory.createDebt({
      businessId: tA.business.id,
      turi: "olinadigan",
      mijozNomi: "Qarzdor mijoz",
      jamiSumma: 300_000,
      userId: kassir.id,
    })
  );
  await A(() =>
    inventory.recordDebtPayment({
      businessId: tA.business.id,
      debtId: qarz.id,
      summa: 120_000,
      userId: kassir.id,
    })
  );

  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, r0.naqdSumma + 120_000, "qarz to'lovi kunlik naqdiga tushishi kerak");
});

test("CSV import: bugungi kirim kunlikka tushadi, tarixiy qator tushmaydi", async () => {
  const csv = await import("@/lib/services/csvImport");
  const r0 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));

  const yozildi = await A(() =>
    csv.csvniYoz({
      businessId: tA.business.id,
      userId: tA.user.id,
      qatorlar: [
        { qator: 1, sana: bugun, turi: "kirim", kategoriya: "CSV kirim", summa: 55_000, izoh: null },
        { qator: 2, sana: "2026-01-05", turi: "kirim", kategoriya: "CSV kirim", summa: 44_000, izoh: null },
      ],
    })
  );
  assert.equal(yozildi, 2);

  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, r0.naqdSumma + 55_000, "faqat bugungi qator kunlikka tushadi");
});

test("yopiq kunda sotuv baribir yoziladi, kunlikka tegilmaydi", async () => {
  const inventory = await import("@/lib/services/inventory");
  await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun));
  const r0 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));

  const product = await rawPrisma.product.create({
    data: {
      businessId: tA.business.id,
      nomi: "Yopiq kun guli",
      kelganNarx: 10_000,
      sotuvNarx: 30_000,
      miqdor: 5,
    },
  });
  const sotuv = await A(() =>
    inventory.createSale({
      businessId: tA.business.id,
      productId: product.id,
      miqdor: 1,
      tolovTuri: "naqd",
      userId: kassir.id,
    })
  );
  assert.ok(sotuv.transactionId, "sotuv va kirim baribir yoziladi");

  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.jamiSumma, r0.jamiSumma, "yopilgan kun o'zgarmasin");
  assert.equal(r.items.length, r0.items.length);
});

// ---------- LOCKED: davr yopish (M-10) va majburiy sabab (M-9) ----------

test("qayta ochish sababsiz rad etiladi, sabab bilan saqlanadi", async () => {
  // Holat: bugun oldingi testda CONFIRMED.
  await assert.rejects(
    () => A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun, "  ")),
    /sabab/i
  );

  const ochildi = await A(() =>
    kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun, "Kassir tushumni xato kiritgan")
  );
  assert.equal(ochildi.holat, "OPEN");
  assert.equal(ochildi.qaytaOchishSabab, "Kassir tushumni xato kiritgan");

  // Sabab auditda ham qoladi.
  const log = await rawPrisma.auditLog.findFirst({
    where: { businessId: tA.business.id, entity: "dailyReport", entityId: ochildi.id },
    orderBy: { createdAt: "desc" },
  });
  assert.match(log.after ?? "", /Kassir tushumni xato kiritgan/);

  // Qayta yopamiz (keyingi testlar uchun).
  await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun));
});

test("oyni yopish: CONFIRMED kunlar LOCKED bo'ladi va hech narsa o'zgartirilmaydi", async () => {
  const oy = bugun.slice(0, 7);
  const natija = await A(() => kunlikSvc.oyniYop(tA.business.id, egaAktor(), oy));
  assert.ok(natija.qulflandi >= 1, "kamida bugungi kun qulflanishi kerak");

  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.holat, "LOCKED");

  // LOCKED kunga: tushum, tahrir, o'chirish, qayta ochish, topshirish — hammasi rad.
  await assert.rejects(
    () => A(() => kunlikSvc.addKunlikTushum(tA.business.id, egaAktor(), { summa: 1_000, tolovTuri: "CASH" })),
    /yopilgan/i
  );
  await assert.rejects(
    () => A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun, "Ochib ko'raylik")),
    /yopilgan/i
  );
  await assert.rejects(
    () => A(() => kunlikSvc.submitKunlikReport(tA.business.id, egaAktor(), bugun, 0)),
    /yopilgan/i
  );
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun)),
    /yopilgan/i
  );
  if (r.items.length > 0) {
    await assert.rejects(
      () => A(() => kunlikSvc.updateKunlikTushum(tA.business.id, egaAktor(), r.items[0].id, { summa: 1 })),
      /yopilgan|Yozuvlar/i
    );
  }

  // Sotuv sinxroni ham LOCKED kunga tegmaydi, sotuv esa yoziladi.
  const inventory = await import("@/lib/services/inventory");
  const product = await rawPrisma.product.create({
    data: { businessId: tA.business.id, nomi: "Qulf guli", kelganNarx: 5_000, sotuvNarx: 20_000, miqdor: 3 },
  });
  const sotuv = await A(() =>
    inventory.createSale({
      businessId: tA.business.id, productId: product.id, miqdor: 1, tolovTuri: "naqd", userId: kassir.id,
    })
  );
  assert.ok(sotuv.transactionId);
  const r2 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r2.jamiSumma, r.jamiSumma, "LOCKED kun o'zgarmasin");
});

test("cron avto qulflash: qulflashKun dan eski CONFIRMED kunlar LOCKED bo'ladi", async () => {
  // 40 kun oldingi kun, 10 kun oldin tasdiqlangan — qulflashKun (7) dan eski.
  const eskiSana = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() - 40 * 24 * 60 * 60 * 1000)
  );
  const eski = await rawPrisma.dailyReport.create({
    data: {
      businessId: tA.business.id,
      sana: date.dateOnlyStringToUTCDate(eskiSana),
      holat: "CONFIRMED",
      confirmedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });

  const soni = await A(() => kunlikSvc.kunlikAvtoQulfla());
  assert.ok(soni >= 1, "kamida bitta kun qulflanishi kerak");
  const keyin = await rawPrisma.dailyReport.findUnique({ where: { id: eski.id } });
  assert.equal(keyin.holat, "LOCKED");

  // qulflashKun = 0 — avto qulflash o'chirilgan.
  await rawPrisma.dailyReport.create({
    data: {
      businessId: tA.business.id,
      sana: date.dateOnlyStringToUTCDate(
        date.utcDateToDateOnlyString(
          new Date(date.dateOnlyStringToUTCDate(bugun).getTime() - 41 * 24 * 60 * 60 * 1000)
        )
      ),
      holat: "CONFIRMED",
      confirmedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  });
  await rawPrisma.dailyReportSetting.updateMany({
    where: { businessId: tA.business.id },
    data: { qulflashKun: 0 },
  });
  const nol = await A(() => kunlikSvc.kunlikAvtoQulfla());
  assert.equal(nol, 0, "qulflashKun=0 da hech narsa qulflanmasin");
});
