/**
 * QARZDORLIK KO'RSATKICHLARI — bosh sahifadagi "Menga qarzdor" kartasi.
 *
 * Asosiy invariant (buzilsa karta yolg'on raqam ko'rsatadi):
 *
 *   olinadigan  = Σ(Debt.jamiSumma − Debt.tolangan),  isYopilgan = false
 *   qarzdorSoni = SHAXSLAR soni (qarz yozuvi soni EMAS)
 *
 * Regressiya himoyasi: karta ilgari `business.omborli` sharti bilan
 * o'ralgan edi va ombori yo'q biznesda har doim 0 ko'rsatardi. Shu bois
 * bu yerdagi test biznesi ATAYLAB `omborli = false`.
 *
 * Ishga tushirish: npm run test:qarzdorlik
 */
process.env.DATABASE_URL = "file:./prisma/test-qarzdorlik.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let qarzSvc: any;
let qarzQ: any;

let T: any;
let T2: any;
let naqdKassa: any;

/** Mijoz nomi → qarz IDsi (testlar orasida ishlatiladi). */
const QARZ: Record<string, string> = {};

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

/** Bosh sahifadagi karta AYNAN shu funksiyadan raqam oladi. */
function jamlar() {
  return A(async () => qarzQ.getQarzJamlari(T.business.id));
}

async function qarzYoz(ism: string, tel: string, summa: number, sana = "2026-08-10") {
  const q = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      mijozNomi: ism,
      mijozTel: tel,
      jamiSumma: summa,
      sana,
    })
  );
  QARZ[ism] = q.id;
  return q;
}

function tolov(ism: string, summa: number, sana = "2026-08-15") {
  return A(async () =>
    qarzSvc.qarzTolov({
      businessId: T.business.id,
      debtId: QARZ[ism],
      userId: T.user.id,
      summa,
      sana,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      idempotencyKey: `test-${ism}-${summa}-${sana}`,
    })
  );
}

before(async () => {
  rmSync("prisma/test-qarzdorlik.db", { force: true });
  rmSync("prisma/test-qarzdorlik.db-journal", { force: true });
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
  qarzQ = await import("@/lib/queries/qarz");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Gul do'koni",
    ism: "Direktor",
    login: "+998900000201",
    parol: "parol12345",
  });
  T2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona biznes",
    ism: "Begona",
    login: "+998900000202",
    parol: "parol12345",
  });

  // OMBORSIZ biznes — aynan shu holatda karta ilgari 0 ko'rsatardi.
  await rawPrisma.business.update({
    where: { id: T.business.id },
    data: { omborli: false },
  });

  const accountsQ = await import("@/lib/queries/accounts");
  naqdKassa = (await A(async () => accountsQ.listAccounts(T.business.id)))[0];
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// Bosh holat
// ---------------------------------------------------------------------------

test("qarz yo'q — karta 0 so'm va 0 ta qarzdor", async () => {
  const j = await jamlar();
  assert.equal(j.olinadigan, 0);
  assert.equal(j.olinadiganSoni, 0);
  assert.equal(j.beriladigan, 0);
  assert.equal(j.beriladiganSoni, 0);
});

// ---------------------------------------------------------------------------
// TEST 1–5 — texnik topshiriqdagi stsenariylar
// ---------------------------------------------------------------------------

test("TEST 1: birinchi mijoz 1 mln qarzdor → 1 000 000 so'm, 1 ta qarzdor", async () => {
  await qarzYoz("Azizbek", "901111111", 1_000_000);
  const j = await jamlar();
  assert.equal(j.olinadigan, 1_000_000);
  assert.equal(j.olinadiganSoni, 1);
});

test("TEST 2: ikkinchi mijoz 2 mln → 3 000 000 so'm, 2 ta qarzdor", async () => {
  await qarzYoz("Bobur", "902222222", 2_000_000);
  const j = await jamlar();
  assert.equal(j.olinadigan, 3_000_000);
  assert.equal(j.olinadiganSoni, 2);
});

test("TEST 3: birinchi mijoz 500 ming to'ladi → 2 500 000 so'm, 2 ta qarzdor", async () => {
  const n = await tolov("Azizbek", 500_000);
  assert.equal(n.qolgan, 500_000);
  assert.equal(n.status, "PARTIALLY_PAID");

  const j = await jamlar();
  assert.equal(j.olinadigan, 2_500_000, "karta to'lov summasiga kamayishi kerak");
  assert.equal(j.olinadiganSoni, 2, "qisman to'lagan mijoz hali ham qarzdor");
});

test("TEST 4: birinchi mijoz qolganini to'laydi → 2 000 000 so'm, 1 ta qarzdor", async () => {
  const n = await tolov("Azizbek", 500_000, "2026-08-16");
  assert.equal(n.qolgan, 0);
  assert.equal(n.status, "PAID");

  const j = await jamlar();
  assert.equal(j.olinadigan, 2_000_000);
  assert.equal(j.olinadiganSoni, 1, "to'lab bo'lgan mijoz qarzdorlar sonidan chiqadi");
});

test("TEST 5: oxirgi mijoz ham to'laydi → 0 so'm, 0 ta qarzdor", async () => {
  await tolov("Bobur", 2_000_000, "2026-08-17");
  const j = await jamlar();
  assert.equal(j.olinadigan, 0);
  assert.equal(j.olinadiganSoni, 0);
});

// ---------------------------------------------------------------------------
// Qarzdor = SHAXS, qarz yozuvi emas
// ---------------------------------------------------------------------------

test("bir mijozning ikki qarzi bitta qarzdor sifatida sanaladi", async () => {
  await qarzYoz("Sardor", "903333333", 1_000_000, "2026-08-11");
  const ikkinchi = await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      mijozNomi: "Sardor",
      mijozTel: "903333333",
      jamiSumma: 750_000,
      sana: "2026-08-12",
    })
  );
  assert.ok(ikkinchi.id);

  const j = await jamlar();
  assert.equal(j.olinadigan, 1_750_000, "ikkala qarz ham jamiga kirishi kerak");
  assert.equal(j.olinadiganSoni, 1, "bir shaxs — bitta qarzdor");

  const royxat = await A(async () => qarzQ.listQarzdorlar(T.business.id));
  assert.equal(royxat.length, 1);
  assert.equal(royxat[0].ism, "Sardor");
  assert.equal(royxat[0].qarz, 1_750_000);
  assert.equal(royxat[0].ochiqSoni, 2);
});

test("qarzdor tafsiloti: barcha qarz va to'lovlar bitta tarixda, qoldiq mos", async () => {
  const royxat = await A(async () => qarzQ.listQarzdorlar(T.business.id));
  const sardor = royxat.find((r: any) => r.ism === "Sardor");
  assert.ok(sardor, "qarzdor ro'yxatda bo'lishi kerak");

  const t = await A(async () =>
    qarzQ.getQarzdorTafsilot(T.business.id, "olinadigan", sardor.kalit)
  );
  assert.equal(t.jamiBerilgan, 1_750_000);
  assert.equal(t.jamiTolangan, 0);
  assert.equal(t.jamiQarz, 1_750_000);
  assert.equal(t.ochiqQarzlar.length, 2);
  assert.equal(t.hodisalar.length, 2, "ikkita qarz hodisasi");
  assert.equal(t.hodisalar.every((h: any) => h.turi === "qarz"), true);

  // Formula: Σ(qarz) − Σ(to'lov) = joriy qoldiq.
  const hisob = t.hodisalar.reduce(
    (acc: number, h: any) => acc + (h.turi === "qarz" ? h.summa : -h.summa),
    0
  );
  assert.equal(hisob, t.jamiQarz);
});

test("to'lovdan keyin tarixda to'lov hodisasi paydo bo'ladi va qoldiq kamayadi", async () => {
  await tolov("Sardor", 250_000, "2026-08-20");

  const royxat = await A(async () => qarzQ.listQarzdorlar(T.business.id));
  const sardor = royxat.find((r: any) => r.ism === "Sardor");
  assert.equal(sardor.qarz, 1_500_000);
  assert.equal(
    sardor.oxirgiTolov?.slice(0, 10),
    "2026-08-20",
    "oxirgi to'lov sanasi ko'rinishi kerak"
  );

  const t = await A(async () =>
    qarzQ.getQarzdorTafsilot(T.business.id, "olinadigan", sardor.kalit)
  );
  assert.equal(t.jamiQarz, 1_500_000);
  assert.equal(t.hodisalar.filter((h: any) => h.turi === "tolov").length, 1);
  const hisob = t.hodisalar.reduce(
    (acc: number, h: any) => acc + (h.turi === "qarz" ? h.summa : -h.summa),
    0
  );
  assert.equal(hisob, 1_500_000, "yuguruvchi qoldiq joriy qarzga teng bo'lishi kerak");

  const j = await jamlar();
  assert.equal(j.olinadigan, 1_500_000, "karta ham darhol kamayishi kerak");
  assert.equal(j.olinadiganSoni, 1);
});

// ---------------------------------------------------------------------------
// Yo'nalishlar aralashmaydi
// ---------------------------------------------------------------------------

test("'men qarzdorman' summasi 'menga qarzdor' ga qo'shilmaydi", async () => {
  await A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "beriladigan",
      mijozNomi: "Ta'minotchi MChJ",
      jamiSumma: 9_000_000,
      sana: "2026-08-13",
    })
  );

  const j = await jamlar();
  assert.equal(j.olinadigan, 1_500_000, "olinadigan o'zgarmasligi kerak");
  assert.equal(j.olinadiganSoni, 1);
  assert.equal(j.beriladigan, 9_000_000);
  assert.equal(j.beriladiganSoni, 1);
  assert.equal(j.sof, 1_500_000 - 9_000_000);

  const faqatOlinadigan = await A(async () =>
    qarzQ.listQarzdorlar(T.business.id, { turi: "olinadigan" })
  );
  assert.equal(faqatOlinadigan.length, 1);
  assert.equal(faqatOlinadigan[0].ism, "Sardor");
});

// ---------------------------------------------------------------------------
// Bekor qilingan qarz va tenant izolyatsiyasi
// ---------------------------------------------------------------------------

test("bekor qilingan qarz jamiga ham, qarzdorlar soniga ham kirmaydi", async () => {
  const oldin = await jamlar();
  const q = await qarzYoz("Xato Yozuv", "904444444", 5_000_000, "2026-08-14");
  const orada = await jamlar();
  assert.equal(orada.olinadigan, oldin.olinadigan + 5_000_000);
  assert.equal(orada.olinadiganSoni, oldin.olinadiganSoni + 1);

  await A(async () =>
    qarzSvc.qarzBekor({
      businessId: T.business.id,
      debtId: q.id,
      userId: T.user.id,
      sabab: "Xato kiritilgan",
    })
  );

  const keyin = await jamlar();
  assert.equal(keyin.olinadigan, oldin.olinadigan, "bekor qilingan qarz jamidan chiqadi");
  assert.equal(keyin.olinadiganSoni, oldin.olinadiganSoni);
});

test("boshqa tenantning qarzi ko'rinmaydi", async () => {
  await runWithTenant(
    T2.tenant.id,
    async () =>
      qarzSvc.createQarz({
        businessId: T2.business.id,
        userId: T2.user.id,
        turi: "olinadigan",
        mijozNomi: "Begona mijoz",
        mijozTel: "905555555",
        jamiSumma: 77_000_000,
        sana: "2026-08-14",
      }),
    { userId: T2.user.id, ism: "Begona" }
  );

  const bizniki = await jamlar();
  assert.equal(bizniki.olinadigan, 1_500_000, "begona qarz bizning kartaga qo'shilmasligi kerak");
  assert.equal(bizniki.olinadiganSoni, 1);

  const begona = await runWithTenant(T2.tenant.id, async () =>
    qarzQ.getQarzJamlari(T2.business.id)
  );
  assert.equal(begona.olinadigan, 77_000_000);
  assert.equal(begona.olinadiganSoni, 1);

  const royxat = await A(async () => qarzQ.listQarzdorlar(T.business.id));
  assert.equal(
    royxat.some((r: any) => r.ism === "Begona mijoz"),
    false
  );
});

test("boshqa tenantning qarzdor tafsiloti o'qilmaydi", async () => {
  const begonaRoyxat = await runWithTenant(T2.tenant.id, async () =>
    qarzQ.listQarzdorlar(T2.business.id)
  );
  const kalit = begonaRoyxat[0].kalit;

  const natija = await A(async () =>
    qarzQ.getQarzdorTafsilot(T.business.id, "olinadigan", kalit)
  );
  assert.equal(natija, null, "begona qarzdor tafsiloti null bo'lishi kerak");
});

// ---------------------------------------------------------------------------
// Ma'lumot yaxlitligi
// ---------------------------------------------------------------------------

test("qarzdan ortiq to'lov qabul qilinmaydi (manfiy qoldiq bo'lmaydi)", async () => {
  await assert.rejects(
    () => tolov("Sardor", 99_000_000, "2026-08-21"),
    /qolgan qarzdan ko'p/i
  );
  const j = await jamlar();
  assert.equal(j.olinadigan, 1_500_000, "rad etilgan to'lov jamini o'zgartirmasligi kerak");
});

test("takror yuborilgan to'lov ikki marta hisoblanmaydi", async () => {
  const kalit = "takror-kalit-12345678";
  const yubor = () =>
    A(async () =>
      qarzSvc.qarzTolov({
        businessId: T.business.id,
        debtId: QARZ["Sardor"],
        userId: T.user.id,
        summa: 100_000,
        sana: "2026-08-22",
        tolovTuri: "naqd",
        accountId: naqdKassa.id,
        idempotencyKey: kalit,
      })
    );

  const birinchi = await yubor();
  assert.equal(birinchi.yangiTolov, true);
  const ikkinchi = await yubor();
  assert.equal(ikkinchi.yangiTolov, false, "takror so'rov yangi to'lov yozmasligi kerak");

  const j = await jamlar();
  assert.equal(j.olinadigan, 1_400_000, "qarz faqat bir marta kamayishi kerak");

  const soni = await A(async () =>
    prisma.debtPayment.count({
      where: { businessId: T.business.id, debtId: QARZ["Sardor"], idempotencyKey: kalit },
    })
  );
  assert.equal(soni, 1);
});

test("qarz yaratish kirim tranzaksiyasi yozmaydi — pul faqat to'lovda keladi", async () => {
  const oldin = await A(async () =>
    prisma.transaction.count({ where: { businessId: T.business.id, turi: "kirim", deletedAt: null } })
  );
  await qarzYoz("Yangi Mijoz", "906666666", 3_000_000, "2026-08-23");
  const keyin = await A(async () =>
    prisma.transaction.count({ where: { businessId: T.business.id, turi: "kirim", deletedAt: null } })
  );
  assert.equal(keyin, oldin, "qarz kirim yaratmasligi kerak");

  const j = await jamlar();
  assert.equal(j.olinadigan, 4_400_000);
  assert.equal(j.olinadiganSoni, 2);
});
