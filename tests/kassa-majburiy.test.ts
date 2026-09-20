/**
 * KASSA MAJBURIY VA KASSANI TUZATISH — TESTLAR (audit K-1, K-2).
 *
 * Auditda ikki Critical topilgan:
 *
 *   K-1. Kirim/Chiqim formasida kassa maydoni "Tanlang..." bo'sh turganda
 *        ham yozuv saqlanardi va server uni JIMGINA foydalanuvchining
 *        shaxsiy kassasiga yozardi. Aynan shu yo'l bilan Direktor kassasi
 *        −17 450 000 ga tushgan: pul umumiy yashikda, yozuv esa shaxsiy
 *        kassada.
 *   K-2. Tahrir formasida Kassa maydoni umuman yo'q edi — xato kassaga
 *        tushgan pulni UI orqali to'g'rilab bo'lmasdi.
 *
 * Bu fayl ikkala qoidani ham server qatlamida isbotlaydi:
 *
 *   A. `webKassaId` — web formalaridan kelgan kassa: majburiy, shu
 *      biznesniki, faol. Boshqa tenant kassasi ko'rinmaydi ham.
 *   B. `standartKassalar` — formada oldindan tanlanadigan kassa serverdagi
 *      yozish qoidasi bilan AYNI (ekranda ko'ringan kassa = yoziladigan kassa).
 *   C. `kassaYangilanishi` — tahrirdagi kassa qoidasi.
 *   D. LEDGER MATEMATIKASI — kassani almashtirish pulni IKKI MARTA
 *      yozmaydi: qoldiq saqlanmaydi, u har safar ledgerdan hisoblanadi.
 *   E. AUDIT IZI — kassa almashgani eski va yangi qiymat bilan jurnalga
 *      tushadi (kim va qachon — kontekstdan).
 *   F. TIZIM YO'LI BUZILMAYDI — bot/import/CRM ishlatadigan
 *      `createTransaction` avvalgidek standart kassani o'zi tanlaydi.
 *
 * Ishga tushirish: npm run test:kassa-majburiy
 */
process.env.DATABASE_URL = "file:./prisma/test-kassa-majburiy.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let createTransaction: any;
let kassaTalab: any;
let accountsSvc: any;
let accountsQ: any;

let T: any;
let boshqaT: any;
let xodim: any;
let naqdKassa: any;
let plastikKassa: any;
let nofaolKassa: any;
let boshqaTenantKassa: any;
let katKirim: any;
let katChiqim: any;

const SANA = "2026-09-20";

/** T tenant konteksti (prisma so'rovlari shu tenantga cheklanadi). */
function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

function qoldiq(kassaId: string, royxat: any[]): number {
  return royxat.find((k) => k.id === kassaId)?.qoldiq ?? 0;
}

before(async () => {
  for (const f of ["prisma/test-kassa-majburiy.db", "prisma/test-kassa-majburiy.db-journal"]) {
    rmSync(f, { force: true });
  }
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  // Audit AVTOMATIK yoziladi — faqat tenant-scoped `prisma` orqali
  // (lib/db/tenantDb.ts extension'i). Route ham aynan shuni ishlatadi.
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));
  kassaTalab = await import("@/lib/services/kassaTalab");
  accountsSvc = await import("@/lib/services/accounts");
  accountsQ = await import("@/lib/queries/accounts");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy",
    ism: "Direktor",
    login: "+998900000701",
    parol: "parol12345",
  });
  boshqaT = await createTenantWithOwner({
    kompaniyaNomi: "Begona biznes",
    ism: "Begona",
    login: "+998900000702",
    parol: "parol12345",
  });

  xodim = await rawPrisma.user.create({
    data: {
      tenantId: T.tenant.id,
      businessId: T.business.id,
      ism: "Fayruza",
      login: "+998900000703",
      parolHash: "x",
      rol: "CASHIER",
    },
  });

  naqdKassa = (await A(async () => accountsQ.listAccounts(T.business.id)))[0];
  plastikKassa = await A(async () =>
    accountsSvc.createAccount(T.business.id, { nomi: "Terminal", turi: "plastik" })
  );
  nofaolKassa = await A(async () =>
    accountsSvc.createAccount(T.business.id, { nomi: "Eski kassa", turi: "naqd" })
  );
  await rawPrisma.account.update({ where: { id: nofaolKassa.id }, data: { isActive: false } });

  boshqaTenantKassa = (
    await runWithTenant(boshqaT.tenant.id, async () => accountsQ.listAccounts(boshqaT.business.id), {
      userId: boshqaT.user.id,
      ism: "Begona",
    })
  )[0];

  katKirim = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Bezak", turi: "kirim" },
  });
  katChiqim = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Xarajat", turi: "chiqim" },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
  for (const f of ["prisma/test-kassa-majburiy.db", "prisma/test-kassa-majburiy.db-journal"]) {
    rmSync(f, { force: true });
  }
});

// ---------------------------------------------------------------------------
// A. Kassa majburiyligi (web formalari)
// ---------------------------------------------------------------------------

test("kassa berilmasa — aniq xato, jimgina boshqa kassaga yozilmaydi", async () => {
  await assert.rejects(
    () => A(async () => kassaTalab.webKassaId({ businessId: T.business.id, tolovTuri: "naqd" })),
    (e: Error) => e.message === kassaTalab.KASSA_TANLANMADI,
    "bo'sh kassa 'Kassani tanlang' xatosini berishi kerak"
  );
  // Bo'sh satr ham, faqat probel ham — kassa emas.
  for (const bosh of ["", "   "]) {
    await assert.rejects(() =>
      A(async () =>
        kassaTalab.webKassaId({ businessId: T.business.id, accountId: bosh, tolovTuri: "naqd" })
      )
    );
  }
});

test("mavjud bo'lmagan kassa rad etiladi", async () => {
  await assert.rejects(
    () =>
      A(async () =>
        kassaTalab.webKassaId({
          businessId: T.business.id,
          accountId: "yoq_kassa_id",
          tolovTuri: "naqd",
        })
      ),
    /topilmadi/i
  );
});

test("BOSHQA TENANT kassasi rad etiladi (cross-tenant bog'lanish mumkin emas)", async () => {
  await assert.rejects(
    () =>
      A(async () =>
        kassaTalab.webKassaId({
          businessId: T.business.id,
          accountId: boshqaTenantKassa.id,
          tolovTuri: "naqd",
        })
      ),
    /topilmadi/i
  );
});

test("NOFAOL kassaga yangi yozuv yozilmaydi", async () => {
  await assert.rejects(
    () =>
      A(async () =>
        kassaTalab.webKassaId({
          businessId: T.business.id,
          accountId: nofaolKassa.id,
          tolovTuri: "naqd",
        })
      ),
    /nofaol/i
  );
});

test("to'g'ri kassa qabul qilinadi; QARZ kassasiz qoladi", async () => {
  const id = await A(async () =>
    kassaTalab.webKassaId({
      businessId: T.business.id,
      accountId: naqdKassa.id,
      tolovTuri: "naqd",
    })
  );
  assert.equal(id, naqdKassa.id);

  // Qarz — pul kassaga tushmagan: kassa so'ralmaydi va null bo'ladi.
  const qarz = await A(async () =>
    kassaTalab.webKassaId({ businessId: T.business.id, tolovTuri: "qarz" })
  );
  assert.equal(qarz, null);
  assert.equal(kassaTalab.kassaKerakmi("qarz"), false);
  assert.equal(kassaTalab.kassaKerakmi("naqd"), true);
  assert.equal(kassaTalab.kassaKerakmi(null), true, "tursiz yozuvda ham kassa so'raladi");
});

// ---------------------------------------------------------------------------
// B. Formadagi standart tanlov = serverdagi yozish qoidasi
// ---------------------------------------------------------------------------

test("standartKassalar: naqd → naqd kassa, click → plastik kassa", async () => {
  const s = await A(async () => accountsSvc.standartKassalar(T.business.id, T.user.id));
  assert.equal(s.naqd, naqdKassa.id);
  assert.equal(s.click, plastikKassa.id, "Click puli naqd kassaga tushmasligi kerak");
  assert.equal(
    s.naqd,
    await A(async () => accountsSvc.resolveAccountId(T.business.id, null, "naqd", T.user.id)),
    "forma va server AYNI kassani tanlashi shart"
  );
});

test("shaxsiy kassa rejimida standart naqd kassa — xodimning o'z kassasi", async () => {
  const shaxsiy = await A(async () =>
    accountsSvc.createAccount(T.business.id, { nomi: "Fayruza kassasi", turi: "naqd" })
  );
  await rawPrisma.account.update({ where: { id: shaxsiy.id }, data: { userId: xodim.id } });
  await rawPrisma.business.update({
    where: { id: T.business.id },
    data: { shaxsiyKassa: true },
  });
  try {
    const s = await A(async () => accountsSvc.standartKassalar(T.business.id, xodim.id));
    assert.equal(s.naqd, shaxsiy.id, "naqd pul xodimning o'z kassasiga");
    assert.equal(s.click, plastikKassa.id, "Click esa terminalda qoladi");
  } finally {
    await rawPrisma.business.update({
      where: { id: T.business.id },
      data: { shaxsiyKassa: false },
    });
    await rawPrisma.account.update({ where: { id: shaxsiy.id }, data: { isActive: false } });
  }
});

// ---------------------------------------------------------------------------
// C. Tahrirdagi kassa qoidasi
// ---------------------------------------------------------------------------

function yangilanish(patch: Record<string, unknown>) {
  return A(async () =>
    kassaTalab.kassaYangilanishi({
      businessId: T.business.id,
      mavjudAccountId: naqdKassa.id,
      mavjudUserId: T.user.id,
      tolovTuriKeldi: true,
      yakuniyTolov: "naqd",
      ...patch,
    })
  );
}

test("tahrir: kassa A → B", async () => {
  assert.deepEqual(await yangilanish({ yangiAccountId: plastikKassa.id }), {
    accountId: plastikKassa.id,
  });
});

test("tahrir: bir xil kassa saqlansa qiymat o'zgarmaydi", async () => {
  assert.deepEqual(await yangilanish({ yangiAccountId: naqdKassa.id }), {
    accountId: naqdKassa.id,
  });
});

test("tahrir: kassa yuborilmasa bog'lanish tegilmaydi", async () => {
  assert.deepEqual(await yangilanish({ tolovTuriKeldi: false }), {});
  assert.deepEqual(await yangilanish({ tolovTuriKeldi: true }), {}, "mavjud kassa saqlanadi");
});

test("tahrir: boshqa tenant / nofaol kassaga ko'chirib bo'lmaydi", async () => {
  await assert.rejects(() => yangilanish({ yangiAccountId: boshqaTenantKassa.id }), /topilmadi/i);
  await assert.rejects(() => yangilanish({ yangiAccountId: nofaolKassa.id }), /nofaol/i);
});

test("tahrir: qarzga o'tsa kassa bog'lanishi uziladi", async () => {
  assert.deepEqual(await yangilanish({ yakuniyTolov: "qarz" }), { accountId: null });
  assert.deepEqual(
    await yangilanish({ yakuniyTolov: "qarz", mavjudAccountId: null }),
    {},
    "allaqachon kassasiz bo'lsa o'zgartirish yo'q"
  );
});

test("tahrir: qarzdan naqdga qaytganda mos kassa qayta bog'lanadi", async () => {
  assert.deepEqual(await yangilanish({ mavjudAccountId: null, yakuniyTolov: "click" }), {
    accountId: plastikKassa.id,
  });
});

// ---------------------------------------------------------------------------
// D. Ledger matematikasi — kassa ko'chganda pul IKKI MARTA yozilmaydi
// ---------------------------------------------------------------------------

test("kassani almashtirish: eski kassadan chiqadi, yangisiga qo'shiladi, JAMI o'zgarmaydi", async () => {
  const yoz = (turi: "kirim" | "chiqim", summa: number, accountId: string) =>
    A(async () =>
      createTransaction(T.user.id, T.business.id, {
        turi,
        categoryId: turi === "kirim" ? katKirim.id : katChiqim.id,
        summa,
        sana: SANA,
        tolovTuri: "naqd",
        accountId,
      })
    );

  const t1 = await yoz("kirim", 1_000_000, naqdKassa.id);
  await yoz("kirim", 400_000, naqdKassa.id);
  await yoz("chiqim", 100_000, naqdKassa.id);

  const oldin = await A(async () => accountsQ.getAccountBalances(T.business.id));
  const jamiOldin = oldin.reduce((a: number, k: any) => a + k.qoldiq, 0);
  assert.equal(qoldiq(naqdKassa.id, oldin), 1_300_000);
  assert.equal(qoldiq(plastikKassa.id, oldin), 0);

  // 1 000 000 lik kirim xato kassaga tushgan edi — terminalga ko'chiramiz.
  await A(async () =>
    rawPrisma.transaction.update({
      where: { id: t1.id },
      data: { accountId: plastikKassa.id, tolovTuri: "click" },
    })
  );

  const keyin = await A(async () => accountsQ.getAccountBalances(T.business.id));
  assert.equal(qoldiq(naqdKassa.id, keyin), 300_000, "eski kassadan chiqdi");
  assert.equal(qoldiq(plastikKassa.id, keyin), 1_000_000, "yangi kassaga tushdi");
  assert.equal(
    keyin.reduce((a: number, k: any) => a + k.qoldiq, 0),
    jamiOldin,
    "biznesning jami puli o'zgarmasligi shart — tuzatish yozuvi yaratilmaydi"
  );
  assert.equal(
    await A(async () => rawPrisma.transaction.count({ where: { businessId: T.business.id } })),
    3,
    "kassani ko'chirish YANGI yozuv yaratmaydi"
  );

  // Summa va kassa BIRGA o'zgarsa ham matematika to'g'ri qoladi.
  await A(async () =>
    rawPrisma.transaction.update({
      where: { id: t1.id },
      data: { accountId: naqdKassa.id, tolovTuri: "naqd", summa: 250_000 },
    })
  );
  const uchinchi = await A(async () => accountsQ.getAccountBalances(T.business.id));
  assert.equal(qoldiq(naqdKassa.id, uchinchi), 550_000, "300 000 + 250 000");
  assert.equal(qoldiq(plastikKassa.id, uchinchi), 0);
});

// ---------------------------------------------------------------------------
// E. Audit izi — eski kassa, yangi kassa, kim, qachon
// ---------------------------------------------------------------------------

test("kassa almashgani audit jurnaliga eski va yangi qiymat bilan tushadi", async () => {
  const t = await A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi: "kirim",
      categoryId: katKirim.id,
      summa: 77_000,
      sana: SANA,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
    })
  );
  // Route bilan AYNI yo'l: tenant-scoped klient — audit shundan yoziladi.
  await A(async () =>
    prisma.transaction.update({
      where: { id: t.id },
      data: { accountId: plastikKassa.id },
    })
  );

  const yozuvlar = await rawPrisma.auditLog.findMany({
    where: { entity: "transaction", entityId: t.id, action: "update" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(yozuvlar.length > 0, "kassa o'zgarishi auditsiz qolmasligi kerak");
  const oxirgi = yozuvlar[0];
  const oldin = JSON.parse(oxirgi.before ?? "{}");
  const keyin = JSON.parse(oxirgi.after ?? "{}");
  assert.equal(oldin.accountId, naqdKassa.id, "eski kassa saqlanadi");
  assert.equal(keyin.accountId, plastikKassa.id, "yangi kassa saqlanadi");
  assert.equal(oxirgi.userId, T.user.id, "kim o'zgartirgani saqlanadi");
  assert.ok(oxirgi.createdAt instanceof Date, "qachon o'zgartirilgani saqlanadi");
});

// ---------------------------------------------------------------------------
// F. Tizim yo'li buzilmaydi (bot, import, CRM, oylik, qarz to'lovi)
// ---------------------------------------------------------------------------

test("createTransaction kassasiz ham ishlaydi — bot va import yo'li o'zgarmadi", async () => {
  const t = await A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi: "chiqim",
      categoryId: katChiqim.id,
      summa: 5_000,
      sana: SANA,
      tolovTuri: "naqd",
    })
  );
  assert.equal(
    t.accountId,
    naqdKassa.id,
    "tizim yozuvi avvalgidek to'lov turiga mos kassaga tushadi"
  );
});
