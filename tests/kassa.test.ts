/**
 * KASSA VA HISOB-RAQAMLAR TESTLARI (Faza 4.1).
 *
 * Asosiy invariant: kassa qoldig'i = kirim − chiqim + kirgan transfer − chiqqan transfer.
 * Pul ko'chirish ATAYLAB tranzaksiya yozmaydi — aks holda kunlik aylanma
 * sun'iy oshib ketardi. Shu ikkalasi shu yerda tekshiriladi.
 *
 * Ishga tushirish: npm run test:kassa
 */
process.env.DATABASE_URL = "file:./prisma/test-kassa.db";

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
let createTenantWithOwner: any;
let createTransaction: any;

let tA: any;
let tB: any;
let naqd: any;
let plastik: any;

const AKTOR = { userId: "", ism: "Direktor" };

function A<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(tA.tenant.id, fn, { ...AKTOR, userId: tA.user.id });
}

before(async () => {
  rmSync("prisma/test-kassa.db", { force: true });
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
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Kassa A",
    ism: "A egasi",
    login: "+998900000001",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Kassa B",
    ism: "B egasi",
    login: "+998900000002",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Default kassa ----------

test("signup har biznesga default 'Naqd kassa' ochadi", async () => {
  const royxat = await A(async () => accountsQ.listAccounts(tA.business.id));
  assert.equal(royxat.length, 1);
  assert.equal(royxat[0].nomi, accountsSvc.DEFAULT_KASSA_NOMI);
  assert.equal(royxat[0].turi, "naqd");
  naqd = royxat[0];
});

test("yangi kassa ochiladi, takroriy nom rad etiladi", async () => {
  plastik = await A(async () =>
    accountsSvc.createAccount(tA.business.id, { nomi: "Terminal", turi: "plastik" })
  );
  assert.equal(plastik.turi, "plastik");

  await assert.rejects(
    () => A(async () => accountsSvc.createAccount(tA.business.id, { nomi: "Terminal", turi: "bank" })),
    /allaqachon bor/
  );
});

// ---------- Qoldiq hisobi ----------

test("tranzaksiya kassaga bog'lanadi, qoldiq to'g'ri hisoblanadi", async () => {
  const kirimCat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: tA.business.id, turi: "kirim" } })
  );
  const chiqimCat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: tA.business.id, turi: "chiqim" } })
  );

  // Naqd kassaga: +1 000 000 va −300 000
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 1_000_000, sana: "2026-07-01", accountId: naqd.id,
    })
  );
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "chiqim", categoryId: chiqimCat.id, summa: 300_000, sana: "2026-07-02", accountId: naqd.id,
    })
  );
  // Plastikka: +500 000
  await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: kirimCat.id, summa: 500_000, sana: "2026-07-03", accountId: plastik.id,
    })
  );

  const qoldiqlar = await A(async () => accountsQ.getAccountBalances(tA.business.id));
  const n = qoldiqlar.find((q: any) => q.id === naqd.id);
  const p = qoldiqlar.find((q: any) => q.id === plastik.id);
  assert.equal(n.kirim, 1_000_000);
  assert.equal(n.chiqim, 300_000);
  assert.equal(n.qoldiq, 700_000);
  assert.equal(p.qoldiq, 500_000);

  const jami = await A(async () => accountsQ.getJamiKassaQoldiq(tA.business.id));
  assert.equal(jami, 1_200_000);
});

test("accountId berilmasa birinchi faol kassa tanlanadi", async () => {
  const cat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: tA.business.id, turi: "kirim" } })
  );
  const tx = await A(async () =>
    createTransaction(tA.user.id, tA.business.id, {
      turi: "kirim", categoryId: cat.id, summa: 100_000, sana: "2026-07-04",
    })
  );
  assert.equal(tx.accountId, naqd.id, "birinchi (tartib 0) kassa tanlanishi kerak");
});

// ---------- Pul ko'chirish ----------

test("transfer qoldiqlarni ko'chiradi, LEKIN kirim/chiqimga ta'sir qilmaydi", async () => {
  const oldin = await A(async () => dashboard.getMonthSummary(tA.business.id, "2026-07"));

  await A(async () =>
    accountsSvc.createTransfer(tA.business.id, tA.user.id, {
      fromAccountId: naqd.id,
      toAccountId: plastik.id,
      summa: 200_000,
      sana: "2026-07-05",
      izoh: "Bankka topshirildi",
    })
  );

  const qoldiqlar = await A(async () => accountsQ.getAccountBalances(tA.business.id));
  const n = qoldiqlar.find((q: any) => q.id === naqd.id);
  const p = qoldiqlar.find((q: any) => q.id === plastik.id);
  assert.equal(n.chiqqanTransfer, 200_000);
  assert.equal(p.kirganTransfer, 200_000);
  // 700 000 + 100 000 (accountId'siz yozuv) − 200 000
  assert.equal(n.qoldiq, 600_000);
  assert.equal(p.qoldiq, 700_000);

  // Eng muhimi: hisobotdagi aylanma O'ZGARMAGAN.
  const keyin = await A(async () => dashboard.getMonthSummary(tA.business.id, "2026-07"));
  assert.equal(keyin.jamiKirim, oldin.jamiKirim, "ko'chirish kirim yozmasligi kerak");
  assert.equal(keyin.jamiChiqim, oldin.jamiChiqim, "ko'chirish chiqim yozmasligi kerak");

  // Jami qoldiq ham o'zgarmaydi — pul biznes ichida qoldi.
  assert.equal(await A(async () => accountsQ.getJamiKassaQoldiq(tA.business.id)), 1_300_000);
});

test("bitta kassaning o'ziga ko'chirish rad etiladi", async () => {
  const { transferSchema } = await import("@/lib/validation/account");
  const natija = transferSchema.safeParse({
    fromAccountId: naqd.id,
    toAccountId: naqd.id,
    summa: 1000,
    sana: "2026-07-05",
  });
  assert.equal(natija.success, false);
});

test("nofaol kassa bilan pul ko'chirib bo'lmaydi", async () => {
  const vaqtinchalik = await A(async () =>
    accountsSvc.createAccount(tA.business.id, { nomi: "Eski kassa", turi: "bank" })
  );
  await A(async () => accountsSvc.updateAccount(tA.business.id, vaqtinchalik.id, { isActive: false }));

  await assert.rejects(
    () =>
      A(async () =>
        accountsSvc.createTransfer(tA.business.id, tA.user.id, {
          fromAccountId: naqd.id, toAccountId: vaqtinchalik.id, summa: 1000, sana: "2026-07-06",
        })
      ),
    /Nofaol kassa/
  );
});

// ---------- Himoya qoidalari ----------

test("yozuvi bor kassani o'chirib bo'lmaydi", async () => {
  await assert.rejects(
    () => A(async () => accountsSvc.deleteAccount(tA.business.id, naqd.id)),
    /o'chirib bo'lmaydi/
  );
});

test("oxirgi faol kassani nofaol qilib bo'lmaydi", async () => {
  const bTenant = await runWithTenant(tB.tenant.id, async () =>
    accountsQ.listAccounts(tB.business.id, true)
  );
  assert.equal(bTenant.length, 1, "B tenantda bitta kassa");

  await assert.rejects(
    () =>
      runWithTenant(tB.tenant.id, async () =>
        accountsSvc.updateAccount(tB.business.id, bTenant[0].id, { isActive: false })
      ),
    /Oxirgi faol kassani/
  );
});

// ---------- Tenant izolyatsiyasi ----------

test("B tenant A ning kassalarini ko'rmaydi va ularga yoza olmaydi", async () => {
  const bKassalar = await runWithTenant(tB.tenant.id, async () =>
    accountsQ.listAccounts(tB.business.id)
  );
  assert.ok(!bKassalar.some((k: any) => k.id === naqd.id));

  // A ning kassasi B ning biznesida ishlatilmaydi.
  await assert.rejects(() =>
    runWithTenant(tB.tenant.id, async () =>
      accountsSvc.updateAccount(tB.business.id, naqd.id, { nomi: "Hack" })
    )
  );

  const bQoldiq = await runWithTenant(tB.tenant.id, async () =>
    accountsQ.getAccountBalances(tB.business.id)
  );
  assert.equal(bQoldiq.reduce((a: number, q: any) => a + q.qoldiq, 0), 0);
});

test("boshqa biznes kassasiga tranzaksiya yozib bo'lmaydi", async () => {
  const bCat = await runWithTenant(tB.tenant.id, async () =>
    prisma.category.findFirst({ where: { businessId: tB.business.id, turi: "kirim" } })
  );
  await assert.rejects(
    () =>
      runWithTenant(tB.tenant.id, async () =>
        createTransaction(tB.user.id, tB.business.id, {
          turi: "kirim", categoryId: bCat.id, summa: 1000, sana: "2026-07-01", accountId: naqd.id,
        })
      ),
    /Kassa topilmadi/
  );
});
