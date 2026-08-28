/**
 * DASHBOARD UX TESTLARI — "Kassadagi pul" kartasi, "Bugungi holat" bloki va
 * TOP-5 kategoriya kesimi.
 *
 * Tekshiriladigan invariantlar:
 *   1) "Kassadagi pul" = FAOL kassalar qoldig'i (kirim jami EMAS);
 *   2) nofaol kassadagi pul asosiy raqamga qo'shilmaydi, lekin yo'qolmaydi;
 *   3) "Bugungi holat" faqat bugungi yozuvlarni sanaydi;
 *   4) qarzga yozilgan savdo kirimga kirmaydi;
 *   5) CRM o'chiq bo'lsa CRM ko'rsatkichlari umuman qaytarilmaydi;
 *   6) kategoriya taqsimoti kamayish tartibida (TOP 5 = eng katta 5 tasi);
 *   7) barcha raqamlar tenantlar orasida sizib o'tmaydi.
 *
 * Ishga tushirish: npm run test:dashboard-ux
 */
process.env.DATABASE_URL = "file:./prisma/test-dashboard-ux.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let accountsSvc: any;
let accountsQ: any;
let dashboard: any;
let panelQ: any;
let createTenantWithOwner: any;
let createTransaction: any;
let createQarz: any;
let crm: any;

let tA: any;
let tB: any;
let naqd: any;
let plastik: any;
let kirimCat: any;
let chiqimCat: any;

/** Bugungi kun — testdagi yozuvlar shu sana bilan kiritiladi. */
let BUGUN: string;

const AKTOR = { ism: "Direktor" };

function A<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(tA.tenant.id, fn, { ...AKTOR, userId: tA.user.id });
}
function B<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(tB.tenant.id, fn, { ...AKTOR, userId: tB.user.id });
}

before(async () => {
  rmSync("prisma/test-dashboard-ux.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  accountsSvc = await import("@/lib/services/accounts");
  accountsQ = await import("@/lib/queries/accounts");
  dashboard = await import("@/lib/queries/dashboard");
  panelQ = await import("@/lib/queries/dashboardPanel");
  crm = await import("@/lib/crm/service");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));
  ({ createQarz } = await import("@/lib/services/qarz"));
  ({ BUGUN } = { BUGUN: (await import("@/lib/date")).todayDateOnlyString() });

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Panel A",
    ism: "A egasi",
    login: "+998900000101",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Panel B",
    ism: "B egasi",
    login: "+998900000102",
    parol: "parol12345",
  });

  [naqd] = await A(async () => accountsQ.listAccounts(tA.business.id));
  plastik = await A(async () =>
    accountsSvc.createAccount(tA.business.id, { nomi: "Terminal", turi: "plastik" })
  );
  kirimCat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: tA.business.id, turi: "kirim" } })
  );
  chiqimCat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: tA.business.id, turi: "chiqim" } })
  );
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- 1-2. "Kassadagi pul" ----------

test("getKassaXulosa: faol kassalar qoldig'i (kirim jami emas)", async () => {
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 1_000_000, sana: BUGUN, accountId: naqd.id,
    })
  );
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "chiqim", categoryId: chiqimCat.id, summa: 400_000, sana: BUGUN, accountId: naqd.id,
    })
  );
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 250_000, sana: BUGUN, accountId: plastik.id,
    })
  );

  const holat = await A(async () => panelQ.getKassaXulosa(tA.business.id));
  // 1 000 000 − 400 000 + 250 000 = 850 000. Kirim jami (1 250 000) EMAS.
  assert.equal(holat.jami, 850_000);
  assert.equal(holat.kassaSoni, 2);
  // Turlar kesimi jami bilan mos bo'lishi shart (karta ichidagi qatorlar).
  assert.equal(
    holat.bolimlar.reduce((a: number, b: any) => a + b.qoldiq, 0),
    holat.jami
  );
});

test("getKassaXulosa: transfer jami qoldiqni o'zgartirmaydi", async () => {
  await A(async () =>
    accountsSvc.createTransfer(tA.business.id, tA.user.id, {
      fromAccountId: naqd.id, toAccountId: plastik.id, summa: 100_000, sana: BUGUN,
    })
  );
  const holat = await A(async () => panelQ.getKassaXulosa(tA.business.id));
  assert.equal(holat.jami, 850_000, "pul biznes ichida ko'chdi — jami o'zgarmaydi");
});

test("getKassaXulosa: NOFAOL kassa qoldig'i jamiga qo'shilmaydi", async () => {
  const eski = await A(async () =>
    accountsSvc.createAccount(tA.business.id, { nomi: "Eski kassa", turi: "bank" })
  );
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 70_000, sana: BUGUN, accountId: eski.id,
    })
  );
  await A(async () => accountsSvc.updateAccount(tA.business.id, eski.id, { isActive: false }));

  const holat = await A(async () => panelQ.getKassaXulosa(tA.business.id));
  assert.equal(holat.jami, 850_000, "nofaol kassa 'joriy kassa' raqamiga qo'shilmaydi");
  assert.equal(holat.kassaSoni, 2, "nofaol kassa sanalmaydi");
  // Eski `getJamiKassaQoldiq` (BARCHA kassalar) xatti-harakati O'ZGARMAGAN —
  // `proBugun` bloki unga tayanadi, ya'ni 70 000 yo'qolmagan.
  assert.equal(await A(async () => accountsQ.getJamiKassaQoldiq(tA.business.id)), 920_000);
});

test("getKassaXulosa: boshqa tenant raqamlari ko'rinmaydi", async () => {
  const bHolat = await B(async () => panelQ.getKassaXulosa(tB.business.id));
  assert.equal(bHolat.jami, 0);
  assert.equal(bHolat.kassaSoni, 1, "B faqat O'Z kassasini ko'radi");
});

// ---------- 3-5. "Bugungi holat" ----------

test("getBugungiHolat: faqat bugungi kirim/chiqim sanaladi", async () => {
  // Kechagi yozuv bugungi raqamga kirmasligi kerak.
  const kecha = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 9_000_000, sana: kecha, accountId: naqd.id,
    })
  );

  const holat = await A(async () => panelQ.getBugungiHolat(tA.business.id, BUGUN, { crm: false, qarz: true }));
  assert.equal(holat.kirim, 1_320_000, "1 000 000 + 250 000 + 70 000");
  assert.equal(holat.chiqim, 400_000);
  assert.equal(holat.sof, 920_000);
  // Kassa qoldig'i bu blokda EMAS — u alohida "Kassada" kartasida
  // (getKassaXulosa) va JORIY holatni beradi: kechagi kirim ham unda.
  const kassa = await A(async () => panelQ.getKassaXulosa(tA.business.id));
  assert.equal(kassa.jami, 9_850_000);
});

test("getBugungiHolat: qarzga yozilgan savdo alohida, kirimga qo'shilmaydi", async () => {
  const oldin = await A(async () => panelQ.getBugungiHolat(tA.business.id, BUGUN, { crm: false, qarz: true }));
  await A(async () =>
    createQarz({
      businessId: tA.business.id,
      userId: tA.user.id,
      turi: "olinadigan",
      mijozNomi: "Karim",
      jamiSumma: 500_000,
      sana: BUGUN,
    })
  );
  const keyin = await A(async () => panelQ.getBugungiHolat(tA.business.id, BUGUN, { crm: false, qarz: true }));
  assert.equal(keyin.qarzBugun.summa, 500_000);
  assert.equal(keyin.qarzBugun.soni, 1);
  assert.equal(keyin.kirim, oldin.kirim, "qarz kirim yozmaydi");
  // Qarz kassaga pul qo'ymaydi — "Kassada" kartasi o'zgarmaydi.
  const kassa = await A(async () => panelQ.getKassaXulosa(tA.business.id));
  assert.equal(kassa.jami, 9_850_000, "qarz kassaga pul qo'ymasligi kerak");
});

test("getBugungiHolat: CRM o'chiq bo'lsa CRM ko'rsatkichlari qaytarilmaydi", async () => {
  await A(async () =>
    crm.createDeal({
      businessId: tA.business.id,
      userId: tA.user.id,
      nomi: "Bugungi buyurtma",
      summa: 300_000,
      sana: BUGUN,
    })
  );
  const ochiq = await A(async () => panelQ.getBugungiHolat(tA.business.id, BUGUN, { crm: false, qarz: true }));
  assert.equal(ochiq.crm, null, "modul yoqilmagan biznesda CRM bloki umuman yo'q");
});

test("getBugungiHolat: CRM yoqilganda yangi va yutilgan buyurtmalar sanaladi", async () => {
  const holat = await A(async () => panelQ.getBugungiHolat(tA.business.id, BUGUN, { crm: true, qarz: true }));
  assert.equal(holat.crm.yangi, 1);
  assert.equal(holat.crm.yutilgan, 0, "hali hech biri yutilmagan");

  // Buyurtmani "Yutildi" (WON) bosqichiga ko'chiramiz.
  const won = await A(async () =>
    prisma.stage.findFirst({ where: { businessId: tA.business.id, turi: "WON" } })
  );
  const deal = await A(async () =>
    prisma.deal.findFirst({ where: { businessId: tA.business.id, nomi: "Bugungi buyurtma" } })
  );
  await A(async () =>
    crm.moveDeal({ businessId: tA.business.id, dealId: deal.id, stageId: won.id, userId: tA.user.id })
  );

  const keyin = await A(async () => panelQ.getBugungiHolat(tA.business.id, BUGUN, { crm: true, qarz: true }));
  assert.equal(keyin.crm.yutilgan, 1);
  assert.equal(keyin.crm.yutilganSumma, 300_000);
});

test("getBugungiHolat: boshqa tenantda hammasi nol", async () => {
  const holat = await B(async () => panelQ.getBugungiHolat(tB.business.id, BUGUN, { crm: true, qarz: true }));
  assert.equal(holat.kirim, 0);
  assert.equal(holat.chiqim, 0);
  assert.equal(holat.qarzBugun.summa, 0);
  assert.equal(holat.crm.yangi, 0);
  const bKassa = await B(async () => panelQ.getKassaXulosa(tB.business.id));
  assert.equal(bKassa.jami, 0);
});

// ---------- 6. TOP 5 kategoriya ----------

test("getCategoryBreakdown kamayish tartibida — TOP 5 haqiqatan eng kattalari", async () => {
  const oy = BUGUN.slice(0, 7);
  // 7 ta kategoriya: 7 mln, 6 mln ... 1 mln (standart kategoriyalardan katta).
  for (let i = 7; i >= 1; i--) {
    const cat = await A(async () =>
      prisma.category.create({ data: { businessId: tA.business.id, nomi: `Kat ${i}`, turi: "chiqim" } })
    );
    await A(async () =>
      createTransaction(tA.user.id, tA.business.id, {
        turi: "chiqim", categoryId: cat.id, summa: i * 1_000_000, sana: BUGUN, accountId: naqd.id,
      })
    );
  }

  const royxat = await A(async () => dashboard.getCategoryBreakdown(tA.business.id, oy, "chiqim"));
  for (let i = 1; i < royxat.length; i++) {
    assert.ok(royxat[i - 1].summa >= royxat[i].summa, "kamayish tartibi buzilgan");
  }
  // Dashboard aynan shu ro'yxatning birinchi 5 tasini ko'rsatadi.
  const top5 = royxat.slice(0, 5);
  assert.equal(top5.length, 5);
  assert.deepEqual(top5.map((c: any) => c.nomi), ["Kat 7", "Kat 6", "Kat 5", "Kat 4", "Kat 3"]);
  assert.ok(royxat.length > 5, "qolganlari 'Barchasini ko'rish' da ochiladi");
});

// ---------- 7. Hisobot davrlari (Kunlik / Haftalik / Oylik / Yillik) ----------

test("davriy hisobot: kunlik va haftalik jami oylik hisobot bilan mos", async () => {
  const davriy = await import("@/lib/queries/davriyHisobot");
  const oy = BUGUN.slice(0, 7);
  const oylik = await A(async () => dashboard.getMonthSummary(tA.business.id, oy));

  for (const davr of ["kunlik", "haftalik"] as const) {
    const h = await A(async () => davriy.getDavriyHisobot(tA.business.id, oy, davr));
    assert.equal(h.jamiKirim, oylik.jamiKirim, `${davr}: kirim jami oylik bilan mos emas`);
    assert.equal(h.jamiChiqim, oylik.jamiChiqim, `${davr}: chiqim jami oylik bilan mos emas`);
    assert.equal(h.jamiSof, oylik.sofFoyda, `${davr}: sof foyda oylik bilan mos emas`);
    assert.ok(h.qatorlar.length > 0);
  }
});

test("davriy hisobot: haftalik qatorlar kunlikdan kam yoki teng", async () => {
  const davriy = await import("@/lib/queries/davriyHisobot");
  const oy = BUGUN.slice(0, 7);
  const kunlik = await A(async () => davriy.getDavriyHisobot(tA.business.id, oy, "kunlik"));
  const haftalik = await A(async () => davriy.getDavriyHisobot(tA.business.id, oy, "haftalik"));
  assert.ok(haftalik.qatorlar.length <= kunlik.qatorlar.length);
  assert.ok(haftalik.qatorlar.length >= 1);
});

test("davriy hisobot: yillik — 12 oy, jami oylar yig'indisiga teng", async () => {
  const davriy = await import("@/lib/queries/davriyHisobot");
  const yil = BUGUN.slice(0, 4);
  const h = await A(async () => davriy.getDavriyHisobot(tA.business.id, `${yil}-06`, "yillik"));
  assert.equal(h.qatorlar.length, 12);
  assert.equal(h.sarlavha, `${yil}-yil`);
  assert.equal(
    h.jamiKirim,
    h.qatorlar.reduce((a: number, q: any) => a + q.kirim, 0)
  );
});

test("davrniOqi: noma'lum qiymat oylikka tushadi", async () => {
  const davriy = await import("@/lib/queries/davriyHisobot");
  assert.equal(davriy.davrniOqi(undefined), "oylik");
  assert.equal(davriy.davrniOqi("nimadir"), "oylik");
  assert.equal(davriy.davrniOqi("haftalik"), "haftalik");
  assert.equal(davriy.davrniOqi("yillik"), "yillik");
});

test("davriy hisobot: boshqa tenantda nol", async () => {
  const davriy = await import("@/lib/queries/davriyHisobot");
  const h = await B(async () => davriy.getDavriyHisobot(tB.business.id, BUGUN.slice(0, 7), "kunlik"));
  assert.equal(h.jamiKirim, 0);
  assert.equal(h.qatorlar.length, 0);
});

// ---------- 8. Dashboard keshi (dashboardCached.ts integratsiyasi) ----------
//
// `keshlangan()` kesh kalitiga [nomi, tenantId, businessId, ...argumentlar]
// ni kiritadi va callback ichida `runWithTenant` ni QAYTA o'rnatadi
// (lib/cache.ts). Shu ikki qoida buzilsa bir mijozning raqami boshqasiga
// ko'rinib ketardi — quyidagi testlar aynan shuni qo'riqlaydi.
//
// DIQQAT: node:test muhitida Next kesh infratuzilmasi yo'q, shuning uchun
// `keshlangan()` to'g'ridan-to'g'ri chaqiruvga tushadi (lib/cache.ts dagi
// "incremental cache" fallback'i). Ya'ni bu yerda KALIT/SCOPE mantiqi
// tekshiriladi; keshning O'ZI va bekor qilinishi haqiqiy Next runtime'ida
// (tests/smoke-brauzer.test.ts) sinaladi.

test("kesh: o'ralgan funksiyalar o'ralmagani bilan bir xil natija beradi", async () => {
  const kesh = await import("@/lib/queries/dashboardCached");
  const [xomKassa, keshKassa] = await A(async () => [
    await panelQ.getKassaXulosa(tA.business.id),
    await kesh.getKassaXulosaKesh(tA.business.id),
  ]);
  assert.deepEqual(keshKassa, xomKassa);

  const [xomBugun, keshBugun] = await A(async () => [
    await panelQ.getBugungiHolat(tA.business.id, BUGUN, { crm: true, qarz: true }),
    await kesh.getBugungiHolatKesh(tA.business.id, BUGUN, { crm: true, qarz: true }),
  ]);
  assert.deepEqual(keshBugun, xomBugun);
});

test("kesh: BOSHQA TENANT ma'lumotini hech qachon qaytarmaydi", async () => {
  const kesh = await import("@/lib/queries/dashboardCached");
  // A'da pul bor (yuqoridagi testlar yozgan), B — bo'sh.
  const a = await A(async () => kesh.getKassaXulosaKesh(tA.business.id));
  const b = await B(async () => kesh.getKassaXulosaKesh(tB.business.id));
  // A'da harakat bo'lgan (qoldiq manfiy ham bo'lishi mumkin — yuqoridagi
  // testlar chiqim yozgan), B esa butunlay toza.
  assert.notEqual(a.jami, 0, "A tenantda kassa harakati bo'lishi kerak");
  assert.equal(b.jami, 0, "B tenantga A'ning qoldig'i sizib o'tdi");
  assert.equal(b.kassaSoni, 1, "B faqat O'Z kassasini ko'rishi kerak");

  const aBugun = await A(async () => kesh.getBugungiHolatKesh(tA.business.id, BUGUN, { crm: true, qarz: true }));
  const bBugun = await B(async () => kesh.getBugungiHolatKesh(tB.business.id, BUGUN, { crm: true, qarz: true }));
  assert.ok(aBugun.kirim > 0);
  assert.equal(bBugun.kirim, 0, "B tenantga A'ning kirimi sizib o'tdi");
  assert.equal(bBugun.qarzBugun.summa, 0);
  assert.equal(bBugun.crm.yangi, 0);
});

test("kesh: BITTA tenant ichidagi ikki biznes aralashmaydi", async () => {
  // Kesh kaliti businessId'ni ham o'z ichiga oladi. Agar olmaganda, bir
  // kompaniyaning ikkinchi biznesi birinchisining raqamlarini ko'rardi.
  const kesh = await import("@/lib/queries/dashboardCached");
  const ikkinchi = await A(async () =>
    prisma.business.create({ data: { nomi: "Ikkinchi biznes" } })
  );
  await A(async () =>
    prisma.account.create({ data: { businessId: ikkinchi.id, nomi: "Naqd", turi: "naqd" } })
  );

  const birinchi = await A(async () => kesh.getKassaXulosaKesh(tA.business.id));
  const boshqa = await A(async () => kesh.getKassaXulosaKesh(ikkinchi.id));
  assert.notEqual(birinchi.jami, 0);
  assert.equal(boshqa.jami, 0, "ikkinchi biznes birinchisining qoldig'ini ko'rdi");
  assert.equal(boshqa.kassaSoni, 1);

  const bugun = await A(async () => kesh.getBugungiHolatKesh(ikkinchi.id, BUGUN, { crm: true, qarz: true }));
  assert.equal(bugun.kirim, 0);
  assert.equal(bugun.qarzBugun.summa, 0);
});

test("kesh: tenant konteksti bo'lmasa XATO beradi (jimgina qaytarmaydi)", async () => {
  // Fail-closed: kalitni tenantId'siz qurishdan ko'ra yiqilgan ma'qul.
  const kesh = await import("@/lib/queries/dashboardCached");
  await assert.rejects(() => kesh.getKassaXulosaKesh(tA.business.id), /Tenant konteksti/);
  await assert.rejects(
    () => kesh.getBugungiHolatKesh(tA.business.id, BUGUN, { crm: true, qarz: true }),
    /Tenant konteksti/
  );
});

test("kesh: yangi yozuvdan keyin qayta hisoblangan qiymat o'zgaradi", async () => {
  // Keshning O'ZI Next runtime'ida bekor qilinadi; bu yerda esa bekor
  // qilingandan KEYIN qaytadigan qiymat to'g'ri ekani tekshiriladi.
  const kesh = await import("@/lib/queries/dashboardCached");
  const oldin = await A(async () => kesh.getKassaXulosaKesh(tA.business.id));
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 33_000, sana: BUGUN, accountId: naqd.id,
    })
  );
  const keyin = await A(async () => kesh.getKassaXulosaKesh(tA.business.id));
  assert.equal(keyin.jami, oldin.jami + 33_000);
});

// ---------- 9. Kesh bekor qilinishi: statik qo'riqchi ----------

test("dashboardga ta'sir qiladigan HAR bir API route keshni bekor qiladi", async () => {
  /*
   * Bu test kodni EMAS, QOIDANI qo'riqlaydi: dashboard raqamiga ta'sir
   * qiladigan yozuv route'i `dashboardYangilandi(businessId)` chaqirmasa,
   * foydalanuvchi 60 soniyagacha eski raqamni ko'rib turadi. Bunday
   * xatoni ko'z bilan topib bo'lmaydi — shuning uchun avtomatik.
   *
   * Yangi route qo'shilib bu test qizarsa: yo `dashboardYangilandi` ni
   * qo'shing, yo (haqiqatan ta'sir qilmasa) quyidagi ISTISNO ro'yxatiga
   * SABABI bilan yozing.
   */
  const { readFileSync, readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");

  /** Dashboard so'rovlari o'qiydigan modellar. */
  const MODELLAR = [
    "transaction", "account", "accountTransfer", "debt", "debtPayment",
    "deal", "sale", "stockEntry", "receipt",
  ];
  /** Shu modellarga yozadigan xizmat qatlami funksiyalari. */
  const XIZMATLAR = [
    "createTransaction", "updateTransaction", "createQarz", "qarzTolov", "qarzBekor",
    "createAccount", "updateAccount", "deleteAccount", "createTransfer", "transferQaror",
    "createDeal", "moveDeal", "kirimgaKochirish", "createSale", "sotuvBekor",
  ];
  /**
   * ISTISNOLAR — sababi bilan.
   *
   * `businesses/route.ts`: YANGI biznes va uning birinchi kassasini
   * yaratadi. Kesh kaliti `businessId` ni o'z ichiga oladi, ya'ni hali
   * mavjud bo'lmagan biznes uchun keshda yozuv ham bo'lishi mumkin emas.
   */
  const ISTISNO = new Set(["src/app/api/businesses/route.ts"]);

  /*
   * CHAQIRUV izlanadi, import EMAS: `import { dashboardYangilandi } ...`
   * qatori faylda qolib, chaqiruvning o'zi o'chirilgan holat eng xavflisi —
   * ko'z bilan qaraganda "hammasi joyida" ko'rinadi.
   */
  const chaqiruv = /\bdashboardYangilandi\s*\(/;

  const yozish = new RegExp(
    `\\b(?:prisma|tx|rawPrisma)\\.(?:${MODELLAR.join("|")})\\.` +
      `(?:create|createMany|update|updateMany|delete|deleteMany|upsert)\\b`
  );
  const xizmat = new RegExp(`\\b(?:${XIZMATLAR.join("|")})\\s*\\(`);

  const fayllar: string[] = [];
  (function yur(dir: string) {
    for (const nom of readdirSync(dir)) {
      const yol = join(dir, nom);
      if (statSync(yol).isDirectory()) yur(yol);
      else if (nom === "route.ts") fayllar.push(yol.split("\\").join("/"));
    }
  })("src/app/api");
  assert.ok(fayllar.length > 40, `route fayllari topilmadi (${fayllar.length} ta)`);

  const buzilgan: string[] = [];
  for (const yol of fayllar) {
    if (ISTISNO.has(yol)) continue;
    const matn = readFileSync(yol, "utf8");
    if (!yozish.test(matn) && !xizmat.test(matn)) continue;
    if (!chaqiruv.test(matn)) buzilgan.push(yol);
  }
  assert.deepEqual(
    buzilgan,
    [],
    "quyidagi route'lar dashboard keshini bekor qilmaydi:\n  " + buzilgan.join("\n  ")
  );
});
