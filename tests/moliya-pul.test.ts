/**
 * MOLIYA — "PUL OLDIM / PUL BERDIM" OQIMI.
 *
 * Asosiy invariantlar (buzilsa mahsulot yolg'on hisobot beradi):
 *
 *   Oddiy chiqim       →  kassa −N,  qarz YARATILMAYDI
 *   Mijoz qarzi to'lovi →  kassa +N,  qarz qoldig'i −N
 *   Ta'minotchi to'lovi →  kassa −N,  qarz qoldig'i −N
 *   Takror bosish       →  ikkinchi so'rov YANGI yozuv yozmaydi
 *   Tuzatish            →  kassa yangi summaga to'g'rilanadi
 *   Bekor qilish        →  kassa qaytadi, qarz oldingi holatiga tiklanadi
 *
 * Ishga tushirish: npm run test:moliya-pul
 */
process.env.DATABASE_URL = "file:./prisma/test-moliya-pul.db";

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
let moliyaQ: any;

let T: any;
let naqdKassa: any;
let terminalKassa: any;

const SANA = "2026-09-05";

function A<T2>(fn: () => Promise<T2>): Promise<T2> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

const qoldiq = () => A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));

const kassaQoldigi = (id: string) =>
  A(async () => {
    const hammasi = await accountsQ.getAccountBalances(T.business.id);
    return hammasi.find((k: any) => k.id === id)?.qoldiq ?? 0;
  });

const qarzQoldigi = (debtId: string) =>
  A(async () => {
    const d = await prisma.debt.findUnique({ where: { id: debtId } });
    return { qolgan: d.jamiSumma - d.tolangan, status: d.status, isYopilgan: d.isYopilgan };
  });

function pul(qism: Record<string, unknown>) {
  return A(async () =>
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

before(async () => {
  for (const f of ["prisma/test-moliya-pul.db", "prisma/test-moliya-pul.db-journal"]) {
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
  moliyaQ = await import("@/lib/queries/moliya");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Moliya test",
    ism: "Direktor",
    login: "+998900000301",
    parol: "parol12345",
  });

  const kassalar = await A(async () => accountsQ.listAccounts(T.business.id));
  naqdKassa = kassalar[0];
  terminalKassa = await A(async () =>
    accountsSvc.createAccount(T.business.id, { nomi: "Terminal", turi: "plastik" })
  );
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1 — Oddiy chiqim: kassa kamayadi, qarz yaratilmaydi (9 va 15/3-talab)
// ---------------------------------------------------------------------------

test("oddiy chiqim: kassa −300 000, qarz yaratilmaydi", async () => {
  const oldin = await qoldiq();
  const qarzlarOldin = await A(async () => prisma.debt.count({ where: { businessId: T.business.id } }));

  const n = await pul({
    yonalish: "chiqim",
    shaxsTuri: "shaxs",
    shaxsIsm: "Bekzod",
    sababKod: "xarajat",
    summa: 300_000,
  });

  assert.equal(n.yangi, true);
  assert.equal(n.transactionIds.length, 1);
  assert.equal(n.qarz, null, "oddiy chiqim qarzga tegmaydi");
  assert.equal(await qoldiq(), oldin - 300_000);
  assert.equal(
    await A(async () => prisma.debt.count({ where: { businessId: T.business.id } })),
    qarzlarOldin,
    "hech qanday qarz yozuvi yaratilmaydi"
  );

  const yozuv = await A(async () =>
    prisma.transaction.findUnique({ where: { id: n.transactionIds[0] }, include: { category: true } })
  );
  assert.equal(yozuv.shaxsTuri, "shaxs");
  assert.equal(yozuv.shaxsIsm, "Bekzod");
  assert.equal(yozuv.pulUsuli, "naqd");
  assert.equal(yozuv.category.nomi, "Xarajat");
});

// ---------------------------------------------------------------------------
// 2 — Takror bosish: ikkinchi so'rov yangi yozuv yozmaydi (16-talab)
// ---------------------------------------------------------------------------

test("takror bosish yangi yozuv yozmaydi", async () => {
  const kalit = randomUUID();
  const asos = {
    businessId: T.business.id,
    userId: T.user.id,
    yonalish: "chiqim" as const,
    shaxsTuri: "shaxs" as const,
    shaxsIsm: "Usta",
    sababKod: "xarajat",
    summa: 120_000,
    sana: SANA,
    usul: "naqd" as const,
    amalId: kalit,
  };

  const birinchi = await A(async () => pulOqimi.pulHarakatiYoz(asos));
  const oldin = await qoldiq();
  const ikkinchi = await A(async () => pulOqimi.pulHarakatiYoz(asos));

  assert.equal(birinchi.yangi, true);
  assert.equal(ikkinchi.yangi, false, "ikkinchi so'rov yangi yozuv emas");
  assert.deepEqual(ikkinchi.transactionIds, birinchi.transactionIds);
  assert.equal(await qoldiq(), oldin, "kassa ikki marta kamaymaydi");
});

// ---------------------------------------------------------------------------
// 3 — Mijoz qarzini to'ladi: kassa +N, qarz −N (8 va 15/1-talab)
// ---------------------------------------------------------------------------

let mijozQarzId = "";
let mijozAmalId = "";
let mijozContactId = "";

test("mijoz qarzini to'ladi: kassa +2 mln, qarz 5 mln → 3 mln", async () => {
  // Kartochka ATAYLAB oldindan ochiladi: qarz kartochkaga bog'lansa u
  // ism yozilishidan (registr, bo'shliq) mustaqil bo'ladi — moliya oqimi
  // ham aynan shu bog'lanishdan yuradi (`qarzdorKalit`).
  const mijoz = await A(async () =>
    prisma.contact.create({
      data: {
        businessId: T.business.id,
        ism: "Aziz",
        tel: "+998901112233",
        createdBy: T.user.id,
      },
    })
  );
  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      contactId: mijoz.id,
      mijozNomi: "Aziz",
      mijozTel: "+998901112233",
      jamiSumma: 5_000_000,
      sana: SANA,
    })
  );
  assert.equal(qarz.contactId, mijoz.id, "qarz kartochkaga bog'landi");
  mijozQarzId = qarz.id;
  mijozContactId = mijoz.id;

  const kassaOldin = await kassaQoldigi(naqdKassa.id);
  const n = await pul({
    yonalish: "kirim",
    shaxsTuri: "mijoz",
    shaxsId: qarz.contactId,
    shaxsIsm: "Aziz",
    sababKod: "mijoz-qarz",
    summa: 2_000_000,
    accountId: naqdKassa.id,
  });
  mijozAmalId = n.amalId;

  assert.equal(n.qarz.oldin, 5_000_000);
  assert.equal(n.qarz.keyin, 3_000_000);
  assert.equal(await kassaQoldigi(naqdKassa.id), kassaOldin + 2_000_000);

  const holat = await qarzQoldigi(mijozQarzId);
  assert.equal(holat.qolgan, 3_000_000);
  assert.equal(holat.status, "PARTIALLY_PAID", "qisman to'lov ishlaydi");
});

// ---------------------------------------------------------------------------
// 4 — Ta'minotchi qarzini to'lash: kassa −N, qarz −N (15/2-talab)
// ---------------------------------------------------------------------------

let taminotQarzId = "";

test("ta'minotchi qarzini to'lash: kassa −3 mln, qarz 7 mln → 4 mln", async () => {
  const supplier = await A(async () =>
    prisma.supplier.create({ data: { businessId: T.business.id, nomi: "Toshkent Optom" } })
  );
  const qarz = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "beriladigan",
      mijozNomi: "Toshkent Optom",
      jamiSumma: 7_000_000,
      sana: SANA,
    })
  );
  taminotQarzId = qarz.id;

  const kassaOldin = await kassaQoldigi(naqdKassa.id);
  const n = await pul({
    yonalish: "chiqim",
    shaxsTuri: "taminotchi",
    shaxsId: supplier.id,
    shaxsIsm: "Toshkent Optom",
    sababKod: "taminotchi-qarz",
    summa: 3_000_000,
    accountId: naqdKassa.id,
  });

  assert.equal(n.qarz.oldin, 7_000_000);
  assert.equal(n.qarz.keyin, 4_000_000);
  assert.equal(await kassaQoldigi(naqdKassa.id), kassaOldin - 3_000_000);
  assert.equal((await qarzQoldigi(taminotQarzId)).qolgan, 4_000_000);
});

// ---------------------------------------------------------------------------
// 5 — Qarzdan ortiq to'lov RAD ETILADI (yashirin avans yaratilmaydi)
// ---------------------------------------------------------------------------

test("qarzdan ortiq to'lov rad etiladi", async () => {
  await assert.rejects(
    () =>
      pul({
        yonalish: "kirim",
        shaxsTuri: "mijoz",
        shaxsId: null,
        shaxsIsm: "Aziz",
        sababKod: "mijoz-qarz",
        summa: 99_000_000,
      }),
    /ko'p|yo'q/i
  );
});

// ---------------------------------------------------------------------------
// 6 — To'lov usuli kassaga MOS tanlanadi (6 va 7-talab)
// ---------------------------------------------------------------------------

test("terminal to'lovi plastik kassaga tushadi", async () => {
  const oldin = await kassaQoldigi(terminalKassa.id);
  const n = await pul({
    yonalish: "kirim",
    shaxsTuri: "mijoz",
    shaxsIsm: "Chakana xaridor",
    sababKod: "savdo",
    summa: 500_000,
    usul: "terminal",
  });
  assert.equal(n.accountId, terminalKassa.id, "kassa tanlanmasa usulga mos kassa olinadi");
  assert.equal(await kassaQoldigi(terminalKassa.id), oldin + 500_000);
});

// ---------------------------------------------------------------------------
// 7 — Tuzatish: kassa yangi summaga to'g'rilanadi (11-talab)
// ---------------------------------------------------------------------------

test("tuzatish: 2 mln kirim 1,5 mln ga o'zgarsa kassa 500 ming kamayadi", async () => {
  const kassaOldin = await kassaQoldigi(naqdKassa.id);
  const qarzOldin = (await qarzQoldigi(mijozQarzId)).qolgan;

  const yangi = await A(async () =>
    tuzatish.pulHarakatiTahrirla({
      businessId: T.business.id,
      userId: T.user.id,
      amalId: mijozAmalId,
      yonalish: "kirim",
      shaxsTuri: "mijoz",
      shaxsId: mijozContactId,
      shaxsIsm: "Aziz",
      sababKod: "mijoz-qarz",
      summa: 1_500_000,
      sana: SANA,
      usul: "naqd",
      accountId: naqdKassa.id,
    })
  );

  assert.equal(await kassaQoldigi(naqdKassa.id), kassaOldin - 500_000, "kassa o'zi to'g'rilanadi");
  assert.equal(
    (await qarzQoldigi(mijozQarzId)).qolgan,
    qarzOldin + 500_000,
    "qarz ham qayta to'g'rilanadi"
  );
  assert.notEqual(yangi.amalId, mijozAmalId, "tuzatilgan amal yangi kalit oladi");
  mijozAmalId = yangi.amalId;
});

// ---------------------------------------------------------------------------
// 8 — Bekor qilish: kassa qaytadi, qarz tiklanadi (12-talab)
// ---------------------------------------------------------------------------

test("bekor qilish: kassa qaytadi, qarz oldingi holatiga tiklanadi", async () => {
  const kassaOldin = await kassaQoldigi(naqdKassa.id);
  const qarzOldin = (await qarzQoldigi(mijozQarzId)).qolgan;

  const n = await A(async () =>
    tuzatish.pulHarakatiBekor({
      businessId: T.business.id,
      userId: T.user.id,
      amalId: mijozAmalId,
      sabab: "Xato kiritilgan",
    })
  );

  assert.equal(n.qarzTolovSoni, 1);
  assert.equal(n.qarzgaQaytdi, 1_500_000);
  assert.equal(await kassaQoldigi(naqdKassa.id), kassaOldin - 1_500_000);

  const holat = await qarzQoldigi(mijozQarzId);
  assert.equal(holat.qolgan, qarzOldin + 1_500_000);
  assert.equal(holat.status, "OPEN", "to'lovsiz qolgan qarz yana ochiladi");
  assert.equal(holat.isYopilgan, false);

  await assert.rejects(
    () =>
      A(async () =>
        tuzatish.pulHarakatiBekor({
          businessId: T.business.id,
          userId: T.user.id,
          amalId: mijozAmalId,
        })
      ),
    /topilmadi|bekor/i,
    "ikki marta bekor qilinmaydi"
  );
});

// ---------------------------------------------------------------------------
// 9 — Ro'yxat: tomon, usul, kassa va kim kiritgani ko'rinadi (1-talab)
// ---------------------------------------------------------------------------

test("ro'yxatda kimdan/kimga, sabab, usul, kassa va kim kiritgani bor", async () => {
  const royxat = await A(async () =>
    moliyaQ.listPulHarakatlari({ businessId: T.business.id, pageSize: 50 })
  );
  const bekzod = royxat.items.find((i: any) => i.shaxsIsm === "Bekzod");
  assert.ok(bekzod, "oddiy chiqim ro'yxatda");
  assert.equal(bekzod.yonalish, "chiqim");
  assert.equal(bekzod.sabab, "Xarajat");
  assert.equal(bekzod.usul, "naqd");
  assert.equal(bekzod.kiritgan, "Direktor");
  assert.equal(bekzod.qarzBogliq, false);
  assert.equal(bekzod.tahrirlanadi, true);

  const taminot = royxat.items.find((i: any) => i.shaxsIsm === "Toshkent Optom");
  assert.equal(taminot.qarzBogliq, true, "qarz to'lovi belgilanadi");

  // Bekor qilingan amal ro'yxatdan chiqadi (soft delete).
  assert.equal(
    royxat.items.some((i: any) => i.amalId === mijozAmalId),
    false
  );
});

// ---------------------------------------------------------------------------
// 10 — Tomon qidiruvi joriy qarzni ko'rsatadi (10-talab)
// ---------------------------------------------------------------------------

test("tomon qidiruvi joriy qarz bilan qaytadi", async () => {
  const mijozlar = await A(async () => moliyaQ.shaxsQidiruv(T.business.id, "mijoz", "Aziz"));
  assert.equal(mijozlar.length, 1);
  assert.equal(mijozlar[0].ism, "Aziz");
  assert.equal(mijozlar[0].qarz, 5_000_000, "bekor qilingandan keyin qarz to'liq qaytdi");

  const taminotchilar = await A(async () =>
    moliyaQ.shaxsQidiruv(T.business.id, "taminotchi", "Toshkent")
  );
  assert.equal(taminotchilar[0].qarz, 4_000_000);
});

// ---------------------------------------------------------------------------
// 11 — Tenant izolyatsiyasi: boshqa biznesning tomonini yozib bo'lmaydi
// ---------------------------------------------------------------------------

test("boshqa biznesning mijozi bilan yozuv rad etiladi", async () => {
  const boshqa = await createTenantWithOwner({
    kompaniyaNomi: "Begona",
    ism: "Begona egasi",
    login: "+998900000302",
    parol: "parol12345",
  });
  const begonaMijoz = await runWithTenant(
    boshqa.tenant.id,
    async () =>
      prisma.contact.create({
        data: { businessId: boshqa.business.id, ism: "Begona mijoz", createdBy: boshqa.user.id },
      }),
    { userId: boshqa.user.id, ism: "Begona egasi" }
  );

  await assert.rejects(
    () =>
      pul({
        yonalish: "kirim",
        shaxsTuri: "mijoz",
        shaxsId: begonaMijoz.id,
        shaxsIsm: "Begona mijoz",
        sababKod: "savdo",
        summa: 100_000,
      }),
    /tegishli emas/i
  );
});
