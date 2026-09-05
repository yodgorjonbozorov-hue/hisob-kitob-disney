/**
 * DIREKTOR OQIMI TESTLARI — kassa topshirish, yo'qotilgan zakaz arxivi va
 * direktorning tuzatish huquqlari.
 *
 * TEKSHIRILADIGAN INVARIANTLAR:
 *   1. TOPSHIRISH ≠ QABUL QILISH. Xodim topshirgan zahoti pul kassasidan
 *      YO'QOLMAYDI — hatto egasiz (umumiy) direktor kassasiga topshirilsa
 *      ham topshiriq "kutilmoqda" holatida turadi.
 *   2. Bir summa IKKI MARTA topshirilmaydi (mavjud qoldiq band bo'ladi).
 *   3. Direktor QABUL QILGANDAN keyin pul ko'chadi: xodim kassasi 0,
 *      direktor kassasi +summa, jami pul O'ZGARMAYDI.
 *   4. RAD ETILSA pul xodim kassasida o'z holicha qoladi.
 *   5. Yo'qotilgan zakaz o'chib ketmaydi: sabab va yopilgan sana yoziladi,
 *      boshqa holatga qaytarilganda sabab TOZALANADI.
 *   6. Moliyaga o'tgan "Yutildi" ni FAQAT direktor qaytara oladi va
 *      qaytarish kirimni yumshoq o'chirib, qarzni bekor qiladi.
 *   7. To'lovi bor qarzli zakaz qaytarilmaydi (pul haqiqatda kelgan).
 *   8. Zakaz o'chirish YUMSHOQ va moliyaga o'tgan zakazda taqiqlangan.
 *
 * Ishga tushirish: npm run test:direktor-oqimi
 */
process.env.DATABASE_URL = "file:./prisma/test-direktor-oqimi.db";

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
let crm: any;
let yakunlash: any;
let createTenantWithOwner: any;
let createTransaction: any;

let T: any;
let sotuvchi: any;
let sotuvchiKassa: string;
/** EGASIZ (umumiy) asosiy kassa — eski oqimda topshiriq darhol yakunlanardi. */
let asosiyKassa: string;
let kat: any;

function A<R>(fn: () => Promise<R>, aktor?: { userId: string; ism: string }): Promise<R> {
  return runWithTenant(T.tenant.id, fn, aktor ?? { userId: T.user.id, ism: "Direktor" });
}

const xodim = () => ({ userId: sotuvchi.id, ism: sotuvchi.ism, rol: "SELLER" });
const direktor = () => ({ userId: T.user.id, ism: "Direktor", rol: "OWNER" });

async function qoldiq(accountId: string): Promise<number> {
  const hammasi = await A(() => accountsQ.getAccountBalances(T.business.id));
  return hammasi.find((k: any) => k.id === accountId)?.qoldiq ?? 0;
}

const jamiKassalar = () => A(() => accountsQ.getJamiKassaQoldiq(T.business.id));

async function kirim(accountId: string, summa: number, userId: string) {
  return A(() =>
    createTransaction(userId, T.business.id, {
      turi: "kirim",
      categoryId: kat.id,
      summa,
      sana: "2026-09-05",
      tolovTuri: "naqd",
      accountId,
    })
  );
}

const topshir = (data: any) =>
  A(() => transferSvc.kassaTransferYarat(T.business.id, xodim(), { turi: "smena", ...data }), {
    userId: sotuvchi.id,
    ism: sotuvchi.ism,
  });

const qaror = (a: any, id: string, amal: string) =>
  A(() => transferSvc.kassaTransferQaror(T.business.id, a, id, { amal }), {
    userId: a.userId,
    ism: a.ism,
  });

const zakaz = (nomi: string, opts: any = {}) =>
  A(() =>
    crm.createDeal({
      businessId: T.business.id,
      nomi,
      categoryId: kat.id,
      summa: opts.summa ?? 0,
      tolangan: opts.tolangan ?? 0,
      tolovTuri: opts.tolovTuri === undefined ? "naqd" : opts.tolovTuri,
      sana: "2026-09-05",
      kontaktIsm: `Mijoz ${nomi}`,
      userId: T.user.id,
    })
  );

const deal = (id: string) => A(() => prisma.deal.findFirst({ where: { id } }));

before(async () => {
  rmSync("prisma/test-direktor-oqimi.db", { force: true });
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
  crm = await import("@/lib/crm/service");
  yakunlash = await import("@/lib/crm/yakunlash");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));

  T = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy Test",
    ism: "Direktor",
    login: "+998910200001",
    parol: "parol12345",
  });

  sotuvchi = await rawPrisma.user.create({
    data: {
      ism: "Sotuvchi",
      login: "+998910200010",
      parolHash: "x",
      rol: "SELLER",
      tenantId: T.tenant.id,
      businessId: T.business.id,
    },
  });

  sotuvchiKassa = (
    await rawPrisma.account.create({
      data: {
        businessId: T.business.id,
        nomi: "Sotuvchi kassasi",
        turi: "naqd",
        userId: sotuvchi.id,
        tartib: 10,
      },
    })
  ).id;
  // EGASIZ kassa: `userId = null`. Eski qoidada aynan shunga topshirish
  // tasdiqsiz yakunlanar va xodim kassasi darhol nolga tushardi.
  asosiyKassa = (
    await rawPrisma.account.create({
      data: { businessId: T.business.id, nomi: "Asosiy kassa", turi: "naqd", tartib: 1 },
    })
  ).id;

  kat = await A(() => prisma.category.findFirst({ where: { businessId: T.business.id, turi: "kirim" } }));

  await kirim(sotuvchiKassa, 6_150_000, sotuvchi.id);
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1-BO'LIM — KASSA TOPSHIRISH IKKI BOSQICHDA
// ---------------------------------------------------------------------------

test("topshirish egasiz asosiy kassaga ham TASDIQ kutadi", async () => {
  assert.equal(await qoldiq(sotuvchiKassa), 6_150_000);

  const tr = await topshir({ toAccountId: asosiyKassa, summa: 6_150_000 });

  assert.equal(tr.holat, "kutilmoqda", "topshiriq darhol yakunlanmasligi kerak");
  // ENG MUHIM: pul hali xodim kassasida.
  assert.equal(await qoldiq(sotuvchiKassa), 6_150_000);
  assert.equal(await qoldiq(asosiyKassa), 0);
});

test("kutilayotgan topshiriq mavjud qoldiqni BAND qiladi — ikki marta topshirilmaydi", async () => {
  // Himoya ikki qatlamli: MAVJUD qoldiq (qoldiq − kutilayotgan chiqim) nolga
  // tushadi, undan ham o'tsa — "ochiq smena topshirig'i bor" sharti. Qaysi
  // biri birinchi ishlashi ahamiyatsiz; muhimi — ikkinchi topshiriq bazaga
  // TUSHMAYDI va kassa qoldig'i o'zgarmaydi.
  await assert.rejects(
    () => topshir({ toAccountId: asosiyKassa, summa: 6_150_000 }),
    /yetarli mablag'|kutayotgan smena topshirig'i|allaqachon tasdiq kutmoqda/
  );

  const kutayotgan = await A(() => accountsQ.listTopshirishlar(T.business.id, ["kutilmoqda"], 10));
  assert.equal(kutayotgan.length, 1, "faqat bitta ochiq topshiriq qolishi kerak");
  assert.equal(await qoldiq(sotuvchiKassa), 6_150_000);
});

test("direktor QABUL QILGANDAN keyin pul ko'chadi, jami o'zgarmaydi", async () => {
  const jamiOldin = await jamiKassalar();
  const kutayotgan = await A(() => accountsQ.listTopshirishlar(T.business.id, ["kutilmoqda"], 10));
  assert.equal(kutayotgan.length, 1);

  await qaror(direktor(), kutayotgan[0].id, "qabul");

  assert.equal(await qoldiq(sotuvchiKassa), 0, "xodim kassasi endi 0");
  assert.equal(await qoldiq(asosiyKassa), 6_150_000);
  assert.equal(await jamiKassalar(), jamiOldin, "jami pul o'zgarmaydi — faqat joyi");

  const tarix = await A(() => accountsQ.listTopshirishlar(T.business.id, ["bajarildi"], 10));
  assert.equal(tarix.length, 1);
  assert.equal(tarix[0].holat, "bajarildi");
});

test("rad etilgan topshiriqda pul xodim kassasida qoladi", async () => {
  await kirim(sotuvchiKassa, 800_000, sotuvchi.id);
  const tr = await topshir({ toAccountId: asosiyKassa, summa: 800_000 });
  assert.equal(await qoldiq(sotuvchiKassa), 800_000);

  await qaror(direktor(), tr.id, "rad");

  assert.equal(await qoldiq(sotuvchiKassa), 800_000, "rad — pul joyida qoladi");
  assert.equal(await qoldiq(asosiyKassa), 6_150_000);

  // Rad etilgandan keyin qayta topshirish mumkin (band emas).
  const qayta = await topshir({ toAccountId: asosiyKassa, summa: 800_000 });
  assert.equal(qayta.holat, "kutilmoqda");
  await qaror(direktor(), qayta.id, "qabul");
  assert.equal(await qoldiq(sotuvchiKassa), 0);
  assert.equal(await qoldiq(asosiyKassa), 6_950_000);
});

// ---------------------------------------------------------------------------
// 2-BO'LIM — YO'QOTILGAN ZAKAZ ARXIVI
// ---------------------------------------------------------------------------

test("yo'qotilgan zakaz o'chmaydi: sabab va yopilgan sana yoziladi", async () => {
  const d = await zakaz("Bantik yo'qotilgan", { summa: 500_000, tolangan: 0, tolovTuri: null });

  await A(() =>
    crm.holatniOzgartirish({
      businessId: T.business.id,
      dealId: d.id,
      holat: "YOQOTILDI",
      userId: T.user.id,
      yoqotishSababi: "Narx kelishmadi",
    })
  );

  const keyin = await deal(d.id);
  assert.equal(keyin.holat, "YOQOTILDI");
  assert.equal(keyin.yoqotishSababi, "Narx kelishmadi");
  assert.ok(keyin.yopilganAt, "yo'qotilgan sana yoziladi");
  assert.equal(keyin.deletedAt, null, "zakaz o'chirilmaydi");
});

test("boshqa holatga qaytarilganda yo'qotish sababi tozalanadi", async () => {
  const d = await zakaz("Qaytariladigan", { summa: 300_000, tolangan: 0, tolovTuri: null });
  await A(() =>
    crm.holatniOzgartirish({
      businessId: T.business.id,
      dealId: d.id,
      holat: "YOQOTILDI",
      userId: T.user.id,
      yoqotishSababi: "Mijoz javob bermadi",
    })
  );
  await A(() =>
    crm.holatniOzgartirish({
      businessId: T.business.id,
      dealId: d.id,
      holat: "JARAYONDA",
      userId: T.user.id,
    })
  );

  const keyin = await deal(d.id);
  assert.equal(keyin.holat, "JARAYONDA");
  assert.equal(keyin.yoqotishSababi, null, "sabab osilib qolmasligi kerak");
  assert.equal(keyin.yopilganAt, null);
});

// ---------------------------------------------------------------------------
// 3-BO'LIM — "YUTILDI" DAN QAYTARISH (faqat direktor)
// ---------------------------------------------------------------------------

test("oddiy xodim moliyaga o'tgan zakazni qaytara olmaydi", async () => {
  const d = await zakaz("Naqd zakaz", { summa: 400_000, tolangan: 400_000 });
  await A(() => yakunlash.zakazniYakunlash({ businessId: T.business.id, dealId: d.id, userId: T.user.id }));

  await assert.rejects(
    () =>
      A(() =>
        crm.holatniOzgartirish({
          businessId: T.business.id,
          dealId: d.id,
          holat: "JARAYONDA",
          userId: sotuvchi.id,
          boshqaruvchi: false,
        })
      ),
    /faqat direktor qaytara oladi/
  );

  const keyin = await deal(d.id);
  assert.equal(keyin.holat, "YUTILDI", "holat o'zgarmagan bo'lishi kerak");
});

test("direktor qaytarganda kirim yumshoq o'chadi va kassa qoldig'i tiklanadi", async () => {
  const d = await zakaz("Qaytariladigan kirim", { summa: 900_000, tolangan: 900_000 });
  const n = await A(() =>
    yakunlash.zakazniYakunlash({ businessId: T.business.id, dealId: d.id, userId: T.user.id })
  );
  assert.equal(n.kirimSumma, 900_000);
  const jamiYutilgach = await jamiKassalar();

  await A(() =>
    crm.holatniOzgartirish({
      businessId: T.business.id,
      dealId: d.id,
      holat: "JARAYONDA",
      userId: T.user.id,
      boshqaruvchi: true,
    })
  );

  const keyin = await deal(d.id);
  assert.equal(keyin.holat, "JARAYONDA");
  assert.equal(keyin.transactionId, null, "kirim bog'lanishi uziladi");
  assert.equal(keyin.debtId, null);

  const kirimYozuv = await A(() => prisma.transaction.findFirst({ where: { id: n.transactionId } }));
  assert.ok(kirimYozuv.deletedAt, "kirim YUMSHOQ o'chiriladi (savatda qoladi)");
  assert.equal(kirimYozuv.deletedBy, T.user.id, "kim o'chirgani yozuvda qoladi");

  assert.equal(await jamiKassalar(), jamiYutilgach - 900_000, "pul kassadan chiqdi");
});

test("qaytarilgan zakaz qayta yutilsa kirim YANGIDAN yoziladi (dublikat yo'q)", async () => {
  const d = await zakaz("Qayta yutiladi", { summa: 250_000, tolangan: 250_000 });
  await A(() => yakunlash.zakazniYakunlash({ businessId: T.business.id, dealId: d.id, userId: T.user.id }));
  await A(() =>
    crm.holatniOzgartirish({
      businessId: T.business.id,
      dealId: d.id,
      holat: "JARAYONDA",
      userId: T.user.id,
      boshqaruvchi: true,
    })
  );
  const qayta = await A(() =>
    yakunlash.zakazniYakunlash({ businessId: T.business.id, dealId: d.id, userId: T.user.id })
  );
  assert.equal(qayta.yangiYakun, true);

  const tirik = await A(() =>
    prisma.transaction.count({
      where: { businessId: T.business.id, izoh: { contains: "Qayta yutiladi" }, deletedAt: null },
    })
  );
  assert.equal(tirik, 1, "faqat bitta TIRIK kirim qolishi kerak");
});

test("qarzli zakaz qaytarilganda qarz BEKOR qilinadi", async () => {
  const d = await zakaz("Qarzga ketgan", { summa: 700_000, tolangan: 0, tolovTuri: "qarz" });
  const n = await A(() =>
    yakunlash.zakazniYakunlash({ businessId: T.business.id, dealId: d.id, userId: T.user.id })
  );
  assert.equal(n.qarzSumma, 700_000);

  await A(() =>
    crm.holatniOzgartirish({
      businessId: T.business.id,
      dealId: d.id,
      holat: "YOQOTILDI",
      userId: T.user.id,
      boshqaruvchi: true,
      yoqotishSababi: "Mijoz to'lamadi, zakaz bekor",
    })
  );

  const qarz = await A(() => prisma.debt.findFirst({ where: { id: n.debtId } }));
  assert.equal(qarz.status, "CANCELLED");
  assert.equal(qarz.isYopilgan, true);

  const keyin = await deal(d.id);
  assert.equal(keyin.holat, "YOQOTILDI");
  assert.equal(keyin.debtId, null);
  assert.equal(keyin.yoqotishSababi, "Mijoz to'lamadi, zakaz bekor");
});

test("to'lovi qabul qilingan qarzli zakaz QAYTARILMAYDI", async () => {
  const d = await zakaz("Qisman to'langan qarz", { summa: 600_000, tolangan: 0, tolovTuri: "qarz" });
  const n = await A(() =>
    yakunlash.zakazniYakunlash({ businessId: T.business.id, dealId: d.id, userId: T.user.id })
  );
  // To'lov kelgan holatni taqlid qilamiz (qarz to'lovi oqimi alohida modul).
  await A(() => prisma.debt.update({ where: { id: n.debtId }, data: { tolangan: 100_000 } }));

  await assert.rejects(
    () =>
      A(() =>
        crm.holatniOzgartirish({
          businessId: T.business.id,
          dealId: d.id,
          holat: "JARAYONDA",
          userId: T.user.id,
          boshqaruvchi: true,
        })
      ),
    /to'lov qabul qilingan/
  );

  const keyin = await deal(d.id);
  assert.equal(keyin.holat, "YUTILDI", "rad etilgan qaytarish holatni buzmaydi");
  assert.ok(keyin.debtId, "qarz bog'lanishi joyida qoladi");
});

// ---------------------------------------------------------------------------
// 4-BO'LIM — ZAKAZNI O'CHIRISH (yumshoq, faqat direktor)
// ---------------------------------------------------------------------------

test("moliyaga o'tgan zakaz o'chirilmaydi", async () => {
  const d = await zakaz("O'chirilmaydigan", { summa: 200_000, tolangan: 200_000 });
  await A(() => yakunlash.zakazniYakunlash({ businessId: T.business.id, dealId: d.id, userId: T.user.id }));

  await assert.rejects(
    () => A(() => crm.zakazniOchirish({ businessId: T.business.id, dealId: d.id, userId: T.user.id })),
    /Moliyaga o'tgan zakaz o'chirilmaydi/
  );
});

test("qaytarilgandan keyin o'chirish ishlaydi va YUMSHOQ bo'ladi", async () => {
  const d = await zakaz("Avval qaytariladi", { summa: 200_000, tolangan: 200_000 });
  await A(() => yakunlash.zakazniYakunlash({ businessId: T.business.id, dealId: d.id, userId: T.user.id }));
  await A(() =>
    crm.holatniOzgartirish({
      businessId: T.business.id,
      dealId: d.id,
      holat: "JARAYONDA",
      userId: T.user.id,
      boshqaruvchi: true,
    })
  );

  await A(() => crm.zakazniOchirish({ businessId: T.business.id, dealId: d.id, userId: T.user.id }));

  const keyin = await deal(d.id);
  assert.ok(keyin, "yozuv bazadan yo'qolmaydi");
  assert.ok(keyin.deletedAt);
  assert.equal(keyin.deletedBy, T.user.id);

  // Ikkinchi marta o'chirish — xato (audit ikki marta yozilmaydi).
  await assert.rejects(
    () => A(() => crm.zakazniOchirish({ businessId: T.business.id, dealId: d.id, userId: T.user.id })),
    /topilmadi|allaqachon o'chirilgan/
  );
});

test("mijozni almashtirish: telefon bo'yicha mavjud kartochka qayta ishlatiladi", async () => {
  const d = await zakaz("Mijozi tuzatiladi", { summa: 100_000, tolangan: 0, tolovTuri: null });
  const oldin = await deal(d.id);

  await A(() =>
    crm.zakazMijoziniOzgartirish({
      businessId: T.business.id,
      dealId: d.id,
      userId: T.user.id,
      kontaktIsm: "Yangi Mijoz",
      kontaktTel: "+998901112233",
    })
  );
  const birinchi = await deal(d.id);
  assert.notEqual(birinchi.contactId, null);

  // AYNI telefon bilan ikkinchi zakaz — yangi kartochka OCHILMAYDI.
  const d2 = await zakaz("Ikkinchi zakaz", { summa: 100_000, tolangan: 0, tolovTuri: null });
  await A(() =>
    crm.zakazMijoziniOzgartirish({
      businessId: T.business.id,
      dealId: d2.id,
      userId: T.user.id,
      kontaktIsm: "Yangi Mijoz",
      kontaktTel: "+998901112233",
    })
  );
  const ikkinchi = await deal(d2.id);
  assert.equal(ikkinchi.contactId, birinchi.contactId, "dublikat mijoz kartochkasi yaratilmaydi");
  assert.notEqual(birinchi.contactId, oldin.contactId, "mijoz haqiqatda almashdi");
});
