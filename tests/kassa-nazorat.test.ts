/**
 * KASSALAR NAZORAT MARKAZI — SAHIFA MANTIG'I TESTLARI.
 *
 * Kassalar sahifasi oltita savolga javob beradi va shu testlar har birining
 * RAQAMI to'g'ri ekanini tekshiradi:
 *   1. jami qoldiq va har kassaning qoldig'i;
 *   2. bugungi kirim / chiqim / sof;
 *   3. o'tkazma — pulning joyi o'zgaradi, biznes kirim/chiqimi O'ZGARMAYDI;
 *   4. kassani topshirish va KASSA FARQI (kamomad) muzlatilishi;
 *   5. tenant/biznes izolyatsiyasi va huquqlar;
 *   6. ikki marta yuborish / ikki marta qabul qilishdan himoya.
 *
 * Ishga tushirish: npm run test:kassa-nazorat
 */
process.env.DATABASE_URL = "file:./prisma/test-kassa-nazorat.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let transferSvc: any;
let accountsSvc: any;
let nazoratQ: any;
let detalQ: any;
let accountsQ: any;
let txQueries: any;
let createTenantWithOwner: any;
let createTransaction: any;
let guard: any;

let T: any;
let boshqaT: any;
let kassir: any;
let kassirKassa: string;
let direktorKassa: string;
let bankKassa: string;
let boshqaKassa: string;
let kirimCat: any;
let chiqimCat: any;

function A<T2>(fn: () => Promise<T2>, aktor?: { userId: string; ism: string }): Promise<T2> {
  return runWithTenant(T.tenant.id, fn, aktor ?? { userId: T.user.id, ism: "Direktor" });
}

const aktor = (u: any, rol = "CASHIER") => ({ userId: u.id, ism: u.ism, rol });
const direktor = () => ({ userId: T.user.id, ism: "Direktor", rol: "OWNER" });

async function nazorat() {
  return A(async () => nazoratQ.getKassaNazorat(T.business.id));
}

async function karta(id: string) {
  const n = await nazorat();
  return n.kartalar.find((k: any) => k.id === id);
}

async function yozuv(
  accountId: string,
  turi: "kirim" | "chiqim",
  summa: number,
  userId: string
) {
  return A(async () =>
    createTransaction(userId, T.business.id, {
      turi,
      categoryId: turi === "kirim" ? kirimCat.id : chiqimCat.id,
      summa,
      sana: new Date().toISOString().slice(0, 10),
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

async function qaror(a: any, id: string, amal: string, izoh?: string) {
  return A(
    async () =>
      transferSvc.kassaTransferQaror(T.business.id, a, id, { amal, qarorIzoh: izoh }),
    { userId: a.userId, ism: a.ism }
  );
}

/** Biznesning kirim/chiqim jamlari — o'tkazma bularni buzmasligi kerak. */
async function moliyaJamlari() {
  return A(async () => {
    const r = await txQueries.listTransactions({ businessId: T.business.id });
    return { kirim: r.totals.jamiKirim, chiqim: r.totals.jamiChiqim, soni: r.total };
  });
}

before(async () => {
  rmSync("prisma/test-kassa-nazorat.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  transferSvc = await import("@/lib/services/kassaTransfer");
  accountsSvc = await import("@/lib/services/accounts");
  nazoratQ = await import("@/lib/queries/kassaNazorat");
  detalQ = await import("@/lib/queries/kassaDetal");
  accountsQ = await import("@/lib/queries/accounts");
  txQueries = await import("@/lib/queries/transactions");
  guard = await import("@/lib/auth/guard");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));

  T = await createTenantWithOwner({
    kompaniyaNomi: "Nazorat Test",
    ism: "Direktor",
    login: "+998910200001",
    parol: "parol12345",
  });
  boshqaT = await createTenantWithOwner({
    kompaniyaNomi: "Begona Biznes",
    ism: "Begona egasi",
    login: "+998910200002",
    parol: "parol12345",
  });

  kassir = await rawPrisma.user.create({
    data: {
      ism: "Fayruza",
      login: "+998910200010",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: T.tenant.id,
      businessId: T.business.id,
    },
  });

  const kassaYarat = (nomi: string, turi: string, userId: string | null) =>
    rawPrisma.account.create({
      data: { businessId: T.business.id, nomi, turi, userId, tartib: 10 },
    });
  kassirKassa = (await kassaYarat("Fayruza kassasi", "naqd", kassir.id)).id;
  direktorKassa = (await kassaYarat("Direktor kassasi", "naqd", T.user.id)).id;
  bankKassa = (await kassaYarat("Bank hisobi", "bank", null)).id;

  boshqaKassa = (
    await rawPrisma.account.findFirst({ where: { businessId: boshqaT.business.id } })
  ).id;

  [kirimCat, chiqimCat] = await A(async () => [
    await prisma.category.findFirst({ where: { businessId: T.business.id, turi: "kirim" } }),
    await prisma.category.findFirst({ where: { businessId: T.business.id, turi: "chiqim" } }),
  ]);

  // Boshlang'ich holat (hammasi BUGUN kiritiladi — "bugungi" raqamlar shundan):
  //   Fayruza: +3 000 000 kirim, −500 000 chiqim  => 2 500 000
  //   Direktor: +10 000 000                        => 10 000 000
  //   Bank: +5 000 000                             => 5 000 000
  await yozuv(kassirKassa, "kirim", 3_000_000, kassir.id);
  await yozuv(kassirKassa, "chiqim", 500_000, kassir.id);
  await yozuv(direktorKassa, "kirim", 10_000_000, T.user.id);
  await yozuv(bankKassa, "kirim", 5_000_000, T.user.id);
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1. BALANS
// ---------------------------------------------------------------------------

test("har kassaning qoldig'i va JAMI QOLDIQ to'g'ri", async () => {
  const n = await nazorat();
  assert.equal((await karta(kassirKassa)).qoldiq, 2_500_000);
  assert.equal((await karta(direktorKassa)).qoldiq, 10_000_000);
  assert.equal((await karta(bankKassa)).qoldiq, 5_000_000);
  assert.equal(n.jamiQoldiq, 17_500_000);

  // Dashboard bilan AYNI raqam — sahifa boshqa javob bermaydi.
  const jami = await A(async () => accountsQ.getJamiKassaQoldiq(T.business.id));
  assert.equal(n.jamiQoldiq, jami);
});

test("qoldiq kassa turlari bo'yicha taqsimlanadi", async () => {
  const n = await nazorat();
  const naqd = n.turBoyicha.find((t: any) => t.turi === "naqd");
  const bank = n.turBoyicha.find((t: any) => t.turi === "bank");
  assert.equal(naqd.summa, 12_500_000);
  assert.equal(bank.summa, 5_000_000);
  assert.equal(
    n.turBoyicha.reduce((a: number, t: any) => a + t.summa, 0),
    n.jamiQoldiq
  );
});

test("bugungi kirim / chiqim / sof to'g'ri", async () => {
  const n = await nazorat();
  assert.equal(n.bugungiKirim, 18_000_000);
  assert.equal(n.bugungiChiqim, 500_000);
  assert.equal(n.bugungiSof, 17_500_000);

  const k = await karta(kassirKassa);
  assert.equal(k.bugungiKirim, 3_000_000);
  assert.equal(k.bugungiChiqim, 500_000);
  assert.equal(k.bugungiSof, 2_500_000);
});

// ---------------------------------------------------------------------------
// 2. O'TKAZMA
// ---------------------------------------------------------------------------

test("Kassa A → Kassa B 1 mln: pul ko'chadi, kirim/chiqim O'ZGARMAYDI", async () => {
  const oldinMoliya = await moliyaJamlari();
  const oldinJami = (await nazorat()).jamiQoldiq;
  const oldinYozuv = await A(async () =>
    prisma.accountTransfer.count({ where: { businessId: T.business.id } })
  );

  const tr = await transferYarat(direktor(), {
    fromAccountId: direktorKassa,
    toAccountId: bankKassa,
    summa: 1_000_000,
  });
  // Umumiy (egasiz) kassaga o'tkazma tasdiq talab qilmaydi — darhol yakunlanadi.
  assert.equal(tr.holat, "bajarildi");

  assert.equal((await karta(direktorKassa)).qoldiq, 9_000_000);
  assert.equal((await karta(bankKassa)).qoldiq, 6_000_000);
  assert.equal((await nazorat()).jamiQoldiq, oldinJami, "jami pul o'zgarmasligi kerak");

  assert.deepEqual(await moliyaJamlari(), oldinMoliya, "o'tkazma kirim/chiqimga tegmaydi");

  const keyinYozuv = await A(async () =>
    prisma.accountTransfer.count({ where: { businessId: T.business.id } })
  );
  assert.equal(keyinYozuv, oldinYozuv + 1, "bitta harakat yozuvi bo'lishi kerak");

  // Oddiy o'tkazmada kassa farqi umuman yozilmaydi.
  assert.equal(tr.hisoblangan, null);
  assert.equal(tr.farq, null);
});

test("bugungi o'tkazma kassa kartasida ALOHIDA ko'rinadi (kirim/chiqimga qo'shilmaydi)", async () => {
  const bank = await karta(bankKassa);
  assert.equal(bank.bugungiKirgan, 1_000_000);
  assert.equal(bank.bugungiKirim, 5_000_000, "o'tkazma kirimga qo'shilmasligi kerak");
  const dir = await karta(direktorKassa);
  assert.equal(dir.bugungiChiqqan, 1_000_000);
  assert.equal(dir.bugungiChiqim, 0);
});

// ---------------------------------------------------------------------------
// 3. KASSANI TOPSHIRISH VA KASSA FARQI
// ---------------------------------------------------------------------------

test("kamomad bilan topshirish: farq MUZLATILADI, pul hali ko'chmaydi", async () => {
  const tizim = (await karta(kassirKassa)).mavjud; // 2 500 000
  assert.equal(tizim, 2_500_000);

  const tr = await transferYarat(aktor(kassir), {
    fromAccountId: kassirKassa,
    toAccountId: direktorKassa,
    summa: 2_450_000,
    turi: "smena",
    izoh: "Mijozga qaytim ortiqcha berildi",
  });

  assert.equal(tr.holat, "kutilmoqda");
  assert.equal(tr.hisoblangan, 2_500_000, "tizim qoldig'i qatorga muzlatiladi");
  assert.equal(tr.farq, -50_000, "farq = topshirilgan − tizim");

  // Tasdiqlanmaguncha pul KASSIRDA.
  assert.equal((await karta(kassirKassa)).qoldiq, 2_500_000);
  assert.equal((await karta(kassirKassa)).mavjud, 50_000, "topshirilayotgan pul band");
  assert.equal((await karta(kassirKassa)).topshirishKutmoqda, true);

  // Direktor panelida farq bilan ko'rinadi.
  const n = await nazorat();
  const kutilayotgan = n.kutilayotganlar.find((t: any) => t.id === tr.id);
  assert.ok(kutilayotgan, "topshiriq kutilayotganlar ro'yxatida bo'lishi kerak");
  assert.equal(kutilayotgan.farq, -50_000);
  assert.equal(kutilayotgan.hisoblangan, 2_500_000);

  // Qaror kutayotganda kassaga YANGI pul tushsa ham farq o'zgarmaydi.
  await yozuv(kassirKassa, "kirim", 200_000, kassir.id);
  const n2 = await nazorat();
  assert.equal(n2.kutilayotganlar.find((t: any) => t.id === tr.id).farq, -50_000);

  // Direktor qabul qiladi.
  await qaror(direktor(), tr.id, "qabul");
  assert.equal(
    (await karta(kassirKassa)).qoldiq,
    250_000,
    "kamomad (50 000) + keyin tushgan 200 000 kassirda qoladi"
  );
  assert.equal((await karta(direktorKassa)).qoldiq, 9_000_000 + 2_450_000);
});

test("farq bo'lsa SABAB majburiy — izohsiz topshiriq rad etiladi", async () => {
  await assert.rejects(
    () =>
      transferYarat(aktor(kassir), {
        fromAccountId: kassirKassa,
        toAccountId: direktorKassa,
        summa: 100_000,
        turi: "smena",
      }),
    /sababini yozing/
  );
});

test("farqsiz topshirishda izoh talab qilinmaydi va kassa 0 ga tushadi", async () => {
  const tizim = (await karta(kassirKassa)).mavjud;
  const dirOldin = (await karta(direktorKassa)).qoldiq;

  const tr = await transferYarat(aktor(kassir), {
    fromAccountId: kassirKassa,
    toAccountId: direktorKassa,
    summa: tizim,
    turi: "smena",
  });
  assert.equal(tr.farq, 0);

  await qaror(direktor(), tr.id, "qabul");
  assert.equal((await karta(kassirKassa)).qoldiq, 0, "hammasi topshirilsa kassa 0 bo'ladi");
  assert.equal((await karta(direktorKassa)).qoldiq, dirOldin + tizim);
});

test("tizim hisobidan KO'P topshirib bo'lmaydi (manfiy qoldiq taqiqlangan)", async () => {
  await yozuv(kassirKassa, "kirim", 300_000, kassir.id);
  await assert.rejects(
    () =>
      transferYarat(aktor(kassir), {
        fromAccountId: kassirKassa,
        toAccountId: direktorKassa,
        summa: 350_000,
        turi: "smena",
        izoh: "ortiqcha",
      }),
    /yetarli mablag' mavjud emas/
  );
  assert.equal((await karta(kassirKassa)).qoldiq, 300_000);
});

test("rad etilgan topshirishda pul topshiruvchida qoladi", async () => {
  const oldin = (await karta(kassirKassa)).qoldiq;
  const tr = await transferYarat(aktor(kassir), {
    fromAccountId: kassirKassa,
    toAccountId: direktorKassa,
    summa: oldin,
    turi: "smena",
  });
  await qaror(direktor(), tr.id, "rad", "Pul sanoqda kam chiqdi");

  assert.equal((await karta(kassirKassa)).qoldiq, oldin);
  const yozuvi = await A(async () =>
    prisma.accountTransfer.findUnique({ where: { id: tr.id } })
  );
  assert.equal(yozuvi.holat, "rad");
  assert.equal(yozuvi.qarorIzoh, "Pul sanoqda kam chiqdi");
  assert.equal(yozuvi.farq, 0, "tarixiy farq o'chirilmaydi");
});

// ---------------------------------------------------------------------------
// 4. TAKRORLASHDAN HIMOYA
// ---------------------------------------------------------------------------

test("bir xil o'tkazma ikki marta yuborilmaydi (double submit)", async () => {
  const birinchi = await transferYarat(aktor(kassir), {
    fromAccountId: kassirKassa,
    toAccountId: direktorKassa,
    summa: 100_000,
  });
  await assert.rejects(
    () =>
      transferYarat(aktor(kassir), {
        fromAccountId: kassirKassa,
        toAccountId: direktorKassa,
        summa: 100_000,
      }),
    /allaqachon tasdiq kutmoqda/
  );
  await qaror(aktor(kassir), birinchi.id, "bekor");
});

test("bir vaqtda ikkita qabul — faqat bittasi o'tadi (double accept)", async () => {
  const dirOldin = (await karta(direktorKassa)).qoldiq;
  const tr = await transferYarat(aktor(kassir), {
    fromAccountId: kassirKassa,
    toAccountId: direktorKassa,
    summa: 70_000,
  });

  const natijalar = await Promise.allSettled([
    qaror(direktor(), tr.id, "qabul"),
    qaror(direktor(), tr.id, "qabul"),
  ]);
  assert.equal(
    natijalar.filter((r) => r.status === "fulfilled").length,
    1,
    "faqat bitta qabul o'tishi kerak"
  );
  assert.equal((await karta(direktorKassa)).qoldiq, dirOldin + 70_000);
});

test("bir vaqtda ikkita ochiq topshiriq bo'lmaydi", async () => {
  await yozuv(kassirKassa, "kirim", 400_000, kassir.id);
  const birinchi = await transferYarat(aktor(kassir), {
    fromAccountId: kassirKassa,
    toAccountId: direktorKassa,
    summa: 100_000,
    turi: "smena",
    izoh: "qisman",
  });
  await assert.rejects(
    () =>
      transferYarat(aktor(kassir), {
        fromAccountId: kassirKassa,
        toAccountId: direktorKassa,
        summa: 50_000,
        turi: "smena",
        izoh: "yana",
      }),
    /smena topshirig'i bor/
  );
  await qaror(aktor(kassir), birinchi.id, "bekor");
});

// ---------------------------------------------------------------------------
// 5. XAVFSIZLIK — TENANT / BIZNES IZOLYATSIYASI VA HUQUQLAR
// ---------------------------------------------------------------------------

test("boshqa biznesning kassasi nazorat sahifasida KO'RINMAYDI", async () => {
  const n = await nazorat();
  assert.equal(
    n.kartalar.some((k: any) => k.id === boshqaKassa),
    false
  );
  // Boshqa biznesning puli jami qoldiqqa ham qo'shilmaydi.
  await runWithTenant(
    boshqaT.tenant.id,
    async () =>
      createTransaction(boshqaT.user.id, boshqaT.business.id, {
        turi: "kirim",
        categoryId: (
          await prisma.category.findFirst({
            where: { businessId: boshqaT.business.id, turi: "kirim" },
          })
        ).id,
        summa: 99_000_000,
        sana: new Date().toISOString().slice(0, 10),
        tolovTuri: "naqd",
        accountId: boshqaKassa,
      }),
    { userId: boshqaT.user.id, ism: "Begona egasi" }
  );
  const keyin = await nazorat();
  assert.equal(keyin.jamiQoldiq, n.jamiQoldiq, "begona biznes puli qo'shilmasligi kerak");
});

test("boshqa biznesning kassasiga pul o'tkazib BO'LMAYDI", async () => {
  await assert.rejects(
    () =>
      transferYarat(direktor(), {
        fromAccountId: direktorKassa,
        toAccountId: boshqaKassa,
        summa: 1_000,
      }),
    /topilmadi yoki boshqa biznesga tegishli/
  );
  await assert.rejects(
    () =>
      transferYarat(direktor(), {
        fromAccountId: boshqaKassa,
        toAccountId: direktorKassa,
        summa: 1_000,
      }),
    /topilmadi yoki boshqa biznesga tegishli/
  );
});

test("boshqa biznesning kassa detali ochilmaydi", async () => {
  const detal = await A(async () => detalQ.getKassaDetal(T.business.id, boshqaKassa));
  assert.equal(detal, null, "begona kassa detali null bo'lishi kerak (sahifa 404 beradi)");
});

test("kassir birovning kassasidan pul chiqara olmaydi", async () => {
  await assert.rejects(
    () =>
      transferYarat(aktor(kassir), {
        fromAccountId: direktorKassa,
        toAccountId: kassirKassa,
        summa: 10_000,
      }),
    /boshqa foydalanuvchiga tegishli/
  );
});

test("kassir/sotuvchi yangi kassa ocha olmaydi, boshqaruvchi ochadi", async () => {
  // Route guard'i (`requireManager`) — yangi kassa API'sida aynan shu ishlatiladi.
  assert.throws(() => guard.requireManager("CASHIER"));
  assert.throws(() => guard.requireManager("SELLER"));
  assert.doesNotThrow(() => guard.requireManager("OWNER"));
  assert.doesNotThrow(() => guard.requireManager("ADMIN"));

  const yangi = await A(async () =>
    accountsSvc.createAccount(T.business.id, { nomi: "Terminal", turi: "plastik" })
  );
  assert.equal(yangi.businessId, T.business.id);
});

test("begona o'tkazma bo'yicha qaror qabul qilinmaydi", async () => {
  const tr = await transferYarat(direktor(), {
    fromAccountId: direktorKassa,
    toAccountId: kassirKassa,
    summa: 30_000,
  });
  // Begona egasi O'Z tenanti va O'Z biznesida turib bizning o'tkazmamiz
  // ustidan qaror qilmoqchi — o'tkazma uning biznesida umuman topilmaydi.
  const begona = { userId: boshqaT.user.id, ism: "Begona egasi", rol: "OWNER" };
  await assert.rejects(
    () =>
      runWithTenant(
        boshqaT.tenant.id,
        async () =>
          transferSvc.kassaTransferQaror(boshqaT.business.id, begona, tr.id, { amal: "qabul" }),
        { userId: begona.userId, ism: begona.ism }
      ),
    /topilmadi/
  );
  await qaror(aktor(kassir), tr.id, "qabul");
});

// ---------------------------------------------------------------------------
// 6. AUDIT
// ---------------------------------------------------------------------------

test("topshirish va farq AUDIT jurnaliga tushadi", async () => {
  const loglar = await A(async () =>
    prisma.auditLog.findMany({ where: { entity: "accountTransfer" } })
  );
  const farqli = loglar
    .map((l: any) => JSON.parse(l.after ?? "{}"))
    .filter((a: any) => a.farq === -50_000);
  assert.ok(farqli.length >= 1, "kamomad auditda ko'rinishi kerak");
  assert.ok(
    farqli.some((a: any) => a.izoh === "Mijozga qaytim ortiqcha berildi"),
    "kamomad sababi auditda saqlanadi"
  );
});

test("yangi kassa auditga yoziladi", async () => {
  const loglar = await A(async () => prisma.auditLog.findMany({ where: { entity: "account" } }));
  assert.ok(
    loglar.some((l: any) => l.action === "create"),
    "kassa ochilishi audit jurnalida bo'lishi kerak"
  );
});

// ---------------------------------------------------------------------------
// 7. DAVR FILTRI (sof funksiyalar)
// ---------------------------------------------------------------------------

test("davr chegaralari Toshkent kalendari bo'yicha hisoblanadi", async () => {
  const { davrBoshi, oraliqChegaralari, davrOqi } = await import("@/lib/kassaDavr");
  // 2026-08-25 — dushanba emas, seshanba (Toshkent vaqti bilan 10:00).
  const now = new Date("2026-08-25T05:00:00.000Z");

  assert.equal(davrBoshi("bugun", now)!.toISOString(), "2026-08-24T19:00:00.000Z");
  assert.equal(davrBoshi("hafta", now)!.toISOString(), "2026-08-23T19:00:00.000Z");
  assert.equal(davrBoshi("oy", now)!.toISOString(), "2026-07-31T19:00:00.000Z");
  assert.equal(davrBoshi("barchasi", now), null);

  const oraliq = oraliqChegaralari("2026-08-17", "2026-08-19")!;
  assert.equal(oraliq.boshlanish.toISOString(), "2026-08-16T19:00:00.000Z");
  assert.equal(oraliq.tugash.toISOString(), "2026-08-19T19:00:00.000Z");
  assert.equal(oraliqChegaralari("2026-08-19", "2026-08-17"), null, "teskari oraliq rad etiladi");
  assert.equal(oraliqChegaralari("xato", "2026-08-17"), null);

  assert.equal(davrOqi("hafta"), "hafta");
  assert.equal(davrOqi("nomalum"), "bugun", "noma'lum qiymat xavfsiz defaultga tushadi");
});

test("harakatlar ro'yxati davr bo'yicha kesiladi va kutilayotganlar kirmaydi", async () => {
  const bugundan = await A(async () =>
    accountsQ.listKassaHarakatlari(T.business.id, new Date(Date.now() - 3600_000), 50)
  );
  assert.ok(bugundan.length > 0);
  assert.equal(
    bugundan.some((t: any) => t.holat === "kutilmoqda"),
    false,
    "tasdiq kutayotganlar tarixda ikkinchi marta ko'rinmasligi kerak"
  );

  const kelajakdan = await A(async () =>
    accountsQ.listKassaHarakatlari(T.business.id, new Date(Date.now() + 3600_000), 50)
  );
  assert.equal(kelajakdan.length, 0, "davrdan tashqari yozuvlar kesilishi kerak");
});
