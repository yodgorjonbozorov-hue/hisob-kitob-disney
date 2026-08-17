/**
 * BIZNESNI BOSHLANG'ICH HOLATGA QAYTARISH TESTLARI.
 *
 * Invariantlar:
 *   - tozalashdan keyin BARCHA balans va hisobot 0;
 *   - SOZLAMALAR (kategoriya, mahsulot, mijoz, foydalanuvchi) saqlanadi;
 *   - shaxsiy kassalar HAR DOIM qoladi;
 *   - noto'g'ri nom yozilsa hech nima o'chmaydi;
 *   - direktordan boshqa hech kim bajara olmaydi;
 *   - BOSHQA BIZNES tegilmaydi.
 *
 * Ishga tushirish: npm run test:tozalash
 */
process.env.DATABASE_URL = "file:./prisma/test-tozalash.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let accountsQ: any;
let txQueries: any;
let biznesTozala: any;
let createTenantWithOwner: any;
let createTransaction: any;
let kassaTransferYarat: any;

let T: any;
let murod: any;
let ikkinchiBiznes: any;
let murodKassa: string;
let umumiyKassa: string;
let kirimCat: any;

function A<T2>(fn: () => Promise<T2>, aktor?: any): Promise<T2> {
  return runWithTenant(T.tenant.id, fn, aktor ?? { userId: T.user.id, ism: "Direktor" });
}

const direktor = () => ({ userId: T.user.id, ism: "Direktor", rol: "OWNER" });

before(async () => {
  rmSync("prisma/test-tozalash.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  accountsQ = await import("@/lib/queries/accounts");
  txQueries = await import("@/lib/queries/transactions");
  ({ biznesTozala } = await import("@/lib/services/tozalash"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));
  ({ kassaTransferYarat } = await import("@/lib/services/kassaTransfer"));

  T = await createTenantWithOwner({
    kompaniyaNomi: "Tozalash Test",
    ism: "Direktor",
    login: "+998910300001",
    parol: "parol12345",
  });

  murod = await rawPrisma.user.create({
    data: {
      ism: "Murod",
      login: "+998910300010",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: T.tenant.id,
      businessId: T.business.id,
    },
  });

  // Ikkinchi biznes — tozalash unga TEGMASLIGI kerak.
  ikkinchiBiznes = await rawPrisma.business.create({
    data: { nomi: "Tegilmaydigan biznes", tenantId: T.tenant.id },
  });
  const ikkinchiKassa = await rawPrisma.account.create({
    data: { businessId: ikkinchiBiznes.id, nomi: "Naqd kassa", turi: "naqd", tartib: 0 },
  });
  const ikkinchiCat = await rawPrisma.category.create({
    data: { businessId: ikkinchiBiznes.id, nomi: "Sotuv", turi: "kirim" },
  });
  await rawPrisma.transaction.create({
    data: {
      businessId: ikkinchiBiznes.id,
      categoryId: ikkinchiCat.id,
      accountId: ikkinchiKassa.id,
      turi: "kirim",
      summa: 777_000,
      sana: new Date("2026-08-17T00:00:00Z"),
      tolovTuri: "naqd",
      userId: T.user.id,
    },
  });

  kirimCat = await A(async () =>
    prisma.category.findFirst({ where: { businessId: T.business.id, turi: "kirim" } })
  );
  umumiyKassa = (
    await A(async () => prisma.account.findFirst({ where: { businessId: T.business.id } }))
  ).id;
  murodKassa = (
    await rawPrisma.account.create({
      data: {
        businessId: T.business.id,
        nomi: "Murod kassasi",
        turi: "naqd",
        userId: murod.id,
        tartib: 10,
      },
    })
  ).id;

  // TEST MA'LUMOTLARI: kirim + o'tkazma (mijozning sinov holati).
  await A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi: "kirim",
      categoryId: kirimCat.id,
      summa: 100_000,
      sana: "2026-08-17",
      tolovTuri: "naqd",
      accountId: umumiyKassa,
    })
  );
  const tr = await A(async () =>
    kassaTransferYarat(T.business.id, direktor(), {
      fromAccountId: umumiyKassa,
      toAccountId: murodKassa,
      summa: 100_000,
    })
  );
  // Murod qabul qiladi — pul haqiqatda ko'chsin.
  const { kassaTransferQaror } = await import("@/lib/services/kassaTransfer");
  await A(
    async () =>
      kassaTransferQaror(
        T.business.id,
        { userId: murod.id, ism: "Murod", rol: "CASHIER" },
        tr.id,
        { amal: "qabul" }
      ),
    { userId: murod.id, ism: "Murod" }
  );
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("boshlang'ich holat: test puli bor", async () => {
  const q = await A(async () => accountsQ.getAccountBalances(T.business.id));
  assert.equal(q.find((k: any) => k.id === murodKassa).qoldiq, 100_000);
  assert.equal(q.find((k: any) => k.id === umumiyKassa).qoldiq, 0);
  assert.equal(await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id)), 100_000);
});

test("noto'g'ri nom yozilsa hech nima o'chmaydi", async () => {
  await assert.rejects(
    () =>
      A(async () =>
        biznesTozala(T.business.id, direktor(), {
          tasdiqNomi: "Boshqa nom",
          kassalarniOchir: false,
        })
      ),
    /nomi mos kelmadi/
  );
  assert.equal(await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id)), 100_000);
});

test("direktordan boshqa hech kim tozalay olmaydi", async () => {
  await assert.rejects(
    () =>
      A(
        async () =>
          biznesTozala(
            T.business.id,
            { userId: murod.id, ism: "Murod", rol: "CASHIER" },
            { tasdiqNomi: T.business.nomi, kassalarniOchir: false }
          ),
        { userId: murod.id, ism: "Murod" }
      ),
    /faqat direktor/
  );
  assert.equal(await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id)), 100_000);
});

test("tozalash: barcha balans va hisobot 0 bo'ladi", async () => {
  const natija = await A(async () =>
    biznesTozala(T.business.id, direktor(), {
      tasdiqNomi: T.business.nomi,
      kassalarniOchir: true,
    })
  );

  assert.ok(natija.jami > 0, "kamida bir nechta yozuv o'chishi kerak");
  assert.equal(natija.keyingiQoldiq, 0);
  assert.deepEqual(natija.ochirilganKassalar, ["Naqd kassa"]);

  const q = await A(async () => accountsQ.getAccountBalances(T.business.id));
  assert.equal(q.length, 1, "faqat shaxsiy kassa qolishi kerak");
  assert.equal(q[0].id, murodKassa);
  assert.equal(q[0].qoldiq, 0);

  const r = await A(async () => txQueries.listTransactions({ businessId: T.business.id }));
  assert.equal(r.total, 0);
  assert.equal(r.totals.jamiKirim, 0);
  assert.equal(r.totals.jamiChiqim, 0);

  const transferlar = await A(async () => accountsQ.listTransfers(T.business.id, 50));
  assert.equal(transferlar.length, 0);
});

test("SOZLAMALAR saqlanadi: kategoriya va foydalanuvchi qoladi", async () => {
  const kategoriyalar = await A(async () =>
    prisma.category.count({ where: { businessId: T.business.id } })
  );
  assert.ok(kategoriyalar > 0, "kategoriyalar o'chmasligi kerak");

  const xodimlar = await rawPrisma.user.count({ where: { tenantId: T.tenant.id } });
  assert.equal(xodimlar, 2, "foydalanuvchilar o'chmasligi kerak");
});

test("audit jurnali saqlanadi va tozalashning o'zi ham yoziladi", async () => {
  const loglar = await A(async () =>
    prisma.auditLog.findMany({ where: { businessId: T.business.id } })
  );
  assert.ok(loglar.length > 0, "audit jurnali o'chmasligi kerak");
  assert.ok(
    loglar.some((l: any) => l.entity === "business" && (l.after ?? "").includes("tozalash")),
    "tozalash amali audit jurnaliga tushishi kerak"
  );
});

test("BOSHQA BIZNES tegilmaydi", async () => {
  const q = await A(async () => accountsQ.getJamiKassaQoldiq(ikkinchiBiznes.id));
  assert.equal(q, 777_000, "ikkinchi biznesning puli joyida qolishi kerak");

  const soni = await rawPrisma.transaction.count({ where: { businessId: ikkinchiBiznes.id } });
  assert.equal(soni, 1);
});

test("shaxsiy kassa yo'q bo'lsa umumiy kassani o'chirishga yo'l qo'yilmaydi", async () => {
  // Shaxsiy kassani nofaol qilmasdan, uni butunlay o'chirib ko'ramiz —
  // biznes kassasiz qolmasligi kerak.
  await rawPrisma.account.deleteMany({ where: { id: murodKassa } });
  await rawPrisma.account.create({
    data: { businessId: T.business.id, nomi: "Yangi umumiy", turi: "naqd", tartib: 0 },
  });

  await assert.rejects(
    () =>
      A(async () =>
        biznesTozala(T.business.id, direktor(), {
          tasdiqNomi: T.business.nomi,
          kassalarniOchir: true,
        })
      ),
    /Shaxsiy kassa yo'q/
  );

  const qolgan = await A(async () =>
    prisma.account.count({ where: { businessId: T.business.id } })
  );
  assert.equal(qolgan, 1, "kassa o'chirilmasligi kerak");
});

test("tozalash ro'yxati zaxira ro'yxati bilan mos (yozuv xatosi bo'lmasin)", async () => {
  // Modul yuklanishining o'zi tekshiruvni ishga tushiradi — xato nom bo'lsa
  // import paytida yiqiladi. Bu test shu himoyaning o'chib qolmasligini
  // qulflaydi.
  const modul = await import("@/lib/services/tozalash");
  assert.equal(typeof modul.biznesTozala, "function");

  const { ZAXIRA_JADVALLARI } = await import("@/lib/backup/dump");
  assert.ok(ZAXIRA_JADVALLARI.includes("accountTransfer" as never));
  assert.ok(ZAXIRA_JADVALLARI.includes("cashHandover" as never));
});
