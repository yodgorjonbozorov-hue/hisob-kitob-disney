/**
 * 3 KASSALI KASSA BOSHQARUVI VA SMENA TOPSHIRISH TESTLARI.
 *
 * Stsenariy Fortex Selos bo'yicha: Murod, Javlon va Direktor kassalari.
 *
 * ENG MUHIM INVARIANTLAR:
 *   1. Kassalararo o'tkazma DAROMAD EMAS — kirim/chiqim/sof o'zgarmaydi;
 *   2. o'tkazmadan keyin JAMI pul o'zgarmaydi, faqat joylashuvi o'zgaradi;
 *   3. kassada yo'q pulni o'tkazib bo'lmaydi (manfiy qoldiq yo'q);
 *   4. tasdiqlanmagan o'tkazma qoldiqqa KIRMAYDI — pul yuboruvchida qoladi;
 *   5. bir pulni ikki marta jo'natib bo'lmaydi (kutilayotgan chiqim band);
 *   6. qaror ikki marta qabul qilinmaydi (race condition).
 *
 * Ishga tushirish: npm run test:kassa-transfer
 */
process.env.DATABASE_URL = "file:./prisma/test-kassa-transfer.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let transferSvc: any;
let accountsQ: any;
let txQueries: any;
let createTenantWithOwner: any;
let createTransaction: any;

let T: any;
let murod: any;
let javlon: any;
let murodKassa: string;
let javlonKassa: string;
let direktorKassa: string;
let kirimCat: any;

function A<T2>(fn: () => Promise<T2>, aktor?: { userId: string; ism: string }): Promise<T2> {
  return runWithTenant(T.tenant.id, fn, aktor ?? { userId: T.user.id, ism: "Direktor" });
}

const aktor = (u: any, rol = "CASHIER") => ({ userId: u.id, ism: u.ism, rol });
const direktor = () => ({ userId: T.user.id, ism: "Direktor", rol: "OWNER" });

/** Kassa qoldig'i (ledgerdan). */
async function qoldiq(accountId: string): Promise<number> {
  const hammasi = await A(async () => accountsQ.getAccountBalances(T.business.id));
  return hammasi.find((k: any) => k.id === accountId)?.qoldiq ?? 0;
}

async function jamiKassalar(): Promise<number> {
  return A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));
}

/** Biznesning kirim/chiqim jamlari — o'tkazmalar bularni O'ZGARTIRMASLIGI kerak. */
async function moliyaJamlari() {
  return A(async () => {
    const r = await txQueries.listTransactions({ businessId: T.business.id });
    return { kirim: r.totals.kirim, chiqim: r.totals.chiqim, soni: r.total };
  });
}

/** Kassaga naqd kirim yozadi (kassa aniq ko'rsatilgan holda). */
async function kirim(accountId: string, summa: number, userId: string) {
  return A(async () =>
    createTransaction(userId, T.business.id, {
      turi: "kirim",
      categoryId: kirimCat.id,
      summa,
      sana: "2026-08-17",
      tolovTuri: "naqd",
      accountId,
    })
  );
}

async function transferYarat(a: any, data: any) {
  return A(async () => transferSvc.kassaTransferYarat(T.business.id, a, data), {
    userId: a.userId,
    ism: a.ism,
  });
}

async function qaror(a: any, id: string, amal: string) {
  return A(async () => transferSvc.kassaTransferQaror(T.business.id, a, id, { amal }), {
    userId: a.userId,
    ism: a.ism,
  });
}

before(async () => {
  rmSync("prisma/test-kassa-transfer.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  transferSvc = await import("@/lib/services/kassaTransfer");
  accountsQ = await import("@/lib/queries/accounts");
  txQueries = await import("@/lib/queries/transactions");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));

  T = await createTenantWithOwner({
    kompaniyaNomi: "Fortex Selos Test",
    ism: "Direktor",
    login: "+998910100001",
    parol: "parol12345",
  });

  murod = await rawPrisma.user.create({
    data: {
      ism: "Murod",
      login: "+998910100010",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: T.tenant.id,
      businessId: T.business.id,
    },
  });
  javlon = await rawPrisma.user.create({
    data: {
      ism: "Javlon",
      login: "+998910100011",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: T.tenant.id,
      businessId: T.business.id,
    },
  });

  // Uchta shaxsiy kassa — Fortex Selos tuzilishi.
  const kassaYarat = (userId: string, nomi: string) =>
    rawPrisma.account.create({
      data: { businessId: T.business.id, nomi, turi: "naqd", userId, tartib: 10 },
    });
  murodKassa = (await kassaYarat(murod.id, "Murod kassasi")).id;
  javlonKassa = (await kassaYarat(javlon.id, "Javlon kassasi")).id;
  direktorKassa = (await kassaYarat(T.user.id, "Direktor kassasi")).id;

  kirimCat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: T.business.id, turi: "kirim" } })
  );

  // Boshlang'ich holat: Murod 3 250 000, Javlon 5 780 000, Direktor 12 400 000.
  await kirim(murodKassa, 3_250_000, murod.id);
  await kirim(javlonKassa, 5_780_000, javlon.id);
  await kirim(direktorKassa, 12_400_000, T.user.id);
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// Boshlang'ich holat
// ---------------------------------------------------------------------------

test("uchala kassa mustaqil balansga ega", async () => {
  assert.equal(await qoldiq(murodKassa), 3_250_000);
  assert.equal(await qoldiq(javlonKassa), 5_780_000);
  assert.equal(await qoldiq(direktorKassa), 12_400_000);
  assert.equal(await jamiKassalar(), 21_430_000);
});

// ---------------------------------------------------------------------------
// TEST 1 — Javlon → Murod 1 000 000
// ---------------------------------------------------------------------------

test("TEST 1: Javlon → Murod 1 000 000 (tasdiq bilan)", async () => {
  const oldin = await moliyaJamlari();
  const jamiOldin = await jamiKassalar();

  const tr = await transferYarat(aktor(javlon), {
    toAccountId: murodKassa,
    summa: 1_000_000,
  });
  // Qabul qiluvchi boshqa odam — darhol yakunlanmaydi.
  assert.equal(tr.holat, "kutilmoqda");

  // Tasdiqlanmaguncha pul JAVLONDA qoladi.
  assert.equal(await qoldiq(javlonKassa), 5_780_000);
  assert.equal(await qoldiq(murodKassa), 3_250_000);
  assert.equal(await jamiKassalar(), jamiOldin);

  await qaror(aktor(murod), tr.id, "qabul");

  assert.equal(await qoldiq(javlonKassa), 4_780_000);
  assert.equal(await qoldiq(murodKassa), 4_250_000);
  assert.equal(await qoldiq(direktorKassa), 12_400_000);

  // ENG MUHIM: jami pul o'zgarmadi.
  assert.equal(await jamiKassalar(), 21_430_000);

  // TEST 10: o'tkazma daromad sifatida hisoblanmaydi.
  const keyin = await moliyaJamlari();
  assert.deepEqual(keyin, oldin, "o'tkazma kirim/chiqim/yozuvlar soniga tegmasligi kerak");
});

// ---------------------------------------------------------------------------
// TEST 2 — Murod → Direktor 2 000 000
// ---------------------------------------------------------------------------

test("TEST 2: Murod → Direktor 2 000 000", async () => {
  const tr = await transferYarat(aktor(murod), {
    toAccountId: direktorKassa,
    summa: 2_000_000,
  });
  await qaror(direktor(), tr.id, "qabul");

  assert.equal(await qoldiq(murodKassa), 2_250_000);
  assert.equal(await qoldiq(direktorKassa), 14_400_000);
  assert.equal(await jamiKassalar(), 21_430_000);
});

// ---------------------------------------------------------------------------
// TEST 3 — Direktor → Javlon 500 000
// ---------------------------------------------------------------------------

test("TEST 3: Direktor → Javlon 500 000", async () => {
  const tr = await transferYarat(direktor(), {
    toAccountId: javlonKassa,
    summa: 500_000,
  });
  await qaror(aktor(javlon), tr.id, "qabul");

  assert.equal(await qoldiq(direktorKassa), 13_900_000);
  assert.equal(await qoldiq(javlonKassa), 5_280_000);
  assert.equal(await jamiKassalar(), 21_430_000);
});

// ---------------------------------------------------------------------------
// TEST 4 — yetarli mablag' bo'lmaganda
// ---------------------------------------------------------------------------

test("TEST 4: kassada yetarli pul bo'lmasa o'tkazma rad etiladi", async () => {
  const bor = await qoldiq(murodKassa);
  await assert.rejects(
    () => transferYarat(aktor(murod), { toAccountId: javlonKassa, summa: bor + 1 }),
    /yetarli mablag' mavjud emas/
  );
  // Qoldiqlar o'zgarmadi.
  assert.equal(await qoldiq(murodKassa), bor);
  assert.equal(await jamiKassalar(), 21_430_000);
});

test("TEST 4b: manfiy qoldiq hech qachon yuzaga kelmaydi", async () => {
  const hammasi = await A(async () => accountsQ.getAccountBalances(T.business.id));
  for (const k of hammasi) {
    assert.ok(k.qoldiq >= 0, `${k.nomi} manfiy qoldiqqa tushdi: ${k.qoldiq}`);
  }
});

// ---------------------------------------------------------------------------
// TEST 5 — ikki marta jo'natish (double submit / race)
// ---------------------------------------------------------------------------

test("TEST 5: kutilayotgan o'tkazma pulni BAND qiladi — ikki marta jo'natib bo'lmaydi", async () => {
  const bor = await qoldiq(javlonKassa); // 5 280 000

  const birinchi = await transferYarat(aktor(javlon), {
    toAccountId: murodKassa,
    summa: bor,
  });
  assert.equal(birinchi.holat, "kutilmoqda");

  // Qoldiq hali o'sha, lekin MAVJUD pul 0 — ikkinchi o'tkazma o'tmasligi kerak.
  assert.equal(await qoldiq(javlonKassa), bor);
  await assert.rejects(
    () => transferYarat(aktor(javlon), { toAccountId: direktorKassa, summa: 1_000 }),
    /yetarli mablag' mavjud emas/
  );

  // Tozalash: bekor qilamiz.
  await qaror(aktor(javlon), birinchi.id, "bekor");
  assert.equal(await qoldiq(javlonKassa), bor);
});

test("TEST 5b: aynan bir xil o'tkazma ikki marta yaratilmaydi", async () => {
  const birinchi = await transferYarat(aktor(javlon), {
    toAccountId: murodKassa,
    summa: 100_000,
  });
  await assert.rejects(
    () => transferYarat(aktor(javlon), { toAccountId: murodKassa, summa: 100_000 }),
    /allaqachon tasdiq kutmoqda/
  );
  await qaror(aktor(javlon), birinchi.id, "bekor");
});

// ---------------------------------------------------------------------------
// TEST 6-8 — smena topshirish, qabul qilish, rad etish
// ---------------------------------------------------------------------------

test("TEST 6: Javlon smenani topshiradi — holat kutilmoqda", async () => {
  const bor = await qoldiq(javlonKassa);
  const tr = await transferYarat(aktor(javlon), {
    toAccountId: murodKassa,
    summa: bor,
    turi: "smena",
    izoh: "Kechki smena",
  });
  assert.equal(tr.turi, "smena");
  assert.equal(tr.holat, "kutilmoqda");
  assert.equal(tr.fromUserIsm, "Javlon");
  assert.equal(tr.toUserIsm, "Murod");

  // Bir vaqtda ikkinchi smena topshirig'i ochilmaydi.
  await assert.rejects(
    () => transferYarat(aktor(javlon), { toAccountId: direktorKassa, summa: 1, turi: "smena" }),
    /smena topshirig'i bor|yetarli mablag'/
  );

  await qaror(aktor(javlon), tr.id, "bekor");
});

test("TEST 7: Murod smenani qabul qiladi — pul ko'chadi", async () => {
  const javlonOldin = await qoldiq(javlonKassa);
  const murodOldin = await qoldiq(murodKassa);

  const tr = await transferYarat(aktor(javlon), {
    toAccountId: murodKassa,
    summa: javlonOldin,
    turi: "smena",
  });
  await qaror(aktor(murod), tr.id, "qabul");

  assert.equal(await qoldiq(javlonKassa), 0);
  assert.equal(await qoldiq(murodKassa), murodOldin + javlonOldin);
  assert.equal(await jamiKassalar(), 21_430_000);

  const yangilangan = await A(async () =>
    prisma.accountTransfer.findUnique({ where: { id: tr.id } })
  );
  assert.equal(yangilangan.holat, "bajarildi");
  assert.equal(yangilangan.tasdiqlaganIsm, "Murod");
  assert.ok(yangilangan.tasdiqlanganAt);
});

test("TEST 8: Murod smenani rad etadi — pul ko'chmaydi", async () => {
  // Avval Javlonga pul beramiz.
  const t0 = await transferYarat(direktor(), { toAccountId: javlonKassa, summa: 800_000 });
  await qaror(aktor(javlon), t0.id, "qabul");

  const javlonOldin = await qoldiq(javlonKassa);
  const murodOldin = await qoldiq(murodKassa);

  const tr = await transferYarat(aktor(javlon), {
    toAccountId: murodKassa,
    summa: javlonOldin,
    turi: "smena",
  });
  await qaror(aktor(murod), tr.id, "rad");

  assert.equal(await qoldiq(javlonKassa), javlonOldin, "rad etilgan pul yuboruvchida qoladi");
  assert.equal(await qoldiq(murodKassa), murodOldin);
  assert.equal(await jamiKassalar(), 21_430_000);

  const yangilangan = await A(async () =>
    prisma.accountTransfer.findUnique({ where: { id: tr.id } })
  );
  assert.equal(yangilangan.holat, "rad");
  assert.ok(yangilangan.radAt);
});

// ---------------------------------------------------------------------------
// Qaror qaytarilmaydi (idempotentlik / race)
// ---------------------------------------------------------------------------

test("qaror ikki marta qabul qilinmaydi", async () => {
  const tr = await transferYarat(direktor(), { toAccountId: murodKassa, summa: 50_000 });
  await qaror(aktor(murod), tr.id, "qabul");
  await assert.rejects(
    () => qaror(aktor(murod), tr.id, "qabul"),
    /allaqachon qabul qilingan/
  );
});

test("bir vaqtda ikkita qabul — faqat bittasi o'tadi", async () => {
  const murodOldin = await qoldiq(murodKassa);
  const tr = await transferYarat(direktor(), { toAccountId: murodKassa, summa: 70_000 });

  const natijalar = await Promise.allSettled([
    qaror(aktor(murod), tr.id, "qabul"),
    qaror(aktor(murod), tr.id, "qabul"),
  ]);
  const muvaffaqiyat = natijalar.filter((r) => r.status === "fulfilled").length;
  assert.equal(muvaffaqiyat, 1, "faqat bitta qabul o'tishi kerak");
  assert.equal(await qoldiq(murodKassa), murodOldin + 70_000, "pul bir marta ko'chishi kerak");
});

// ---------------------------------------------------------------------------
// TEST 12 — ruxsatlarni chetlab o'tishga urinish
// ---------------------------------------------------------------------------

test("TEST 12a: birovning kassasidan pul chiqarib bo'lmaydi", async () => {
  await assert.rejects(
    () =>
      transferYarat(aktor(javlon), {
        fromAccountId: murodKassa,
        toAccountId: javlonKassa,
        summa: 10_000,
      }),
    /boshqa foydalanuvchiga tegishli/
  );
});

test("TEST 12b: begona o'tkazmani tasdiqlab bo'lmaydi", async () => {
  const tr = await transferYarat(direktor(), { toAccountId: murodKassa, summa: 30_000 });
  await assert.rejects(() => qaror(aktor(javlon), tr.id, "qabul"), /sizga yuborilmagan/);
  await qaror(aktor(murod), tr.id, "qabul");
});

test("TEST 12c: qabul qiluvchi o'tkazmani bekor qila olmaydi (faqat yuboruvchi)", async () => {
  const tr = await transferYarat(direktor(), { toAccountId: javlonKassa, summa: 20_000 });
  await assert.rejects(() => qaror(aktor(javlon), tr.id, "bekor"), /bekor qila olmaysiz/);
  await qaror(aktor(javlon), tr.id, "rad");
});

test("o'z kassasiga o'tkazib bo'lmaydi", async () => {
  await assert.rejects(
    () => transferYarat(aktor(murod), { toAccountId: murodKassa, summa: 1_000 }),
    /o'ziga o'tkazib bo'lmaydi/
  );
});

// ---------------------------------------------------------------------------
// TEST 9 — hisobot
// ---------------------------------------------------------------------------

test("TEST 9: kassalar hisobotida o'tkazma savdoga qo'shilmaydi", async () => {
  const { getKassaHisobot } = await import("@/lib/queries/kassaHisobot");
  const boshlanish = new Date("2020-01-01");
  const tugash = new Date("2100-01-01");
  const hisobot = await A(async () => getKassaHisobot(T.business.id, boshlanish, tugash));

  // Savdo = faqat kirim yozuvlari (3 250 000 + 5 780 000 + 12 400 000).
  assert.equal(hisobot.jamiSavdo, 21_430_000);
  assert.equal(hisobot.jamiXarajat, 0);
  assert.equal(hisobot.jamiBalans, 21_430_000);
  assert.ok(hisobot.transferlar.length > 0, "o'tkazmalar alohida ro'yxatda bo'lishi kerak");
});

// ---------------------------------------------------------------------------
// TEST 11 — audit izi
// ---------------------------------------------------------------------------

test("TEST 11: har o'tkazma va qaror audit jurnaliga tushadi", async () => {
  const loglar = await A(async () =>
    prisma.auditLog.findMany({ where: { entity: "accountTransfer" } })
  );
  assert.ok(loglar.length >= 2, "audit yozuvlari bo'lishi kerak");
  assert.ok(loglar.some((l: any) => l.action === "create"));
  assert.ok(loglar.some((l: any) => l.action === "update"));
});

test("TEST 11b: rad etilgan/bekor qilingan o'tkazma o'chirilmaydi — tarix qoladi", async () => {
  const radEtilganlar = await A(async () =>
    prisma.accountTransfer.findMany({ where: { businessId: T.business.id, holat: "rad" } })
  );
  assert.ok(radEtilganlar.length > 0, "rad etilgan yozuvlar bazada saqlanishi kerak");
});
