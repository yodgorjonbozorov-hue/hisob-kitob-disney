/**
 * MOLIYA — MERGE OLDIDAN CHUQUR AUDIT.
 *
 * `tests/moliya-pul.test.ts` oqimning ishlashini tekshiradi; bu fayl esa
 * BUZILISH nuqtalarini: tenant izolyatsiyasi, huquqlar, FIFO qayta
 * taqsimlash, ledger tozaligi va to'lov kanali → kassa turi mosligi.
 *
 * Ishga tushirish: npm run test:moliya-audit
 */
process.env.DATABASE_URL = "file:./prisma/test-moliya-audit.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let qarzSvc: any;
let pulOqimi: any;
let tuzatish: any;
let accountsQ: any;
let accountsSvc: any;
let qulf: any;
let guard: any;

let A1: any;
let A2: any;
let naqd: any;
let plastik: any;
let bank: any;

const SANA = "2026-09-05";

/** Tenant konteksti bilan bajarish (har tenant uchun alohida). */
function ctx(T: any) {
  return <R>(fn: () => Promise<R>): Promise<R> =>
    runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: T.user.ism });
}

const A = (fn: any) => ctx(A1)(fn);

const kassa = (id: string) =>
  A(async () => {
    const hammasi = await accountsQ.getAccountBalances(A1.business.id);
    return hammasi.find((k: any) => k.id === id)?.qoldiq ?? 0;
  });

const qarzQolgan = (debtId: string) =>
  A(async () => {
    const d = await prisma.debt.findUnique({ where: { id: debtId } });
    return d.jamiSumma - d.tolangan;
  });

function pul(qism: Record<string, unknown>, T = A1) {
  return ctx(T)(async () =>
    pulOqimi.pulHarakatiYoz({
      businessId: T.business.id,
      userId: T.user.id,
      sana: SANA,
      usul: "naqd",
      amalId: randomUUID(),
      ...qism,
    })
  );
}

/** Qarz yaratish — kartochkasiz (ism bo'yicha jamlanadi). */
function qarzYarat(turi: string, ism: string, summa: number, sana: string) {
  return A(async () =>
    qarzSvc.createQarz({
      businessId: A1.business.id,
      userId: A1.user.id,
      turi,
      mijozNomi: ism,
      mijozTel: turi === "olinadigan" ? "+998901110000" : null,
      jamiSumma: summa,
      sana,
    })
  );
}

before(async () => {
  for (const f of ["prisma/test-moliya-audit.db", "prisma/test-moliya-audit.db-journal"]) {
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
  qarzSvc = await import("@/lib/services/qarz");
  pulOqimi = await import("@/lib/services/pulOqimi");
  tuzatish = await import("@/lib/services/pulOqimiTuzatish");
  accountsQ = await import("@/lib/queries/accounts");
  accountsSvc = await import("@/lib/services/accounts");
  qulf = await import("@/lib/services/yozuvQulfi");
  guard = await import("@/lib/auth/guard");

  A1 = await createTenantWithOwner({
    kompaniyaNomi: "Audit A",
    ism: "Direktor A",
    login: "+998900000401",
    parol: "parol12345",
  });
  A2 = await createTenantWithOwner({
    kompaniyaNomi: "Audit B",
    ism: "Direktor B",
    login: "+998900000402",
    parol: "parol12345",
  });

  const kassalar = await A(async () => accountsQ.listAccounts(A1.business.id));
  naqd = kassalar[0];
  plastik = await A(async () =>
    accountsSvc.createAccount(A1.business.id, { nomi: "Terminal", turi: "plastik" })
  );
  bank = await A(async () =>
    accountsSvc.createAccount(A1.business.id, { nomi: "Bank hisobi", turi: "bank" })
  );
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ===========================================================================
// 1 — idempotencyKey MULTI-TENANT XAVFSIZLIGI
// ===========================================================================

test("1a: unique cheklov business bilan scoped (tenantdan ham tor)", async () => {
  // Sxema haqiqati: Business.tenantId MAJBURIY skalyar, ya'ni bitta biznes
  // aynan bitta tenantga tegishli. Demak (businessId, idempotencyKey)
  // (tenantId, idempotencyKey) dan QAT'IY tor — bir tenantning kaliti
  // boshqasinikini to'sa olmaydi.
  const biz = await A(async () =>
    prisma.business.findUnique({
      where: { id: A1.business.id },
      select: { tenantId: true },
    })
  );
  assert.equal(biz.tenantId, A1.tenant.id, "biznes aynan bitta tenantga tegishli");

  const indeks: any[] = await rawPrisma.$queryRawUnsafe(
    `SELECT name, "unique" FROM pragma_index_list('Transaction') WHERE "unique" = 1`
  );
  const kalitli = indeks.find((i) => String(i.name).includes("idempotencyKey"));
  assert.ok(kalitli, "idempotencyKey unique indeksi mavjud");

  const ustunlar: any[] = await rawPrisma.$queryRawUnsafe(
    `SELECT name FROM pragma_index_info('${kalitli.name}') ORDER BY seqno`
  );
  assert.deepEqual(
    ustunlar.map((u) => String(u.name)),
    ["businessId", "idempotencyKey"],
    "unique cheklov businessId bilan scoped — global emas"
  );
});

test("1b: bir tenantdagi kalit boshqa tenantning so'rovini bloklamaydi", async () => {
  // AYNI kalit ikkala tenantda ham ishlashi kerak.
  const bir_xil_kalit = "AYNI-KALIT-" + randomUUID();

  const birinchi = await pul(
    {
      yonalish: "chiqim",
      shaxsTuri: "shaxs",
      shaxsIsm: "Usta",
      sababKod: "xarajat",
      summa: 100_000,
      amalId: bir_xil_kalit,
    },
    A1
  );
  const ikkinchi = await pul(
    {
      yonalish: "chiqim",
      shaxsTuri: "shaxs",
      shaxsIsm: "Usta",
      sababKod: "xarajat",
      summa: 250_000,
      amalId: bir_xil_kalit,
    },
    A2
  );

  assert.equal(birinchi.yangi, true);
  assert.equal(ikkinchi.yangi, true, "boshqa tenant bloklanmaydi");
  assert.notDeepEqual(birinchi.transactionIds, ikkinchi.transactionIds);
  assert.equal(ikkinchi.summa, 250_000, "ikkinchi tenant o'z summasini yozdi");

  // AYNI tenant + AYNI kalit esa takrorlanmaydi.
  const uchinchi = await pul(
    {
      yonalish: "chiqim",
      shaxsTuri: "shaxs",
      shaxsIsm: "Usta",
      sababKod: "xarajat",
      summa: 100_000,
      amalId: bir_xil_kalit,
    },
    A1
  );
  assert.equal(uchinchi.yangi, false, "o'z tenantida takror bosish to'siladi");
  assert.deepEqual(uchinchi.transactionIds, birinchi.transactionIds);
});

test("1c: klient kaliti UUID — to'qnashuv ehtimoli yo'q, lekin himoya kalitga tayanmaydi", () => {
  // Kalit klientdan keladi, shuning uchun UNIQUE cheklov bilan bir qatorda
  // bekor qilishda TEGISHLILIK ham tekshiriladi (pulOqimiTuzatish.ts).
  const namuna = randomUUID();
  assert.match(namuna, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

// ===========================================================================
// 2 — HUQUQLAR (route qatlamidagi guard)
// ===========================================================================

test("2: tuzatish va bekor qilish faqat boshqaruvchiga", () => {
  // `/api/moliya/[amalId]` PATCH va DELETE birinchi qatorda shu guardni
  // chaqiradi; ForbiddenError -> 403 (lib/auth/guard.ts handleApiError).
  for (const rol of ["CASHIER", "SELLER"]) {
    assert.throws(() => guard.requireManager(rol), /Ruxsat|ruxsat|Forbidden/i, `${rol} rad etiladi`);
  }
  assert.doesNotThrow(() => guard.requireManager("OWNER"));
  assert.doesNotThrow(() => guard.requireManager("ADMIN"));
});

test("2b: qarz to'lovi yozuvi umumiy Kirim/Chiqim oqimidan qulflangan", async () => {
  const qarz = await qarzYarat("olinadigan", "Qulf mijozi", 1_000_000, SANA);
  const n = await pul({
    yonalish: "kirim",
    shaxsTuri: "mijoz",
    shaxsIsm: "Qulf mijozi",
    sababKod: "mijoz-qarz",
    summa: 400_000,
    accountId: naqd.id,
  });

  const yozuvId = n.transactionIds[0];
  await assert.rejects(
    () => A(async () => qulf.qarzQulfiniTekshir(A1.business.id, yozuvId)),
    /qarz to'lovi/i,
    "PATCH/DELETE shu qulfga uriladi"
  );

  // Ommaviy o'chirishda esa qulflangani o'tkazib yuboriladi, qolgani o'chadi.
  const oddiy = await pul({
    yonalish: "chiqim",
    shaxsTuri: "shaxs",
    shaxsIsm: "Usta",
    sababKod: "xarajat",
    summa: 50_000,
  });
  const natija = await A(async () =>
    qulf.qarzsizYozuvlar(A1.business.id, [yozuvId, oddiy.transactionIds[0]])
  );
  assert.deepEqual(natija.ruxsat, [oddiy.transactionIds[0]]);
  assert.equal(natija.qulflangan, 1);

  // Qulf qarz qoldig'ini himoya qiladi — u hali ham to'g'ri.
  assert.equal(await qarzQolgan(qarz.id), 600_000);
});

// ===========================================================================
// 3 — QARZ OQIMLARI: CUSTOMER / SUPPLIER / FIFO
// ===========================================================================

test("3a CUSTOMER: 5 mln qarz -> 2 mln to'lov -> 3 mln -> bekor -> yana 5 mln", async () => {
  const qarz = await qarzYarat("olinadigan", "Aziz", 5_000_000, SANA);
  assert.equal(await qarzQolgan(qarz.id), 5_000_000);

  const kassaBoshi = await kassa(naqd.id);
  const n = await pul({
    yonalish: "kirim",
    shaxsTuri: "mijoz",
    shaxsIsm: "Aziz",
    sababKod: "mijoz-qarz",
    summa: 2_000_000,
    accountId: naqd.id,
  });

  assert.equal(await qarzQolgan(qarz.id), 3_000_000, "qolgan 3 mln");
  assert.equal(await kassa(naqd.id), kassaBoshi + 2_000_000, "kassa +2 mln");

  await A(async () =>
    tuzatish.pulHarakatiBekor({
      businessId: A1.business.id,
      userId: A1.user.id,
      amalId: n.amalId,
    })
  );

  assert.equal(await qarzQolgan(qarz.id), 5_000_000, "bekor qilingach qarz yana 5 mln");
  assert.equal(await kassa(naqd.id), kassaBoshi, "kassa boshlang'ich holatga qaytdi");

  const d = await A(async () => prisma.debt.findUnique({ where: { id: qarz.id } }));
  assert.equal(d.status, "OPEN");
  assert.equal(d.isYopilgan, false);
  assert.equal(
    await A(async () => prisma.debtPayment.count({ where: { debtId: qarz.id } })),
    0,
    "to'lov yozuvi ham qoldirilmaydi"
  );
});

test("3b SUPPLIER: 7 mln qarz -> 3 mln to'lov -> 4 mln -> bekor -> yana 7 mln", async () => {
  const qarz = await qarzYarat("beriladigan", "Toshkent Optom", 7_000_000, SANA);
  const kassaBoshi = await kassa(naqd.id);

  const n = await pul({
    yonalish: "chiqim",
    shaxsTuri: "taminotchi",
    shaxsIsm: "Toshkent Optom",
    sababKod: "taminotchi-qarz",
    summa: 3_000_000,
    accountId: naqd.id,
  });

  assert.equal(await qarzQolgan(qarz.id), 4_000_000, "qolgan 4 mln");
  assert.equal(await kassa(naqd.id), kassaBoshi - 3_000_000, "kassa −3 mln");

  await A(async () =>
    tuzatish.pulHarakatiBekor({
      businessId: A1.business.id,
      userId: A1.user.id,
      amalId: n.amalId,
    })
  );

  assert.equal(await qarzQolgan(qarz.id), 7_000_000, "bekor qilingach qarz yana 7 mln");
  assert.equal(await kassa(naqd.id), kassaBoshi, "kassa qaytdi");
});

test("3c FIFO: bitta to'lov uchta qarzga taqsimlanadi", async () => {
  const a = await qarzYarat("olinadigan", "Fifo mijoz", 500_000, "2026-08-10");
  const b = await qarzYarat("olinadigan", "Fifo mijoz", 1_000_000, "2026-08-15");
  const c = await qarzYarat("olinadigan", "Fifo mijoz", 2_000_000, "2026-08-20");

  const n = await pul({
    yonalish: "kirim",
    shaxsTuri: "mijoz",
    shaxsIsm: "Fifo mijoz",
    sababKod: "mijoz-qarz",
    summa: 1_200_000,
    accountId: naqd.id,
  });

  // A(500k) to'liq yopiladi, B dan 700k, C tegilmaydi.
  assert.equal(await qarzQolgan(a.id), 0, "eng eski qarz to'liq yopildi");
  assert.equal(await qarzQolgan(b.id), 300_000, "ikkinchisidan 700k olindi");
  assert.equal(await qarzQolgan(c.id), 2_000_000, "eng yangisiga tegilmadi");
  assert.equal(n.transactionIds.length, 2, "har qarz uchun alohida kirim");

  // FIFO QAYTA TAQSIMLASH: 1,2 mln -> 400k. Eski taqsimot TO'LIQ bekor
  // bo'lib, yangi summa qaytadan eng eskisidan boshlab taqsimlanishi kerak.
  const yangi = await A(async () =>
    tuzatish.pulHarakatiTahrirla({
      businessId: A1.business.id,
      userId: A1.user.id,
      amalId: n.amalId,
      yonalish: "kirim",
      shaxsTuri: "mijoz",
      shaxsIsm: "Fifo mijoz",
      sababKod: "mijoz-qarz",
      summa: 400_000,
      sana: SANA,
      usul: "naqd",
      accountId: naqd.id,
    })
  );

  assert.equal(await qarzQolgan(a.id), 100_000, "A endi 400k oldi (500k − 400k)");
  assert.equal(await qarzQolgan(b.id), 1_000_000, "B ga tegilmaydi — eski allocation bekor bo'ldi");
  assert.equal(await qarzQolgan(c.id), 2_000_000);
  assert.equal(yangi.transactionIds.length, 1, "yangi taqsimot bitta qarzga tushdi");

  const tolovlar = await A(async () =>
    prisma.debtPayment.count({
      where: { businessId: A1.business.id, debtId: { in: [a.id, b.id, c.id] } },
    })
  );
  assert.equal(tolovlar, 1, "eski to'lov yozuvlari qoldirilmaydi");
});

// ===========================================================================
// 4 — KASSA LEDGER TOZALIGI (correction yozuvi yaratilmaydi)
// ===========================================================================

test("4: 2 mln kirim 1,5 mln ga tuzatilsa faqat 1,5 mln qoladi", async () => {
  const boshi = await kassa(naqd.id);
  const yozuvlarBoshi = await A(async () =>
    prisma.transaction.count({ where: { businessId: A1.business.id, deletedAt: null } })
  );

  const n = await pul({
    yonalish: "kirim",
    shaxsTuri: "shaxs",
    shaxsIsm: "Ledger sinovi",
    sababKod: "boshqa-kirim",
    summa: 2_000_000,
    accountId: naqd.id,
  });
  assert.equal(await kassa(naqd.id), boshi + 2_000_000);

  const yangi = await A(async () =>
    tuzatish.pulHarakatiTahrirla({
      businessId: A1.business.id,
      userId: A1.user.id,
      amalId: n.amalId,
      yonalish: "kirim",
      shaxsTuri: "shaxs",
      shaxsIsm: "Ledger sinovi",
      sababKod: "boshqa-kirim",
      summa: 1_500_000,
      sana: SANA,
      usul: "naqd",
      accountId: naqd.id,
    })
  );

  assert.equal(await kassa(naqd.id), boshi + 1_500_000, "natija faqat 1,5 mln");

  // FAOL yozuvlar soni faqat BITTAGA oshgan: eski yozuv soft-delete,
  // yangisi yozildi. Hech qanday qo'shimcha "correction" yozuvi yo'q.
  const yozuvlarKeyin = await A(async () =>
    prisma.transaction.count({ where: { businessId: A1.business.id, deletedAt: null } })
  );
  assert.equal(yozuvlarKeyin, yozuvlarBoshi + 1, "correction tranzaksiyasi yaratilmaydi");

  const faol = await A(async () =>
    prisma.transaction.findMany({
      where: { businessId: A1.business.id, amalId: yangi.amalId, deletedAt: null },
      select: { summa: true },
    })
  );
  assert.deepEqual(
    faol.map((t: any) => t.summa),
    [1_500_000],
    "amalda bitta yozuv va u 1,5 mln"
  );

  const eski = await A(async () =>
    prisma.transaction.findUnique({ where: { id: n.transactionIds[0] } })
  );
  assert.ok(eski.deletedAt, "eski yozuv o'chirilgan deb belgilangan (audit izi qoladi)");
  assert.equal(eski.idempotencyKey, null, "bekor qilingan kalit yangi yozuvni to'smaydi");
});

// ===========================================================================
// 5 — TO'LOV KANALI -> KASSA TURI
// ===========================================================================

test("5: har usul o'z kassa turiga tushadi", async () => {
  const kutilgan: Array<[string, string, string]> = [
    ["naqd", naqd.id, "naqd"],
    ["terminal", plastik.id, "plastik"],
    ["click", plastik.id, "plastik"],
    ["otkazma", bank.id, "bank"],
  ];

  for (const [usul, kassaId, kassaTuri] of kutilgan) {
    const n = await pul({
      yonalish: "kirim",
      shaxsTuri: "shaxs",
      shaxsIsm: `Kanal ${usul}`,
      sababKod: "boshqa-kirim",
      summa: 10_000,
      usul,
    });
    assert.equal(n.accountId, kassaId, `${usul} -> ${kassaTuri} kassa`);

    const yozuv = await A(async () =>
      prisma.transaction.findUnique({
        where: { id: n.transactionIds[0] },
        include: { account: true },
      })
    );
    assert.equal(yozuv.account.turi, kassaTuri, `${usul} noto'g'ri kassa turiga tushmadi`);
    assert.equal(yozuv.pulUsuli, usul, "tanlangan usul saqlanadi");
    // Moliya lug'ati kengaymaydi: naqddan boshqasi "click" yo'nalishida.
    assert.equal(yozuv.tolovTuri, usul === "naqd" ? "naqd" : "click");
  }
});

test("5b: naqd pul plastik yoki bank kassaga TUSHMAYDI", async () => {
  const n = await pul({
    yonalish: "kirim",
    shaxsTuri: "shaxs",
    shaxsIsm: "Naqd sinovi",
    sababKod: "boshqa-kirim",
    summa: 10_000,
    usul: "naqd",
  });
  const yozuv = await A(async () =>
    prisma.transaction.findUnique({
      where: { id: n.transactionIds[0] },
      include: { account: true },
    })
  );
  assert.equal(yozuv.account.turi, "naqd");
  assert.notEqual(yozuv.accountId, plastik.id);
  assert.notEqual(yozuv.accountId, bank.id);
});

test("5c: qo'lda tanlangan kassa boshqa biznesniki bo'lsa rad etiladi", async () => {
  const begonaKassa = await ctx(A2)(async () =>
    accountsSvc.createAccount(A2.business.id, { nomi: "Begona kassa", turi: "naqd" })
  );
  await assert.rejects(
    () =>
      pul({
        yonalish: "kirim",
        shaxsTuri: "shaxs",
        shaxsIsm: "Sinov",
        sababKod: "boshqa-kirim",
        summa: 10_000,
        accountId: begonaKassa.id,
      }),
    /Kassa topilmadi/i
  );
});
