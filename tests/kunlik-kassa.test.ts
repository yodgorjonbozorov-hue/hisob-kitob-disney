/**
 * KUN YAKUNI — KASSA TOPSHIRISH VA ACCOUNTING INVARIANTLARI.
 *
 * Bu testning yagona maqsadi — mahsulotning eng qimmat xatosini bo'lmasligini
 * ISBOTLASH: kassirdan direktorga topshirilgan pul YANGI KIRIM sifatida
 * qayta hisoblanmasin.
 *
 * Isbotlanadigan invariantlar:
 *   1. Kun davomida: Jami Kirim = 10 mln, Jami Chiqim = 3 mln, kassada 7 mln;
 *   2. Kassir 7 mln topshiradi, direktor qabul qiladi;
 *   3. KASSIR KASSASI = 0, DIREKTOR KASSASI = +7 mln;
 *   4. Jami Kirim HALI HAM 10 mln, Jami Chiqim HALI HAM 3 mln (dashboard,
 *      oylik hisobot va kunlik hisobot — uchalasida ham);
 *   5. Pul harakati BITTA (`AccountTransfer`), dublikat `Transaction` YO'Q;
 *   6. Farq (kamomad/ortiqcha) sababsiz yopilmaydi va totallarni buzmaydi;
 *   7. Ikki marta topshirish/tasdiqlash pulni ikki marta ko'chirmaydi;
 *   8. Kun qayta ochilsa pul STORNO bilan orqaga qaytadi;
 *   9. Tenant/biznes izolyatsiyasi.
 *
 * Ishga tushirish: npm run test:kunlik-kassa
 */
process.env.DATABASE_URL = "file:./prisma/test-kunlik-kassa.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let kunlikSvc: any;
let kunlikQ: any;
let dashboardQ: any;
let txSvc: any;
let createTenantWithOwner: any;

let tA: any;
let tB: any;
let kassir: any;
let kassirKassa: any;
let direktorKassa: any;
let kirimCat: any;
let chiqimCat: any;
let bugun: string;

function A(fn: () => unknown): Promise<any> {
  return runWithTenant(tA.tenant.id, fn, { userId: tA.user.id, ism: "A egasi" });
}
function B(fn: () => unknown): Promise<any> {
  return runWithTenant(tB.tenant.id, fn, { userId: tB.user.id, ism: "B egasi" });
}

const egaAktor = () => ({ userId: tA.user.id, ism: "A egasi", rol: "OWNER" });
const kassirAktor = () => ({ userId: kassir.id, ism: kassir.ism, rol: "CASHIER" });

/** Kassaning ledger qoldig'i — bazadan to'g'ridan-to'g'ri o'qiladi. */
async function qoldiq(accountId: string): Promise<number> {
  const [kirim, chiqim, kirgan, chiqqan] = await Promise.all([
    rawPrisma.transaction.aggregate({
      where: { accountId, turi: "kirim", deletedAt: null },
      _sum: { summa: true },
    }),
    rawPrisma.transaction.aggregate({
      where: { accountId, turi: "chiqim", deletedAt: null },
      _sum: { summa: true },
    }),
    rawPrisma.accountTransfer.aggregate({
      where: { toAccountId: accountId, holat: { in: ["bajarildi", "bekor"] } },
      _sum: { summa: true },
    }),
    rawPrisma.accountTransfer.aggregate({
      where: { fromAccountId: accountId, holat: { in: ["bajarildi", "bekor"] } },
      _sum: { summa: true },
    }),
  ]);
  return (
    (kirim._sum.summa ?? 0) -
    (chiqim._sum.summa ?? 0) +
    (kirgan._sum.summa ?? 0) -
    (chiqqan._sum.summa ?? 0)
  );
}

/** Biznesning JAMI kirim/chiqimi — dashboard qaysi manbadan o'qisa, o'sha. */
async function totallar(): Promise<{ kirim: number; chiqim: number; soni: number }> {
  const [kirim, chiqim, soni] = await Promise.all([
    rawPrisma.transaction.aggregate({
      where: { businessId: tA.business.id, turi: "kirim", deletedAt: null },
      _sum: { summa: true },
    }),
    rawPrisma.transaction.aggregate({
      where: { businessId: tA.business.id, turi: "chiqim", deletedAt: null },
      _sum: { summa: true },
    }),
    rawPrisma.transaction.count({ where: { businessId: tA.business.id, deletedAt: null } }),
  ]);
  return { kirim: kirim._sum.summa ?? 0, chiqim: chiqim._sum.summa ?? 0, soni };
}

before(async () => {
  rmSync("prisma/test-kunlik-kassa.db", { force: true });
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
  dashboardQ = await import("@/lib/queries/dashboard");
  txSvc = await import("@/lib/services/transactionService");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Kassa A",
    ism: "A egasi",
    login: "+998900000301",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Kassa B",
    ism: "B egasi",
    login: "+998900000302",
    parol: "parol12345",
  });

  kassir = await rawPrisma.user.create({
    data: {
      ism: "Fayruza",
      login: "+998900000303",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: tA.tenant.id,
      businessId: tA.business.id,
    },
  });

  // KUNLIK moduli + shaxsiy kassa rejimi (naqd pul xodimning o'z kassasiga tushadi).
  await rawPrisma.tenantModule.create({
    data: { tenantId: tA.tenant.id, code: "KUNLIK", isActive: true },
  });
  await rawPrisma.business.update({
    where: { id: tA.business.id },
    data: { shaxsiyKassa: true },
  });
  kassirKassa = await rawPrisma.account.create({
    data: { businessId: tA.business.id, nomi: "Fayruza kassasi", turi: "naqd", userId: kassir.id },
  });
  direktorKassa = await rawPrisma.account.create({
    data: { businessId: tA.business.id, nomi: "Direktor kassasi", turi: "naqd", userId: tA.user.id },
  });

  // Egasi — tayinlangan direktor (kunni u tasdiqlaydi).
  await A(() => kunlikSvc.setKunlikDirektor(tA.business.id, tA.user.id));

  kirimCat = await rawPrisma.category.findFirst({
    where: { businessId: tA.business.id, turi: "kirim" },
  });
  chiqimCat = await rawPrisma.category.findFirst({
    where: { businessId: tA.business.id, turi: "chiqim" },
  });

  bugun = kunlikSvc.kunlikBugun();
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1. KUN DAVOMIDA: 10 mln kirim, 3 mln chiqim -> kassada 7 mln
// ---------------------------------------------------------------------------

test("kun boshi: kassalar bo'sh", async () => {
  assert.equal(await qoldiq(kassirKassa.id), 0);
  assert.equal(await qoldiq(direktorKassa.id), 0);
});

test("10 mln naqd kirim kassirning kassasiga tushadi va Jami Kirimga kiradi", async () => {
  await A(() =>
    kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), {
      summa: 10_000_000,
      tolovTuri: "CASH",
      categoryId: kirimCat.id,
    })
  );

  const t = await totallar();
  assert.equal(t.kirim, 10_000_000, "Jami Kirim = 10 mln");
  assert.equal(t.chiqim, 0);
  assert.equal(t.soni, 1, "Tushum BITTA yozuv yaratishi kerak (dublikat yo'q)");

  assert.equal(await qoldiq(kassirKassa.id), 10_000_000, "pul kassirning kassasida");

  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun, true));
  assert.equal(r.jamiSumma, 10_000_000, "kunlik hisobot ham 10 mln ko'rsatadi");
  assert.equal(r.naqdSumma, 10_000_000);
  assert.equal(r.items.length, 1, "kunlikda ham BITTA qator");
});

test("3 mln naqd chiqim kassadan ayriladi, Jami Kirimga tegmaydi", async () => {
  await A(() =>
    txSvc.createTransaction(kassir.id, tA.business.id, {
      turi: "chiqim",
      categoryId: chiqimCat.id,
      summa: 3_000_000,
      sana: bugun,
      tolovTuri: "naqd",
      accountId: kassirKassa.id,
    })
  );

  const t = await totallar();
  assert.equal(t.kirim, 10_000_000, "chiqim Jami Kirimga tegmasin");
  assert.equal(t.chiqim, 3_000_000);

  assert.equal(await qoldiq(kassirKassa.id), 7_000_000, "kassada 7 mln qolishi kerak");

  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun, true));
  assert.equal(r.jamiSumma, 10_000_000);
  assert.equal(r.chiqimSumma, 3_000_000);
  assert.equal(r.sofSumma, 7_000_000, "sof natija = 7 mln");
});

test("tizim hisobi kassa qoldig'idan olinadi (naqd kirimdan EMAS)", async () => {
  const kassa = await A(() => kunlikQ.getKunlikKassa(tA.business.id, kassir.id));
  assert.equal(kassa.shaxsiy, true);
  assert.equal(
    kassa.qoldiq,
    7_000_000,
    "10 mln kirim − 3 mln naqd chiqim = 7 mln (eski xatoda 10 mln ko'rsatilardi)"
  );
});

// ---------------------------------------------------------------------------
// 2. TOPSHIRISH -> TASDIQLASH -> KASSIR KASSASI 0
// ---------------------------------------------------------------------------

test("topshirilganda pul HALI kassirda turadi (kutilmoqda)", async () => {
  const { report } = await A(() =>
    kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), bugun, 7_000_000)
  );
  assert.equal(report.holat, "SUBMITTED");
  assert.equal(report.kutilganNaqd, 7_000_000);
  assert.equal(report.kassaFarq, 0);
  assert.ok(report.transferId, "pul harakati yaralishi kerak");

  const transfer = await rawPrisma.accountTransfer.findUnique({
    where: { id: report.transferId },
  });
  assert.equal(transfer.holat, "kutilmoqda");
  assert.equal(transfer.turi, "smena");
  assert.equal(transfer.summa, 7_000_000);
  assert.equal(transfer.fromAccountId, kassirKassa.id);
  assert.equal(transfer.toAccountId, direktorKassa.id);

  // Tasdiqlanmagan o'tkazma qoldiqni O'ZGARTIRMAYDI.
  assert.equal(await qoldiq(kassirKassa.id), 7_000_000);
  assert.equal(await qoldiq(direktorKassa.id), 0);
});

test("DIREKTOR QABUL QILGANDA: kassir kassasi 0, direktor kassasi +7 mln", async () => {
  const { report, pulHolati } = await A(() =>
    kunlikSvc.qarorKunlikReport(tA.business.id, egaAktor(), { sana: bugun, amal: "qabul" })
  );
  assert.equal(report.holat, "CONFIRMED");
  assert.equal(pulHolati, "kochdi");

  assert.equal(await qoldiq(kassirKassa.id), 0, "KASSIR KASSASI 0 BO'LISHI SHART");
  assert.equal(await qoldiq(direktorKassa.id), 7_000_000, "pul direktor kassasiga o'tdi");
});

// ---------------------------------------------------------------------------
// 3. ASOSIY INVARIANT: TRANSFER JAMI KIRIM/CHIQIMGA QO'SHILMAYDI
// ---------------------------------------------------------------------------

test("Jami Kirim 10 mln, Jami Chiqim 3 mln — transferdan KEYIN ham", async () => {
  const t = await totallar();
  assert.equal(t.kirim, 10_000_000, "17 mln bo'lib ketsa — CRITICAL BUG");
  assert.equal(t.chiqim, 3_000_000, "topshirish chiqim ham emas");
  assert.equal(t.soni, 2, "faqat 2 ta yozuv: 1 kirim + 1 chiqim");

  // Dashboard (oylik xulosa) ham aynan shu raqamlarni beradi.
  const oy = bugun.slice(0, 7);
  const xulosa = await A(() => dashboardQ.getMonthSummary(tA.business.id, oy));
  assert.equal(xulosa.jamiKirim, 10_000_000, "Dashboard Jami Kirim o'zgarmasin");
  assert.equal(xulosa.jamiChiqim, 3_000_000, "Dashboard Jami Chiqim o'zgarmasin");
  assert.equal(xulosa.sofFoyda, 7_000_000);

  // Kunlik hisobot ham (tasdiqlangan kun tarixda muzlaydi).
  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun, true));
  assert.equal(r.jamiSumma, 10_000_000);
  assert.equal(r.chiqimSumma, 3_000_000);
  assert.equal(r.sofSumma, 7_000_000);
  assert.equal(r.sanalganNaqd, 7_000_000);
  assert.equal(r.naqdFarq, 0);
});

test("pul harakati BITTA, dublikat yo'q", async () => {
  const smenalar = await rawPrisma.accountTransfer.findMany({
    where: { businessId: tA.business.id, turi: "smena" },
  });
  assert.equal(smenalar.length, 1, "faqat bitta topshiriq yozuvi");
  assert.equal(smenalar[0].holat, "bajarildi");

  // Kunlik tushum qatori ham bitta va u yozuvga BOG'LANGAN.
  const kunlikQatorlar = await rawPrisma.dailyTransaction.findMany({
    where: { businessId: tA.business.id, deletedAt: null },
  });
  assert.equal(kunlikQatorlar.length, 1);
  assert.ok(kunlikQatorlar[0].transactionId, "kunlik qator haqiqiy yozuvga bog'langan bo'lishi kerak");
});

// ---------------------------------------------------------------------------
// 4. DOUBLE-SUBMIT / DOUBLE-APPROVE HIMOYASI
// ---------------------------------------------------------------------------

test("qayta tasdiqlash rad etiladi va pul ikkinchi marta ko'chmaydi", async () => {
  await assert.rejects(
    () =>
      A(() =>
        kunlikSvc.qarorKunlikReport(tA.business.id, egaAktor(), { sana: bugun, amal: "qabul" })
      ),
    /allaqachon tasdiqlangan/i
  );
  assert.equal(await qoldiq(kassirKassa.id), 0);
  assert.equal(await qoldiq(direktorKassa.id), 7_000_000);
});

test("bir vaqtda 5 ta topshirish — faqat bittasi o'tadi", async () => {
  // Kunni qayta ochamiz (pul kassirga qaytadi), so'ng bir vaqtda urinamiz.
  await A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun));
  assert.equal(await qoldiq(kassirKassa.id), 7_000_000, "qayta ochilganda pul kassirga qaytadi");
  assert.equal(await qoldiq(direktorKassa.id), 0);

  const natijalar = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      A(() => kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), bugun, 7_000_000))
    )
  );
  const otgan = natijalar.filter((n) => n.status === "fulfilled");
  assert.equal(otgan.length, 1, "faqat bitta topshiriq o'tishi kerak");

  const kutayotgan = await rawPrisma.accountTransfer.findMany({
    where: { businessId: tA.business.id, turi: "smena", holat: "kutilmoqda" },
  });
  assert.equal(kutayotgan.length, 1, "dublikat kutayotgan o'tkazma bo'lmasin");
});

test("bir vaqtda 5 ta tasdiqlash — pul bir marta ko'chadi", async () => {
  const natijalar = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      A(() =>
        kunlikSvc.qarorKunlikReport(tA.business.id, egaAktor(), { sana: bugun, amal: "qabul" })
      )
    )
  );
  const otgan = natijalar.filter((n) => n.status === "fulfilled");
  assert.equal(otgan.length, 1, "faqat bitta tasdiq o'tishi kerak");

  assert.equal(await qoldiq(kassirKassa.id), 0);
  assert.equal(await qoldiq(direktorKassa.id), 7_000_000, "ikki marta ko'chmasin");

  const t = await totallar();
  assert.equal(t.kirim, 10_000_000, "Jami Kirim baribir o'zgarmaydi");
  assert.equal(t.chiqim, 3_000_000);
});

// ---------------------------------------------------------------------------
// 5. KASSA FARQI (kamomad)
// ---------------------------------------------------------------------------

test("farq sababsiz yopilmaydi; kamomad muzlatiladi va totallarni buzmaydi", async () => {
  // Yangi kun uchun tozalab olamiz: direktor pulni kassirga qaytarmaydi,
  // shuning uchun kassirga yangi 2 mln kirim yozamiz.
  await A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun));
  await A(() =>
    kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), {
      summa: 2_000_000,
      tolovTuri: "CASH",
      categoryId: kirimCat.id,
    })
  );
  const kassa = await A(() => kunlikQ.getKunlikKassa(tA.business.id, kassir.id));
  assert.equal(kassa.qoldiq, 9_000_000, "7 mln (qaytgan) + 2 mln yangi");

  // Izohsiz kamomad — RAD.
  await assert.rejects(
    () =>
      A(() =>
        kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), bugun, 8_950_000)
      ),
    /KAM chiqdi.*sababini yozing/i
  );

  const { report } = await A(() =>
    kunlikSvc.submitKunlikReport(
      tA.business.id,
      kassirAktor(),
      bugun,
      8_950_000,
      "50 000 yo'qoldi — tekshirilmoqda"
    )
  );
  assert.equal(report.kutilganNaqd, 9_000_000);
  assert.equal(report.sanalganNaqd, 8_950_000);
  assert.equal(report.kassaFarq, -50_000, "farq = real − tizim");

  await A(() => kunlikSvc.qarorKunlikReport(tA.business.id, egaAktor(), { sana: bugun, amal: "qabul" }));

  // Kamomad kassirning kassasida OCHIQ qoladi — u hali 50 000 qarzdor.
  assert.equal(await qoldiq(kassirKassa.id), 50_000, "kamomad kassirda ochiq qoladi");
  // Kun qayta ochilganda oldingi 7 mln STORNO bilan kassirga qaytgan edi,
  // shuning uchun direktorda faqat shu safar topshirilgani turadi.
  assert.equal(await qoldiq(direktorKassa.id), 8_950_000);

  // ENG MUHIMI: farq hech qanday Kirim/Chiqim yozuvi YARATMAYDI.
  const t = await totallar();
  assert.equal(t.kirim, 12_000_000, "10 mln + 2 mln — farq kirim yaratmadi");
  assert.equal(t.chiqim, 3_000_000, "farq chiqim ham yaratmadi");
  assert.equal(t.soni, 3, "3 ta yozuv: 2 kirim + 1 chiqim");
});

test("ortiqcha ham izoh talab qiladi va totallarni buzmaydi", async () => {
  const kecha = "2026-08-01";
  await A(() =>
    txSvc.createTransaction(kassir.id, tA.business.id, {
      turi: "kirim",
      categoryId: kirimCat.id,
      summa: 100_000,
      sana: kecha,
      tolovTuri: "naqd",
      accountId: kassirKassa.id,
    })
  );
  const oldin = await totallar();
  const kassa = await A(() => kunlikQ.getKunlikKassa(tA.business.id, kassir.id));

  await assert.rejects(
    () => A(() => kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), kecha, kassa.qoldiq + 20_000)),
    /ORTIQCHA chiqdi.*sababini yozing/i
  );

  const { report } = await A(() =>
    kunlikSvc.submitKunlikReport(
      tA.business.id,
      kassirAktor(),
      kecha,
      kassa.qoldiq + 20_000,
      "mijoz qaytimini olmadi"
    )
  );
  assert.equal(report.kassaFarq, 20_000);

  const keyin = await totallar();
  assert.equal(keyin.kirim, oldin.kirim, "ortiqcha pul KIRIM emas");
  assert.equal(keyin.chiqim, oldin.chiqim);
});

// ---------------------------------------------------------------------------
// 6. QAYTA OCHISH -> STORNO
// ---------------------------------------------------------------------------

test("qayta ochilganda pul storno bilan orqaga qaytadi, ledger append-only", async () => {
  const kassirOldin = await qoldiq(kassirKassa.id);
  const direktorOldin = await qoldiq(direktorKassa.id);

  // Yuqorida "2026-08-01" kuni SUBMITTED holatda (hali tasdiqlanmagan) —
  // uni tasdiqlab, keyin qayta ochamiz.
  await A(() =>
    kunlikSvc.qarorKunlikReport(tA.business.id, egaAktor(), { sana: "2026-08-01", amal: "qabul" })
  );
  const kochgan = await qoldiq(direktorKassa.id);
  assert.ok(kochgan > direktorOldin, "tasdiqlangach pul direktorga o'tishi kerak");

  await A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), "2026-08-01"));

  assert.equal(await qoldiq(kassirKassa.id), kassirOldin, "kassir qoldig'i tiklanadi");
  assert.equal(await qoldiq(direktorKassa.id), direktorOldin, "direktor qoldig'i tiklanadi");

  // Asl yozuv O'CHIRILMAYDI — "bekor" bo'ladi va storno qatori qo'shiladi.
  const stornolar = await rawPrisma.accountTransfer.findMany({
    where: { businessId: tA.business.id, relatedType: "storno" },
  });
  assert.ok(stornolar.length >= 1, "storno qatori yozilishi kerak");
  const bekorlar = await rawPrisma.accountTransfer.findMany({
    where: { businessId: tA.business.id, holat: "bekor" },
  });
  assert.ok(bekorlar.length >= 1, "asl yozuv 'bekor' deb belgilanadi, o'chirilmaydi");

  const t = await totallar();
  assert.equal(t.chiqim, 3_000_000, "storno chiqim yaratmaydi");
});

// ---------------------------------------------------------------------------
// 7. RBAC va IZOLYATSIYA
// ---------------------------------------------------------------------------

test("kassir o'z topshirig'ini o'zi tasdiqlay olmaydi", async () => {
  // Kassirni direktor etib tayinlaymiz — u endi tasdiqlash huquqiga ega,
  // LEKIN o'z topshirig'ini yopa olmaydi.
  await A(() => kunlikSvc.setKunlikDirektor(tA.business.id, kassir.id));
  await A(() =>
    kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), "2026-08-01", 0, "bo'sh")
  );
  await assert.rejects(
    () =>
      A(() =>
        kunlikSvc.qarorKunlikReport(tA.business.id, kassirAktor(), {
          sana: "2026-08-01",
          amal: "qabul",
        })
      ),
    /o'zingiz tasdiqlay olmaysiz/i
  );
  // Boshqaruvchi esa yopa oladi.
  const { report } = await A(() =>
    kunlikSvc.qarorKunlikReport(tA.business.id, egaAktor(), { sana: "2026-08-01", amal: "qabul" })
  );
  assert.equal(report.holat, "CONFIRMED");
  await A(() => kunlikSvc.setKunlikDirektor(tA.business.id, tA.user.id));
});

test("direktor rad etsa kun OPEN ga qaytadi, pul kassirda qoladi", async () => {
  const sana = "2026-08-02";
  await A(() =>
    txSvc.createTransaction(kassir.id, tA.business.id, {
      turi: "kirim",
      categoryId: kirimCat.id,
      summa: 300_000,
      sana,
      tolovTuri: "naqd",
      accountId: kassirKassa.id,
    })
  );
  const kassa = await A(() => kunlikQ.getKunlikKassa(tA.business.id, kassir.id));
  await A(() => kunlikSvc.submitKunlikReport(tA.business.id, kassirAktor(), sana, kassa.qoldiq));

  const { report, pulHolati } = await A(() =>
    kunlikSvc.qarorKunlikReport(tA.business.id, egaAktor(), {
      sana,
      amal: "rad",
      qarorIzoh: "Summa mos emas",
    })
  );
  assert.equal(report.holat, "OPEN");
  assert.equal(report.sanalganNaqd, null);
  assert.equal(pulHolati, "rad");
  assert.equal(await qoldiq(kassirKassa.id), kassa.qoldiq, "rad etilganda pul kassirda qoladi");
});

test("begona tenant kun yakunini topshira/tasdiqlay olmaydi", async () => {
  await assert.rejects(
    () =>
      B(() =>
        kunlikSvc.submitKunlikReport(
          tA.business.id,
          { userId: tB.user.id, ism: "B egasi", rol: "OWNER" },
          bugun,
          1_000
        )
      ),
    /tegishli emas|topilmadi/i
  );
  await assert.rejects(
    () =>
      B(() =>
        kunlikSvc.qarorKunlikReport(
          tA.business.id,
          { userId: tB.user.id, ism: "B egasi", rol: "OWNER" },
          { sana: bugun, amal: "qabul" }
        )
      ),
    /tegishli emas|topilmadi/i
  );

  // B tenantda hech qanday pul harakati paydo bo'lmagan.
  const bTransferlar = await rawPrisma.accountTransfer.count({
    where: { businessId: tB.business.id },
  });
  assert.equal(bTransferlar, 0);
});

test("kun topshirig'i faqat SHU biznes kassalari orasida bo'ladi", async () => {
  const smenalar = await rawPrisma.accountTransfer.findMany({
    where: { turi: "smena" },
    select: { businessId: true, fromAccountId: true, toAccountId: true },
  });
  const kassalar = await rawPrisma.account.findMany({ select: { id: true, businessId: true } });
  const biznesi = new Map(kassalar.map((k: any) => [k.id, k.businessId]));
  for (const s of smenalar) {
    assert.equal(biznesi.get(s.fromAccountId), s.businessId, "manba kassa boshqa biznesda");
    assert.equal(biznesi.get(s.toAccountId), s.businessId, "manzil kassa boshqa biznesda");
  }
});
