/**
 * SOTILGAN MAHSULOTLAR STATISTIKASI — Kirim bo'limidagi blok.
 *
 * INVARIANTLAR:
 *   1. MANBA — `Sale` va faqat u. Ombordan sotuv bo'lishi bilan statistika
 *      o'zi shakllanadi; qo'lda hech narsa kiritilmaydi.
 *   2. JAMLASH: bir mahsulot kun davomida 5 marta sotilsa 5 ta qator emas,
 *      BITTA qator chiqadi (miqdor va summa qo'shilgan holda).
 *   3. Guruhlash — `Product.categoryId` (POS kategoriyasi); kategoriyasiz
 *      mahsulotlar oxirgi guruhda.
 *   4. Sana filtri `Sale.sana` bo'yicha (`createdAt` emas).
 *   5. QAYTARISH: bekor qilingan sotuv (`deletedAt`) statistikadan ayriladi —
 *      ombor qoldig'i tiklangani bilan BIR PAYTDA.
 *   6. IKKI MARTA SANALMAYDI: POS cheki 3 satrdan iborat bo'lsa ham har satr
 *      bitta `Sale`, chekning o'zi statistikaga qo'shilmaydi.
 *   7. Ombor qoldig'i bilan moslik: boshlang'ich − sotilgan = joriy qoldiq.
 *   8. Tenant/biznes izolyatsiyasi.
 *
 * Ishga tushirish: npm run test:sotuv-statistika
 */
process.env.DATABASE_URL = "file:./prisma/test-sotuv-statistika.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let invSvc: any;
let posSvc: any;
let invQ: any;
let statQ: any;

let T: any;
let T2: any;
let naqdKassa: any;
const P: Record<string, any> = {};
const K: Record<string, any> = {};

/** Sotuvlar shu sanalarga yoziladi — "bugun" ga bog'lanib qolmaslik uchun. */
const BUGUN = "2026-08-20";
const KECHA = "2026-08-19";
const OTGAN_OY = "2026-07-15";

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

function stat(from = BUGUN, to = from) {
  return A(async () => statQ.getSotuvStatistika(T.business.id, { from, to }));
}

function guruh(s: any, nomi: string) {
  return s.kategoriyalar.find((k: any) => k.nomi === nomi);
}

function mahsulot(s: any, nomi: string) {
  for (const k of s.kategoriyalar) {
    const m = k.mahsulotlar.find((x: any) => x.nomi === nomi);
    if (m) return m;
  }
  return undefined;
}

function birlik(birliklar: any[], nomi: string) {
  return birliklar.find((b: any) => b.birlik === nomi);
}

async function kategoriya(nomi: string, tartib: number) {
  const c = await rawPrisma.productCategory.create({
    data: { businessId: T.business.id, nomi, tartib },
  });
  K[nomi] = c;
  return c;
}

async function tovar(
  nomi: string,
  opts: { kategoriya?: string; miqdor?: number; narx?: number; birlik?: string } = {}
) {
  const p = await rawPrisma.product.create({
    data: {
      businessId: T.business.id,
      nomi,
      birlik: opts.birlik ?? "dona",
      miqdor: opts.miqdor ?? 1000,
      kelganNarx: Math.round((opts.narx ?? 10_000) / 2),
      sotuvNarx: opts.narx ?? 10_000,
      categoryId: opts.kategoriya ? K[opts.kategoriya].id : null,
    },
  });
  P[nomi] = p;
  return p;
}

function sot(nomi: string, miqdor: number, sana = BUGUN) {
  return A(async () =>
    invSvc.createSale({
      businessId: T.business.id,
      productId: P[nomi].id,
      miqdor,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      sana,
      userId: T.user.id,
    })
  );
}

before(async () => {
  rmSync("prisma/test-sotuv-statistika.db", { force: true });
  rmSync("prisma/test-sotuv-statistika.db-journal", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  invSvc = await import("@/lib/services/inventory");
  posSvc = await import("@/lib/services/pos");
  invQ = await import("@/lib/queries/inventory");
  statQ = await import("@/lib/queries/sotuvStatistika");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Sotuv statistika",
    ism: "Direktor",
    login: "+998900000701",
    parol: "parol12345",
  });
  T2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona do'kon",
    ism: "Begona",
    login: "+998900000702",
    parol: "parol12345",
  });

  const accountsQ = await import("@/lib/queries/accounts");
  naqdKassa = (await A(async () => accountsQ.listAccounts(T.business.id)))[0];

  await kategoriya("Ichimliklar", 1);
  await kategoriya("Shirinliklar", 2);
  await tovar("Coca-Cola", { kategoriya: "Ichimliklar", narx: 35_000 });
  await tovar("Pepsi", { kategoriya: "Ichimliklar", narx: 30_000 });
  await tovar("Snickers", { kategoriya: "Shirinliklar", narx: 12_000 });
  await tovar("KitKat", { kategoriya: "Shirinliklar", narx: 8_000 });
  // Kategoriyasiz — MAGAZIN moduli yoqilmagan bizneslardagi odatiy holat.
  await tovar("Non", { narx: 4_000 });
  await tovar("Guruch", { birlik: "kg", miqdor: 500, narx: 20_000 });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1. Sotuv → statistika (qo'lda kiritishsiz)
// ---------------------------------------------------------------------------

test("sotuvsiz davr: barcha ko'rsatkich nol", async () => {
  const s = await stat();
  assert.equal(s.yakun.jamiSumma, 0);
  assert.equal(s.yakun.mahsulotTurlari, 0);
  assert.equal(s.yakun.kategoriyalar, 0);
  assert.deepEqual(s.kategoriyalar, []);
  assert.deepEqual(s.yakun.birliklar, []);
});

test("mahsulot sotildi — statistikaga O'ZI qo'shildi", async () => {
  await sot("Coca-Cola", 10);

  const s = await stat();
  const m = mahsulot(s, "Coca-Cola");
  assert.ok(m, "sotilgan mahsulot ro'yxatda");
  assert.equal(m.miqdor, 10);
  assert.equal(m.birlik, "dona");
  assert.equal(m.summa, 350_000, "10 × 35 000");
  assert.equal(m.kategoriya, "Ichimliklar");
  assert.equal(s.yakun.jamiSumma, 350_000);
  assert.equal(s.yakun.mahsulotTurlari, 1);
});

// ---------------------------------------------------------------------------
// 2. Bir mahsulot bir necha marta sotildi → BITTA qator
// ---------------------------------------------------------------------------

test("bir mahsulotdan 5 marta sotuv bitta qatorga jamlanadi", async () => {
  // 10 dona allaqachon sotilgan; yana 4 marta.
  await sot("Coca-Cola", 5);
  await sot("Coca-Cola", 3);
  await sot("Coca-Cola", 2);
  await sot("Coca-Cola", 5);

  const s = await stat();
  const ichimliklar = guruh(s, "Ichimliklar");
  const qatorlar = ichimliklar.mahsulotlar.filter((m: any) => m.nomi === "Coca-Cola");
  assert.equal(qatorlar.length, 1, "5 ta sotuv — 1 ta qator");
  assert.equal(qatorlar[0].miqdor, 25, "10 + 5 + 3 + 2 + 5");
  assert.equal(qatorlar[0].summa, 875_000, "25 × 35 000");
  assert.equal(qatorlar[0].sotuvSoni, 5, "necha marta sotilgani ma'lumot uchun qoladi");
  assert.equal(s.yakun.mahsulotTurlari, 1, "tur soni — sotuv soni emas");
});

// ---------------------------------------------------------------------------
// 3. Kategoriya bo'yicha guruhlash
// ---------------------------------------------------------------------------

test("mahsulotlar kategoriyalar bo'yicha guruhlanadi", async () => {
  await sot("Pepsi", 18);
  await sot("Snickers", 12);
  await sot("KitKat", 8);

  const s = await stat();
  assert.equal(s.kategoriyalar.length, 2);
  // `tartib` bo'yicha: Ichimliklar (1) → Shirinliklar (2).
  assert.deepEqual(
    s.kategoriyalar.map((k: any) => k.nomi),
    ["Ichimliklar", "Shirinliklar"]
  );

  const ichimliklar = guruh(s, "Ichimliklar");
  assert.equal(ichimliklar.mahsulotlar.length, 2);
  assert.equal(ichimliklar.summa, 875_000 + 540_000, "Coca-Cola + Pepsi");
  assert.equal(birlik(ichimliklar.birliklar, "dona").miqdor, 43, "25 + 18");
  // Ichkarida ko'p pul keltirgan yuqorida.
  assert.equal(ichimliklar.mahsulotlar[0].nomi, "Coca-Cola");

  const shirinliklar = guruh(s, "Shirinliklar");
  assert.equal(shirinliklar.summa, 144_000 + 64_000);
  assert.equal(birlik(shirinliklar.birliklar, "dona").miqdor, 20, "12 + 8");

  assert.equal(s.yakun.mahsulotTurlari, 4);
  assert.equal(s.yakun.kategoriyalar, 2);
  assert.equal(s.yakun.jamiSumma, 875_000 + 540_000 + 144_000 + 64_000);
});

test("kategoriyasiz mahsulot alohida, ENG OXIRGI guruhda", async () => {
  await sot("Non", 30);

  const s = await stat();
  assert.equal(s.kategoriyalar.length, 3);
  assert.equal(s.kategoriyalar[2].nomi, "Kategoriyasiz", "oxirgi guruh");
  assert.equal(s.kategoriyalar[2].kategoriyaId, null);
  assert.equal(s.kategoriyalar[2].summa, 120_000, "30 × 4 000");
});

test("turli birliklar BITTA raqamga qo'shilmaydi", async () => {
  await sot("Guruch", 40);

  const s = await stat();
  assert.equal(s.yakun.birliklar.length, 2);
  assert.equal(birlik(s.yakun.birliklar, "dona").miqdor, 93, "25 + 18 + 12 + 8 + 30");
  assert.equal(birlik(s.yakun.birliklar, "kg").miqdor, 40);
  assert.equal(mahsulot(s, "Guruch").birlik, "kg");
});

// ---------------------------------------------------------------------------
// 4. Sana filtri
// ---------------------------------------------------------------------------

test("boshqa kundagi sotuv bugungi statistikaga kirmaydi", async () => {
  await sot("Snickers", 100, KECHA);
  await sot("KitKat", 200, OTGAN_OY);

  const bugun = await stat(BUGUN);
  assert.equal(mahsulot(bugun, "Snickers").miqdor, 12, "kechagi 100 ta qo'shilmadi");
  assert.equal(mahsulot(bugun, "KitKat").miqdor, 8);

  const kecha = await stat(KECHA);
  assert.equal(kecha.yakun.mahsulotTurlari, 1);
  assert.equal(mahsulot(kecha, "Snickers").miqdor, 100);
  assert.equal(kecha.yakun.jamiSumma, 1_200_000, "100 × 12 000");
});

test("oraliq filtri ikkala chekka kunni ham O'Z ICHIGA oladi", async () => {
  const oraliq = await stat(KECHA, BUGUN);
  assert.equal(mahsulot(oraliq, "Snickers").miqdor, 112, "12 (bugun) + 100 (kecha)");
  assert.equal(mahsulot(oraliq, "Coca-Cola").miqdor, 25);

  // "Shu oy" — avgust: iyuldagi KitKat sotuvi kirmaydi.
  const oy = await stat("2026-08-01", BUGUN);
  assert.equal(mahsulot(oy, "KitKat").miqdor, 8, "iyuldagi 200 ta kirmadi");

  const ikkiOy = await stat("2026-07-01", BUGUN);
  assert.equal(mahsulot(ikkiOy, "KitKat").miqdor, 208, "8 + 200");
});

// ---------------------------------------------------------------------------
// 5. Qaytarish (sotuvni bekor qilish)
// ---------------------------------------------------------------------------

test("qaytarilgan sotuv statistikadan ayriladi", async () => {
  const sotuv = await sot("Pepsi", 7);
  const oldin = await stat();
  assert.equal(mahsulot(oldin, "Pepsi").miqdor, 25, "18 + 7");

  await A(async () =>
    invSvc.cancelSale({
      businessId: T.business.id,
      saleId: sotuv.id,
      sabab: "Mijoz qaytardi",
      userId: T.user.id,
    })
  );

  const keyin = await stat();
  assert.equal(mahsulot(keyin, "Pepsi").miqdor, 18, "qaytarilgan 7 ta ayrildi");
  assert.equal(mahsulot(keyin, "Pepsi").summa, 540_000);
  assert.equal(keyin.yakun.qaytarilgan.soni, 1);
  assert.equal(keyin.yakun.qaytarilgan.summa, 210_000, "7 × 30 000");
  assert.equal(
    keyin.yakun.jamiSumma,
    oldin.yakun.jamiSumma - 210_000,
    "jami summa ham kamaydi"
  );
});

test("mahsulotning HAMMA sotuvi qaytarilsa u ro'yxatdan butunlay chiqadi", async () => {
  await tovar("Sinov choy", { kategoriya: "Ichimliklar", narx: 5_000, miqdor: 50 });
  const sotuv = await sot("Sinov choy", 4);
  assert.ok(mahsulot(await stat(), "Sinov choy"));

  await A(async () =>
    invSvc.cancelSale({
      businessId: T.business.id,
      saleId: sotuv.id,
      sabab: "Xato kiritilgan",
      userId: T.user.id,
    })
  );

  const s = await stat();
  assert.equal(mahsulot(s, "Sinov choy"), undefined, "qatori umuman qolmaydi");
  assert.equal(guruh(s, "Ichimliklar").mahsulotlar.length, 2, "Coca-Cola va Pepsi");
});

// ---------------------------------------------------------------------------
// 6. POS cheki — ikki marta sanalmaydi
// ---------------------------------------------------------------------------

test("POS cheki: har satr bir marta, chekning o'zi qo'shilmaydi", async () => {
  const oldin = await stat();

  const chek = await A(async () =>
    posSvc.posSotuv({
      businessId: T.business.id,
      satrlar: [
        { productId: P["Coca-Cola"].id, miqdor: 2 },
        { productId: P["Snickers"].id, miqdor: 3 },
      ],
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      sana: BUGUN,
      userId: T.user.id,
    })
  );

  const keyin = await stat();
  assert.equal(mahsulot(keyin, "Coca-Cola").miqdor, 27, "25 + 2 (chek satri bir marta)");
  assert.equal(mahsulot(keyin, "Snickers").miqdor, 15, "12 + 3");
  assert.equal(
    keyin.yakun.jamiSumma,
    oldin.yakun.jamiSumma + 70_000 + 36_000,
    "chek summasi qo'shimcha yozuv sifatida QAYTA sanalmaydi"
  );

  // Chek qaytarilsa ikkala satr ham ayriladi.
  await A(async () =>
    posSvc.posChekBekor({
      businessId: T.business.id,
      chekId: chek.id,
      sabab: "Xaridor qaytardi",
      userId: T.user.id,
    })
  );
  const qaytgan = await stat();
  assert.equal(mahsulot(qaytgan, "Coca-Cola").miqdor, 25);
  assert.equal(mahsulot(qaytgan, "Snickers").miqdor, 12);
  assert.equal(qaytgan.yakun.jamiSumma, oldin.yakun.jamiSumma);
});

// ---------------------------------------------------------------------------
// 7. Ombor qoldig'i bilan moslik
// ---------------------------------------------------------------------------

test("boshlang'ich qoldiq − sotilgan = ombordagi joriy qoldiq", async () => {
  // Butun tarix bo'yicha (barcha sanalar) — qaytarilganlar ayrilgan holda.
  const hammasi = await stat("2026-01-01", "2026-12-31");

  const mahsulotlar: any[] = await A(async () =>
    invQ.listProducts(T.business.id, { forKassir: false })
  );

  // Har mahsulot uchun: 1000 (yoki tovar() da berilgan) boshlang'ich qoldiq.
  const boshlangich: Record<string, number> = {
    "Coca-Cola": 1000,
    Pepsi: 1000,
    Snickers: 1000,
    KitKat: 1000,
    Non: 1000,
    Guruch: 500,
    "Sinov choy": 50,
  };

  for (const p of mahsulotlar) {
    const sotilgan = mahsulot(hammasi, p.nomi)?.miqdor ?? 0;
    assert.equal(
      p.miqdor,
      boshlangich[p.nomi] - sotilgan,
      `${p.nomi}: qoldiq statistika bilan mos kelmadi`
    );
  }
});

// ---------------------------------------------------------------------------
// 8. Izolyatsiya
// ---------------------------------------------------------------------------

test("boshqa tenantning sotuvi statistikaga kirmaydi", async () => {
  const begonaTovar = await rawPrisma.product.create({
    data: {
      businessId: T2.business.id,
      nomi: "Begona suv",
      birlik: "dona",
      miqdor: 10_000,
      kelganNarx: 1_000,
      sotuvNarx: 2_000,
    },
  });
  await rawPrisma.sale.create({
    data: {
      businessId: T2.business.id,
      productId: begonaTovar.id,
      miqdor: 9_999,
      birlikNarx: 2_000,
      tannarx: 1_000,
      jamiSumma: 19_998_000,
      tolovTuri: "naqd",
      sana: new Date(`${BUGUN}T00:00:00.000Z`),
      userId: T2.user.id,
    },
  });

  const s = await stat();
  assert.equal(mahsulot(s, "Begona suv"), undefined);
  assert.ok(s.yakun.jamiSumma < 19_998_000, "begona summa qo'shilmadi");

  const begona = await runWithTenant(T2.tenant.id, async () =>
    statQ.getSotuvStatistika(T2.business.id, { from: BUGUN, to: BUGUN })
  );
  assert.equal(begona.yakun.mahsulotTurlari, 1);
  assert.equal(begona.yakun.jamiSumma, 19_998_000);
  assert.equal(begona.kategoriyalar[0].nomi, "Kategoriyasiz");
});
