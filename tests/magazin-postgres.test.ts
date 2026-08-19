/**
 * MAGAZIN — POSTGRESQL CONCURRENCY.
 *
 * Nega alohida to'plam: SQLite/Turso yozuv tranzaksiyalarini
 * KETMA-KETLASHTIRADI, ya'ni u yerda chek raqami poygasi UMUMAN yuzaga
 * kelmaydi va `tests/magazin.test.ts` bu xavfni sinay olmaydi. PostgreSQL
 * esa READ COMMITTED bilan ishlaydi: ikki kassir bir vaqtda sotsa ikkalasi
 * ham bir xil `max(raqam)` ni o'qishi mumkin.
 *
 * Shu bois production bazasi (Postgres) bilan aynan shu holat sinaladi:
 *   - dublikat chek raqami CHIQMASLIGI kerak (unique cheklov + qayta urinish);
 *   - parallel sotuvlarning HAMMASI muvaffaqiyatli tugashi kerak
 *     (qayta urinish ishlayotgani — foydalanuvchi xato ko'rmaydi);
 *   - qoldiq va pul yozuvlari to'g'ri qolishi kerak.
 *
 * Ishga tushirish:
 *   PG_TEST_URL="postgresql://postgres@127.0.0.1:5433/balansa_magazin" \
 *     npm run test:magazin-postgres
 *
 * `PG_TEST_URL` berilmasa to'plam O'TKAZIB YUBORILADI — Postgres yo'q
 * mashinada ham yashil qoladi (tests/postgres.test.ts bilan bir xil qoida).
 *
 * ⚠️ Ko'rsatilgan baza TO'LIQ TOZALANADI. Faqat sinov bazasini bering.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PG = process.env.PG_TEST_URL;
const sabab = PG ? undefined : "PG_TEST_URL sozlanmagan — Postgres testlari o'tkazib yuborildi";

// Dialekt va Prisma adapteri `DATABASE_URL` dan aniqlanadi — import'dan OLDIN.
process.env.DATABASE_URL = PG ?? "postgresql://sinov:sinov@127.0.0.1:5432/sinov";

const MIGRATSIYA = "prisma/migrations-postgres/00000000000000_init/migration.sql";

let rawPrisma: any;
let runWithTenant: any;
let pos: any;
let dokon: { tenantId: string; businessId: string; userId: string };

/** Sinov ma'lumotini xom SQL bilan quramiz — signup oqimi bu yerda tekshirilmaydi. */
async function sxemaVaMalumot() {
  const { Client } = (await import("pg")) as typeof import("pg");
  const c = new Client({ connectionString: PG });
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await c.query(readFileSync(MIGRATSIYA, "utf8"));

  const now = "NOW()";
  await c.query(
    `INSERT INTO "Tenant" ("id","name","slug","status","plan","bepul","createdAt","updatedAt")
     VALUES ('T1','Disney Navoiy','disney-navoiy','ACTIVE','STANDARD',false,${now},${now})`
  );
  await c.query(
    `INSERT INTO "Business" ("id","nomi","isActive","omborli","turi","shaxsiyKassa","magazin","createdAt","tenantId")
     VALUES ('B1','Disney',true,true,'umumiy',false,true,${now},'T1')`
  );
  await c.query(
    `INSERT INTO "User" ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId")
     VALUES ('U1','Kassir','+998900000001','x','OWNER',true,${now},false,'T1')`
  );
  await c.query(
    `INSERT INTO "Account" ("id","businessId","nomi","turi","isActive","tartib","createdAt")
     VALUES ('A1','B1','Naqd kassa','naqd',true,0,${now})`
  );
  await c.query(
    `INSERT INTO "TenantModule" ("id","tenantId","code","isActive","createdAt")
     VALUES ('M1','T1','OMBOR',true,${now}), ('M2','T1','MAGAZIN',true,${now})`
  );
  await c.end();
}

/** Tenant kontekstida bajarish (xizmat qatlami shuni talab qiladi). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function D(fn: () => unknown): Promise<any> {
  return runWithTenant(dokon.tenantId, fn, { userId: dokon.userId, ism: "Kassir" });
}

before(async () => {
  if (!PG) return;
  await sxemaVaMalumot();

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  pos = await import("@/lib/services/pos");
  dokon = { tenantId: "T1", businessId: "B1", userId: "U1" };
});

after(async () => {
  await rawPrisma?.$disconnect();
});

/** Sinov mahsuloti yaratadi. */
async function mahsulot(id: string, nomi: string, narx: number, miqdor: number) {
  await rawPrisma.product.create({
    data: {
      id,
      businessId: dokon.businessId,
      nomi,
      kelganNarx: Math.round(narx * 0.7),
      sotuvNarx: narx,
      miqdor,
    },
  });
  return id;
}

function sot(satrlar: Array<{ productId: string; miqdor: number }>) {
  return D(() =>
    pos.posSotuv({
      businessId: dokon.businessId,
      userId: dokon.userId,
      satrlar,
      tolovTuri: "naqd",
    })
  );
}

test("Postgres adapteri ishlayapti (sanity)", { skip: sabab }, async () => {
  const n = await rawPrisma.business.count();
  assert.equal(n, 1);
});

test(
  "PARALLEL 2 SOTUV bir xil chek raqamini OLMAYDI",
  { skip: sabab },
  async () => {
    // Talabdagi asosiy stsenariy: aynan ikkita bir vaqtli sotuv.
    await mahsulot("P_A", "Coca-Cola", 12_000, 500);
    await mahsulot("P_B", "Fanta", 11_000, 500);

    const [a, b] = await Promise.all([
      sot([{ productId: "P_A", miqdor: 1 }]),
      sot([{ productId: "P_B", miqdor: 1 }]),
    ]);

    assert.notEqual(a.raqam, b.raqam, "ikki parallel sotuv bir xil chek raqamini olmasligi kerak");
    assert.deepEqual([a.raqam, b.raqam].sort((x, y) => x - y), [1, 2]);

    // Bazada ham dublikat yo'q.
    const cheklar = await rawPrisma.posChek.findMany({
      where: { businessId: dokon.businessId },
      select: { raqam: true },
    });
    const raqamlar = cheklar.map((c: { raqam: number }) => c.raqam);
    assert.equal(new Set(raqamlar).size, raqamlar.length, "dublikat chek raqami topildi");
  }
);

test(
  "20 ta parallel sotuv: hammasi o'tadi, raqamlar 1..N va takrorlanmaydi",
  { skip: sabab },
  async () => {
    await rawPrisma.sale.deleteMany({ where: { businessId: dokon.businessId } });
    await rawPrisma.posChek.deleteMany({ where: { businessId: dokon.businessId } });
    await rawPrisma.transaction.deleteMany({ where: { businessId: dokon.businessId } });

    // HAR SOTUV O'Z MAHSULOTI bilan — bu ataylab.
    //
    // Bir xil mahsulot sotilganda `product.updateMany` o'sha qatorga qulf
    // qo'yadi va tranzaksiyalar SHU YERDA navbatga tushadi; natijada chek
    // raqami poygasi umuman yuzaga kelmaydi va test hech narsani sinamaydi
    // (buni tekshirib ko'rildi: retry o'chirilganda ham yashil qolardi).
    //
    // Haqiqiy do'konda esa kassirlar TURLI tovarlarni urishadi — umumiy
    // qator qulfi yo'q, ya'ni `max(raqam)` ni hammasi bir vaqtda o'qiydi.
    // Aynan shu holat sinaladi.
    const N = 20;
    for (let i = 0; i < N; i++) {
      await mahsulot(`P_N${i}`, `Tovar ${i}`, 5_000, 10);
    }

    const natijalar = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => sot([{ productId: `P_N${i}`, miqdor: 1 }]))
    );

    const yiqilgan = natijalar.filter((r) => r.status === "rejected");
    assert.equal(
      yiqilgan.length,
      0,
      `qayta urinish ishlamadi — ${yiqilgan.length} ta sotuv yiqildi: ` +
        yiqilgan
          .map((r) => String((r as PromiseRejectedResult).reason?.message))
          .slice(0, 3)
          .join(" | ")
    );

    const raqamlar = (
      await rawPrisma.posChek.findMany({
        where: { businessId: dokon.businessId },
        select: { raqam: true },
        orderBy: { raqam: "asc" },
      })
    ).map((c: { raqam: number }) => c.raqam);

    assert.equal(raqamlar.length, N);
    assert.equal(new Set(raqamlar).size, N, "dublikat chek raqami topildi");
    assert.deepEqual(
      raqamlar,
      Array.from({ length: N }, (_, i) => i + 1),
      "raqamlar 1..N ketma-ketligi bo'lishi kerak"
    );
  }
);

test(
  "Parallel sotuvda ombor qoldig'i va pul yozuvlari to'g'ri qoladi",
  { skip: sabab },
  async () => {
    const oldin = await rawPrisma.product.findUnique({ where: { id: "P_B" } });
    const N = 10;
    await Promise.all(
      Array.from({ length: N }, () => sot([{ productId: "P_B", miqdor: 2 }]))
    );
    const keyin = await rawPrisma.product.findUnique({ where: { id: "P_B" } });
    assert.equal(
      keyin.miqdor,
      oldin.miqdor - N * 2,
      "parallel sotuvda qoldiq aniq N×2 ga kamayishi kerak (yo'qolgan yoki qo'sh yozuv yo'q)"
    );

    // Har chek uchun ANIQ BITTA kirim tranzaksiya.
    const cheklar = await rawPrisma.posChek.findMany({
      where: { businessId: dokon.businessId, tolovTuri: "naqd" },
      select: { id: true, transactionId: true, jamiSumma: true },
    });
    assert.ok(cheklar.every((c: { transactionId: string | null }) => !!c.transactionId));
    const txIds = cheklar.map((c: { transactionId: string }) => c.transactionId);
    assert.equal(new Set(txIds).size, txIds.length, "ikki chek bitta tranzaksiyaga bog'lanmasin");
  }
);

test(
  "DEADLOCK YO'Q: qarama-qarshi tartibdagi savatlar parallel sotiladi",
  { skip: sabab },
  async () => {
    // Ikki kassir bir xil ikki tovarni TESKARI tartibda urgan holat.
    // Xizmat qatlami satrlarni productId bo'yicha saralaydi, shuning uchun
    // qator qulflari bir xil ketma-ketlikda olinadi va kutish halqasi
    // tuzilmaydi. Saralash olib tashlansa bu test 40P01 bilan yiqiladi.
    await rawPrisma.product.update({ where: { id: "P_A" }, data: { miqdor: 500 } });
    await rawPrisma.product.update({ where: { id: "P_B" }, data: { miqdor: 500 } });

    const natijalar = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        sot(
          i % 2 === 0
            ? [
                { productId: "P_A", miqdor: 1 },
                { productId: "P_B", miqdor: 1 },
              ]
            : [
                { productId: "P_B", miqdor: 1 },
                { productId: "P_A", miqdor: 1 },
              ]
        )
      )
    );

    const yiqilgan = natijalar.filter((r) => r.status === "rejected");
    assert.equal(
      yiqilgan.length,
      0,
      "teskari tartibdagi savatlar deadlock berdi: " +
        yiqilgan
          .map((r) => String((r as PromiseRejectedResult).reason?.message))
          .slice(0, 3)
          .join(" | ")
    );
  }
);

test(
  "Qoldiq poygasi Postgres'da ham ushlanadi: 1 dona, 5 kassir",
  { skip: sabab },
  async () => {
    await mahsulot("P_LAST", "Oxirgi tort", 120_000, 1);
    const natijalar = await Promise.allSettled(
      Array.from({ length: 5 }, () => sot([{ productId: "P_LAST", miqdor: 1 }]))
    );
    const otgan = natijalar.filter((r) => r.status === "fulfilled").length;
    assert.equal(otgan, 1, "faqat bittasi o'tishi kerak — manfiy qoldiq bo'lmaydi");

    const p = await rawPrisma.product.findUnique({ where: { id: "P_LAST" } });
    assert.equal(p.miqdor, 0);
  }
);

test(
  "Chek raqami BIZNES ichida — boshqa biznes raqamiga ta'sir qilmaydi",
  { skip: sabab },
  async () => {
    await rawPrisma.business.create({
      data: {
        id: "B2",
        nomi: "Ikkinchi do'kon",
        tenantId: "T1",
        omborli: true,
        magazin: true,
      },
    });
    await rawPrisma.account.create({
      data: { id: "A2", businessId: "B2", nomi: "Naqd kassa", turi: "naqd", tartib: 0 },
    });
    await rawPrisma.product.create({
      data: {
        id: "P_B2",
        businessId: "B2",
        nomi: "Ikkinchi do'kon tovari",
        kelganNarx: 1_000,
        sotuvNarx: 2_000,
        miqdor: 50,
      },
    });

    const chek = await D(() =>
      pos.posSotuv({
        businessId: "B2",
        userId: dokon.userId,
        satrlar: [{ productId: "P_B2", miqdor: 1 }],
        tolovTuri: "naqd",
      })
    );
    assert.equal(chek.raqam, 1, "yangi biznesda raqam 1 dan boshlanishi kerak");

    // B1 dagi raqamlar tegilmagan.
    const b1 = await rawPrisma.posChek.count({ where: { businessId: "B1" } });
    assert.ok(b1 > 1);
  }
);
