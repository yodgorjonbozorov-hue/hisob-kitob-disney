/**
 * 2026-09-08 VAZIFALARI — backend qoidalari, huquqlar, saralash va audit.
 *
 * Qamrov:
 *   1. Ta'minotchi tanlanganda sabab ro'yxati qisqaradi;
 *   2. CRM "Qarz" ustuni — ochiq qarzli yutilgan zakaz;
 *   4. Sotuv ro'yxati qoldiq bo'yicha kamayish tartibida;
 *   5. Ko'p mahsulotli sotuv — atomik, birlashtirish, qoldiq chegarasi;
 *   6. Qarzni tahrirlash/o'chirish — faqat direktor (API darajasida);
 *   7. Qarz audit tarixi — o'chirilgandan keyin ham yo'qolmaydi.
 *
 * Ishga tushirish: npm run test:vazifalar
 */
process.env.DATABASE_URL = "file:./prisma/test-vazifalar.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let sabablar: any;
let pipeline: any;
let mahsulotTartib: any;
let inventorySvc: any;
let inventoryQ: any;
let qarzSvc: any;
let qarzTuzatish: any;
let qarzAuditQ: any;
let qarzQ: any;
let katalog: any;
let rollar: any;
let tekshir: any;

let T: any;
const SANA = "2026-09-08";

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

before(async () => {
  for (const f of ["prisma/test-vazifalar.db", "prisma/test-vazifalar.db-journal"]) {
    rmSync(f, { force: true });
  }
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  sabablar = await import("@/lib/moliya/sabablar");
  pipeline = await import("@/lib/crm/pipeline");
  mahsulotTartib = await import("@/lib/mahsulotTartib");
  inventorySvc = await import("@/lib/services/inventory");
  inventoryQ = await import("@/lib/queries/inventory");
  qarzSvc = await import("@/lib/services/qarz");
  qarzTuzatish = await import("@/lib/services/qarzTuzatish");
  qarzAuditQ = await import("@/lib/queries/qarzAudit");
  qarzQ = await import("@/lib/queries/qarz");
  katalog = await import("@/lib/permissions/katalog");
  rollar = await import("@/lib/auth/roles");
  tekshir = await import("@/lib/permissions/tekshir");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Vazifalar testi",
    ism: "Direktor",
    login: "+998900000601",
    parol: "parol12345",
  });
  await A(async () => prisma.business.update({ where: { id: T.business.id }, data: { omborli: true } }));
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ===========================================================================
// 1 — TA'MINOTCHI SABABLARI
// ===========================================================================

test("1: ta'minotchida FAQAT BITTA sabab ko'rinadi", () => {
  const royxat = sabablar.shaxsSabablari("chiqim", "taminotchi");
  assert.equal(royxat.length, 1, "ro'yxatda aynan bitta variant");
  assert.equal(royxat[0].kod, "taminotchi-tolov");
  assert.equal(royxat[0].nomi, "Ta'minotchiga pul berish");
  assert.equal(royxat[0].qarz, false, "oddiy to'lov qarzga bog'lanmaydi");

  const kodlar = royxat.map((s: any) => s.kod);
  // Qarz to'lovi HAM, umumiy variantlar HAM yashirilgan.
  for (const yoq of ["taminotchi-qarz", "xarajat", "qarz-berdik", "boshqa-chiqim"]) {
    assert.equal(kodlar.includes(yoq), false, `${yoq} ta'minotchida ko'rinmasligi kerak`);
  }
  assert.equal(sabablar.qatiyShaxsmi("taminotchi"), true);

  // Kirim tarafida ham ta'minotchi uchun umumiy sabablar chiqmaydi.
  assert.equal(
    sabablar.shaxsSabablari("kirim", "taminotchi").length,
    0,
    "ta'minotchidan pul olish oqimi bu formada yo'q"
  );
});

test("1c: yashirilgan sabab KATALOGDA qoladi — eski yozuvlar sababsiz qolmaydi", () => {
  // Ro'yxatdan chiqarildi, lekin `sababTop` uni hali ham topadi: tuzatish
  // oynasi eski amalning sababini ko'rsatishi kerak.
  const qarzSababi = sabablar.sababTop("chiqim", "taminotchi-qarz");
  assert.ok(qarzSababi, "sabab katalogda qoladi");
  assert.equal(qarzSababi.qarz, true);
});

test("1b: boshqa tomonlarda umumiy sabablar saqlanadi", () => {
  assert.equal(sabablar.qatiyShaxsmi("mijoz"), false);
  const mijoz = sabablar.shaxsSabablari("chiqim", "mijoz").map((s: any) => s.kod);
  assert.ok(mijoz.includes("xarajat"), "mijozda umumiy sabab qoladi");
  assert.ok(mijoz.includes("mijozga-qaytim"));

  const xodim = sabablar.shaxsSabablari("kirim", "xodim").map((s: any) => s.kod);
  assert.ok(xodim.includes("xodim-qaytardi"));
  assert.ok(xodim.includes("boshqa-kirim"));
});

// ===========================================================================
// 2 — CRM "QARZ" USTUNI
// ===========================================================================

test("2: ochiq qarzli yutilgan zakaz 'Qarz' ustunida", () => {
  const ochiq = { isYopilgan: false, status: "OPEN" };
  const yopiq = { isYopilgan: true, status: "PAID" };
  const bekor = { isYopilgan: true, status: "CANCELLED" };

  assert.equal(pipeline.zakazQarzdormi(ochiq), true);
  assert.equal(pipeline.zakazQarzdormi(yopiq), false);
  assert.equal(pipeline.zakazQarzdormi(bekor), false, "bekor qilingan qarz — qarzdorlik emas");
  assert.equal(pipeline.zakazQarzdormi(null), false);

  assert.equal(pipeline.zakazUstuni("YUTILDI", SANA, SANA, true), "QARZ");
  assert.equal(pipeline.zakazUstuni("YUTILDI", SANA, SANA, false), "YUTILDI");
  // Boshqa holatlar o'zgarmadi.
  assert.equal(pipeline.zakazUstuni("JARAYONDA", SANA, SANA, true), "JARAYONDA");
  assert.equal(pipeline.zakazUstuni("KUTILMOQDA", SANA, SANA), "BUGUNGI");
  assert.equal(pipeline.zakazUstuni("YOQOTILDI", null, SANA, true), "YOQOTILDI");
});

test("2b: 'Qarz' ustuni ro'yxatda 'Yutildi'dan KEYIN turadi", () => {
  const i = pipeline.ASOSIY_USTUNLAR.indexOf("QARZ");
  const y = pipeline.ASOSIY_USTUNLAR.indexOf("YUTILDI");
  assert.ok(y >= 0 && i === y + 1, "Qarz — Yutildidan keyingi ustun");
  assert.equal(pipeline.USTUN_NOMI.QARZ, "Qarz");
  // Zakaz BIR VAQTDA bitta ustunda: qarzdor "Yutildi"da ko'rinmaydi.
  assert.notEqual(pipeline.zakazUstuni("YUTILDI", SANA, SANA, true), "YUTILDI");
});

// ===========================================================================
// 4 — MAHSULOT TARTIBI
// ===========================================================================

test("4: qoldiq ko'p mahsulot tepada, tugagani eng pastda", () => {
  const xom = [
    { nomi: "Tugagan", qoldiq: 0 },
    { nomi: "Kam", qoldiq: 3 },
    { nomi: "Ko'p", qoldiq: 120 },
    { nomi: "Manfiy", qoldiq: -5 },
    { nomi: "O'rta", qoldiq: 40 },
  ];
  const tartib = mahsulotTartib.mahsulotlarniTartibla(xom).map((p: any) => p.nomi);
  assert.deepEqual(tartib, ["Ko'p", "O'rta", "Kam", "Manfiy", "Tugagan"]);
  assert.equal(mahsulotTartib.tugaganmi(0), true);
  assert.equal(mahsulotTartib.tugaganmi(-2), true, "manfiy qoldiq ham tugagan");
  assert.equal(mahsulotTartib.tugaganmi(1), false);
});

test("4b: sotuv ro'yxati bazadan ham shu tartibda keladi", async () => {
  await A(async () => {
    for (const [nomi, miqdor] of [["Aaa kam", 2], ["Bbb ko'p", 90], ["Ccc tugagan", 0]] as const) {
      await prisma.product.create({
        data: { businessId: T.business.id, nomi, miqdor, sotuvNarx: 10_000, kelganNarx: 5_000 },
      });
    }
  });
  const royxat = await A(async () =>
    inventoryQ.listProducts(T.business.id, { forKassir: true, faqatFaol: true })
  );
  const nomlar = royxat.map((p: any) => p.nomi);
  assert.deepEqual(nomlar, ["Bbb ko'p", "Aaa kam", "Ccc tugagan"]);
  assert.equal(royxat[2].mavjud, false, "tugagan mahsulotda 'Qolmadi' belgisi qoladi");
  assert.equal(royxat[0].qoldiq, 90, "kassirga qoldiq raqami ham beriladi");
});

// ===========================================================================
// 5 — KO'P MAHSULOTLI SOTUV
// ===========================================================================

test("5: savat birlashtiriladi — takror mahsulot miqdori qo'shiladi", () => {
  const savat = inventorySvc.savatniBirlashtir([
    { productId: "a", miqdor: 2, narx: 5000 },
    { productId: "b", miqdor: 1 },
    { productId: "a", miqdor: 3 },
  ]);
  assert.equal(savat.length, 2, "takror qator yangi satr ochmaydi");
  const a = savat.find((q: any) => q.productId === "a");
  assert.equal(a.miqdor, 5, "miqdor qo'shiladi");
  assert.equal(a.narx, 5000, "birinchi kiritilgan narx saqlanadi");
});

test("5b: bir necha mahsulot bitta amalda sotiladi", async () => {
  const p1 = await A(async () =>
    prisma.product.create({
      data: { businessId: T.business.id, nomi: "Savat A", miqdor: 10, sotuvNarx: 1_000, kelganNarx: 500 },
    })
  );
  const p2 = await A(async () =>
    prisma.product.create({
      data: { businessId: T.business.id, nomi: "Savat B", miqdor: 5, sotuvNarx: 2_000, kelganNarx: 900 },
    })
  );

  const sotuvlar = await A(async () =>
    inventorySvc.createSaleKop(
      { businessId: T.business.id, tolovTuri: "naqd", userId: T.user.id, sana: SANA },
      [
        { productId: p1.id, miqdor: 3 },
        { productId: p2.id, miqdor: 2 },
        // Takror qator — birlashadi (p1 jami 4 ta bo'ladi).
        { productId: p1.id, miqdor: 1 },
      ]
    )
  );

  assert.equal(sotuvlar.length, 2, "birlashtirilgandan keyin ikkita sotuv");
  const qoldiq1 = await A(async () => prisma.product.findUnique({ where: { id: p1.id } }));
  const qoldiq2 = await A(async () => prisma.product.findUnique({ where: { id: p2.id } }));
  assert.equal(qoldiq1.miqdor, 6, "10 − 4");
  assert.equal(qoldiq2.miqdor, 3, "5 − 2");
});

test("5c: qoldiqdan ortiq savat ATOMIK rad etiladi — hech nima yozilmaydi", async () => {
  const p1 = await A(async () =>
    prisma.product.create({
      data: { businessId: T.business.id, nomi: "Atomik A", miqdor: 4, sotuvNarx: 1_000, kelganNarx: 500 },
    })
  );
  const p2 = await A(async () =>
    prisma.product.create({
      data: { businessId: T.business.id, nomi: "Atomik B", miqdor: 1, sotuvNarx: 1_000, kelganNarx: 500 },
    })
  );
  const sotuvOldin = await A(async () =>
    prisma.sale.count({ where: { businessId: T.business.id } })
  );

  await assert.rejects(
    () =>
      A(async () =>
        inventorySvc.createSaleKop(
          { businessId: T.business.id, tolovTuri: "naqd", userId: T.user.id, sana: SANA },
          [
            { productId: p1.id, miqdor: 2 },
            { productId: p2.id, miqdor: 99 },
          ]
        )
      ),
    /yetarli emas/i
  );

  // Birinchi qator ham YOZILMAGAN bo'lishi kerak (atomiklik).
  const keyin1 = await A(async () => prisma.product.findUnique({ where: { id: p1.id } }));
  assert.equal(keyin1.miqdor, 4, "birinchi mahsulot qoldig'i tegilmaydi");
  assert.equal(
    await A(async () => prisma.sale.count({ where: { businessId: T.business.id } })),
    sotuvOldin,
    "yarim sotuv yozilmaydi"
  );
});

test("5d: bitta mahsulotli eski yo'l o'zgarmagan", async () => {
  const p = await A(async () =>
    prisma.product.create({
      data: { businessId: T.business.id, nomi: "Eski yo'l", miqdor: 7, sotuvNarx: 3_000, kelganNarx: 1_000 },
    })
  );
  const sotuv = await A(async () =>
    inventorySvc.createSale({
      businessId: T.business.id,
      productId: p.id,
      miqdor: 2,
      tolovTuri: "naqd",
      userId: T.user.id,
      sana: SANA,
    })
  );
  assert.equal(sotuv.jamiSumma, 6_000);
  const keyin = await A(async () => prisma.product.findUnique({ where: { id: p.id } }));
  assert.equal(keyin.miqdor, 5);
});

// ===========================================================================
// 6 — QARZ TAHRIRI VA O'CHIRISH HUQUQI
// ===========================================================================

test("6: qarz.tahrir huquqi FAQAT direktorda (OWNER)", () => {
  assert.ok(katalog.HUQUQ_KODLARI.has("qarz.tahrir"), "huquq katalogda bor");
  assert.ok(katalog.FAQAT_DIREKTOR.includes("qarz.tahrir"));
  assert.ok(katalog.ROL_DEFAULT_HUQUQLAR.OWNER.includes("qarz.tahrir"));
  // ADMINISTRATOR ham OLMAYDI — asosiy o'zgarish shu.
  assert.equal(
    katalog.ROL_DEFAULT_HUQUQLAR.ADMIN.includes("qarz.tahrir"),
    false,
    "administrator qarzni tahrirlay olmaydi"
  );
  assert.equal(katalog.ROL_DEFAULT_HUQUQLAR.CASHIER.includes("qarz.tahrir"), false);
  assert.equal(katalog.ROL_DEFAULT_HUQUQLAR.SELLER.includes("qarz.tahrir"), false);

  // Qolgan huquqlarda administrator to'plami o'zgarmagan.
  assert.ok(katalog.ROL_DEFAULT_HUQUQLAR.ADMIN.includes("qarz.tolash"));
  assert.ok(katalog.ROL_DEFAULT_HUQUQLAR.ADMIN.includes("hisobot.korish"));
});

test("6a: isDirektor faqat OWNER ni o'tkazadi", () => {
  assert.equal(rollar.isDirektor("OWNER"), true);
  assert.equal(rollar.isDirektor("ADMIN"), false, "administrator direktor emas");
  assert.equal(rollar.isDirektor("CASHIER"), false);
  assert.equal(rollar.isDirektor("SELLER"), false);
  assert.equal(rollar.isDirektor(null), false);
  // `isManager` avvalgidek ikkalasini o'tkazadi — boshqa amallar tegilmadi.
  assert.equal(rollar.isManager("ADMIN"), true);
});

test("6b: administrator va kassir uchun huquq tekshiruvi rad etadi", async () => {
  const yarat = (ism: string, login: string, rol: string) =>
    A(async () =>
      prisma.user.create({
        data: { ism, login, parolHash: "x", rol, tenantId: T.tenant.id },
      })
    );
  const kassir = await yarat("Kassir", "+998900000602", "CASHIER");
  const admin = await yarat("Administrator", "+998900000603", "ADMIN");

  for (const u of [kassir, admin]) {
    assert.equal(
      await A(async () => tekshir.hasPermission(u.id, "qarz.tahrir")),
      false,
      `${u.rol} da qarz.tahrir bo'lmasligi kerak`
    );
    await assert.rejects(
      () => A(async () => tekshir.requirePermission(u.id, "qarz.tahrir")),
      /huquq/i
    );
  }
  // Direktorda esa bor.
  assert.equal(await A(async () => tekshir.hasPermission(T.user.id, "qarz.tahrir")), true);
});

test("6c: qarz summasi tuzatiladi va holat qayta hisoblanadi", async () => {
  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      mijozNomi: "Tuzatiladigan",
      mijozTel: "+998901234501",
      jamiSumma: 5_000_000,
      sana: SANA,
    })
  );

  const yangi = await A(async () =>
    qarzTuzatish.qarzTahrirla({
      businessId: T.business.id,
      debtId: qarz.id,
      userId: T.user.id,
      jamiSumma: 3_000_000,
      sabab: "Summa xato kiritilgan",
    })
  );
  assert.equal(yangi.jamiSumma, 3_000_000);
  assert.equal(yangi.status, "OPEN");
});

test("6d: to'langan qismdan past summa rad etiladi", async () => {
  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      mijozNomi: "To'lovli",
      mijozTel: "+998901234502",
      jamiSumma: 1_000_000,
      sana: SANA,
    })
  );
  await A(async () =>
    qarzSvc.qarzTolov({
      businessId: T.business.id,
      debtId: qarz.id,
      userId: T.user.id,
      summa: 600_000,
      sana: SANA,
      tolovTuri: "naqd",
    })
  );

  await assert.rejects(
    () =>
      A(async () =>
        qarzTuzatish.qarzTahrirla({
          businessId: T.business.id,
          debtId: qarz.id,
          userId: T.user.id,
          jamiSumma: 400_000,
          sabab: "Noto'g'ri tuzatish",
        })
      ),
    /past bo'lmasligi/i
  );

  // To'lovi bor qarz O'CHIRILMAYDI ham.
  await assert.rejects(
    () =>
      A(async () =>
        qarzTuzatish.qarzOchir({
          businessId: T.business.id,
          debtId: qarz.id,
          userId: T.user.id,
          sabab: "kerak emas",
        })
      ),
    /to'lovni Moliya bo'limidan bekor/i
  );
});

// ===========================================================================
// 7 — QARZ AUDIT TARIXI
// ===========================================================================

test("7: o'chirilgan qarz ro'yxatdan chiqadi, audit yozuvi QOLADI", async () => {
  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      mijozNomi: "O'chiriladigan mijoz",
      mijozTel: "+998901234503",
      jamiSumma: 2_500_000,
      sana: SANA,
    })
  );

  const oldinRoyxat = await A(async () => qarzQ.listQarzlar(T.business.id, {}));
  assert.ok(oldinRoyxat.some((d: any) => d.id === qarz.id));

  await A(async () =>
    qarzTuzatish.qarzOchir({
      businessId: T.business.id,
      debtId: qarz.id,
      userId: T.user.id,
      sabab: "Takroriy yozuv",
    })
  );

  // Ro'yxatdan chiqdi.
  const keyinRoyxat = await A(async () => qarzQ.listQarzlar(T.business.id, {}));
  assert.equal(keyinRoyxat.some((d: any) => d.id === qarz.id), false);
  assert.equal(await A(async () => qarzQ.getQarzTafsilot(T.business.id, qarz.id)), null);

  // Yozuv BAZADA qoladi (bog'lanishlar uzilmasin) va CANCELLED.
  const xom = await A(async () => prisma.debt.findUnique({ where: { id: qarz.id } }));
  assert.ok(xom.deletedAt, "yumshoq o'chirish");
  assert.equal(xom.status, "CANCELLED");
  assert.equal(xom.isYopilgan, true);

  // AUDIT: o'chirish yozuvi eski qiymat va sabab bilan.
  const audit = await A(async () => qarzAuditQ.listQarzAudit({ businessId: T.business.id }));
  const ochirish = audit.items.find((a: any) => a.debtId === qarz.id && a.amal === "delete");
  assert.ok(ochirish, "o'chirish audit yozuvi bor");
  assert.equal(ochirish.qarzdor, "O'chiriladigan mijoz", "qarzdor nomi suratdan o'qiladi");
  assert.equal(ochirish.eskiSumma, 2_500_000);
  assert.equal(ochirish.sabab, "Takroriy yozuv");
  assert.equal(ochirish.turi, "olinadigan");
  assert.ok(ochirish.kim, "kim o'chirgani yozilgan");
  assert.ok(ochirish.vaqt, "sana/vaqt yozilgan");
});

test("7b: tahrir auditi eski va yangi qiymatni saqlaydi", async () => {
  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "beriladigan",
      mijozNomi: "Audit ta'minotchi",
      jamiSumma: 4_000_000,
      sana: SANA,
    })
  );
  await A(async () =>
    qarzTuzatish.qarzTahrirla({
      businessId: T.business.id,
      debtId: qarz.id,
      userId: T.user.id,
      jamiSumma: 4_500_000,
      sabab: "Ta'minotchi hisobiga qo'shildi",
    })
  );

  const audit = await A(async () =>
    qarzAuditQ.listQarzAudit({ businessId: T.business.id, amal: "update" })
  );
  const yozuv = audit.items.find((a: any) => a.debtId === qarz.id);
  assert.ok(yozuv);
  assert.equal(yozuv.eskiSumma, 4_000_000);
  assert.equal(yozuv.yangiSumma, 4_500_000);
  assert.equal(yozuv.sabab, "Ta'minotchi hisobiga qo'shildi");
  assert.equal(yozuv.turi, "beriladigan");
  assert.equal(yozuv.kim, "Direktor");
});

test("7c: audit qarzdor nomi bo'yicha qidiriladi", async () => {
  const natija = await A(async () =>
    qarzAuditQ.listQarzAudit({ businessId: T.business.id, q: "o'chiriladigan" })
  );
  assert.ok(natija.items.length > 0);
  assert.ok(
    natija.items.every((a: any) => (a.qarzdor ?? "").toLowerCase().includes("o'chiriladigan"))
  );
});
