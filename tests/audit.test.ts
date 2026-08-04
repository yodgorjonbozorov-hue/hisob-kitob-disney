/**
 * AVTOMATIK AUDIT + RATE LIMIT TESTLARI (H-2, H-4, S-3, S-7).
 *
 * H-2: audit 66 route'dan atigi 8 tasida edi. Endi u tenant extension'ida —
 * har `create/update/delete` avtomatik ushlanadi, "audit qo'shishni unutish"
 * imkonsiz. Tranzaksiya ichidagi (runBusinessTx) amallar esa servis
 * darajasida biznes hodisasi sifatida yoziladi.
 *
 * Ishga tushirish: npm run test:audit
 */
process.env.DATABASE_URL = "file:./prisma/test-audit.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let inventory: any;
let rateLimitMod: any;
let suhbat: any;

const TENANT = "t_au";
const BIZ = "biz_au";
const USER = "u_au";
const AKTOR = { userId: USER, ism: "Direktor", ip: "10.0.0.1" };

/** Testda so'rov runWithTenant ICHIDA await qilinadi (Prisma promise'i dangasa). */
function tenantda<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(TENANT, fn, AKTOR);
}

before(async () => {
  rmSync("prisma/test-audit.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  inventory = await import("@/lib/services/inventory");
  rateLimitMod = await import("@/lib/rateLimit");
  suhbat = await import("@/lib/ai/suhbat");

  await rawPrisma.tenant.create({ data: { id: TENANT, name: "Audit", slug: "audit", status: "ACTIVE" } });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "Audit biznes", tenantId: TENANT, omborli: true } });
  await rawPrisma.user.create({
    data: { id: USER, ism: "Direktor", login: "au_owner", parolHash: "x", rol: "OWNER", tenantId: TENANT, businessId: BIZ },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

async function auditlar(entity: string) {
  return rawPrisma.auditLog.findMany({ where: { entity }, orderBy: { createdAt: "asc" } });
}

// ---------- Avtomatik audit (extension) ----------

test("kategoriya yaratish/tahrirlash/o'chirish uchalasi ham jurnalga tushadi", async () => {
  const cat = await tenantda(async () =>
    prisma.category.create({ data: { businessId: BIZ, nomi: "Ijara", turi: "chiqim" } })
  );
  await tenantda(async () =>
    prisma.category.update({ where: { id: cat.id }, data: { nomi: "Ijara (yangi)" } })
  );
  await tenantda(async () => prisma.category.delete({ where: { id: cat.id } }));

  const rows = await auditlar("category");
  assert.deepEqual(
    rows.map((r: any) => r.action),
    ["create", "update", "delete"]
  );
  // `before` update'da eski nomni saqlashi kerak.
  const upd = rows[1];
  assert.match(String(upd.before), /Ijara/);
  assert.match(String(upd.after), /Ijara \(yangi\)/);
  assert.equal(upd.entityId, cat.id);
});

test("audit yozuvida aktor, tenant, biznes va IP bo'ladi", async () => {
  const rows = await auditlar("category");
  const r = rows[0];
  assert.equal(r.userId, USER);
  assert.equal(r.userIsm, "Direktor");
  assert.equal(r.tenantId, TENANT);
  assert.equal(r.businessId, BIZ);
  assert.equal(r.ip, "10.0.0.1");
});

test("soft-delete (deletedAt qo'yish) 'delete', tiklash 'restore' deb yoziladi", async () => {
  const cat = await tenantda(async () =>
    prisma.category.create({ data: { businessId: BIZ, nomi: "Sotuv", turi: "kirim" } })
  );
  const tx = await tenantda(async () =>
    prisma.transaction.create({
      data: { turi: "kirim", categoryId: cat.id, businessId: BIZ, summa: 1000, sana: new Date(), userId: USER },
    })
  );
  await tenantda(async () =>
    prisma.transaction.update({ where: { id: tx.id }, data: { deletedAt: new Date() } })
  );
  await tenantda(async () =>
    prisma.transaction.update({ where: { id: tx.id }, data: { deletedAt: null } })
  );

  const rows = (await auditlar("transaction")).filter((r: any) => r.entityId === tx.id);
  assert.deepEqual(
    rows.map((r: any) => r.action),
    ["create", "delete", "restore"],
    "deletedAt qo'yilishi 'delete', olib tashlanishi 'restore' bo'lishi kerak"
  );
});

test("parol hash audit jurnaliga TUSHMAYDI", async () => {
  const u = await tenantda(async () =>
    prisma.user.create({
      data: { ism: "Yangi", login: "au_yangi", parolHash: "juda-maxfiy-hash", rol: "SELLER" },
    })
  );
  const rows = await auditlar("user");
  const yozuv = rows.find((r: any) => r.entityId === u.id);
  assert.ok(yozuv, "foydalanuvchi yaratish jurnalga tushishi kerak");
  assert.ok(!String(yozuv.after).includes("juda-maxfiy-hash"), "parol hash yozilmasligi kerak");
  assert.match(String(yozuv.after), /\*\*\*/);
});

test("AuditLog o'qish audit qilinmaydi (cheksiz sikl bo'lmaydi)", async () => {
  const oldin = await rawPrisma.auditLog.count();
  await tenantda(async () => prisma.auditLog.findMany({ take: 5 }));
  assert.equal(await rawPrisma.auditLog.count(), oldin);
});

// ---------- Tranzaksiya ichidagi amallar (runBusinessTx) ----------

test("sotuv, qarz va mashina xarajati biznes hodisasi sifatida yoziladi", async () => {
  const mashina = await tenantda(async () =>
    inventory.createAvtoMashina({
      businessId: BIZ,
      nomi: "Cobalt",
      olinganNarx: 100_000_000,
      sotuvNarx: 120_000_000,
      tolovTuri: "naqd",
      userId: USER,
    })
  );
  await tenantda(async () =>
    inventory.addProductExpense({
      businessId: BIZ, productId: mashina.id, turi: "boyoq", summa: 1_000_000, userId: USER,
    })
  );
  await tenantda(async () =>
    inventory.createSale({
      businessId: BIZ, productId: mashina.id, miqdor: 1, tolovTuri: "naqd", userId: USER,
    })
  );

  const sotuvlar = await auditlar("sale");
  assert.equal(sotuvlar.length, 1, "sotuv jurnalga tushishi kerak");
  assert.equal(sotuvlar[0].userId, USER, "aktor tranzaksiyadan keyin ham saqlanishi kerak");
  assert.match(String(sotuvlar[0].after), /120000000/);

  const xarajatlar = await auditlar("productExpense");
  assert.equal(xarajatlar.length, 1);
  assert.equal(xarajatlar[0].action, "create");
});

// ---------- Rate limit (baza asosida) ----------

test("rate limit: limitdan oshgan so'rov rad etiladi", async () => {
  const kalit = `sinov:${Date.now()}`;
  for (let i = 0; i < 3; i++) {
    const r = await rateLimitMod.rateLimit(kalit, 3, 60_000);
    assert.equal(r.ok, true, `${i + 1}-urinish o'tishi kerak`);
  }
  const tortinchi = await rateLimitMod.rateLimit(kalit, 3, 60_000);
  assert.equal(tortinchi.ok, false, "limitdan oshgani rad etilishi kerak");
  assert.ok(tortinchi.retryAfter > 0);
});

test("rate limit PARALLEL so'rovlarda ham atomik (hisoblagich o'g'irlanmaydi)", async () => {
  const kalit = `parallel:${Date.now()}`;
  // 10 ta bir vaqtda; limit 4 — aynan 4 tasi o'tishi kerak.
  const natijalar = await Promise.all(
    Array.from({ length: 10 }, () => rateLimitMod.rateLimit(kalit, 4, 60_000))
  );
  const otganlar = natijalar.filter((r: any) => r.ok).length;
  assert.equal(otganlar, 4, `4 ta o'tishi kerak edi, ${otganlar} ta o'tdi`);
});

test("rate limit reset hisoblagichni tozalaydi", async () => {
  const kalit = `reset:${Date.now()}`;
  await rateLimitMod.rateLimit(kalit, 1, 60_000);
  assert.equal((await rateLimitMod.rateLimit(kalit, 1, 60_000)).ok, false);
  await rateLimitMod.rateLimitReset(kalit, 60_000);
  assert.equal((await rateLimitMod.rateLimit(kalit, 1, 60_000)).ok, true);
});

test("eskirgan rate limit yozuvlari tozalanadi, joriylari qoladi", async () => {
  const joriy = `joriy:${Date.now()}`;
  await rateLimitMod.rateLimit(joriy, 5, 60 * 60 * 1000);
  // Qo'lda eskirgan yozuv (oynasi allaqachon tugagan).
  await rawPrisma.appSetting.create({ data: { key: "rl:eski:1000:1", value: "9" } });

  const soni = await rateLimitMod.cleanupRateLimits();
  assert.ok(soni >= 1, "eskirgan yozuv o'chirilishi kerak");
  assert.equal(await rawPrisma.appSetting.findUnique({ where: { key: "rl:eski:1000:1" } }), null);
  const qolgan = await rawPrisma.appSetting.findMany({ where: { key: { startsWith: `rl:${joriy}:` } } });
  assert.equal(qolgan.length, 1, "joriy oyna yozuvi qolishi kerak");
});

// ---------- AI suhbati serverda ----------

test("AI suhbat tarixi serverda saqlanadi va MAX_TARIX bilan cheklanadi", async () => {
  const kalit = { businessId: BIZ, userId: USER };
  assert.deepEqual(await suhbat.tarixniOl(kalit), [], "boshida bo'sh");

  for (let i = 0; i < 15; i++) {
    await suhbat.tarixgaYoz({ ...kalit, tenantId: TENANT }, `savol ${i}`, `javob ${i}`);
  }
  const tarix = await suhbat.tarixniOl(kalit);
  assert.equal(tarix.length, suhbat.MAX_TARIX, "tarix cheklanishi kerak");
  assert.equal(tarix[tarix.length - 1].matn, "javob 14", "oxirgi javob saqlanadi");
  assert.equal(tarix[tarix.length - 2].matn, "savol 14");

  await suhbat.tarixniTozala(kalit);
  assert.deepEqual(await suhbat.tarixniOl(kalit), []);
});

test("buzilgan suhbat yozuvi xato bermaydi (bo'sh tarix)", async () => {
  await rawPrisma.aiConversation.create({
    data: { tenantId: TENANT, businessId: BIZ, userId: "u_buzuq", xabarlar: "{buzuq" },
  });
  assert.deepEqual(await suhbat.tarixniOl({ businessId: BIZ, userId: "u_buzuq" }), []);
});
