/**
 * KATEGORIYA TAFSILOTI — bosh sahifadagi taqsimot qatoriga bosilganda
 * chiqadigan yozuvlar ro'yxati.
 *
 * ENG MUHIM INVARIANT (11-talab): kartadagi kategoriya summasi va tafsilot
 * ro'yxatining yig'indisi BIR XIL bo'lishi shart. Ikkalasi ham bitta
 * manbadan — `lib/qarzFiltr.ts` dagi real-pul qoidasidan — o'tishi kerak,
 * aks holda qarzga yozilgan savdo bir ekranda ko'rinib, ikkinchisida
 * ko'rinmay qolardi.
 *
 * Ishga tushirish: npm run test:kategoriya
 */
process.env.DATABASE_URL = "file:./prisma/test-kategoriya.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let createTransaction: any;
let txQ: any;
let dashboardQ: any;

let T: any;
let T2: any;
let naqdKassa: any;
/** Kategoriyalar: gulKirim/gulChiqim ayni NOMDA, lekin har xil yo'nalishda. */
let gulKirim: any;
let gulChiqim: any;
let qogozga: any;
let begonaKat: any;

const OY = "2026-08";

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

/** Kategoriya tafsiloti oynasi AYNAN shu chaqiruvni yuboradi. */
function tafsilot(opts: {
  categoryId: string;
  turi: "kirim" | "chiqim";
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}) {
  return A(async () =>
    txQ.listTransactions({
      businessId: T.business.id,
      categoryId: opts.categoryId,
      turi: opts.turi,
      from: opts.from ?? null,
      to: opts.to ?? null,
      q: opts.q ?? null,
      realPul: true,
      kunlikJami: true,
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 20,
    })
  );
}

/** Bosh sahifadagi karta raqami. */
async function kartaSummasi(nomi: string, turi: "kirim" | "chiqim") {
  const royxat = await A(async () => dashboardQ.getCategoryBreakdown(T.business.id, OY, turi));
  return royxat.find((c: any) => c.nomi === nomi)?.summa ?? 0;
}

function yoz(opts: {
  turi: "kirim" | "chiqim";
  categoryId: string;
  summa: number;
  sana: string;
  izoh?: string;
  tolovTuri?: string | null;
}) {
  return A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi: opts.turi,
      categoryId: opts.categoryId,
      summa: opts.summa,
      sana: opts.sana,
      izoh: opts.izoh,
      tolovTuri: opts.tolovTuri === undefined ? "naqd" : opts.tolovTuri,
      accountId: opts.tolovTuri === "qarz" ? undefined : naqdKassa.id,
    })
  );
}

before(async () => {
  rmSync("prisma/test-kategoriya.db", { force: true });
  rmSync("prisma/test-kategoriya.db-journal", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));
  txQ = await import("@/lib/queries/transactions");
  dashboardQ = await import("@/lib/queries/dashboard");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Gul do'koni",
    ism: "Direktor",
    login: "+998900000301",
    parol: "parol12345",
  });
  T2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona biznes",
    ism: "Begona",
    login: "+998900000302",
    parol: "parol12345",
  });

  const accountsQ = await import("@/lib/queries/accounts");
  naqdKassa = (await A(async () => accountsQ.listAccounts(T.business.id)))[0];

  gulKirim = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Gul", turi: "kirim" },
  });
  gulChiqim = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Gul", turi: "chiqim" },
  });
  qogozga = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Qog'ozga", turi: "chiqim" },
  });
  begonaKat = await rawPrisma.category.create({
    data: { businessId: T2.business.id, nomi: "Gul", turi: "kirim" },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// TEST 1 — kirim kategoriyasi
// ---------------------------------------------------------------------------

test("TEST 1: Gul kirimi 5M+3M+2M → karta 10M, tafsilotda aynan 3 ta yozuv", async () => {
  await yoz({ turi: "kirim", categoryId: gulKirim.id, summa: 5_000_000, sana: "2026-08-18", izoh: "Optom savdo" });
  await yoz({ turi: "kirim", categoryId: gulKirim.id, summa: 3_000_000, sana: "2026-08-15", izoh: "Chakana savdo" });
  await yoz({ turi: "kirim", categoryId: gulKirim.id, summa: 2_000_000, sana: "2026-08-10", izoh: "Toshkentdan" });

  assert.equal(await kartaSummasi("Gul", "kirim"), 10_000_000);

  const t = await tafsilot({ categoryId: gulKirim.id, turi: "kirim", from: "2026-08-01", to: "2026-08-31" });
  assert.equal(t.total, 3, "faqat uchta yozuv");
  assert.equal(t.totals.jamiKirim, 10_000_000, "tafsilot jami karta bilan bir xil");
  assert.equal(
    t.items.reduce((a: number, x: any) => a + x.summa, 0),
    10_000_000,
    "ro'yxat yig'indisi ham 10M"
  );
  assert.equal(t.items.every((x: any) => x.categoryId === gulKirim.id), true);
  assert.equal(t.items.every((x: any) => x.turi === "kirim"), true);
  // Eng yangi -> eng eski.
  assert.deepEqual(
    t.items.map((x: any) => x.summa),
    [5_000_000, 3_000_000, 2_000_000]
  );
});

// ---------------------------------------------------------------------------
// TEST 2 — chiqim kategoriyasi
// ---------------------------------------------------------------------------

test("TEST 2: Qog'ozga chiqimi 2M+1M+500K → karta 3,5M, tafsilotda 3 ta", async () => {
  await yoz({ turi: "chiqim", categoryId: qogozga.id, summa: 2_000_000, sana: "2026-08-18" });
  await yoz({ turi: "chiqim", categoryId: qogozga.id, summa: 1_000_000, sana: "2026-08-16" });
  await yoz({ turi: "chiqim", categoryId: qogozga.id, summa: 500_000, sana: "2026-08-14" });

  assert.equal(await kartaSummasi("Qog'ozga", "chiqim"), 3_500_000);

  const t = await tafsilot({ categoryId: qogozga.id, turi: "chiqim", from: "2026-08-01", to: "2026-08-31" });
  assert.equal(t.total, 3);
  assert.equal(t.totals.jamiChiqim, 3_500_000);
  assert.equal(t.items.every((x: any) => x.turi === "chiqim"), true);
});

// ---------------------------------------------------------------------------
// TEST 3 — bir xil nom, har xil yo'nalish
// ---------------------------------------------------------------------------

test("TEST 3: 'Gul' kirimi va chiqimi bir-biriga aralashmaydi", async () => {
  await yoz({ turi: "chiqim", categoryId: gulChiqim.id, summa: 3_000_000, sana: "2026-08-17" });

  const kirim = await tafsilot({ categoryId: gulKirim.id, turi: "kirim", from: "2026-08-01", to: "2026-08-31" });
  assert.equal(kirim.total, 3, "kirim oynasida chiqim ko'rinmasligi kerak");
  assert.equal(kirim.totals.jamiKirim, 10_000_000);

  const chiqim = await tafsilot({ categoryId: gulChiqim.id, turi: "chiqim", from: "2026-08-01", to: "2026-08-31" });
  assert.equal(chiqim.total, 1, "chiqim oynasida faqat chiqim");
  assert.equal(chiqim.items[0].summa, 3_000_000);
  assert.equal(chiqim.totals.jamiChiqim, 3_000_000);

  // Kategoriya IDsi bo'yicha filtr: bir xil NOMLI ikki kategoriya aralashmaydi.
  assert.notEqual(gulKirim.id, gulChiqim.id);
  assert.equal(kirim.items.every((x: any) => x.categoryId === gulKirim.id), true);
});

// ---------------------------------------------------------------------------
// TEST 4 — sana filtri
// ---------------------------------------------------------------------------

test("TEST 4: 15–18 avgust oralig'i → 2 ta yozuv, jami 8M", async () => {
  const t = await tafsilot({ categoryId: gulKirim.id, turi: "kirim", from: "2026-08-15", to: "2026-08-18" });
  assert.equal(t.total, 2);
  assert.equal(t.totals.jamiKirim, 8_000_000);
  assert.deepEqual(
    t.items.map((x: any) => x.summa),
    [5_000_000, 3_000_000]
  );

  // Bir kunlik oraliq ham ikkala chetni o'z ichiga oladi.
  const birKun = await tafsilot({ categoryId: gulKirim.id, turi: "kirim", from: "2026-08-10", to: "2026-08-10" });
  assert.equal(birKun.total, 1);
  assert.equal(birKun.items[0].summa, 2_000_000);
});

// ---------------------------------------------------------------------------
// TEST 5 — biznes izolyatsiyasi
// ---------------------------------------------------------------------------

test("TEST 5: boshqa biznesning yozuvlari ko'rinmaydi", async () => {
  await runWithTenant(
    T2.tenant.id,
    async () =>
      createTransaction(T2.user.id, T2.business.id, {
        turi: "kirim",
        categoryId: begonaKat.id,
        summa: 99_000_000,
        sana: "2026-08-18",
        izoh: "Begona yozuv",
      }),
    { userId: T2.user.id, ism: "Begona" }
  );

  const bizniki = await tafsilot({ categoryId: gulKirim.id, turi: "kirim", from: "2026-08-01", to: "2026-08-31" });
  assert.equal(bizniki.totals.jamiKirim, 10_000_000, "begona yozuv jamiga qo'shilmasligi kerak");
  assert.equal(bizniki.items.some((x: any) => x.izoh === "Begona yozuv"), false);

  // Begona kategoriya IDsi bilan so'ralsa ham — bo'sh natija.
  const ogirlangan = await tafsilot({ categoryId: begonaKat.id, turi: "kirim" });
  assert.equal(ogirlangan.total, 0, "boshqa biznes kategoriyasi bo'yicha yozuv chiqmasligi kerak");
  assert.equal(ogirlangan.items.length, 0);
});

// ---------------------------------------------------------------------------
// 11-TALAB: karta summasi === tafsilot summasi (qarz bo'lganda ham)
// ---------------------------------------------------------------------------

test("qarzga yozilgan savdo kartada ham, tafsilotda ham hisobga olinmaydi", async () => {
  await yoz({
    turi: "kirim",
    categoryId: gulKirim.id,
    summa: 7_000_000,
    sana: "2026-08-19",
    izoh: "Qarzga berildi",
    tolovTuri: "qarz",
  });

  const karta = await kartaSummasi("Gul", "kirim");
  assert.equal(karta, 10_000_000, "qarz kategoriya taqsimotiga kirmaydi");

  const t = await tafsilot({ categoryId: gulKirim.id, turi: "kirim", from: "2026-08-01", to: "2026-08-31" });
  assert.equal(t.totals.jamiKirim, karta, "tafsilot jami karta bilan AYNAN teng");
  assert.equal(t.total, 3, "qarzli yozuv ro'yxatda ham chiqmasligi kerak");
  assert.equal(t.items.some((x: any) => x.izoh === "Qarzga berildi"), false);
  assert.equal(
    t.items.reduce((a: number, x: any) => a + x.summa, 0),
    karta,
    "ro'yxat yig'indisi kartaga teng"
  );
});

test("Yozuvlar sahifasi (realPul'siz) qarzli yozuvni avvalgidek ko'rsatadi", async () => {
  const oddiy = await A(async () =>
    txQ.listTransactions({
      businessId: T.business.id,
      categoryId: gulKirim.id,
      turi: "kirim",
      from: "2026-08-01",
      to: "2026-08-31",
      pageSize: 50,
    })
  );
  assert.equal(oddiy.total, 4, "regressiya: qarzli yozuv Yozuvlar ro'yxatida qoladi");
  assert.equal(oddiy.items.some((x: any) => x.izoh === "Qarzga berildi"), true);
  assert.equal(oddiy.totals.jamiKirim, 10_000_000, "jami esa avvalgidek qarzsiz");
  assert.equal(oddiy.totals.qarzKirim, 7_000_000);
  assert.equal(oddiy.kunlik, null, "so'ralmagan bo'lsa kunlik jamlar hisoblanmaydi");
});

// ---------------------------------------------------------------------------
// Kunlik jamlar, qidiruv, sahifalash
// ---------------------------------------------------------------------------

test("kunlik jamlar butun to'plamdan hisoblanadi, sahifadan emas", async () => {
  // 18-avgustga ikkinchi yozuv — kunlik jami 5M + 2M = 7M bo'lishi kerak.
  await yoz({ turi: "kirim", categoryId: gulKirim.id, summa: 2_000_000, sana: "2026-08-18", izoh: "Ikkinchi savdo" });

  const t = await tafsilot({
    categoryId: gulKirim.id,
    turi: "kirim",
    from: "2026-08-01",
    to: "2026-08-31",
    pageSize: 1,
  });
  assert.equal(t.items.length, 1, "sahifada bitta yozuv");
  assert.equal(t.total, 4);

  const kun18 = t.kunlik.find((k: any) => k.sana === "2026-08-18");
  assert.equal(kun18.summa, 7_000_000, "kunlik jami sahifadagi yozuvga bog'liq emas");
  assert.equal(kun18.soni, 2);
  const kun10 = t.kunlik.find((k: any) => k.sana === "2026-08-10");
  assert.equal(kun10.summa, 2_000_000);
});

test("qidiruv izoh bo'yicha serverda filtrlaydi", async () => {
  const t = await tafsilot({
    categoryId: gulKirim.id,
    turi: "kirim",
    from: "2026-08-01",
    to: "2026-08-31",
    q: "Chakana",
  });
  assert.equal(t.total, 1);
  assert.equal(t.items[0].summa, 3_000_000);
  assert.equal(t.totals.jamiKirim, 3_000_000, "jami ham qidiruvga mos");
});

test("sahifalash: har sahifa alohida, jami o'zgarmaydi", async () => {
  const birinchi = await tafsilot({
    categoryId: gulKirim.id, turi: "kirim", from: "2026-08-01", to: "2026-08-31", page: 1, pageSize: 2,
  });
  const ikkinchi = await tafsilot({
    categoryId: gulKirim.id, turi: "kirim", from: "2026-08-01", to: "2026-08-31", page: 2, pageSize: 2,
  });

  assert.equal(birinchi.items.length, 2);
  assert.equal(ikkinchi.items.length, 2);
  assert.equal(birinchi.total, 4);
  assert.equal(ikkinchi.total, 4);
  assert.equal(birinchi.totals.jamiKirim, ikkinchi.totals.jamiKirim, "jami sahifaga bog'liq emas");

  // Sahifalar kesishmasligi kerak.
  const idlar = new Set([...birinchi.items, ...ikkinchi.items].map((x: any) => x.id));
  assert.equal(idlar.size, 4, "sahifalarda takrorlanuvchi yozuv bo'lmasligi kerak");
});

test("bo'sh davr — yozuv yo'q, jami 0", async () => {
  const t = await tafsilot({ categoryId: gulKirim.id, turi: "kirim", from: "2026-01-01", to: "2026-01-31" });
  assert.equal(t.total, 0);
  assert.equal(t.items.length, 0);
  assert.equal(t.totals.jamiKirim, 0);
});
