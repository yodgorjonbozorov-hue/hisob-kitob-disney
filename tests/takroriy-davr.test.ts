/**
 * TAKRORIY YOZUVLAR VA YOPILGAN DAVR — REGRESSIYA TESTI (audit: Critical #4).
 *
 * Muammo: `recurring.ts` cron jarayoni `btx.transaction.create` ni
 * TO'G'RIDAN-TO'G'RI chaqiradi, ya'ni `createTransaction` dagi davr qulfini
 * chetlab o'tardi. Takroriy yozuvning sanasi joriy oyning `kun` i — u
 * tasdiqlangan (yopilgan) kunga tushib qolishi mumkin (masalan cron bir
 * necha kun ishlamay qolgan va oradagi kunlar yopilgan). Bunday yozuv
 * jimgina yozilib ketsa, tasdiqlangan hisobot raqamlari bilan Yozuvlar
 * bir-biriga mos kelmay qolardi.
 *
 * Talab: yopilgan kun o'tkazib yuborilsin, cron yiqilmasin, qolgan
 * andozalar odatdagidek ishlasin, o'tkazib yuborish esa ko'rinib tursin.
 *
 * Ishga tushirish: npm run test:takroriy-davr
 *
 * Alohida test bazasi (prisma/test-takroriy-davr.db) — dev/prod bazaga tegmaydi.
 */
process.env.DATABASE_URL = "file:./prisma/test-takroriy-davr.db";

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let generateDueRecurring: any;
let dateOnlyStringToUTCDate: any;

const TENANT = "t_td";
const BIZ = "biz_td";
const OWNER = "u_td_owner";
const CAT_IJARA = "cat_td_ijara";
const CAT_INTERNET = "cat_td_internet";

/**
 * Sinov "hozir" i: 2026-07-20. Andozalar 10- va 12-kunlarga sozlanadi —
 * ikkalasi ham muddati kelgan bo'ladi.
 */
const HOZIR = new Date("2026-07-20T06:00:00.000Z");
const YOPIQ_KUN = "2026-07-10";
const OCHIQ_KUN = "2026-07-12";

/** Andoza yaratadi (yoki qayta tiklaydi). */
async function andoza(id: string, kun: number, categoryId: string, summa: number) {
  await rawPrisma.recurringTransaction.deleteMany({ where: { id } });
  return rawPrisma.recurringTransaction.create({
    data: {
      id,
      businessId: BIZ,
      turi: "chiqim",
      categoryId,
      summa,
      kun,
      izoh: `Andoza ${id}`,
      isActive: true,
      lastGenerated: null,
    },
  });
}

async function kunlikHisobot(sana: string, holat: string) {
  return rawPrisma.dailyReport.upsert({
    where: { businessId_sana: { businessId: BIZ, sana: dateOnlyStringToUTCDate(sana) } },
    update: { holat },
    create: { businessId: BIZ, sana: dateOnlyStringToUTCDate(sana), holat },
  });
}

const yozuvlar = (sana: string) =>
  rawPrisma.transaction.findMany({
    where: { businessId: BIZ, sana: dateOnlyStringToUTCDate(sana) },
  });

before(async () => {
  rmSync("prisma/test-takroriy-davr.db", { force: true });

  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ generateDueRecurring } = await import("@/lib/services/recurring"));
  ({ dateOnlyStringToUTCDate } = await import("@/lib/date"));

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "TD tenant", slug: "td-tenant", status: "ACTIVE" },
  });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "TD biznes", tenantId: TENANT } });
  await rawPrisma.user.create({
    data: { id: OWNER, ism: "Direktor", login: "td_owner", parolHash: "x", rol: "OWNER", tenantId: TENANT, businessId: BIZ },
  });
  await rawPrisma.category.create({
    data: { id: CAT_IJARA, nomi: "Ijara", turi: "chiqim", businessId: BIZ },
  });
  await rawPrisma.category.create({
    data: { id: CAT_INTERNET, nomi: "Internet", turi: "chiqim", businessId: BIZ },
  });

  // 10-kun TASDIQLANGAN, 12-kun ochiq.
  await kunlikHisobot(YOPIQ_KUN, "CONFIRMED");
  await kunlikHisobot(OCHIQ_KUN, "OPEN");
});

after(async () => {
  await rawPrisma?.$disconnect();
});

beforeEach(async () => {
  // Har test toza holatdan boshlansin.
  await rawPrisma.transaction.deleteMany({ where: { businessId: BIZ } });
  await rawPrisma.auditLog.deleteMany({ where: { businessId: BIZ } });
  await rawPrisma.recurringTransaction.deleteMany({ where: { businessId: BIZ } });
});

// ───────────── Asosiy regressiya ─────────────

test("yopilgan kunga takroriy yozuv YOZILMAYDI", async () => {
  await andoza("rec_yopiq", 10, CAT_IJARA, 1_500_000);

  const n = await runWithTenant(TENANT, () => generateDueRecurring(HOZIR));

  assert.equal(n, 0, "yopilgan kunga yozuv yaratilmasligi kerak");
  assert.equal((await yozuvlar(YOPIQ_KUN)).length, 0);
});

test("ochiq kunga takroriy yozuv ODATDAGIDEK yoziladi", async () => {
  await andoza("rec_ochiq", 12, CAT_INTERNET, 200_000);

  const n = await runWithTenant(TENANT, () => generateDueRecurring(HOZIR));

  assert.equal(n, 1);
  const [t] = await yozuvlar(OCHIQ_KUN);
  assert.ok(t, "ochiq kunga yozuv tushishi kerak");
  assert.equal(t.summa, 200_000);
  assert.equal(t.turi, "chiqim");
  assert.match(t.izoh, /\[Takroriy\]/);
});

test("hisoboti yo'q kunga yoziladi (kunlik moduli ishlatilmasa)", async () => {
  // 15-kun uchun hisobot umuman yo'q — qulf tegmasligi kerak.
  await andoza("rec_hisobotsiz", 15, CAT_INTERNET, 90_000);

  const n = await runWithTenant(TENANT, () => generateDueRecurring(HOZIR));

  assert.equal(n, 1);
  assert.equal((await yozuvlar("2026-07-15")).length, 1);
});

// ───────────── Cron yiqilmaydi, qolganlari davom etadi ─────────────

test("qulflangan andoza qolganlarini TO'XTATMAYDI", async () => {
  // Yopilgan kun andozasi ro'yxatda BIRINCHI bo'lishi uchun kuni kichikroq.
  await andoza("rec_yopiq", 10, CAT_IJARA, 1_500_000);
  await andoza("rec_ochiq", 12, CAT_INTERNET, 200_000);
  await andoza("rec_hisobotsiz", 15, CAT_INTERNET, 90_000);

  const n = await runWithTenant(TENANT, () => generateDueRecurring(HOZIR));

  assert.equal(n, 2, "qulflanmagan ikkitasi yozilishi kerak");
  assert.equal((await yozuvlar(YOPIQ_KUN)).length, 0);
  assert.equal((await yozuvlar(OCHIQ_KUN)).length, 1);
  assert.equal((await yozuvlar("2026-07-15")).length, 1);
});

test("qulflangan andoza cron'ni YIQITMAYDI (xato tashlamaydi)", async () => {
  await andoza("rec_yopiq", 10, CAT_IJARA, 1_500_000);

  await assert.doesNotReject(
    () => runWithTenant(TENANT, () => generateDueRecurring(HOZIR)),
    "yopilgan kun xato emas — kutilgan holat"
  );
});

// ───────────── Skip ko'rinadigan bo'lsin ─────────────

test("o'tkazib yuborish AUDIT jurnaliga tushadi (sabab bilan)", async () => {
  await andoza("rec_yopiq", 10, CAT_IJARA, 1_500_000);

  await runWithTenant(TENANT, () => generateDueRecurring(HOZIR));

  const log = await rawPrisma.auditLog.findFirst({
    where: { businessId: BIZ, entity: "recurringTransaction", action: "skip" },
  });
  assert.ok(log, "o'tkazib yuborish jurnalga tushishi kerak");
  assert.equal(log.entityId, "rec_yopiq");

  const after = JSON.parse(log.after);
  assert.match(after.sabab, /tasdiqlangan \(yopilgan\)/, "sabab yozilishi kerak");
  assert.equal(after.sana, YOPIQ_KUN, "qaysi kun ekani yozilishi kerak");
  assert.equal(after.summa, 1_500_000);
  assert.equal(after.takroriy, true);
});

test("yozilgan takroriy yozuv esa avvalgidek 'create' bo'lib tushadi", async () => {
  await andoza("rec_ochiq", 12, CAT_INTERNET, 200_000);

  await runWithTenant(TENANT, () => generateDueRecurring(HOZIR));

  const log = await rawPrisma.auditLog.findFirst({
    where: { businessId: BIZ, entity: "transaction", action: "create" },
  });
  assert.ok(log);
  assert.equal(JSON.parse(log.after).takroriy, true);
});

// ───────────── Oy yo'qolmaydi ─────────────

test("o'tkazib yuborilgan andoza 'bajarildi' deb BELGILANMAYDI", async () => {
  await andoza("rec_yopiq", 10, CAT_IJARA, 1_500_000);

  await runWithTenant(TENANT, () => generateDueRecurring(HOZIR));

  const r = await rawPrisma.recurringTransaction.findUnique({ where: { id: "rec_yopiq" } });
  assert.equal(r.lastGenerated, null, "kun qayta ochilsa yozuv yaratilishi uchun belgilanmasligi kerak");
});

test("kun QAYTA OCHILSA keyingi yurishda yozuv yaratiladi", async () => {
  await andoza("rec_yopiq", 10, CAT_IJARA, 1_500_000);

  // 1-yurish: kun yopiq — o'tkazib yuboriladi.
  assert.equal(await runWithTenant(TENANT, () => generateDueRecurring(HOZIR)), 0);

  // Direktor kunni qayta ochdi.
  await kunlikHisobot(YOPIQ_KUN, "OPEN");

  // 2-yurish: endi yoziladi.
  assert.equal(await runWithTenant(TENANT, () => generateDueRecurring(HOZIR)), 1);
  const [t] = await yozuvlar(YOPIQ_KUN);
  assert.equal(t.summa, 1_500_000);

  const r = await rawPrisma.recurringTransaction.findUnique({ where: { id: "rec_yopiq" } });
  assert.ok(r.lastGenerated, "yaratilgandan keyin oy belgilanadi (takroran yozilmasin)");

  await kunlikHisobot(YOPIQ_KUN, "CONFIRMED");
});

test("idempotentlik saqlanadi: ochiq kunda ikki marta yozilmaydi", async () => {
  await andoza("rec_ochiq", 12, CAT_INTERNET, 200_000);

  assert.equal(await runWithTenant(TENANT, () => generateDueRecurring(HOZIR)), 1);
  assert.equal(
    await runWithTenant(TENANT, () => generateDueRecurring(HOZIR)),
    0,
    "shu oyda ikkinchi marta yaratilmasligi kerak"
  );
  assert.equal((await yozuvlar(OCHIQ_KUN)).length, 1);
});

// ───────────── Boshqa biznesga tegmaydi ─────────────

test("bir biznesning yopiq kuni BOSHQA biznes andozasini to'smaydi", async () => {
  await rawPrisma.business.create({ data: { id: "biz_td2", nomi: "Ikkinchi", tenantId: TENANT } });
  await rawPrisma.category.create({
    data: { id: "cat_td2", nomi: "Ijara", turi: "chiqim", businessId: "biz_td2" },
  });
  await rawPrisma.user.create({
    data: {
      id: "u_td2", ism: "Direktor 2", login: "td_owner2", parolHash: "x",
      rol: "OWNER", tenantId: TENANT, businessId: "biz_td2",
    },
  });
  await rawPrisma.recurringTransaction.create({
    data: {
      id: "rec_biz2", businessId: "biz_td2", turi: "chiqim", categoryId: "cat_td2",
      summa: 300_000, kun: 10, isActive: true, lastGenerated: null,
    },
  });

  // Birinchi biznesda 10-kun tasdiqlangan, ikkinchisida hisobot yo'q.
  const n = await runWithTenant(TENANT, () => generateDueRecurring(HOZIR));
  assert.equal(n, 1, "ikkinchi biznes andozasi yozilishi kerak");

  const t = await rawPrisma.transaction.findFirst({ where: { businessId: "biz_td2" } });
  assert.ok(t);
  assert.equal(t.summa, 300_000);

  await rawPrisma.transaction.deleteMany({ where: { businessId: "biz_td2" } });
  await rawPrisma.recurringTransaction.deleteMany({ where: { businessId: "biz_td2" } });
});
