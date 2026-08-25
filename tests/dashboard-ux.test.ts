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
let bugunQ: any;
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
  bugunQ = await import("@/lib/queries/bugun");
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

test("getKassaHolati: faol kassalar qoldig'i (kirim jami emas)", async () => {
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

  const holat = await A(async () => accountsQ.getKassaHolati(tA.business.id));
  // 1 000 000 − 400 000 + 250 000 = 850 000. Kirim jami (1 250 000) EMAS.
  assert.equal(holat.faolJami, 850_000);
  assert.equal(holat.faolSoni, 2);
  assert.equal(holat.nofaolJami, 0);
});

test("getKassaHolati: transfer jami qoldiqni o'zgartirmaydi", async () => {
  await A(async () =>
    accountsSvc.createTransfer(tA.business.id, tA.user.id, {
      fromAccountId: naqd.id, toAccountId: plastik.id, summa: 100_000, sana: BUGUN,
    })
  );
  const holat = await A(async () => accountsQ.getKassaHolati(tA.business.id));
  assert.equal(holat.faolJami, 850_000, "pul biznes ichida ko'chdi — jami o'zgarmaydi");
});

test("getKassaHolati: nofaol kassa asosiy raqamdan chiqadi, lekin yo'qolmaydi", async () => {
  const eski = await A(async () =>
    accountsSvc.createAccount(tA.business.id, { nomi: "Eski kassa", turi: "bank" })
  );
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 70_000, sana: BUGUN, accountId: eski.id,
    })
  );
  await A(async () => accountsSvc.updateAccount(tA.business.id, eski.id, { isActive: false }));

  const holat = await A(async () => accountsQ.getKassaHolati(tA.business.id));
  assert.equal(holat.faolJami, 850_000, "nofaol kassa 'joriy kassa' raqamiga qo'shilmaydi");
  assert.equal(holat.faolSoni, 2);
  assert.equal(holat.nofaolJami, 70_000, "pul yashirilmaydi — alohida qatorda");
  // Eski `getJamiKassaQoldiq` xatti-harakati O'ZGARMAGAN (proBugun bloki unga tayanadi).
  assert.equal(await A(async () => accountsQ.getJamiKassaQoldiq(tA.business.id)), 920_000);
});

test("getKassaHolati: boshqa tenant raqamlari ko'rinmaydi", async () => {
  const bHolat = await B(async () => accountsQ.getKassaHolati(tB.business.id));
  assert.equal(bHolat.faolJami, 0);
  assert.equal(bHolat.nofaolJami, 0);
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

  const holat = await A(async () => bugunQ.getBugungiHolat(tA.business.id, BUGUN, false));
  assert.equal(holat.kirim, 1_320_000, "1 000 000 + 250 000 + 70 000");
  assert.equal(holat.chiqim, 400_000);
  assert.equal(holat.sof, 920_000);
  // Kassa — JORIY holat (bugungi emas): kechagi kirim ham qoldiqda.
  assert.equal(holat.kassaJami, 9_850_000);
  assert.equal(holat.kassaSoni, 2);
});

test("getBugungiHolat: qarzga yozilgan savdo alohida, kirimga qo'shilmaydi", async () => {
  const oldin = await A(async () => bugunQ.getBugungiHolat(tA.business.id, BUGUN, false));
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
  const keyin = await A(async () => bugunQ.getBugungiHolat(tA.business.id, BUGUN, false));
  assert.equal(keyin.qarzgaYozilgan, 500_000);
  assert.equal(keyin.qarzSoni, 1);
  assert.equal(keyin.kirim, oldin.kirim, "qarz kirim yozmaydi");
  assert.equal(keyin.kassaJami, oldin.kassaJami, "qarz kassaga pul qo'ymaydi");
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
  const ochiq = await A(async () => bugunQ.getBugungiHolat(tA.business.id, BUGUN, false));
  assert.equal(ochiq.crm, null, "modul yoqilmagan biznesda CRM bloki umuman yo'q");
});

test("getBugungiHolat: CRM yoqilganda yangi va yutilgan buyurtmalar sanaladi", async () => {
  const holat = await A(async () => bugunQ.getBugungiHolat(tA.business.id, BUGUN, true));
  assert.equal(holat.crm.yangiSoni, 1);
  assert.equal(holat.crm.yangiSumma, 300_000);
  assert.equal(holat.crm.yutilganSoni, 0, "hali hech biri yutilmagan");

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

  const keyin = await A(async () => bugunQ.getBugungiHolat(tA.business.id, BUGUN, true));
  assert.equal(keyin.crm.yutilganSoni, 1);
  assert.equal(keyin.crm.yutilganSumma, 300_000);
});

test("getBugungiHolat: boshqa tenantda hammasi nol", async () => {
  const holat = await B(async () => bugunQ.getBugungiHolat(tB.business.id, BUGUN, true));
  assert.equal(holat.kirim, 0);
  assert.equal(holat.chiqim, 0);
  assert.equal(holat.kassaJami, 0);
  assert.equal(holat.qarzgaYozilgan, 0);
  assert.equal(holat.crm.yangiSoni, 0);
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
