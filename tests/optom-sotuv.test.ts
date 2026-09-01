/**
 * OPTOM SOTUV — mijoz majburiyligi va Sotuv → Mijoz → Qarz zanjiri.
 *
 * Asosiy qoidalar (server tomonda, frontendga ishonilmaydi):
 *   - optom biznesda mijozsiz sotuv O'TMAYDI (naqdda ham);
 *   - qarzga sotuvda mijoz HAR QANDAY biznes turida majburiy;
 *   - chakana (umumiy) naqd sotuv mijozsiz ishlayveradi;
 *   - mijozli sotuv kartochkaga bog'lanadi, ombor kamayadi, qarz/kirim
 *     bitta tranzaksiyada yoziladi.
 *
 * Ishga tushirish: npm run test:optom
 */
process.env.DATABASE_URL = "file:./prisma/test-optom-sotuv.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let omborSvc: any;
let mijozQ: any;

let T: any;
let productId: string;

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

function sotuv(p: {
  tolovTuri: "naqd" | "qarz";
  contactId?: string;
  mijozNomi?: string;
  mijozTel?: string;
  miqdor?: number;
}) {
  return A(async () =>
    omborSvc.createSale({
      businessId: T.business.id,
      productId,
      miqdor: p.miqdor ?? 1,
      tolovTuri: p.tolovTuri,
      contactId: p.contactId,
      mijozNomi: p.mijozNomi,
      mijozTel: p.mijozTel,
      mijozSaqla: true,
      userId: T.user.id,
      sana: "2026-08-20",
    })
  );
}

function qoldiq(): Promise<number> {
  return A(async () => {
    const p = await rawPrisma.product.findUnique({ where: { id: productId } });
    return p.miqdor;
  });
}

before(async () => {
  rmSync("prisma/test-optom-sotuv.db", { force: true });
  rmSync("prisma/test-optom-sotuv.db-journal", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  omborSvc = await import("@/lib/services/inventory");
  mijozQ = await import("@/lib/queries/mijoz");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Isfan optom",
    ism: "Direktor",
    login: "+998900000701",
    parol: "parol12345",
  });

  // Biznes OPTOM rejimga o'tkaziladi (turi — oddiy string ustun, migratsiyasiz).
  await rawPrisma.business.update({
    where: { id: T.business.id },
    data: { turi: "optom", omborli: true },
  });

  const p = await rawPrisma.product.create({
    data: {
      businessId: T.business.id,
      nomi: "Qog'oz A4",
      kelganNarx: 30_000,
      sotuvNarx: 45_000,
      miqdor: 100,
    },
  });
  productId = p.id;
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1-2. Optom qoida: mijozsiz sotuv o'tmaydi
// ---------------------------------------------------------------------------

test("1. Optom biznesda NAQD mijozsiz sotuv rad etiladi", async () => {
  await assert.rejects(
    () => sotuv({ tolovTuri: "naqd" }),
    /mijoz/i,
    "optom naqd sotuvda mijoz talab qilinishi kerak"
  );
  assert.equal(await qoldiq(), 100, "rad etilgan sotuv omborga tegmasligi kerak");
});

test("2. Optom biznesda QARZGA mijozsiz sotuv rad etiladi", async () => {
  await assert.rejects(() => sotuv({ tolovTuri: "qarz" }), /mijoz/i);
  assert.equal(await qoldiq(), 100);
});

// ---------------------------------------------------------------------------
// 3-4. Mijozli sotuvlar: kartochka, ombor, kirim/qarz
// ---------------------------------------------------------------------------

let akmalContactId: string;

test("3. Naqd sotuv mijoz bilan: kartochka ochiladi, kirim yoziladi, ombor kamayadi", async () => {
  const s = await sotuv({
    tolovTuri: "naqd",
    mijozNomi: "Akmal Savdo",
    mijozTel: "+998901234567",
    miqdor: 10,
  });
  assert.ok(s.contactId, "sotuv mijoz kartochkasiga bog'lanishi kerak");
  assert.ok(s.transactionId, "naqd sotuv kirim tranzaksiyasini yozishi kerak");
  assert.equal(s.jamiSumma, 450_000);
  assert.equal(await qoldiq(), 90, "ombor 10 taga kamayishi kerak");
  akmalContactId = s.contactId;

  const qarzlar = await A(async () =>
    rawPrisma.debt.count({ where: { businessId: T.business.id } })
  );
  assert.equal(qarzlar, 0, "naqd sotuvda qarz yaratilmasligi kerak");
});

test("4. Qarzga sotuv: BITTA qarz yoziladi, kirim yozilmaydi, mijozga bog'lanadi", async () => {
  const s = await sotuv({ tolovTuri: "qarz", contactId: akmalContactId, miqdor: 50 });
  assert.equal(s.contactId, akmalContactId);
  assert.equal(s.transactionId, null, "qarzga sotuvda kirim yozilmasligi kerak");
  assert.equal(await qoldiq(), 40);

  const qarzlar = await A(async () =>
    rawPrisma.debt.findMany({ where: { businessId: T.business.id } })
  );
  assert.equal(qarzlar.length, 1, "bitta sotuv — bitta qarz (dublikat yo'q)");
  assert.equal(qarzlar[0].contactId, akmalContactId);
  assert.equal(qarzlar[0].jamiSumma, 2_250_000);
  assert.equal(qarzlar[0].saleId, s.id, "qarz sotuvga bog'lanishi kerak");
});

// ---------------------------------------------------------------------------
// 5. Mijoz kartochkasi statistikasi (source-of-truth'dan)
// ---------------------------------------------------------------------------

test("5. Kartochka: jami xarid, to'lov, joriy qarz va oxirgi sotuv to'g'ri", async () => {
  const k = await A(async () => mijozQ.getMijozKartochka(T.business.id, akmalContactId));
  assert.ok(k, "kartochka topilishi kerak");
  assert.equal(k.mijoz.jamiSotuv, 450_000 + 2_250_000, "jami xarid = naqd + qarz sotuvlar");
  assert.equal(k.mijoz.sotuvSoni, 2);
  assert.equal(k.mijoz.ochiqQarz, 2_250_000, "joriy qarz = qarzga sotuv summasi");
  assert.equal(k.jamiTolov, 450_000, "to'lov = naqd sotuv (qarz to'lovi hali yo'q)");
  assert.ok(k.oxirgiSotuv, "oxirgi sotuv sanasi bo'lishi kerak");
});

// ---------------------------------------------------------------------------
// 6-7. Chakana (umumiy) biznes: eski xatti-harakat buzilmagan
// ---------------------------------------------------------------------------

test("6. Umumiy biznesda naqd mijozsiz sotuv ISHLAYDI (regressiya yo'q)", async () => {
  await rawPrisma.business.update({ where: { id: T.business.id }, data: { turi: "umumiy" } });
  const s = await sotuv({ tolovTuri: "naqd", miqdor: 2 });
  assert.equal(s.contactId, null, "mijozsiz naqd sotuvda kartochka yo'q");
  assert.equal(await qoldiq(), 38);
});

test("7. Umumiy biznesda ham QARZGA mijozsiz sotuv rad etiladi", async () => {
  await assert.rejects(() => sotuv({ tolovTuri: "qarz" }), /mijoz/i);
  assert.equal(await qoldiq(), 38);
  // Keyingi testlar uchun optomga qaytariladi.
  await rawPrisma.business.update({ where: { id: T.business.id }, data: { turi: "optom" } });
});

// ---------------------------------------------------------------------------
// 8. Dublikat mijoz: xuddi shu ism/telefon ikkinchi kartochka ochmaydi
// ---------------------------------------------------------------------------

test("8. Bir xil mijozga ikkinchi sotuv yangi kartochka ochmaydi", async () => {
  const s = await sotuv({
    tolovTuri: "naqd",
    mijozNomi: "Akmal Savdo",
    mijozTel: "+998901234567",
    miqdor: 1,
  });
  assert.equal(s.contactId, akmalContactId, "telefon bo'yicha mavjud kartochka topilishi kerak");
  const soni = await A(async () =>
    rawPrisma.contact.count({ where: { businessId: T.business.id, deletedAt: null } })
  );
  assert.equal(soni, 1, "dublikat kartochka yaratilmasligi kerak");
});
