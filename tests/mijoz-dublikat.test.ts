/**
 * MIJOZ DUBLIKATI — himoya va birlashtirish.
 *
 * INVARIANT: 1 haqiqiy mijoz = 1 Contact = uning ichida BARCHA qarzlari.
 *
 * Muammo (Disney Flowers): ayni bir odam ikki kartochka bo'lib qolgan va
 * qarzdorlar ro'yxatida ikki karta chiqardi — biri 800 000, ikkinchisi
 * 300 000 so'm. Sababi: `services/mijoz.ts` dagi `createMijoz()`
 * to'g'ridan-to'g'ri `contact.create()` chaqirar, telefonni XOM saqlar va
 * `mijozniAniqlaTx` dagi dublikat himoyasini CHETLAB O'TARDI.
 *
 * Bu fayl ikkalasini ham tekshiradi:
 *   · yozish yo'li — endi dublikat YARATILMAYDI (1-5, 8-test);
 *   · birlashtirish skripti — mavjud dublikatlar bitta kartochkaga
 *     yig'iladi va JAMI QARZ bir so'mga ham o'zgarmaydi (6-7-test).
 *
 * Ishga tushirish: npm run test:mijoz-dublikat
 */
process.env.DATABASE_URL = "file:./prisma/test-mijoz-dublikat.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let mijozSvc: any;
let qarzSvc: any;
let qarzQ: any;

/** Disney Flowers — birlashtirish skripti AYNAN shu biznesni qidiradi. */
let disney: any;
/** Begona tenant — telefon bir xil bo'lsa ham dublikat emas. */
let begona: any;

function D<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(disney.tenant.id, fn, { userId: disney.user.id, ism: "Direktor" });
}

function B<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(begona.tenant.id, fn, { userId: begona.user.id, ism: "Direktor" });
}

/** Qarz yozish — Qarzlar sahifasidagi forma bilan bir xil yo'l. */
function qarzYoz(p: { contactId?: string; ism?: string; tel?: string; summa: number }) {
  return D(async () =>
    qarzSvc.createQarz({
      businessId: disney.business.id,
      userId: disney.user.id,
      turi: "olinadigan",
      contactId: p.contactId,
      mijozNomi: p.ism,
      mijozTel: p.tel,
      mijozSaqla: true,
      jamiSumma: p.summa,
      sana: "2026-09-01",
    })
  );
}

function mijozSoni() {
  return rawPrisma.contact.count({
    where: { businessId: disney.business.id, deletedAt: null },
  });
}

function qarzSoni() {
  return rawPrisma.debt.count({ where: { businessId: disney.business.id } });
}

/** Biznesning jami ochiq qarzi — skript bilan AYNI hisob qoidasi. */
async function jamiOchiqQarz(): Promise<number> {
  const agg = await rawPrisma.debt.aggregate({
    where: {
      businessId: disney.business.id,
      turi: "olinadigan",
      isYopilgan: false,
      deletedAt: null,
    },
    _sum: { jamiSumma: true, tolangan: true },
  });
  return (agg._sum.jamiSumma ?? 0) - (agg._sum.tolangan ?? 0);
}

/** Birlashtirish skriptini ishga tushiradi (`--write` bo'lmasa quruq rejim). */
function skriptniIshlat(write: boolean) {
  const res = spawnSync(
    process.execPath,
    [
      "-r",
      "ts-node/register",
      "scripts/disney-flowers-mijoz-dublikat-birlashtir.ts",
      ...(write ? ["--write"] : []),
    ],
    { env: { ...process.env }, encoding: "utf8" }
  );
  if (res.status !== 0) {
    throw new Error(`Skript xatosi (${res.status}):\n${res.stdout}\n${res.stderr}`);
  }
  return res.stdout;
}

before(async () => {
  for (const f of ["prisma/test-mijoz-dublikat.db", "prisma/test-mijoz-dublikat.db-journal"]) {
    rmSync(f, { force: true });
  }
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  mijozSvc = await import("@/lib/services/mijoz");
  qarzSvc = await import("@/lib/services/qarz");
  qarzQ = await import("@/lib/queries/qarz");

  disney = await createTenantWithOwner({
    kompaniyaNomi: "Disney Flowers",
    ism: "Direktor",
    login: "+998900000701",
    parol: "parol12345",
  });
  begona = await createTenantWithOwner({
    kompaniyaNomi: "Begona gullar",
    ism: "Begona",
    login: "+998900000702",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1-2. Yaratishda dublikat bloklanadi
// ---------------------------------------------------------------------------

let akmal: any;

test("1. Bir xil telefonli ikkinchi mijoz OCHILMAYDI (format har xil bo'lsa ham)", async () => {
  akmal = await D(async () =>
    mijozSvc.createMijoz(disney.business.id, disney.user.id, {
      ism: "Akmal Karimov",
      tel: "+998901112233",
    })
  );
  assert.ok(akmal.id);
  assert.equal(akmal.tel, "+998901112233", "telefon yagona formatda saqlanishi kerak");

  // AYNI raqam, boshqa yozuv ko'rinishi va boshqa ism.
  await assert.rejects(
    () =>
      D(async () =>
        mijozSvc.createMijoz(disney.business.id, disney.user.id, {
          ism: "Akmal aka",
          tel: "90 111 22 33",
        })
      ),
    /Bu mijoz mavjud/
  );

  const soni = await rawPrisma.contact.count({
    where: { businessId: disney.business.id, deletedAt: null, tel: "+998901112233" },
  });
  assert.equal(soni, 1, "shu raqamda BITTA kartochka qolishi kerak");
});

test("2. Xato javobi 'Bu mijoz mavjud' deydi va mavjud kartochkani qaytaradi", async () => {
  const xato = await D(async () =>
    mijozSvc
      .createMijoz(disney.business.id, disney.user.id, { ism: "Akmal", tel: "998901112233" })
      .then(() => null)
      .catch((e: unknown) => e)
  );

  assert.ok(xato, "dublikat xato tashlashi kerak");
  assert.equal(xato.message, "Bu mijoz mavjud");
  assert.equal(xato.code, "MIJOZ_DUBLIKAT", "UI shu kod bo'yicha dublikatni ajratadi");
  assert.equal(xato.qoshimcha.mavjud.id, akmal.id);
  assert.equal(xato.qoshimcha.mavjud.ism, "Akmal Karimov");
  assert.equal(xato.qoshimcha.mavjud.tel, "+998901112233");
});

// ---------------------------------------------------------------------------
// 3-4. Himoya CHEGARASI: nima dublikat EMAS
// ---------------------------------------------------------------------------

test("3. Ayni telefon BOSHQA biznesda ruxsat — izolyatsiya buzilmaydi", async () => {
  const begonaMijoz = await B(async () =>
    mijozSvc.createMijoz(begona.business.id, begona.user.id, {
      ism: "Akmal Karimov",
      tel: "+998901112233",
    })
  );
  assert.ok(begonaMijoz.id, "boshqa biznesning mijozi — dublikat emas");
  assert.notEqual(begonaMijoz.id, akmal.id);
  assert.equal(begonaMijoz.businessId, begona.business.id);
});

test("4. Bir xil ism + BOSHQA telefon = ikki alohida mijoz", async () => {
  const ikkinchi = await D(async () =>
    mijozSvc.createMijoz(disney.business.id, disney.user.id, {
      ism: "Akmal Karimov",
      tel: "+998909998877",
    })
  );
  assert.notEqual(ikkinchi.id, akmal.id, "asosiy identifikator — telefon, ism emas");

  const soni = await rawPrisma.contact.count({
    where: { businessId: disney.business.id, deletedAt: null, ism: "Akmal Karimov" },
  });
  assert.equal(soni, 2);
});

// ---------------------------------------------------------------------------
// 5. Mavjud mijozga yangi qarz
// ---------------------------------------------------------------------------

test("5. Mavjud mijozga qarz qo'shilsa Contact soni oshmaydi, Debt soni oshadi", async () => {
  const mijozOldin = await mijozSoni();
  const qarzOldin = await qarzSoni();

  // Kassir qidiruvni o'tkazib yuborib ism/telefonni QO'LDA yozdi — telefon
  // bo'yicha mavjud kartochka topilishi kerak.
  const q = await qarzYoz({ ism: "Akmal aka", tel: "90 111 22 33", summa: 250_000 });
  assert.equal(q.contactId, akmal.id, "qarz mavjud kartochkaga tushishi kerak");

  assert.equal(await mijozSoni(), mijozOldin, "yangi kartochka ochilmaydi");
  assert.equal(await qarzSoni(), qarzOldin + 1, "qarz esa yangi yozuv");
});

// ---------------------------------------------------------------------------
// 6-7. Mavjud dublikatlarni birlashtirish (Disney Flowers skripti)
// ---------------------------------------------------------------------------

let kanonikId: string;
let dublikatId: string;
let birlashOldinJami: number;

test("6. Skript ikki kartochkani bitta kartochka ostiga yig'adi", async () => {
  // ESKI ma'lumot holati: himoyagacha yozilgan ikki kartochka. Ataylab
  // xom klient bilan yaratiladi — bugungi xizmat qatlami buni bloklaydi.
  const kanonik = await rawPrisma.contact.create({
    data: {
      businessId: disney.business.id,
      ism: "Bozorov yodgor",
      tel: "+998913320008",
      createdBy: disney.user.id,
      createdAt: new Date("2026-01-10T00:00:00Z"),
      izoh: "Doimiy mijoz",
    },
  });
  const dublikat = await rawPrisma.contact.create({
    data: {
      businessId: disney.business.id,
      // AYNI raqam, XOM ko'rinishda — aynan shu dublikatni tug'dirgan holat.
      ism: "Bozorov Yodgor",
      tel: "91 332 00 08",
      createdBy: disney.user.id,
      createdAt: new Date("2026-03-05T00:00:00Z"),
      manzil: "Navoiy sh.",
    },
  });
  kanonikId = kanonik.id;
  dublikatId = dublikat.id;

  await qarzYoz({ contactId: kanonik.id, summa: 800_000 });
  await qarzYoz({ contactId: dublikat.id, summa: 300_000 });

  // Birlashtirishdan OLDIN: ikki qarzdor kartasi — mahsulotdagi xato.
  const oldin = await D(async () =>
    qarzQ.listQarzdorlar(disney.business.id, { turi: "olinadigan" })
  );
  const boruvchi = oldin.filter((r: any) => r.ism.toLowerCase().includes("bozorov"));
  assert.equal(boruvchi.length, 2, "tuzatishdan oldin ikki qarzdor bo'lishi kerak");

  birlashOldinJami = await jamiOchiqQarz();

  // --- QURUQ REJIM: hisobot chiqadi, baza O'ZGARMAYDI ---
  const quruq = skriptniIshlat(false);
  assert.match(quruq, /KO'RISH REJIMI/);
  assert.match(quruq, /Dublikat guruhlar\s+: 1/);
  assert.match(quruq, /Birlashtiriladigan karta\s+: 1/);
  assert.match(quruq, /Ko'chadigan Debt\s+: 1/);
  assert.equal(
    await rawPrisma.contact.count({ where: { id: dublikatId, deletedAt: null } }),
    1,
    "quruq rejim hech narsa o'chirmasligi kerak"
  );
  assert.equal(
    await rawPrisma.debt.count({ where: { contactId: dublikatId } }),
    1,
    "quruq rejim qarzni ko'chirmasligi kerak"
  );

  // --- YOZISH ---
  const yozildi = skriptniIshlat(true);
  assert.match(yozildi, /YOZILDI/);
  assert.match(yozildi, /INVARIANT: jami qarz o'zgarmadi/);

  // Ikkala qarz ham BITTA kartochka ostida.
  const kanonikQarzlari = await rawPrisma.debt.count({
    where: { businessId: disney.business.id, contactId: kanonikId },
  });
  assert.equal(kanonikQarzlari, 2, "ikkala qarz kanonik kartochkaga bog'lanishi kerak");
  assert.equal(
    await rawPrisma.debt.count({ where: { contactId: dublikatId } }),
    0,
    "dublikatda qarz qolmasligi kerak"
  );

  // Dublikat YUMSHOQ o'chiriladi — tarix va audit izi qoladi.
  const ochirilgan = await rawPrisma.contact.findUnique({ where: { id: dublikatId } });
  assert.ok(ochirilgan, "dublikat qattiq o'chirilmasligi kerak");
  assert.ok(ochirilgan.deletedAt, "dublikat yumshoq o'chirilishi kerak");

  // Kanonikda bo'sh bo'lgan maydon dublikatdan to'ldiriladi, to'lgani esa
  // ustidan yozilmaydi.
  const yangilangan = await rawPrisma.contact.findUnique({ where: { id: kanonikId } });
  assert.equal(yangilangan.manzil, "Navoiy sh.", "bo'sh maydon to'ldiriladi");
  assert.equal(yangilangan.izoh, "Doimiy mijoz", "kanonik qiymat saqlanadi");

  // Qarzdorlar ro'yxatida endi BITTA karta, ichida ikkita ochiq qarz.
  const keyin = await D(async () =>
    qarzQ.listQarzdorlar(disney.business.id, { turi: "olinadigan" })
  );
  const bozorov = keyin.filter((r: any) => r.ism.toLowerCase().includes("bozorov"));
  assert.equal(bozorov.length, 1, "bir mijoz — bitta qarzdor kartasi");
  assert.equal(bozorov[0].qarz, 1_100_000, "800 000 + 300 000 = 1 100 000");
  assert.equal(bozorov[0].ochiqSoni, 2, "qarzlar alohida tarix bo'lib qoladi");
});

test("7. Birlashtirish jami ochiq qarzni bir so'mga ham o'zgartirmaydi", async () => {
  assert.equal(await jamiOchiqQarz(), birlashOldinJami);
});

test("7b. Skript IDEMPOTENT — ikkinchi ishga tushirishda guruh qolmaydi", async () => {
  const takror = skriptniIshlat(false);
  assert.match(takror, /Dublikat guruhlar\s+: 0/);
});

// ---------------------------------------------------------------------------
// 8. Tahrir orqali dublikat
// ---------------------------------------------------------------------------

test("8. Tahrirda boshqa mijozning telefonini berib bo'lmaydi", async () => {
  const boshqa = await D(async () =>
    mijozSvc.createMijoz(disney.business.id, disney.user.id, {
      ism: "Sardor Toshev",
      tel: "+998935554433",
    })
  );

  await assert.rejects(
    () =>
      D(async () =>
        mijozSvc.updateMijoz(disney.business.id, boshqa.id, { tel: "90 111 22 33" })
      ),
    /Bu telefon raqamli mijoz mavjud/
  );

  const ozgarmagan = await rawPrisma.contact.findUnique({ where: { id: boshqa.id } });
  assert.equal(ozgarmagan.tel, "+998935554433", "telefon o'zgarmasligi kerak");

  // O'Z raqamini qayta saqlash — dublikat EMAS (boshqa formatda bo'lsa ham).
  const yangilangan = await D(async () =>
    mijozSvc.updateMijoz(disney.business.id, boshqa.id, { tel: "93 555 44 33" })
  );
  assert.equal(yangilangan.tel, "+998935554433");
});
