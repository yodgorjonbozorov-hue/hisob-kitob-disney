/**
 * "OMBORDAGI MAHSULOTLAR" KARTASI — bosh sahifadagi 5-karta.
 *
 * INVARIANTLAR:
 *   1. Qoldiq manbasi — `Product.miqdor`, ya'ni xizmat qatlami yuritadigan
 *      YAGONA qiymat. Kirim, sotuv, qaytarish va to'g'rilash unga ta'sir
 *      qiladi, karta esa o'sha qiymatni o'qiydi (parallel hisob YO'Q).
 *   2. TURLI BIRLIKLAR QO'SHILMAYDI: "500 dona + 120 kg = 620" ma'nosiz.
 *      Karta har birlikni alohida qaytaradi.
 *   3. Turlar soni — qoldig'i BOR unique mahsulotlar.
 *   4. Tenant/biznes izolyatsiyasi.
 *
 * Ishga tushirish: npm run test:ombor-kartasi
 */
process.env.DATABASE_URL = "file:./prisma/test-ombor-kartasi.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let invSvc: any;
let adjustSvc: any;
let invQ: any;

let T: any;
let T2: any;
let naqdKassa: any;
/** dona: olma, non; kg: guruch; litr: moy */
const P: Record<string, any> = {};

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

/** Bosh sahifadagi karta AYNAN shu funksiyadan o'qiydi. */
function karta() {
  return A(async () => invQ.getOmborKartasi(T.business.id));
}

function birlik(k: any, nomi: string) {
  return k.birliklar.find((b: any) => b.birlik === nomi);
}

async function mahsulot(nomi: string, birlikNomi: string, miqdor: number, narx = 1000) {
  const p = await rawPrisma.product.create({
    data: {
      businessId: T.business.id,
      nomi,
      birlik: birlikNomi,
      miqdor,
      kelganNarx: narx,
      sotuvNarx: narx * 2,
    },
  });
  P[nomi] = p;
  return p;
}

before(async () => {
  rmSync("prisma/test-ombor-kartasi.db", { force: true });
  rmSync("prisma/test-ombor-kartasi.db-journal", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  invSvc = await import("@/lib/services/inventory");
  adjustSvc = await import("@/lib/services/stockAdjust");
  invQ = await import("@/lib/queries/inventory");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Ombor test",
    ism: "Direktor",
    login: "+998900000501",
    parol: "parol12345",
  });
  T2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona ombor",
    ism: "Begona",
    login: "+998900000502",
    parol: "parol12345",
  });

  const accountsQ = await import("@/lib/queries/accounts");
  naqdKassa = (await A(async () => accountsQ.listAccounts(T.business.id)))[0];
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// Bo'sh ombor
// ---------------------------------------------------------------------------

test("mahsulotsiz ombor: 0 tur, birliklar bo'sh, asosiy null", async () => {
  const k = await karta();
  assert.equal(k.turlarSoni, 0);
  assert.deepEqual(k.birliklar, []);
  assert.equal(k.asosiy, null);
});

// ---------------------------------------------------------------------------
// Birliklar aralashmaydi
// ---------------------------------------------------------------------------

test("turli birliklar BITTA raqamga qo'shilmaydi", async () => {
  await mahsulot("Olma", "dona", 500);
  await mahsulot("Non", "dona", 748);
  await mahsulot("Guruch", "kg", 120);
  await mahsulot("Moy", "litr", 40);

  const k = await karta();

  assert.equal(k.turlarSoni, 4, "qoldig'i bor 4 ta tur");
  assert.equal(k.birliklar.length, 3, "uchta birlik alohida");
  assert.equal(birlik(k, "dona").miqdor, 1_248, "500 + 748");
  assert.equal(birlik(k, "dona").turlar, 2);
  assert.equal(birlik(k, "kg").miqdor, 120);
  assert.equal(birlik(k, "litr").miqdor, 40);

  // Eng ko'p TURGA ega birlik kartadagi katta raqam bo'ladi.
  assert.equal(k.asosiy.birlik, "dona");
  assert.equal(k.asosiy.miqdor, 1_248);

  // 500 + 748 + 120 + 40 = 1408 — bunday qo'shilgan raqam CHIQMASLIGI kerak.
  const notogri = k.birliklar.reduce((a: number, b: any) => a + b.miqdor, 0);
  assert.equal(notogri, 1_408);
  assert.notEqual(k.asosiy.miqdor, notogri, "birliklar qo'shib yuborilmagan");
});

// ---------------------------------------------------------------------------
// Turlar soni — faqat qoldig'i borlar
// ---------------------------------------------------------------------------

test("qoldig'i nol va nofaol mahsulot turlar soniga kirmaydi", async () => {
  await mahsulot("Tugagan", "dona", 0);
  const k1 = await karta();
  assert.equal(k1.turlarSoni, 4, "nol qoldiqli mahsulot sanalmaydi");

  const nofaol = await mahsulot("Nofaol", "dona", 99);
  await A(async () =>
    rawPrisma.product.update({ where: { id: nofaol.id }, data: { isActive: false } })
  );
  const k2 = await karta();
  assert.equal(k2.turlarSoni, 4, "nofaol mahsulot sanalmaydi");
  assert.equal(birlik(k2, "dona").miqdor, 1_248, "nofaolning 99 tasi qo'shilmaydi");
});

// ---------------------------------------------------------------------------
// Harakatlar: kirim, sotuv, qaytarish, to'g'rilash
// ---------------------------------------------------------------------------

test("ombor kirimidan keyin qoldiq oshadi", async () => {
  await A(async () =>
    invSvc.createStockEntry({
      businessId: T.business.id,
      productId: P["Olma"].id,
      miqdor: 250,
      birlikNarx: 1000,
      userId: T.user.id,
    })
  );
  const k = await karta();
  assert.equal(birlik(k, "dona").miqdor, 1_498, "500 + 250 + 748");
  assert.equal(k.turlarSoni, 4);
});

test("sotuvdan keyin qoldiq kamayadi", async () => {
  const sotuv = await A(async () =>
    invSvc.createSale({
      businessId: T.business.id,
      productId: P["Olma"].id,
      miqdor: 98,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      userId: T.user.id,
    })
  );
  assert.ok(sotuv.id);

  const k = await karta();
  assert.equal(birlik(k, "dona").miqdor, 1_400, "1498 − 98");
});

test("sotuvni bekor qilish (qaytarish) qoldiqni tiklaydi", async () => {
  const sotuv = await A(async () =>
    invSvc.createSale({
      businessId: T.business.id,
      productId: P["Non"].id,
      miqdor: 48,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      userId: T.user.id,
    })
  );
  const oradan = await karta();
  assert.equal(birlik(oradan, "dona").miqdor, 1_352);

  await A(async () =>
    invSvc.cancelSale({
      businessId: T.business.id,
      saleId: sotuv.id,
      userId: T.user.id,
      sabab: "Mijoz qaytardi",
    })
  );
  const k = await karta();
  assert.equal(birlik(k, "dona").miqdor, 1_400, "qaytarilgandan keyin tiklandi");
});

test("inventarizatsiya va hisobdan chiqarish kartada aks etadi", async () => {
  // Guruch sanaldi: 120 emas, 100 kg chiqdi.
  await A(async () =>
    adjustSvc.adjustStock({
      businessId: T.business.id,
      productId: P["Guruch"].id,
      turi: "inventarizatsiya",
      miqdor: 100,
      sabab: "Yillik sanoq",
      userId: T.user.id,
    })
  );
  const k1 = await karta();
  assert.equal(birlik(k1, "kg").miqdor, 100);

  // Moydan 15 litr hisobdan chiqarildi (to'kildi).
  await A(async () =>
    adjustSvc.adjustStock({
      businessId: T.business.id,
      productId: P["Moy"].id,
      turi: "chiqarish",
      miqdor: 15,
      sabab: "To'kilib ketdi",
      userId: T.user.id,
    })
  );
  const k2 = await karta();
  assert.equal(birlik(k2, "litr").miqdor, 25, "40 − 15");
  assert.equal(k2.turlarSoni, 4, "hech biri nolga tushmadi");
});

test("qoldiq nolga tushsa tur ham, birlik ham ro'yxatdan chiqadi", async () => {
  await A(async () =>
    adjustSvc.adjustStock({
      businessId: T.business.id,
      productId: P["Moy"].id,
      turi: "chiqarish",
      miqdor: 25,
      sabab: "Hammasi tugadi",
      userId: T.user.id,
    })
  );
  const k = await karta();
  assert.equal(birlik(k, "litr"), undefined, "litr birligi umuman chiqmaydi");
  assert.equal(k.turlarSoni, 3);
  assert.equal(k.birliklar.length, 2);
});

// ---------------------------------------------------------------------------
// Ombor sahifasi bilan mosligi
// ---------------------------------------------------------------------------

test("karta qoldig'i Ombor sahifasidagi qoldiq bilan bir manbadan", async () => {
  const k = await karta();
  const stats = await A(async () => invQ.getOmborStats(T.business.id));

  // Ombor sahifasi barcha birliklarni bitta raqamga qo'shadi (tarixiy
  // xatti-harakat); karta esa ajratadi. Yig'indi bir xil bo'lishi kerak —
  // ya'ni ikkalasi ham AYNI `Product.miqdor` dan o'qiydi.
  const kartaJami = k.birliklar.reduce((a: number, b: any) => a + b.miqdor, 0);
  assert.equal(kartaJami, stats.jamiQoldiq, "manba bitta: Product.miqdor");
});

// ---------------------------------------------------------------------------
// Izolyatsiya
// ---------------------------------------------------------------------------

test("boshqa biznesning mahsulotlari kartaga kirmaydi", async () => {
  await rawPrisma.product.create({
    data: {
      businessId: T2.business.id,
      nomi: "Begona tovar",
      birlik: "dona",
      miqdor: 999_999,
      kelganNarx: 1,
      sotuvNarx: 2,
    },
  });

  const k = await karta();
  assert.equal(birlik(k, "dona").miqdor, 1_400, "begona 999 999 qo'shilmadi");
  assert.equal(k.turlarSoni, 3);

  const begona = await runWithTenant(T2.tenant.id, async () =>
    invQ.getOmborKartasi(T2.business.id)
  );
  assert.equal(begona.turlarSoni, 1);
  assert.equal(begona.asosiy.miqdor, 999_999);
});
