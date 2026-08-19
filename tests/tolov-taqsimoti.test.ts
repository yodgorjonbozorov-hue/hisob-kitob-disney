/**
 * TO'LOV TAQSIMOTI — "Jami kirim/chiqim" kartasi ichidagi bo'limlar.
 *
 * ENG MUHIM INVARIANT (6 va 7-talab): bo'limlar YIG'INDISI bosh sahifadagi
 * karta summasiga AYNAN teng bo'lishi shart. Ikkalasi ham bitta to'plamdan
 * (shu biznes, o'chirilmagan, tanlangan oy, qarzsiz) hisoblanadi.
 *
 * Ikkinchi invariant: bo'lim bo'yicha ro'yxat filtri (`tolovBolimiWhere`)
 * jamlash qoidasi (`amaldagiBolim`) bilan bir xil natija berishi kerak —
 * aks holda "Naqd 45 mln" deb ochilgan ro'yxatda boshqa summa chiqardi.
 *
 * Ishga tushirish: npm run test:tolov-taqsimoti
 */
process.env.DATABASE_URL = "file:./prisma/test-tolov-taqsimoti.db";

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
let taqsimotQ: any;
let bolimLib: any;

let T: any;
let T2: any;
let naqdKassa: any;
let plastikKassa: any;
let bankKassa: any;
let katKirim: any;
let katChiqim: any;

const OY = "2026-08";

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

/** Bosh sahifadagi karta raqami. */
async function karta(turi: "kirim" | "chiqim") {
  const x = await A(async () => dashboardQ.getMonthSummary(T.business.id, OY));
  return turi === "kirim" ? x.jamiKirim : x.jamiChiqim;
}

function taqsimot(turi: "kirim" | "chiqim") {
  return A(async () => taqsimotQ.getTolovTaqsimoti(T.business.id, OY, turi));
}

/** Oynada bo'lim bosilganda ketadigan so'rov. */
function bolimRoyxati(turi: "kirim" | "chiqim", bolim: string) {
  return A(async () =>
    txQ.listTransactions({
      businessId: T.business.id,
      turi,
      tolovBolimi: bolim,
      from: "2026-08-01",
      to: "2026-08-31",
      realPul: true,
      pageSize: 100,
    })
  );
}

function yoz(o: {
  turi: "kirim" | "chiqim";
  summa: number;
  sana?: string;
  tolovTuri?: string | null;
  accountId?: string | null;
  izoh?: string;
}) {
  return A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi: o.turi,
      categoryId: o.turi === "kirim" ? katKirim.id : katChiqim.id,
      summa: o.summa,
      sana: o.sana ?? "2026-08-12",
      izoh: o.izoh,
      tolovTuri: o.tolovTuri ?? null,
      accountId: o.accountId ?? undefined,
    })
  );
}

before(async () => {
  rmSync("prisma/test-tolov-taqsimoti.db", { force: true });
  rmSync("prisma/test-tolov-taqsimoti.db-journal", { force: true });
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
  taqsimotQ = await import("@/lib/queries/tolovTaqsimoti");
  bolimLib = await import("@/lib/tolovBolimi");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy",
    ism: "Direktor",
    login: "+998900000401",
    parol: "parol12345",
  });
  T2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona",
    ism: "Begona",
    login: "+998900000402",
    parol: "parol12345",
  });

  const accountsQ = await import("@/lib/queries/accounts");
  const accountsSvc = await import("@/lib/services/accounts");
  naqdKassa = (await A(async () => accountsQ.listAccounts(T.business.id)))[0];
  plastikKassa = await A(async () =>
    accountsSvc.createAccount(T.business.id, { nomi: "Terminal", turi: "plastik" })
  );
  bankKassa = await A(async () =>
    accountsSvc.createAccount(T.business.id, { nomi: "Bank", turi: "bank" })
  );

  katKirim = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Bezak", turi: "kirim" },
  });
  katChiqim = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Xarajat", turi: "chiqim" },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// Sof funksiya — bo'limga biriktirish qoidasi
// ---------------------------------------------------------------------------

test("amaldagiBolim: aniq to'lov turi ustun, bo'lmasa kassa turidan", () => {
  const f = bolimLib.amaldagiBolim;
  assert.equal(f("naqd", "plastik"), "naqd", "aniq tur kassadan ustun");
  assert.equal(f("click", "naqd"), "click");
  assert.equal(f(null, "plastik"), "plastik", "eski yozuv — kassa turidan");
  assert.equal(f(null, "bank"), "bank");
  assert.equal(f(null, "naqd"), "naqd");
  assert.equal(f(null, null), "naqd", "kassasiz eski yozuv naqd hisoblanadi");
  assert.equal(f("qarz", "naqd"), null, "qarz bo'limlarga kirmaydi");
});

// ---------------------------------------------------------------------------
// Kirim
// ---------------------------------------------------------------------------

test("kirim: bo'limlar yig'indisi kartadagi 'Jami kirim' bilan AYNAN teng", async () => {
  await yoz({ turi: "kirim", summa: 45_200_000, tolovTuri: "naqd", accountId: naqdKassa.id });
  await yoz({ turi: "kirim", summa: 28_500_000, tolovTuri: "click", accountId: plastikKassa.id });
  // Eski yozuv (tolovTuri null) plastik kassada → "Plastik" bo'limi.
  await yoz({ turi: "kirim", summa: 23_000_000, tolovTuri: null, accountId: plastikKassa.id });

  const jamiKarta = await karta("kirim");
  const t = await taqsimot("kirim");

  assert.equal(jamiKarta, 96_700_000);
  assert.equal(t.jami, jamiKarta, "bo'limlar yig'indisi kartaga teng");
  assert.equal(
    t.bolimlar.reduce((a: number, b: any) => a + b.summa, 0),
    jamiKarta
  );

  const kod = (k: string) => t.bolimlar.find((b: any) => b.kod === k);
  assert.equal(kod("naqd").summa, 45_200_000);
  assert.equal(kod("click").summa, 28_500_000);
  assert.equal(kod("plastik").summa, 23_000_000);
  assert.equal(kod("bank"), undefined, "bank yozuvi yo'q — qator ham chiqmaydi");

  // Foizlar yig'indisi 100.
  const foizJami = t.bolimlar.reduce((a: number, b: any) => a + b.foiz, 0);
  assert.ok(Math.abs(foizJami - 100) < 0.0001, `foizlar yig'indisi 100 bo'lishi kerak: ${foizJami}`);
  assert.equal(kod("naqd").foiz.toFixed(1), "46.7");
});

test("bo'lim bosilganda ro'yxat AYNI shu bo'lim summasini beradi", async () => {
  const t = await taqsimot("kirim");
  for (const b of t.bolimlar) {
    const royxat = await bolimRoyxati("kirim", b.kod);
    assert.equal(royxat.totals.jamiKirim, b.summa, `${b.kod}: ro'yxat jami taqsimotga teng`);
    assert.equal(royxat.total, b.soni, `${b.kod}: yozuvlar soni teng`);
  }
});

test("bo'limlar kesishmaydi — har yozuv aynan bitta bo'limga tushadi", async () => {
  const t = await taqsimot("kirim");
  const idlar = new Set<string>();
  let jami = 0;
  for (const b of t.bolimlar) {
    const royxat = await bolimRoyxati("kirim", b.kod);
    for (const x of royxat.items) {
      assert.equal(idlar.has(x.id), false, `${x.id} ikki bo'limda chiqdi`);
      idlar.add(x.id);
      jami += x.summa;
    }
  }
  assert.equal(jami, t.jami, "barcha bo'limlar yozuvlari jamiga teng");
  assert.equal(idlar.size, 3);
});

test("qarzga yozilgan kirim bo'limlarga kirmaydi, alohida ko'rsatiladi", async () => {
  await yoz({ turi: "kirim", summa: 9_000_000, tolovTuri: "qarz", izoh: "Qarzga" });

  const jamiKarta = await karta("kirim");
  const t = await taqsimot("kirim");

  assert.equal(jamiKarta, 96_700_000, "karta qarzni hisobga olmaydi");
  assert.equal(t.jami, jamiKarta, "taqsimot ham — invariant saqlanadi");
  assert.equal(t.qarz, 9_000_000, "qarz alohida qatorda ko'rinadi");
  assert.equal(
    t.bolimlar.reduce((a: number, b: any) => a + b.summa, 0),
    96_700_000
  );

  // Qarzli yozuv hech qaysi bo'lim ro'yxatida chiqmasligi kerak.
  for (const b of t.bolimlar) {
    const royxat = await bolimRoyxati("kirim", b.kod);
    assert.equal(royxat.items.some((x: any) => x.izoh === "Qarzga"), false);
  }
});

// ---------------------------------------------------------------------------
// Chiqim
// ---------------------------------------------------------------------------

test("chiqim: bo'limlar yig'indisi 'Jami chiqim' bilan teng", async () => {
  await yoz({ turi: "chiqim", summa: 30_000_000, tolovTuri: "naqd", accountId: naqdKassa.id });
  await yoz({ turi: "chiqim", summa: 20_000_000, tolovTuri: "click", accountId: plastikKassa.id });
  await yoz({ turi: "chiqim", summa: 8_600_000, tolovTuri: null, accountId: bankKassa.id });

  const jamiKarta = await karta("chiqim");
  const t = await taqsimot("chiqim");

  assert.equal(jamiKarta, 58_600_000);
  assert.equal(t.jami, jamiKarta);
  assert.equal(t.qarz, 0, "chiqimda qarz bo'lmaydi");

  const kod = (k: string) => t.bolimlar.find((b: any) => b.kod === k);
  assert.equal(kod("naqd").summa, 30_000_000);
  assert.equal(kod("click").summa, 20_000_000);
  assert.equal(kod("bank").summa, 8_600_000, "bank bo'limi avtomatik paydo bo'ldi");

  for (const b of t.bolimlar) {
    const royxat = await bolimRoyxati("chiqim", b.kod);
    assert.equal(royxat.totals.jamiChiqim, b.summa);
  }
});

test("kirim va chiqim bo'limlari aralashmaydi", async () => {
  const kirim = await taqsimot("kirim");
  const chiqim = await taqsimot("chiqim");
  assert.notEqual(kirim.jami, chiqim.jami);

  const naqdKirim = await bolimRoyxati("kirim", "naqd");
  assert.equal(naqdKirim.items.every((x: any) => x.turi === "kirim"), true);
  const naqdChiqim = await bolimRoyxati("chiqim", "naqd");
  assert.equal(naqdChiqim.items.every((x: any) => x.turi === "chiqim"), true);
});

// ---------------------------------------------------------------------------
// Kassasiz eski yozuv, bo'sh oy, izolyatsiya
// ---------------------------------------------------------------------------

test("kassasiz va tursiz eski yozuv naqd bo'limiga tushadi", async () => {
  const oldin = (await taqsimot("kirim")).bolimlar.find((b: any) => b.kod === "naqd").summa;
  await yoz({ turi: "kirim", summa: 1_300_000, tolovTuri: null, accountId: null, izoh: "Eski" });

  const t = await taqsimot("kirim");
  assert.equal(t.bolimlar.find((b: any) => b.kod === "naqd").summa, oldin + 1_300_000);
  assert.equal(t.jami, await karta("kirim"), "invariant saqlanadi");

  const royxat = await bolimRoyxati("kirim", "naqd");
  assert.equal(royxat.items.some((x: any) => x.izoh === "Eski"), true);
});

test("yozuvsiz oyda taqsimot bo'sh, jami 0", async () => {
  const t = await A(async () => taqsimotQ.getTolovTaqsimoti(T.business.id, "2026-01", "kirim"));
  assert.equal(t.jami, 0);
  assert.equal(t.bolimlar.length, 0);
  assert.equal(t.qarz, 0);
});

test("boshqa biznesning yozuvlari taqsimotga kirmaydi", async () => {
  const begonaKat = await rawPrisma.category.create({
    data: { businessId: T2.business.id, nomi: "Begona", turi: "kirim" },
  });
  await runWithTenant(
    T2.tenant.id,
    async () =>
      createTransaction(T2.user.id, T2.business.id, {
        turi: "kirim",
        categoryId: begonaKat.id,
        summa: 500_000_000,
        sana: "2026-08-12",
        izoh: "Begona yozuv",
      }),
    { userId: T2.user.id, ism: "Begona" }
  );

  const t = await taqsimot("kirim");
  assert.equal(t.jami, await karta("kirim"), "begona yozuv ikkalasiga ham kirmaydi");
  assert.ok(t.jami < 500_000_000);

  const royxat = await bolimRoyxati("kirim", "naqd");
  assert.equal(royxat.items.some((x: any) => x.izoh === "Begona yozuv"), false);

  // Begona tenant o'z raqamini ko'radi.
  const begona = await runWithTenant(T2.tenant.id, async () =>
    taqsimotQ.getTolovTaqsimoti(T2.business.id, OY, "kirim")
  );
  assert.equal(begona.jami, 500_000_000);
});

test("o'chirilgan yozuv taqsimotdan ham, kartadan ham chiqadi", async () => {
  const yozuv = await yoz({ turi: "kirim", summa: 4_000_000, tolovTuri: "naqd", accountId: naqdKassa.id });
  const oldin = await taqsimot("kirim");
  assert.equal(oldin.jami, await karta("kirim"));

  await A(async () =>
    rawPrisma.transaction.update({ where: { id: yozuv.id }, data: { deletedAt: new Date() } })
  );

  const keyin = await taqsimot("kirim");
  assert.equal(keyin.jami, oldin.jami - 4_000_000);
  assert.equal(keyin.jami, await karta("kirim"), "invariant o'chirishdan keyin ham saqlanadi");
});
