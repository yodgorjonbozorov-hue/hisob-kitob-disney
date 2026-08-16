/**
 * KASSIR KASSASI (KASSA TOPSHIRISH) TESTLARI.
 *
 * ENG MUHIM INVARIANT (loyiha talabi 24): biznes hisoboti va kassirning
 * qo'lidagi pul — IKKI BOSHQA tizim. Kassa topshirilishi:
 *   - Kirim'ni kamaytirmaydi;
 *   - Chiqim'ni oshirmaydi;
 *   - Sof balansni o'zgartirmaydi;
 *   - biznes kassalari (Account) qoldig'iga tegmaydi;
 *   - hech qanday Transaction o'chirmaydi/yozmaydi.
 * O'zgaradigan YAGONA narsa — kassirning kassa qoldig'i.
 *
 * Ishga tushirish: npm run test:kassir-kassa
 */
process.env.DATABASE_URL = "file:./prisma/test-kassir-kassa.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let svc: any;
let q: any;
let accountsQ: any;
let queries: any;
let createTenantWithOwner: any;
let createTransaction: any;

let tA: any;
let tB: any;
let kassir: any;
let kassir2: any;
let kirimCat: any;
let chiqimCat: any;

function A<T>(fn: () => Promise<T>, aktor?: { userId: string; ism: string }): Promise<T> {
  return runWithTenant(tA.tenant.id, fn, aktor ?? { userId: tA.user.id, ism: "A egasi" });
}
function B<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(tB.tenant.id, fn, { userId: tB.user.id, ism: "B egasi" });
}

const kassirAktor = () => ({ userId: kassir.id, ism: kassir.ism, rol: "CASHIER" });
const egaAktor = () => ({ userId: tA.user.id, ism: "A egasi", rol: "OWNER" });

/** Naqd kirim/chiqim yozuvi — kassir nomidan. */
async function yozuv(
  turi: "kirim" | "chiqim",
  summa: number,
  userId: string = kassir.id,
  tolovTuri = "naqd"
) {
  return A(async () =>
    createTransaction(userId, tA.business.id, {
      turi,
      categoryId: turi === "kirim" ? kirimCat.id : chiqimCat.id,
      summa,
      sana: "2026-08-16",
      tolovTuri,
    })
  );
}

/** Biznesning asosiy moliyaviy ko'rsatkichlari (o'zgarmasligini tekshiramiz). */
async function asosiyKorsatkichlar() {
  return A(async () => {
    const r = await queries.listTransactions({ businessId: tA.business.id });
    const kassalar = await accountsQ.getJamiKassaQoldiq(tA.business.id);
    return { ...r.totals, yozuvlarSoni: r.total, kassalar };
  });
}

before(async () => {
  rmSync("prisma/test-kassir-kassa.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  svc = await import("@/lib/services/kassirKassa");
  q = await import("@/lib/queries/kassirKassa");
  accountsQ = await import("@/lib/queries/accounts");
  queries = await import("@/lib/queries/transactions");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Kassir A",
    ism: "A egasi",
    login: "+998910000001",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Kassir B",
    ism: "B egasi",
    login: "+998910000002",
    parol: "parol12345",
  });

  kassir = await rawPrisma.user.create({
    data: {
      ism: "Ali Valiyev",
      login: "+998910000010",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: tA.tenant.id,
      businessId: tA.business.id,
    },
  });
  kassir2 = await rawPrisma.user.create({
    data: {
      ism: "Vali Karimov",
      login: "+998910000011",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: tA.tenant.id,
      businessId: tA.business.id,
    },
  });

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

// ---------------------------------------------------------------------------
// FINAL TEST (talab 25) — asosiy stsenariy
// ---------------------------------------------------------------------------

let oldingi: Awaited<ReturnType<typeof asosiyKorsatkichlar>>;

test("boshlang'ich kassa 0", async () => {
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir));
  assert.equal(holat.qoldiq, 0);
  assert.equal(holat.ochiq, false);
  assert.equal(holat.kutilayotgan, null);
});

test("naqd kirim kassirning kassasini DARHOL oshiradi", async () => {
  await yozuv("kirim", 5_000_000);
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir));
  assert.equal(holat.qoldiq, 5_000_000);
  assert.equal(holat.bugungiKirim, 5_000_000);
});

test("naqd chiqim kassirning kassasini kamaytiradi", async () => {
  await yozuv("chiqim", 4_000_000);
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir));
  assert.equal(holat.qoldiq, 1_000_000);
  assert.equal(holat.bugungiChiqim, 4_000_000);
  assert.equal(holat.ochiq, true);

  oldingi = await asosiyKorsatkichlar();
  assert.equal(oldingi.jamiKirim, 5_000_000);
  assert.equal(oldingi.jamiChiqim, 4_000_000);
  assert.equal(oldingi.sof, 1_000_000);
});

test("Click va qarz kassirning NAQD kassasiga tushmaydi", async () => {
  await yozuv("kirim", 900_000, kassir.id, "click");
  await yozuv("kirim", 800_000, kassir.id, "qarz");
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir));
  assert.equal(holat.qoldiq, 1_000_000, "faqat naqd kassaga tushadi");
});

test("kassa topshiriladi: qoldiq QABULGACHA o'zgarmaydi", async () => {
  const topshiriq = await A(
    async () => svc.topshiriqYarat(tA.business.id, kassirAktor(), { topshirilgan: 1_000_000 }),
    kassirAktor()
  );
  assert.equal(topshiriq.hisoblangan, 1_000_000);
  assert.equal(topshiriq.farq, 0);
  assert.equal(topshiriq.holat, "kutilmoqda");

  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir));
  assert.equal(holat.qoldiq, 1_000_000, "tasdiqlanmagan topshiriq pulni ayirmaydi");
  assert.equal(holat.kutilayotgan.topshirilgan, 1_000_000);
});

test("bir vaqtda ikkinchi topshiriq ochib bo'lmaydi", async () => {
  await assert.rejects(
    () =>
      A(
        async () => svc.topshiriqYarat(tA.business.id, kassirAktor(), { topshirilgan: 500_000 }),
        kassirAktor()
      ),
    /kutayotgan topshiriq/
  );
});

test("kassirning o'zi topshiriqni qabul qila olmaydi", async () => {
  const t = await A(async () => q.listKutilayotganTopshiriqlar(tA.business.id));
  await assert.rejects(
    () =>
      A(
        async () => svc.topshiriqQaror(tA.business.id, kassirAktor(), t[0].id, { amal: "qabul" }),
        kassirAktor()
      ),
    /direktor yoki admin/
  );
});

test("direktor qabul qiladi -> kassa 0, hisobotlar O'ZGARMAYDI", async () => {
  const t = await A(async () => q.listKutilayotganTopshiriqlar(tA.business.id));
  const natija = await A(async () =>
    svc.topshiriqQaror(tA.business.id, egaAktor(), t[0].id, { amal: "qabul" })
  );
  assert.equal(natija.holat, "qabul");
  assert.equal(natija.yangiQoldiq, 0);

  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir));
  assert.equal(holat.qoldiq, 0, "FINAL TEST: kassir kassasi 0");
  assert.equal(holat.ochiq, false);

  // ⚠️ ASOSIY INVARIANT — hech bir raqam o'zgarmagan.
  const keyin = await asosiyKorsatkichlar();
  assert.equal(keyin.jamiKirim, oldingi.jamiKirim + 1_700_000, "faqat yangi yozuvlar qo'shildi");
  assert.equal(keyin.jamiChiqim, oldingi.jamiChiqim, "topshirish CHIQIM yozmaydi");
  assert.equal(keyin.kassalar, keyin.naqdKirim + keyin.clickKirim - keyin.jamiChiqim,
    "biznes kassalari qoldig'i topshirishdan o'zgarmaydi");
});

test("topshirish hech qanday Transaction yozmaydi/o'chirmaydi", async () => {
  const soni = await A(async () =>
    prisma.transaction.count({ where: { businessId: tA.business.id, deletedAt: null } })
  );
  assert.equal(soni, 4, "4 ta yozuv: naqd kirim, naqd chiqim, click, qarz");
  const ochirilgan = await A(async () =>
    prisma.transaction.count({ where: { businessId: tA.business.id, deletedAt: { not: null } } })
  );
  assert.equal(ochirilgan, 0);
});

test("ikkinchi marta qabul qilish bloklanadi", async () => {
  const tarix = await A(async () => q.listKassaTarix(tA.business.id, kassir.id));
  const qabulQilingan = tarix.find((t: any) => t.holat === "qabul");
  await assert.rejects(
    () =>
      A(async () =>
        svc.topshiriqQaror(tA.business.id, egaAktor(), qabulQilingan.id, { amal: "qabul" })
      ),
    /allaqachon/
  );
});

// ---------------------------------------------------------------------------
// KAMOMAD va ORTIQCHA (talab 12-13)
// ---------------------------------------------------------------------------

test("kamomad: yopilmasa kassirning kassasida OCHIQ qoladi", async () => {
  await yozuv("kirim", 1_000_000, kassir2.id);
  const aktor2 = { userId: kassir2.id, ism: kassir2.ism, rol: "CASHIER" };

  const t = await A(
    async () => svc.topshiriqYarat(tA.business.id, aktor2, { topshirilgan: 900_000 }),
    aktor2
  );
  assert.equal(t.hisoblangan, 1_000_000);
  assert.equal(t.farq, -100_000, "kamomad = topshirilgan − hisoblangan");

  await A(async () =>
    svc.topshiriqQaror(tA.business.id, egaAktor(), t.id, { amal: "qabul", farqYopildi: false })
  );
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir2));
  assert.equal(holat.qoldiq, 100_000, "kamomad kassirda qarz bo'lib qoladi");
});

test("kamomad yopilsa kassa 0 ga tushadi", async () => {
  const aktor2 = { userId: kassir2.id, ism: kassir2.ism, rol: "CASHIER" };
  const t = await A(
    async () => svc.topshiriqYarat(tA.business.id, aktor2, { topshirilgan: 0 }),
    aktor2
  );
  assert.equal(t.hisoblangan, 100_000);
  assert.equal(t.farq, -100_000);

  await A(async () =>
    svc.topshiriqQaror(tA.business.id, egaAktor(), t.id, { amal: "qabul", farqYopildi: true })
  );
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir2));
  assert.equal(holat.qoldiq, 0);
});

test("ortiqcha: farq har doim yopiladi, kassa manfiy bo'lmaydi", async () => {
  await yozuv("kirim", 1_000_000, kassir2.id);
  const aktor2 = { userId: kassir2.id, ism: kassir2.ism, rol: "CASHIER" };

  const t = await A(
    async () => svc.topshiriqYarat(tA.business.id, aktor2, { topshirilgan: 1_100_000 }),
    aktor2
  );
  assert.equal(t.farq, 100_000);

  // Direktor `farqYopildi: false` yuborsa ham server uni majburan yopadi.
  await A(async () =>
    svc.topshiriqQaror(tA.business.id, egaAktor(), t.id, { amal: "qabul", farqYopildi: false })
  );
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir2));
  assert.equal(holat.qoldiq, 0, "ortiqcha kassaga kiritiladi, qoldiq manfiy bo'lmaydi");
});

// ---------------------------------------------------------------------------
// RAD ETISH, BEKOR QILISH, PUL BERISH
// ---------------------------------------------------------------------------

test("rad etilgan topshiriq kassani kamaytirmaydi", async () => {
  await yozuv("kirim", 300_000);
  const t = await A(
    async () => svc.topshiriqYarat(tA.business.id, kassirAktor(), { topshirilgan: 300_000 }),
    kassirAktor()
  );
  await A(async () =>
    svc.topshiriqQaror(tA.business.id, egaAktor(), t.id, { amal: "rad", qarorIzoh: "Pul yetmadi" })
  );
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir));
  assert.equal(holat.qoldiq, 300_000);
  assert.equal(holat.kutilayotgan, null, "rad etilgach yangi topshiriq ochish mumkin");
});

test("kassir o'z topshirig'ini bekor qila oladi", async () => {
  const t = await A(
    async () => svc.topshiriqYarat(tA.business.id, kassirAktor(), { topshirilgan: 300_000 }),
    kassirAktor()
  );
  await A(
    async () => svc.topshiriqQaror(tA.business.id, kassirAktor(), t.id, { amal: "bekor" }),
    kassirAktor()
  );
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir));
  assert.equal(holat.qoldiq, 300_000);
  assert.equal(holat.kutilayotgan, null);
});

test("kassaga pul berish qoldiqni oshiradi, hisobotga tegmaydi", async () => {
  const oldin = await asosiyKorsatkichlar();
  await A(async () =>
    svc.kassagaPulBer(tA.business.id, egaAktor(), {
      kassirId: kassir.id,
      summa: 200_000,
      izoh: "Qaytim uchun",
    })
  );
  const holat = await A(async () => q.getKassaHolat(tA.business.id, kassir));
  assert.equal(holat.qoldiq, 500_000);

  const keyin = await asosiyKorsatkichlar();
  assert.deepEqual(
    { k: keyin.jamiKirim, c: keyin.jamiChiqim, s: keyin.sof },
    { k: oldin.jamiKirim, c: oldin.jamiChiqim, s: oldin.sof },
    "pul berish kirim/chiqim/sof raqamlarini o'zgartirmaydi"
  );
});

test("pul berishni faqat boshqaruvchi bajaradi", async () => {
  await assert.rejects(
    () =>
      A(
        async () =>
          svc.kassagaPulBer(tA.business.id, kassirAktor(), { kassirId: kassir.id, summa: 100 }),
        kassirAktor()
      ),
    /direktor yoki admin/
  );
});

// ---------------------------------------------------------------------------
// DIREKTOR PANELI VA IZOLYATSIYA
// ---------------------------------------------------------------------------

test("kassirlar ro'yxati holat bilan chiqadi", async () => {
  const royxat = await A(async () => q.listKassirQoldiqlari(tA.business.id));
  const ali = royxat.find((k: any) => k.kassirId === kassir.id);
  const vali = royxat.find((k: any) => k.kassirId === kassir2.id);
  assert.equal(ali.kassirIsm, "Ali Valiyev");
  assert.equal(ali.qoldiq, 500_000);
  assert.equal(ali.ochiq, true);
  assert.equal(vali.qoldiq, 0);
  assert.equal(vali.ochiq, false, "topshirgan kassir 'Yopilgan' bo'ladi");
});

test("boshqa tenant kassa topshiriqlarini KO'RMAYDI", async () => {
  const bTopshiriqlar = await B(async () => q.listTopshiriqlar(tB.business.id));
  assert.equal(bTopshiriqlar.length, 0);

  const bKassirlar = await B(async () => q.listKassirQoldiqlari(tB.business.id));
  assert.equal(bKassirlar.length, 0);

  // B tenant A ning topshirig'i bo'yicha qaror qabul qila olmaydi.
  const aTopshiriq = await A(async () => q.listTopshiriqlar(tA.business.id));
  await assert.rejects(
    () =>
      B(async () =>
        svc.topshiriqQaror(
          tA.business.id,
          { userId: tB.user.id, ism: "B egasi", rol: "OWNER" },
          aTopshiriq[0].id,
          { amal: "qabul" }
        )
      ),
    /tegishli emas/
  );
});

test("audit jurnalida kassa harakatlari qoladi", async () => {
  const loglar = await A(async () =>
    prisma.auditLog.findMany({ where: { businessId: tA.business.id, entity: "cashHandover" } })
  );
  assert.ok(loglar.length >= 6, `kamida 6 ta audit yozuvi kutilgan, topildi: ${loglar.length}`);
});

// ---------------------------------------------------------------------------
// SOF FUNKSIYALAR
// ---------------------------------------------------------------------------

test("harakatTasiri formulasi", () => {
  const t = (turi: string, topshirilgan: number, farq: number, farqYopildi: boolean) =>
    svc.harakatTasiri({ turi, topshirilgan, farq, farqYopildi });

  assert.equal(t("berish", 500_000, 0, false), 500_000);
  assert.equal(t("topshirish", 1_000_000, 0, false), -1_000_000);
  // Kamomad ochiq: faqat topshirilgani ayriladi (100 000 kassada qoladi).
  assert.equal(t("topshirish", 900_000, -100_000, false), -900_000);
  // Kamomad yopilgan: hisoblangan (1 000 000) to'liq ayriladi.
  assert.equal(t("topshirish", 900_000, -100_000, true), -1_000_000);
  // Ortiqcha: hisoblangan (1 000 000) ayriladi, ortiqcha kassaga kiritiladi.
  assert.equal(t("topshirish", 1_100_000, 100_000, true), -1_000_000);
});

test("kassaQoldiqHisobi formulasi", () => {
  assert.equal(svc.kassaQoldiqHisobi(3_000_000, 2_000_000, []), 1_000_000);
  assert.equal(
    svc.kassaQoldiqHisobi(3_000_000, 2_000_000, [
      { turi: "topshirish", topshirilgan: 1_000_000, farq: 0, farqYopildi: false },
    ]),
    0
  );
});
