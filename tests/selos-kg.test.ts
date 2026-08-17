/**
 * KG SAVDOSI TESTLARI (mijozga xos — Fortex Selos).
 *
 * Asosiy invariantlar:
 *  - jami HAR DOIM miqdor × 1 kg narxi (frontend yuborgan summaga ishonilmaydi);
 *  - narx QOTIRILMAGAN: 4 500 / 5 000 / 5 500 — uchalasi ham valid;
 *  - eski yozuvning narxi keyingi savdodan keyin O'ZGARMAYDI (immutable);
 *  - 0 / manfiy miqdor va narx rad etiladi;
 *  - kg kassa BALANSIGA qo'shilmaydi — kassaga faqat so'm tushadi;
 *  - kunlik, sotuvchi va kassa kesimlari to'g'ri jamlanadi;
 *  - kg bayrog'i faqat Fortex Selos mijoziga ochiladi (boshqalarda ko'rinmaydi).
 *
 * Ishga tushirish: npm run test:selos-kg
 */
process.env.DATABASE_URL = "file:./prisma/test-selos-kg.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let txService: any;
let selosQ: any;
let accountsQ: any;
let validation: any;
let kg: any;
let mijozXos: any;

const TENANT = "t_selos";
const BIZ = "biz_selos";
const JAVLON = "u_javlon";
const MUROD = "u_murod";
const KASSA = "acc_selos_naqd";

/** Selos kategoriyalari (kg asosida) va oddiy kategoriya (nazorat uchun). */
let selos: any;
let donli: any;
let xizmat: any;
let bugun: string;

/** Kg savdosini yozadi (route qiladigan yo'l — createTransaction). */
function savdo(userId: string, categoryId: string, miqdorKg: number, kgNarxi: number, summa = 1) {
  return runWithTenant(TENANT, () =>
    txService.createTransaction(userId, BIZ, {
      turi: "kirim",
      categoryId,
      // `summa` ATAYLAB noto'g'ri: server uni qayta hisoblashi shart.
      summa,
      sana: bugun,
      tolovTuri: "naqd",
      accountId: KASSA,
      miqdorKg,
      kgNarxi,
    })
  );
}

before(async () => {
  rmSync("prisma/test-selos-kg.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  txService = await import("@/lib/services/transactionService");
  selosQ = await import("@/lib/queries/selos");
  accountsQ = await import("@/lib/queries/accounts");
  validation = await import("@/lib/validation/transaction");
  kg = await import("@/lib/kg");
  mijozXos = await import("@/lib/mijozXos");
  const date = await import("@/lib/date");
  bugun = date.todayDateOnlyString();

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "Fortex Selos UZB", slug: "fortex-selos-uzb", status: "ACTIVE" },
  });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "Fortex Selos", tenantId: TENANT } });
  await rawPrisma.user.create({
    data: { id: JAVLON, ism: "Javlon", login: "+998900001001", parolHash: "x", rol: "CASHIER", tenantId: TENANT, businessId: BIZ },
  });
  await rawPrisma.user.create({
    data: { id: MUROD, ism: "Murod", login: "+998900001002", parolHash: "x", rol: "CASHIER", tenantId: TENANT, businessId: BIZ },
  });
  await rawPrisma.account.create({
    data: { id: KASSA, businessId: BIZ, nomi: "Asosiy kassa", turi: "naqd" },
  });
  selos = await rawPrisma.category.create({
    data: { businessId: BIZ, nomi: "Selos", turi: "kirim", kgAsosli: true },
  });
  donli = await rawPrisma.category.create({
    data: { businessId: BIZ, nomi: "Donli selos", turi: "kirim", kgAsosli: true },
  });
  xizmat = await rawPrisma.category.create({
    data: { businessId: BIZ, nomi: "Xizmat", turi: "kirim", kgAsosli: false },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1-3. Hisob: miqdor × narx
// ---------------------------------------------------------------------------

test("100 kg × 5 000 = 500 000", async () => {
  const t = await savdo(JAVLON, selos.id, 100, 5_000);
  assert.equal(t.summa, 500_000);
  assert.equal(t.miqdorGr, 100_000);
  assert.equal(t.kgNarxi, 5_000);
});

test("80 kg × 5 500 = 440 000", async () => {
  const t = await savdo(JAVLON, selos.id, 80, 5_500);
  assert.equal(t.summa, 440_000);
  assert.equal(t.miqdorGr, 80_000);
});

test("50 kg × 4 800 = 240 000", async () => {
  const t = await savdo(MUROD, selos.id, 50, 4_800);
  assert.equal(t.summa, 240_000);
});

// ---------------------------------------------------------------------------
// 4-7. Validatsiya: 0 va manfiy qiymatlar
// ---------------------------------------------------------------------------

const xato = (data: any) => {
  const r = validation.createTransactionSchema.safeParse({
    turi: "kirim",
    categoryId: "c1",
    summa: 1000,
    sana: "2026-08-17",
    ...data,
  });
  return r.success ? null : r.error.errors[0]?.message ?? "xato";
};

test("0 kg rad etiladi", () => {
  assert.ok(xato({ miqdorKg: 0, kgNarxi: 5_000 }), "0 kg o'tmasligi kerak");
});

test("manfiy kg rad etiladi", () => {
  assert.ok(xato({ miqdorKg: -10, kgNarxi: 5_000 }), "manfiy kg o'tmasligi kerak");
});

test("0 so'm/kg rad etiladi", () => {
  assert.ok(xato({ miqdorKg: 10, kgNarxi: 0 }), "0 narx o'tmasligi kerak");
});

test("manfiy so'm/kg rad etiladi", () => {
  assert.ok(xato({ miqdorKg: 10, kgNarxi: -5_000 }), "manfiy narx o'tmasligi kerak");
});

test("miqdor yoki narx yolg'iz kelsa rad etiladi", () => {
  assert.ok(xato({ miqdorKg: 10 }), "narxsiz miqdor o'tmasligi kerak");
  assert.ok(xato({ kgNarxi: 5_000 }), "miqdorsiz narx o'tmasligi kerak");
});

test("kg savdosi chiqimga yozilmaydi", () => {
  assert.ok(xato({ turi: "chiqim", miqdorKg: 10, kgNarxi: 5_000 }));
});

// ---------------------------------------------------------------------------
// 8. Kasr (decimal) kg — gramm aniqligida
// ---------------------------------------------------------------------------

test("kasr kg qo'llab-quvvatlanadi: 12,5 kg × 5 000 = 62 500", async () => {
  const t = await savdo(JAVLON, donli.id, 12.5, 5_000);
  assert.equal(t.miqdorGr, 12_500);
  assert.equal(t.summa, 62_500);
});

test("100,5 kg × 5 000 = 502 500 (float xatosi yo'q)", () => {
  assert.equal(kg.kgSumma(kg.kgToGram(100.5), 5_000), 502_500);
  // 12,75 kg — uchinchi xonagacha aniq.
  assert.equal(kg.kgToGram(12.75), 12_750);
  assert.equal(kg.kgSumma(12_750, 4_800), 61_200);
});

test("grammdan mayda miqdor (4 xona) rad etiladi", () => {
  assert.ok(xato({ miqdorKg: 1.00005, kgNarxi: 5_000 }));
});

// ---------------------------------------------------------------------------
// 9. Frontend yuborgan summaga ishonilmaydi
// ---------------------------------------------------------------------------

test("frontend noto'g'ri summa yuborsa server qayta hisoblaydi", async () => {
  const t = await savdo(MUROD, selos.id, 20, 6_000, 999_999_999);
  assert.equal(t.summa, 120_000, "summa miqdor × narxdan hisoblanishi kerak");
});

test("kg'siz kategoriyaga kg yozib bo'lmaydi", async () => {
  await assert.rejects(() => savdo(JAVLON, xizmat.id, 10, 5_000), /kg bo'yicha savdo qilmaydi/);
});

test("kg kategoriyasiga kg'siz yozib bo'lmaydi", async () => {
  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        txService.createTransaction(JAVLON, BIZ, {
          turi: "kirim",
          categoryId: selos.id,
          summa: 500_000,
          sana: bugun,
          tolovTuri: "naqd",
          accountId: KASSA,
        })
      ),
    /kg bo'yicha sotiladi/
  );
});

// ---------------------------------------------------------------------------
// 10. Kassa balansi: so'm tushadi, kg TUSHMAYDI
// ---------------------------------------------------------------------------

test("kg savdosi kassaga faqat so'm bo'lib tushadi", async () => {
  const oldin = await runWithTenant(TENANT, () => accountsQ.getAccountBalances(BIZ));
  const oldinQoldiq = oldin.find((a: any) => a.id === KASSA).qoldiq;

  await savdo(JAVLON, selos.id, 30, 5_000); // 150 000 so'm

  const keyin = await runWithTenant(TENANT, () => accountsQ.getAccountBalances(BIZ));
  const keyinQoldiq = keyin.find((a: any) => a.id === KASSA).qoldiq;
  assert.equal(keyinQoldiq - oldinQoldiq, 150_000, "kassaga faqat pul qo'shiladi");

  // Kg alohida maydonda — kassa qoldig'i hisobiga aralashmaydi.
  const jami = await runWithTenant(TENANT, () => selosQ.getKgSavdoJami(BIZ, bugun));
  assert.ok(jami.jamiGr > 0);
  assert.notEqual(keyinQoldiq, jami.jamiGr);
});

// ---------------------------------------------------------------------------
// 11-12. Kunlik va sotuvchi bo'yicha hisobot
// ---------------------------------------------------------------------------

test("kunlik kg hisoboti va sotuvchi kesimi to'g'ri jamlanadi", async () => {
  const hisobot = await runWithTenant(TENANT, () => selosQ.getKgSavdo(BIZ, bugun));

  // Bazadan mustaqil tekshiruv: shu kundagi barcha kg yozuvlari.
  const yozuvlar = await rawPrisma.transaction.findMany({
    where: { businessId: BIZ, deletedAt: null, miqdorGr: { not: null } },
  });
  const kutilganGr = yozuvlar.reduce((s: number, t: any) => s + t.miqdorGr, 0);
  const kutilganSumma = yozuvlar.reduce((s: number, t: any) => s + t.summa, 0);

  assert.equal(hisobot.jamiGr, kutilganGr);
  assert.equal(hisobot.jamiSumma, kutilganSumma);
  assert.equal(hisobot.savdoSoni, yozuvlar.length);

  // O'rtacha narx — statistik: jami summa / jami kg.
  assert.equal(hisobot.ortachaNarx, Math.round((kutilganSumma * 1000) / kutilganGr));

  const javlon = hisobot.sotuvchilar.find((s: any) => s.nomi === "Javlon");
  const murod = hisobot.sotuvchilar.find((s: any) => s.nomi === "Murod");
  assert.ok(javlon && murod, "ikkala sotuvchi ham kesimda bo'lishi kerak");
  assert.equal(javlon.miqdorGr + murod.miqdorGr, kutilganGr);
  assert.equal(javlon.summa + murod.summa, kutilganSumma);

  // Kassa kesimi ham to'liq.
  const kassa = hisobot.kassalar.find((k: any) => k.id === KASSA);
  assert.equal(kassa.miqdorGr, kutilganGr);

  // Mahsulot (kategoriya) kesimi: Selos va Donli selos alohida.
  assert.ok(hisobot.kategoriyalar.length >= 2, "har mahsulot alohida jamlanadi");
});

// ---------------------------------------------------------------------------
// 13-14. Turli narxlar va narx tarixining o'zgarmasligi
// ---------------------------------------------------------------------------

test("turli narxdagi savdolar alohida saqlanadi", async () => {
  const a = await savdo(MUROD, donli.id, 100, 4_500);
  const b = await savdo(MUROD, donli.id, 100, 5_000);
  const c = await savdo(MUROD, donli.id, 100, 5_500);
  assert.equal(a.summa, 450_000);
  assert.equal(b.summa, 500_000);
  assert.equal(c.summa, 550_000);
  assert.deepEqual([a.kgNarxi, b.kgNarxi, c.kgNarxi], [4_500, 5_000, 5_500]);
});

test("eski yozuv narxi keyingi savdodan keyin O'ZGARMAYDI", async () => {
  const eski = await savdo(JAVLON, selos.id, 100, 5_000);
  await savdo(JAVLON, selos.id, 100, 5_500);
  await savdo(JAVLON, selos.id, 100, 7_000);

  const qayta = await rawPrisma.transaction.findUnique({ where: { id: eski.id } });
  assert.equal(qayta.kgNarxi, 5_000, "narx snapshot bo'lib qolishi kerak");
  assert.equal(qayta.miqdorGr, 100_000);
  assert.equal(qayta.summa, 500_000);
});

// ---------------------------------------------------------------------------
// Mijozga xoslik: boshqa mijozlarda kg savdosi YO'Q
// ---------------------------------------------------------------------------

test("kg savdosi faqat Fortex Selos mijoziga ochiladi", () => {
  assert.equal(
    mijozXos.kgSavdoKorinadi({ name: "Fortex Selos UZB", slug: "fortex-selos-uzb" }),
    true
  );
  assert.equal(mijozXos.kgSavdoKorinadi({ name: "Fortex Selos", slug: "fortex-selos-2" }), true);
  assert.equal(mijozXos.kgSavdoKorinadi({ name: "Red Flora", slug: "red-flora" }), false);
  assert.equal(mijozXos.kgSavdoKorinadi({ name: "Selos", slug: "selos" }), false);
});

test("yangi kategoriya standart holatda kg'siz — boshqa mijozlar xulqi o'zgarmaydi", async () => {
  const oddiy = await rawPrisma.category.create({
    data: { businessId: BIZ, nomi: "Boshqa kirim", turi: "kirim" },
  });
  assert.equal(oddiy.kgAsosli, false);

  // Kg'siz kategoriyaga oddiy summa avvalgidek yoziladi.
  const t = await runWithTenant(TENANT, () =>
    txService.createTransaction(JAVLON, BIZ, {
      turi: "kirim",
      categoryId: oddiy.id,
      summa: 777_000,
      sana: bugun,
      tolovTuri: "naqd",
      accountId: KASSA,
    })
  );
  assert.equal(t.summa, 777_000);
  assert.equal(t.miqdorGr, null);
  assert.equal(t.kgNarxi, null);
});
