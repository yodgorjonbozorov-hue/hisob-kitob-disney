/**
 * MIJOZLAR MODULI (Faza 6.3) — mijoz kartochkasi va qarz limiti.
 *
 * Ilgari sotuv va qarzda mijoz faqat ERKIN MATN edi: "Akmal", "akmal aka",
 * "Akmal 90-..." — bularning bittaligini tizim bilmasdi, shuning uchun
 * "bu odam bizga qancha qarz?" degan savolga javob yo'q edi. Endi sotuv va
 * qarz kartochkaga bog'lanadi, kartochkada esa qarz chegarasi bor.
 *
 * Ishga tushirish: npm run test:mijozlar
 */
process.env.DATABASE_URL = "file:./prisma/test-mijozlar.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let mijoz: any;
let queries: any;
let inventory: any;
let createTenantWithOwner: any;

let t: any;
let t2: any;
let mahsulot: any;
let akmal: any;
let bekhzod: any;

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

function sotuv(params: { contactId?: string | null; miqdor: number; tolovTuri: "naqd" | "qarz" }) {
  return T(async () =>
    inventory.createSale({
      businessId: t.business.id,
      productId: mahsulot.id,
      miqdor: params.miqdor,
      tolovTuri: params.tolovTuri,
      contactId: params.contactId ?? null,
      mijozNomi: params.tolovTuri === "qarz" ? "Mijoz" : null,
      sana: "2026-08-04",
      userId: t.user.id,
    })
  );
}

before(async () => {
  rmSync("prisma/test-mijozlar.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  mijoz = await import("@/lib/services/mijoz");
  queries = await import("@/lib/queries/mijoz");
  inventory = await import("@/lib/services/inventory");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Mijoz test",
    ism: "Egasi",
    login: "+998922222501",
    parol: "parol12345",
  });
  t2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona firma",
    ism: "Begona",
    login: "+998922222502",
    parol: "parol12345",
  });
  await rawPrisma.business.update({ where: { id: t.business.id }, data: { omborli: true } });

  mahsulot = await rawPrisma.product.create({
    data: {
      businessId: t.business.id,
      nomi: "Sement", kelganNarx: 40_000, sotuvNarx: 50_000, miqdor: 1000, birlik: "quti",
    },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Kartochka ----------

test("mijoz yaratiladi va ro'yxatda ko'rinadi", async () => {
  akmal = await T(async () =>
    mijoz.createMijoz(t.business.id, t.user.id, {
      ism: "Akmal aka", tel: "+998901112233", qarzLimit: 1_000_000,
    })
  );
  bekhzod = await T(async () =>
    mijoz.createMijoz(t.business.id, t.user.id, { ism: "Bekhzod" })
  );

  const royxat = await T(async () => queries.listMijozlar(t.business.id));
  assert.equal(royxat.length, 2);
  const a = royxat.find((m: any) => m.id === akmal.id);
  assert.equal(a.qarzLimit, 1_000_000);
  assert.equal(a.ochiqQarz, 0);
  assert.equal(a.jamiSotuv, 0);
  assert.equal(a.limitToldi, false);

  const b = royxat.find((m: any) => m.id === bekhzod.id);
  assert.equal(b.qarzLimit, null, "limitsiz mijoz — chegara yo'q");
});

test("naqd sotuv kartochkaga bog'lanadi va jami sotuvga qo'shiladi", async () => {
  await sotuv({ contactId: akmal.id, miqdor: 4, tolovTuri: "naqd" });

  const royxat = await T(async () => queries.listMijozlar(t.business.id));
  const a = royxat.find((m: any) => m.id === akmal.id);
  assert.equal(a.jamiSotuv, 200_000);
  assert.equal(a.sotuvSoni, 1);
  assert.equal(a.ochiqQarz, 0, "naqd sotuv qarz yaratmaydi");
});

// ---------- Qarz limiti ----------

test("limitdan past qarzga sotuv o'tadi", async () => {
  await sotuv({ contactId: akmal.id, miqdor: 12, tolovTuri: "qarz" }); // 600 000

  const holat = await T(async () => mijoz.mijozQarzHolati(t.business.id, akmal.id));
  assert.equal(holat.ochiqQarz, 600_000);
  assert.equal(holat.limit, 1_000_000);
  assert.equal(holat.qolgan, 400_000);
});

test("limitdan OSHADIGAN qarzga sotuv rad etiladi", async () => {
  const oldingiQoldiq = (await rawPrisma.product.findUnique({ where: { id: mahsulot.id } })).miqdor;

  await assert.rejects(
    () => sotuv({ contactId: akmal.id, miqdor: 10, tolovTuri: "qarz" }), // +500 000 > 400 000
    /qarz limiti/
  );

  const keyingiQoldiq = (await rawPrisma.product.findUnique({ where: { id: mahsulot.id } })).miqdor;
  assert.equal(keyingiQoldiq, oldingiQoldiq, "rad etilgan sotuv ombordan tovar olmasligi kerak");

  const holat = await T(async () => mijoz.mijozQarzHolati(t.business.id, akmal.id));
  assert.equal(holat.ochiqQarz, 600_000, "qarz o'zgarmasligi kerak");
});

test("limitga AYNAN teng qarz o'tadi", async () => {
  await sotuv({ contactId: akmal.id, miqdor: 8, tolovTuri: "qarz" }); // +400 000 = 1 000 000
  const holat = await T(async () => mijoz.mijozQarzHolati(t.business.id, akmal.id));
  assert.equal(holat.ochiqQarz, 1_000_000);
  assert.equal(holat.qolgan, 0);
});

test("limit to'lgach eng kichik qarz ham o'tmaydi", async () => {
  await assert.rejects(
    () => sotuv({ contactId: akmal.id, miqdor: 1, tolovTuri: "qarz" }),
    /qarz limiti/
  );
});

test("naqd sotuv limitdan qat'i nazar o'tadi", async () => {
  const natija = await sotuv({ contactId: akmal.id, miqdor: 20, tolovTuri: "naqd" });
  assert.ok(natija, "limit faqat QARZGA sotuvni cheklaydi");
});

test("to'lov qilingach limitda joy bo'shaydi", async () => {
  const qarz = await rawPrisma.debt.findFirst({
    where: { businessId: t.business.id, contactId: akmal.id, isYopilgan: false },
  });
  await rawPrisma.debt.update({
    where: { id: qarz.id },
    data: { tolangan: 300_000 },
  });

  const holat = await T(async () => mijoz.mijozQarzHolati(t.business.id, akmal.id));
  assert.equal(holat.ochiqQarz, 700_000, "to'langan qism qarz qoldig'idan chiqadi");
  assert.equal(holat.qolgan, 300_000);

  // Endi 300 000 so'mlik qarz o'tishi kerak.
  await sotuv({ contactId: akmal.id, miqdor: 6, tolovTuri: "qarz" });
});

test("limitsiz mijozga har qanday qarz o'tadi", async () => {
  await sotuv({ contactId: bekhzod.id, miqdor: 100, tolovTuri: "qarz" }); // 5 000 000
  const holat = await T(async () => mijoz.mijozQarzHolati(t.business.id, bekhzod.id));
  assert.equal(holat.limit, null);
  assert.equal(holat.qolgan, null);
  assert.equal(holat.ochiqQarz, 5_000_000);
});

test("limit 0 — mijozga umuman qarzga sotilmaydi", async () => {
  const naqdchi = await T(async () =>
    mijoz.createMijoz(t.business.id, t.user.id, { ism: "Faqat naqd", qarzLimit: 0 })
  );
  await assert.rejects(
    () => sotuv({ contactId: naqdchi.id, miqdor: 1, tolovTuri: "qarz" }),
    /qarz limiti/
  );
  const naqd = await sotuv({ contactId: naqdchi.id, miqdor: 1, tolovTuri: "naqd" });
  assert.ok(naqd);
});

test("kartochkasiz qarzga sotuv avvalgidek ishlaydi", async () => {
  const natija = await sotuv({ contactId: null, miqdor: 200, tolovTuri: "qarz" });
  assert.ok(natija, "eski xatti-harakat buzilmasligi kerak");
});

// ---------- Kartochka sahifasi ----------

test("kartochka sotuv, qarz va yakunlarni birga qaytaradi", async () => {
  const k = await T(async () => queries.getMijozKartochka(t.business.id, akmal.id));
  assert.ok(k);
  assert.equal(k.mijoz.ism, "Akmal aka");
  assert.ok(k.sotuvlar.length >= 5);
  assert.ok(k.qarzlar.length >= 3);
  assert.equal(
    k.mijoz.ochiqQarz,
    k.qarzlar.filter((d: any) => !d.isYopilgan).reduce((a: number, d: any) => a + d.qoldiq, 0)
  );
  assert.equal(k.bitimlar.length, 0, "CRM bitimi ochilmagan");
});

test("begona tenant kartochkasini ochib bo'lmaydi", async () => {
  const k = await runWithTenant(t2.tenant.id, async () =>
    queries.getMijozKartochka(t2.business.id, akmal.id)
  );
  assert.equal(k, null);

  const royxat = await runWithTenant(t2.tenant.id, async () =>
    queries.listMijozlar(t2.business.id)
  );
  assert.equal(royxat.length, 0);
});

// ---------- O'chirish ----------

test("yopilmagan qarzi bor mijoz o'chirilmaydi", async () => {
  await assert.rejects(
    () => T(async () => mijoz.deleteMijoz(t.business.id, bekhzod.id)),
    /yopilmagan qarz/
  );
});

test("qarzi yo'q mijoz yumshoq o'chiriladi, tarixi qoladi", async () => {
  const yangi = await T(async () =>
    mijoz.createMijoz(t.business.id, t.user.id, { ism: "Vaqtinchalik" })
  );
  await sotuv({ contactId: yangi.id, miqdor: 1, tolovTuri: "naqd" });

  await T(async () => mijoz.deleteMijoz(t.business.id, yangi.id));

  const ochirilgan = await rawPrisma.contact.findUnique({ where: { id: yangi.id } });
  assert.ok(ochirilgan.deletedAt);

  const sotuvlar = await rawPrisma.sale.count({ where: { contactId: yangi.id } });
  assert.equal(sotuvlar, 1, "sotuv tarixi saqlanadi");

  const royxat = await T(async () => queries.listMijozlar(t.business.id));
  assert.ok(!royxat.some((m: any) => m.id === yangi.id), "ro'yxatda ko'rinmaydi");
});
