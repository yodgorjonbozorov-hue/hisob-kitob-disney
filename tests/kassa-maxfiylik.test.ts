/**
 * KASSA MAXFIYLIGI VA KASSA TOPSHIRISH RESET NUQTASI — TESTLAR.
 *
 * Ikki talab isbotlanadi:
 *
 *   A. MAXFIYLIK — boshqa xodimning kassasi, biznesning jami puli va
 *      xodimlar orasidagi o'tkazmalar "kassa.jami" huquqisiz ochilmaydi
 *      (huquq katalogi, API filtri, sahifa manbalari). Direktor esa
 *      hammasini va jamini ko'radi.
 *
 *   B. RESET — kassa topshirilgan zahoti JORIY SMENA 0 dan boshlanadi:
 *      kirim = chiqim = sof = 0, "kassadagi pul" = 0. Handoverdan keyingi
 *      yangi savdo 0 dan hisoblanadi, eski smena qo'shilmaydi. Tarix
 *      o'chirilmaydi. Ikki marta topshirish pulni ikki marta ko'chirmaydi.
 *
 * Ishga tushirish: npm run test:kassa-maxfiylik
 */
process.env.DATABASE_URL = "file:./prisma/test-kassa-maxfiylik.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let transferSvc: any;
let nazoratQ: any;
let detalQ: any;
let accountsQ: any;
let smenaQ: any;
let katalog: any;
let tekshir: any;
let createTenantWithOwner: any;
let createTransaction: any;

let T: any;
let boshqaT: any;
let ali: any;
let vali: any;
let aliKassa: string;
let valiKassa: string;
let direktorKassa: string;
let kirimCat: any;
let chiqimCat: any;

function A<T2>(fn: () => Promise<T2>, aktor?: { userId: string; ism: string }): Promise<T2> {
  return runWithTenant(T.tenant.id, fn, aktor ?? { userId: T.user.id, ism: "Direktor" });
}
const aktor = (u: any, rol = "CASHIER") => ({ userId: u.id, ism: u.ism, rol });
const direktor = () => ({ userId: T.user.id, ism: "Direktor", rol: "OWNER" });

async function yozuv(accountId: string, turi: "kirim" | "chiqim", summa: number, userId: string) {
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
async function topshir(u: any, fromAccountId: string, summa: number, izoh?: string) {
  return A(
    async () =>
      transferSvc.kassaTransferYarat(T.business.id, aktor(u), {
        fromAccountId,
        toAccountId: direktorKassa,
        summa,
        turi: "smena",
        izoh,
      }),
    { userId: u.id, ism: u.ism }
  );
}
async function qabul(id: string) {
  return A(async () =>
    transferSvc.kassaTransferQaror(T.business.id, direktor(), id, { amal: "qabul" })
  );
}
/** Xodim ko'radigan manba — faqat o'z kassasi (`/app/kassam` bilan bir xil). */
async function meningKassam(u: any) {
  return A(async () => accountsQ.getMeningKassam(T.business.id, u.id), {
    userId: u.id,
    ism: u.ism,
  });
}
async function detal(accountId: string) {
  return A(async () => detalQ.getKassaDetal(T.business.id, accountId, 50));
}
/** Direktor manbasi — barcha kassalar va jami. */
async function nazorat() {
  return A(async () => nazoratQ.getKassaNazorat(T.business.id));
}
const kutib = (ms: number) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  rmSync("prisma/test-kassa-maxfiylik.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  transferSvc = await import("@/lib/services/kassaTransfer");
  nazoratQ = await import("@/lib/queries/kassaNazorat");
  detalQ = await import("@/lib/queries/kassaDetal");
  accountsQ = await import("@/lib/queries/accounts");
  smenaQ = await import("@/lib/queries/kassaSmena");
  katalog = await import("@/lib/permissions/katalog");
  tekshir = await import("@/lib/permissions/tekshir");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));

  T = await createTenantWithOwner({
    kompaniyaNomi: "Maxfiylik Test",
    ism: "Direktor",
    login: "+998910300001",
    parol: "parol12345",
  });
  boshqaT = await createTenantWithOwner({
    kompaniyaNomi: "Begona Biznes",
    ism: "Begona egasi",
    login: "+998910300002",
    parol: "parol12345",
  });

  const xodim = (ism: string, login: string) =>
    rawPrisma.user.create({
      data: { ism, login, parolHash: "x", rol: "CASHIER", tenantId: T.tenant.id, businessId: T.business.id },
    });
  ali = await xodim("Ali", "+998910300010");
  vali = await xodim("Vali", "+998910300011");

  const kassaYarat = (nomi: string, userId: string | null) =>
    rawPrisma.account.create({
      data: { businessId: T.business.id, nomi, turi: "naqd", userId, tartib: 10 },
    });
  aliKassa = (await kassaYarat("Ali kassasi", ali.id)).id;
  valiKassa = (await kassaYarat("Vali kassasi", vali.id)).id;
  direktorKassa = (await kassaYarat("Direktor kassasi", T.user.id)).id;

  [kirimCat, chiqimCat] = await A(async () => [
    await prisma.category.findFirst({ where: { businessId: T.business.id, turi: "kirim" } }),
    await prisma.category.findFirst({ where: { businessId: T.business.id, turi: "chiqim" } }),
  ]);
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// A. MAXFIYLIK
// ---------------------------------------------------------------------------

test("A1. 'kassa.jami' huquqi: direktor/adminda BOR, kassir/sotuvchida YO'Q", () => {
  assert.ok(katalog.HUQUQ_KODLARI.has("kassa.jami"));
  const bor = (rol: string) => tekshir.effektivHuquqlar({ rol }).has("kassa.jami");
  assert.equal(bor("OWNER"), true);
  assert.equal(bor("ADMIN"), true);
  assert.equal(bor("CASHIER"), false, "kassir jami kassani ko'rmaydi");
  assert.equal(bor("SELLER"), false, "sotuvchi jami kassani ko'rmaydi");
  // Kassir o'z kassasi bilan ishlashi uchun kerak bo'lgan huquqlar qoladi.
  assert.equal(tekshir.effektivHuquqlar({ rol: "CASHIER" }).has("kassa.korish"), true);
  assert.equal(tekshir.effektivHuquqlar({ rol: "CASHIER" }).has("pul.berish"), true);
  // Maxsus rol ochiq bersa ham, huquqMinus bilan olib qo'yish mumkin.
  assert.equal(
    tekshir
      .effektivHuquqlar({ rol: "CASHIER", huquqPlus: JSON.stringify(["kassa.jami"]) })
      .has("kassa.jami"),
    true
  );
});

test("A2. Kassir manbasi: faqat O'Z kassasi — Vali kassasi va jami YO'Q", async () => {
  await yozuv(aliKassa, "kirim", 500_000, ali.id);
  await yozuv(valiKassa, "kirim", 700_000, vali.id);

  const meniki = await meningKassam(ali);
  assert.ok(meniki);
  assert.equal(meniki.accountId, aliKassa);
  assert.equal(meniki.mavjud, 500_000);
  const kalitlar = Object.keys(meniki);
  assert.ok(!kalitlar.some((k) => /jami/i.test(k)), "xodim DTO'sida 'jami' maydoni yo'q");
  assert.equal(JSON.stringify(meniki).includes("Vali"), false, "Vali nomi ham chiqmaydi");

  // Kassa detali boshqa kassaning qoldig'ini qaytarmaydi.
  const d = await detal(aliKassa);
  assert.equal(d.kassa.qoldiq, 500_000);
  assert.equal(JSON.stringify(d).includes(String(700_000)), false, "Vali summasi detalda yo'q");
});

test("A3. Tasdiq kutayotgan o'tkazmalar: xodim faqat O'ZINIKINI ko'radi (API filtri)", async () => {
  const valiTopshirish = await topshir(vali, valiKassa, 700_000);
  assert.equal(valiTopshirish.holat, "kutilmoqda");

  const aliKoradi = await A(async () =>
    accountsQ.listKutilayotganTransferlar(T.business.id, 50, ali.id)
  );
  assert.equal(aliKoradi.length, 0, "Ali Valining 700 000 topshirishini ko'rmaydi");

  const valiKoradi = await A(async () =>
    accountsQ.listKutilayotganTransferlar(T.business.id, 50, vali.id)
  );
  assert.equal(valiKoradi.length, 1);

  const direktorKoradi = await A(async () =>
    accountsQ.listKutilayotganTransferlar(T.business.id, 50, null)
  );
  assert.equal(direktorKoradi.length, 1, "direktor (kassa.jami) hammasini ko'radi");

  await qabul(valiTopshirish.id);
});

test("A4. Direktor: Ali, Vali va JAMI ko'rinadi", async () => {
  const n = await nazorat();
  const ali_ = n.kartalar.find((k: any) => k.id === aliKassa);
  const vali_ = n.kartalar.find((k: any) => k.id === valiKassa);
  const dir = n.kartalar.find((k: any) => k.id === direktorKassa);
  assert.equal(ali_.qoldiq, 500_000);
  assert.equal(vali_.qoldiq, 0, "Vali topshirdi — kassasi 0");
  assert.equal(dir.qoldiq, 700_000);
  assert.equal(n.jamiQoldiq, 1_200_000, "jami = Ali 500 000 + direktorda 700 000");
});

test("A5. Boshqa biznesning kassasi hech qaysi manbada ko'rinmaydi", async () => {
  const begonaKassa = await rawPrisma.account.findFirst({
    where: { businessId: boshqaT.business.id },
  });
  const n = await nazorat();
  assert.equal(n.kartalar.some((k: any) => k.id === begonaKassa.id), false);
  assert.equal(await detal(begonaKassa.id), null);
  const boshlari = await A(async () => smenaQ.getSmenaBoshlari(T.business.id, [begonaKassa.id]));
  assert.equal(boshlari.get(begonaKassa.id).topshirishdan, false);
});

// ---------------------------------------------------------------------------
// B. KASSA TOPSHIRISH — RESET NUQTASI
// ---------------------------------------------------------------------------

test("B1. To'liq topshirish: joriy smena 0 ga tushadi (kirim, chiqim, sof, kassa)", async () => {
  // Ali: 500 000 bor edi; +1 000 000 kirim, −200 000 chiqim => 1 300 000.
  await yozuv(aliKassa, "kirim", 1_000_000, ali.id);
  await yozuv(aliKassa, "chiqim", 200_000, ali.id);

  let m = await meningKassam(ali);
  assert.equal(m.smenaKirim, 1_500_000);
  assert.equal(m.smenaChiqim, 200_000);
  assert.equal(m.mavjud, 1_300_000);
  assert.equal(m.smenaTopshirishdan, false);

  // createdAt millisekund aniqligida — topshirish yozuvlardan keyin bo'lsin.
  await kutib(20);
  const tr = await topshir(ali, aliKassa, 1_300_000);
  assert.equal(tr.holat, "kutilmoqda");
  assert.equal(tr.farq, 0);

  // TOPSHIRILGAN ZAHOTI (hali direktor qabul qilmagan) xodim uchun 0.
  m = await meningKassam(ali);
  assert.equal(m.smenaTopshirishdan, true, "smena topshirishdan boshlanadi");
  assert.equal(m.smenaKirim, 0);
  assert.equal(m.smenaChiqim, 0);
  assert.equal(m.smenaKirim - m.smenaChiqim, 0, "sof = 0");
  assert.equal(m.mavjud, 0, "kassadagi mavjud pul = 0");
  assert.equal(m.kutilayotganChiqim, 1_300_000, "topshirilgan pul tasdiq kutmoqda");

  const d = await detal(aliKassa);
  assert.equal(d.smenaKirim, 0);
  assert.equal(d.smenaChiqim, 0);
  assert.equal(d.mavjud, 0);

  // Direktor kartasida ham smena 0, ledger qoldig'i esa qabulgacha 1 300 000.
  let k = (await nazorat()).kartalar.find((x: any) => x.id === aliKassa);
  assert.equal(k.smenaKirim, 0);
  assert.equal(k.smenaSof, 0);
  assert.equal(k.qoldiq, 1_300_000);
  assert.equal(k.mavjud, 0);
  assert.equal(k.topshirishKutmoqda, true);

  // Direktor qabul qildi — ledger ham 0.
  await qabul(tr.id);
  k = (await nazorat()).kartalar.find((x: any) => x.id === aliKassa);
  assert.equal(k.qoldiq, 0, "qabul qilingach ledger qoldig'i 0");
  assert.equal(k.smenaKirim, 0);
  assert.equal(k.smenaSof, 0);
  m = await meningKassam(ali);
  assert.equal(m.mavjud, 0);
  assert.equal(m.qoldiq, 0);
});

test("B2. Handoverdan keyingi yangi savdo 0 dan hisoblanadi — eski smena qo'shilmaydi", async () => {
  await kutib(20);
  await yozuv(aliKassa, "kirim", 300_000, ali.id);
  const m = await meningKassam(ali);
  assert.equal(m.smenaKirim, 300_000, "eski 1 500 000 qo'shilmagan");
  assert.equal(m.smenaChiqim, 0);
  assert.equal(m.mavjud, 300_000);
  assert.equal(m.qoldiq, 300_000);

  const k = (await nazorat()).kartalar.find((x: any) => x.id === aliKassa);
  assert.equal(k.smenaKirim, 300_000);
  assert.equal(k.smenaSof, 300_000);
  assert.equal(k.qoldiq, 300_000);
  // Topshirish o'tkazmasining o'zi yangi smenaning "chiqqan" o'tkazmasi emas.
  assert.equal(k.smenaChiqqan, 0);
});

test("B3. Tarix o'chirilmaydi: 1 300 000 topshirish va eski yozuvlar joyida", async () => {
  const d = await detal(aliKassa);
  const topshirish = d.topshirishlar.find((t: any) => t.summa === 1_300_000);
  assert.ok(topshirish, "topshirish tarixda turadi");
  assert.equal(topshirish.holat, "bajarildi");
  assert.equal(topshirish.yonalish, "chiqqan");
  // Lentada ham ko'rinadi.
  assert.ok(d.harakatlar.some((h: any) => h.summa === -1_300_000 && /topshirildi/i.test(h.matn)));

  const yozuvlar = await A(async () =>
    prisma.transaction.count({ where: { businessId: T.business.id, accountId: aliKassa, deletedAt: null } })
  );
  assert.equal(yozuvlar, 4, "500k + 1M kirim, 200k chiqim, 300k kirim — hammasi saqlangan");
  // Biznesning kunlik kirimi (dashboard) topshirishdan O'ZGARMAYDI.
  const n = await nazorat();
  assert.equal(n.bugungiKirim, 500_000 + 700_000 + 1_000_000 + 300_000);
  assert.equal(n.bugungiChiqim, 200_000);
});

test("B4. Rad etilgan topshirish reset nuqtasi EMAS — smena davom etadi", async () => {
  await kutib(20);
  const tr = await topshir(ali, aliKassa, 300_000);
  assert.equal((await meningKassam(ali)).smenaKirim, 0, "topshirilgan zahoti 0");
  await A(async () =>
    transferSvc.kassaTransferQaror(T.business.id, direktor(), tr.id, { amal: "rad", qarorIzoh: "sanoq" })
  );
  const m = await meningKassam(ali);
  assert.equal(m.smenaKirim, 300_000, "rad etilgach pul va smena qaytadi");
  assert.equal(m.mavjud, 300_000);
});

test("B5. Ikki marta bosish — bitta topshirish, pul ikki marta ko'chmaydi", async () => {
  await kutib(20);
  const natijalar = await Promise.allSettled([
    topshir(ali, aliKassa, 300_000),
    topshir(ali, aliKassa, 300_000),
  ]);
  const otgan = natijalar.filter((r) => r.status === "fulfilled");
  assert.equal(otgan.length, 1, "faqat bittasi yaratiladi");
  const ochiq = await A(async () =>
    prisma.accountTransfer.count({
      where: { businessId: T.business.id, fromAccountId: aliKassa, turi: "smena", holat: "kutilmoqda" },
    })
  );
  assert.equal(ochiq, 1);
  const id = (otgan[0] as PromiseFulfilledResult<any>).value.id;
  await qabul(id);
  assert.equal((await meningKassam(ali)).qoldiq, 0);
});

test("B6. Kamomad bilan topshirish: smena 0, yetishmagan pul kassada ochiq qoladi", async () => {
  await kutib(20);
  await yozuv(valiKassa, "kirim", 1_250_000, vali.id);
  await kutib(20);
  const tr = await topshir(vali, valiKassa, 1_200_000, "50 000 qaytimda ketdi");
  assert.equal(tr.hisoblangan, 1_250_000);
  assert.equal(tr.farq, -50_000);
  await qabul(tr.id);
  const m = await meningKassam(vali);
  assert.equal(m.smenaKirim, 0, "yangi smena 0 dan");
  assert.equal(m.mavjud, 50_000, "kamomad kassirda ochiq qoladi — tarix yo'qolmaydi");
});

test("B7. Topshirilmagan kassa (bank) uchun smena kun boshidan — avvalgi xatti-harakat", async () => {
  const boshlari = await A(async () => smenaQ.getSmenaBoshlari(T.business.id, [direktorKassa]));
  const s = boshlari.get(direktorKassa);
  assert.equal(s.topshirishdan, false);
  const { toshkentKunBoshi } = await import("@/lib/kassaDavr");
  assert.equal(s.boshi.getTime(), toshkentKunBoshi().getTime());
});
