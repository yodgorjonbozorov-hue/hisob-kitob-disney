/**
 * MOLIYAVIY YOZUV O'ZGARMASLIGI — REGRESSIYA TESTI (audit: Critical #3).
 *
 * Muammo:
 *   1. `PATCH /api/transactions/[id]` summa, sana va turini JOYIDA
 *      o'zgartirardi. Bir oy oldin yozilgan 500 000 so'mlik kirimni bugun
 *      50 000 ga aylantirib qo'yish mumkin edi va bazada avvalgi qiymatdan
 *      iz qolmasdi — hisobot tarixi jimgina qayta yozilardi.
 *   2. `DELETE ?permanent=true` yozuvni bazadan BUTUNLAY o'chirardi: audit
 *      izi ham, savatdan tiklash imkoni ham yo'qolardi.
 *
 * Yechim (loyihadagi mavjud pattern — `cancelSale`, `qarzBekor`,
 * `cancelUserTransfer`): yozuv o'zgarmaydi va o'chmaydi, u SABAB bilan
 * bekor qilinadi va o'rniga tuzatilgani yoziladi.
 *
 * Ishga tushirish: npm run test:tranzaksiya-ozgarmas
 *
 * Alohida test bazasi (prisma/test-tranzaksiya-ozgarmas.db) — dev/prod
 * bazaga tegmaydi.
 */
process.env.DATABASE_URL = "file:./prisma/test-tranzaksiya-ozgarmas.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let createTransaction: any;
let stornoTransaction: any;
let validation: any;
let dateOnlyStringToUTCDate: any;

const TENANT = "t_tox";
const BIZ = "biz_tox";
const OWNER = "u_tox_owner";
const KASSIR = "u_tox_kassir";
const CAT_KIRIM = "cat_tox_kirim";
const CAT_KIRIM2 = "cat_tox_kirim2";

const SANA = "2026-07-10";
const SUMMA = 500_000;

/** Har testda toza yozuv — bekor qilingan yozuvni qayta ishlatib bo'lmaydi. */
async function yozuvYarat(userId = OWNER, summa = SUMMA) {
  return runWithTenant(TENANT, () =>
    createTransaction(userId, BIZ, {
      turi: "kirim",
      categoryId: CAT_KIRIM,
      summa,
      sana: SANA,
      izoh: "Asl yozuv",
      tolovTuri: "naqd",
    })
  );
}

before(async () => {
  rmSync("prisma/test-tranzaksiya-ozgarmas.db", { force: true });

  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));
  ({ stornoTransaction } = await import("@/lib/services/transactionStorno"));
  validation = await import("@/lib/validation/transaction");
  ({ dateOnlyStringToUTCDate } = await import("@/lib/date"));

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "Tox tenant", slug: "tox-tenant", status: "ACTIVE" },
  });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "Tox biznes", tenantId: TENANT } });
  await rawPrisma.user.create({
    data: { id: OWNER, ism: "Direktor", login: "tox_owner", parolHash: "x", rol: "OWNER", tenantId: TENANT, businessId: BIZ },
  });
  await rawPrisma.user.create({
    data: { id: KASSIR, ism: "Kassir", login: "tox_kassir", parolHash: "x", rol: "CASHIER", tenantId: TENANT, businessId: BIZ },
  });
  await rawPrisma.category.create({
    data: { id: CAT_KIRIM, nomi: "Sotuv", turi: "kirim", businessId: BIZ },
  });
  await rawPrisma.category.create({
    data: { id: CAT_KIRIM2, nomi: "Boshqa kirim", turi: "kirim", businessId: BIZ },
  });
  await rawPrisma.account.create({
    data: { id: "acc_tox", nomi: "Kassa", turi: "naqd", businessId: BIZ },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ───────────── 1. PATCH: moliyaviy maydonlar o'zgarmas ─────────────

const mavjud = {
  turi: "kirim",
  summa: SUMMA,
  sana: dateOnlyStringToUTCDateLazy(),
  tolovTuri: "naqd" as string | null,
  accountId: "acc_tox" as string | null,
};

/** `before` dan oldin baholanmasligi uchun — sana obyekti kech quriladi. */
function dateOnlyStringToUTCDateLazy(): Date {
  return new Date(`${SANA}T00:00:00.000Z`);
}

function buzilish(data: Record<string, unknown>) {
  return validation.ozgarmasBuzilishi(data, mavjud, dateOnlyStringToUTCDate);
}

test("summani o'zgartirish RAD etiladi", () => {
  assert.deepEqual(buzilish({ summa: 50_000 }), ["summa"]);
});

test("sanani o'zgartirish RAD etiladi", () => {
  assert.deepEqual(buzilish({ sana: "2026-08-01" }), ["sana"]);
});

test("turini o'zgartirish RAD etiladi", () => {
  assert.deepEqual(buzilish({ turi: "chiqim" }), ["turi"]);
});

test("to'lov turi va kassani o'zgartirish RAD etiladi", () => {
  assert.deepEqual(buzilish({ tolovTuri: "click" }), ["to'lov turi"]);
  assert.deepEqual(buzilish({ accountId: "acc_boshqa" }), ["kassa"]);
});

test("bir nechta maydon birga o'zgarsa hammasi ko'rsatiladi", () => {
  assert.deepEqual(buzilish({ summa: 1, sana: "2026-01-01", turi: "chiqim" }), [
    "turi",
    "summa",
    "sana",
  ]);
});

test("O'ZGARMAGAN qiymat qaytarib yuborilsa o'tadi (mijoz butun obyektni yuboradi)", () => {
  assert.deepEqual(
    buzilish({ turi: "kirim", summa: SUMMA, sana: SANA, tolovTuri: "naqd", accountId: "acc_tox" }),
    [],
    "o'zgarmagan maydonlar so'rovni rad etmasligi kerak"
  );
});

test("moliyaviy bo'lmagan maydonlar (izoh, filial, kategoriya) o'tadi", () => {
  assert.deepEqual(buzilish({ izoh: "yangi izoh", filial: "Chilonzor", categoryId: CAT_KIRIM2 }), []);
});

test("eski yozuvda null tolovTuri: null yuborilsa o'zgarish emas", () => {
  const eski = { ...mavjud, tolovTuri: null, accountId: null };
  assert.deepEqual(validation.ozgarmasBuzilishi({ tolovTuri: null }, eski, dateOnlyStringToUTCDate), []);
  assert.deepEqual(
    validation.ozgarmasBuzilishi({ tolovTuri: "naqd" }, eski, dateOnlyStringToUTCDate),
    ["to'lov turi"],
    "null'dan qiymatga o'tish ham moliyaviy o'zgarish"
  );
});

// ───────────── 2. Manba darajasidagi qo'riqchi ─────────────

test("PATCH bazaga FAQAT moliyaviy bo'lmagan maydonlarni yozadi", () => {
  const kod = readFileSync("src/app/api/transactions/[id]/route.ts", "utf8");

  // PATCH'dagi `prisma.transaction.update({ data: { ... } })` blokining
  // ichidagi maydon nomlari (`include:` gacha — u yerdagi `turi: true`
  // tanlov, yozish emas).
  const bosh = kod.indexOf("prisma.transaction.update");
  assert.ok(bosh > 0, "PATCH'da update chaqiruvi bo'lishi kerak");
  const dataBloki = kod.slice(kod.indexOf("data: {", bosh), kod.indexOf("include:", bosh));

  const yoziladigan = [...dataBloki.matchAll(/\{\s*(\w+):/g)].map((m) => m[1]);
  const ruxsat = ["categoryId", "izoh", "filial"];

  const taqiqlangan = yoziladigan.filter((m) => !ruxsat.includes(m));
  assert.deepEqual(
    taqiqlangan,
    [],
    `PATCH quyidagi maydonlarni yozmoqda: ${taqiqlangan.join(", ")} — ` +
      "moliyaviy maydonlar o'zgarmas bo'lishi kerak"
  );
});

test("route'da butunlay o'chirish (permanent) QOLMAGAN", () => {
  const kod = readFileSync("src/app/api/transactions/[id]/route.ts", "utf8");
  assert.ok(
    !/prisma\.transaction\.delete\s*\(/.test(kod),
    "moliyaviy yozuvni bazadan butunlay o'chiradigan kod bo'lmasligi kerak"
  );
});

test("hech qayerda tranzaksiyani butunlay o'chirish yo'q", () => {
  // Butun manba bo'ylab qo'riqchi: yangi route ham shu yo'ldan ketmasin.
  const res = spawnSync(
    "grep",
    ["-rn", "-e", "transaction\\.delete(", "-e", "transaction\\.deleteMany(", "src/"],
    { encoding: "utf8" }
  );
  const satrlar = res.stdout
    .split("\n")
    .filter(Boolean)
    // Tenantni butunlay o'chirish (superadmin) — bu boshqa amal, tranzaksiya
    // tuzatish yo'li emas.
    .filter((s) => !s.startsWith("src/lib/superadmin/"));
  assert.deepEqual(satrlar, [], `Tranzaksiyani o'chiradigan kod topildi:\n${satrlar.join("\n")}`);
});

// ───────────── 3. Storno: bekor qilish + tuzatish ─────────────

test("storno: asl yozuv bekor qilinadi, BAZADAN yo'qolmaydi", async () => {
  const t = await yozuvYarat();

  const natija = await runWithTenant(TENANT, () =>
    stornoTransaction({
      businessId: BIZ,
      transactionId: t.id,
      sabab: "Summa xato kiritilgan",
      actorId: OWNER,
      actorRol: "OWNER",
    })
  );

  assert.equal(natija.bekorQilingan.id, t.id);
  assert.equal(natija.tuzatilgan, null);

  const asl = await rawPrisma.transaction.findUnique({ where: { id: t.id } });
  assert.ok(asl, "asl yozuv bazada QOLISHI kerak");
  assert.ok(asl.deletedAt, "bekor qilingan deb belgilanishi kerak");
  // Eng muhimi: qiymatlar o'zgarmagan.
  assert.equal(asl.summa, SUMMA, "summa o'zgarmasligi kerak");
  assert.equal(asl.turi, "kirim");
  assert.equal(asl.sana.toISOString().slice(0, 10), SANA);
});

test("storno: tuzatilgan yozuv YANGI id bilan yoziladi, asl tegilmaydi", async () => {
  const t = await yozuvYarat();

  const natija = await runWithTenant(TENANT, () =>
    stornoTransaction({
      businessId: BIZ,
      transactionId: t.id,
      sabab: "Summa 500 000 emas, 450 000 bo'lishi kerak",
      actorId: OWNER,
      actorRol: "OWNER",
      tuzatish: {
        turi: "kirim",
        categoryId: CAT_KIRIM,
        summa: 450_000,
        sana: SANA,
        izoh: "Tuzatilgan",
        tolovTuri: "naqd",
      },
    })
  );

  assert.ok(natija.tuzatilgan, "tuzatilgan yozuv yaratilishi kerak");
  assert.notEqual(natija.tuzatilgan.id, t.id, "tuzatilgani YANGI yozuv bo'lishi kerak");

  const asl = await rawPrisma.transaction.findUnique({ where: { id: t.id } });
  assert.equal(asl.summa, SUMMA, "asl yozuv summasi tegilmasligi kerak");
  assert.ok(asl.deletedAt);

  const yangi = await rawPrisma.transaction.findUnique({ where: { id: natija.tuzatilgan.id } });
  assert.equal(yangi.summa, 450_000);
  assert.equal(yangi.deletedAt, null);
  assert.equal(yangi.businessId, BIZ);
});

test("storno: sabab MAJBURIY", async () => {
  const t = await yozuvYarat();
  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        stornoTransaction({
          businessId: BIZ,
          transactionId: t.id,
          sabab: "   ",
          actorId: OWNER,
          actorRol: "OWNER",
        })
      ),
    /sababi yozilishi shart/
  );

  const asl = await rawPrisma.transaction.findUnique({ where: { id: t.id } });
  assert.equal(asl.deletedAt, null, "sababsiz so'rov yozuvga TEGMASLIGI kerak");
});

test("storno: ikki marta bekor qilib bo'lmaydi", async () => {
  const t = await yozuvYarat();
  const bekor = () =>
    runWithTenant(TENANT, () =>
      stornoTransaction({
        businessId: BIZ,
        transactionId: t.id,
        sabab: "Xato",
        actorId: OWNER,
        actorRol: "OWNER",
      })
    );

  await bekor();
  await assert.rejects(bekor, /allaqachon bekor qilingan/);
});

test("storno: xodim BOSHQANING yozuvini bekor qila olmaydi", async () => {
  const t = await yozuvYarat(OWNER);

  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        stornoTransaction({
          businessId: BIZ,
          transactionId: t.id,
          sabab: "Xato",
          actorId: KASSIR,
          actorRol: "CASHIER",
        })
      ),
    /o'zingiz kiritgan/
  );

  const asl = await rawPrisma.transaction.findUnique({ where: { id: t.id } });
  assert.equal(asl.deletedAt, null, "ruxsatsiz urinish yozuvga tegmasligi kerak");
});

test("storno: xodim O'Z yozuvini bekor qila oladi", async () => {
  const t = await yozuvYarat(KASSIR);

  const natija = await runWithTenant(TENANT, () =>
    stornoTransaction({
      businessId: BIZ,
      transactionId: t.id,
      sabab: "O'zim xato kiritdim",
      actorId: KASSIR,
      actorRol: "CASHIER",
    })
  );
  assert.equal(natija.bekorQilingan.id, t.id);
});

test("storno: boshqa biznesning yozuviga yetib bo'lmaydi", async () => {
  const t = await yozuvYarat();
  await rawPrisma.business.create({ data: { id: "biz_tox2", nomi: "Ikkinchi", tenantId: TENANT } });

  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        stornoTransaction({
          businessId: "biz_tox2",
          transactionId: t.id,
          sabab: "Xato",
          actorId: OWNER,
          actorRol: "OWNER",
        })
      ),
    /topilmadi/
  );

  const asl = await rawPrisma.transaction.findUnique({ where: { id: t.id } });
  assert.equal(asl.deletedAt, null);
});

test("storno ATOMIK: tuzatish yiqilsa asl yozuv ham bekor qilinmaydi", async () => {
  const t = await yozuvYarat();

  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        stornoTransaction({
          businessId: BIZ,
          transactionId: t.id,
          sabab: "Xato",
          actorId: OWNER,
          actorRol: "OWNER",
          tuzatish: {
            turi: "kirim",
            // Boshqa biznesning kategoriyasi — createTransactionTx rad etadi.
            categoryId: "cat_yoq_bunday",
            summa: 1_000,
            sana: SANA,
          },
        })
      ),
    /Kategoriya/
  );

  const asl = await rawPrisma.transaction.findUnique({ where: { id: t.id } });
  assert.equal(asl.deletedAt, null, "tranzaksiya orqaga qaytishi kerak — yarim holat bo'lmasin");
});

// ───────────── 4. Audit izi ─────────────

test("storno audit jurnaliga sabab bilan tushadi", async () => {
  const t = await yozuvYarat();

  await runWithTenant(
    TENANT,
    () =>
      stornoTransaction({
        businessId: BIZ,
        transactionId: t.id,
        sabab: "Mijoz pulni qaytarib berdi",
        actorId: OWNER,
        actorRol: "OWNER",
        tuzatish: {
          turi: "kirim",
          categoryId: CAT_KIRIM,
          summa: 100_000,
          sana: SANA,
        },
      }),
    { userId: OWNER, ism: "Direktor" }
  );

  const log = await rawPrisma.auditLog.findFirst({
    where: { entity: "transaction", entityId: t.id },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(log, "audit yozuvi bo'lishi kerak");

  const after = JSON.parse(log.after);
  assert.equal(after.sabab, "Mijoz pulni qaytarib berdi");
  assert.ok(after.tuzatilganId, "tuzatilgan yozuv identifikatori saqlanishi kerak");

  // Avvalgi holat ham yozilgan — nima o'zgargani tarixdan o'qiladi.
  const before = JSON.parse(log.before);
  assert.equal(before.summa, SUMMA);
  assert.equal(before.turi, "kirim");
});

// ───────────── 5. Hisobotga ta'siri ─────────────

test("bekor qilingan yozuv hisobotdan chiqadi, tuzatilgani kiradi", async () => {
  // Toza boshlash uchun oldingi testlarning yozuvlarini hisobga olmaymiz:
  // faqat shu testda yaratilgan ikkita yozuv taqqoslanadi.
  const oldin = await rawPrisma.transaction.aggregate({
    where: { businessId: BIZ, deletedAt: null },
    _sum: { summa: true },
  });

  const t = await yozuvYarat(OWNER, 900_000);

  const orada = await rawPrisma.transaction.aggregate({
    where: { businessId: BIZ, deletedAt: null },
    _sum: { summa: true },
  });
  assert.equal((orada._sum.summa ?? 0) - (oldin._sum.summa ?? 0), 900_000);

  await runWithTenant(TENANT, () =>
    stornoTransaction({
      businessId: BIZ,
      transactionId: t.id,
      sabab: "900 000 emas, 90 000",
      actorId: OWNER,
      actorRol: "OWNER",
      tuzatish: { turi: "kirim", categoryId: CAT_KIRIM, summa: 90_000, sana: SANA },
    })
  );

  const keyin = await rawPrisma.transaction.aggregate({
    where: { businessId: BIZ, deletedAt: null },
    _sum: { summa: true },
  });
  assert.equal(
    (keyin._sum.summa ?? 0) - (oldin._sum.summa ?? 0),
    90_000,
    "hisobotda faqat tuzatilgan summa qolishi kerak"
  );
});
