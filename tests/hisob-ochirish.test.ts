/**
 * HISOBNI O'CHIRISH TESTLARI (App Store 5.1.1(v)).
 *
 * Tekshiriladi:
 *  1. Har zaxira jadvali qanday o'chirilishi ANIQ (fail-closed qo'riqchi);
 *  2. o'chirish tartibi FK bog'liqliklariga zid emas;
 *  3. so'rov → bekor → so'rov oqimi va 30 kunlik muddat hisobi;
 *  4. haqiqiy o'chirishda ma'lumotli kompaniya butunlay yo'qoladi va
 *     BOSHQA kompaniyaga TEGILMAYDI (tenant izolyatsiyasi).
 *
 * Ishga tushirish: npm run test:hisob-ochirish
 */
process.env.DATABASE_URL = "file:./prisma/test-hisob-ochirish.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let createTenantWithOwner: any;
let ochirishSora: any;
let ochirishBekor: any;
let ochirishgaTayyor: any;
let tenantniButunlayOchir: any;
let nomalumJadvallar: any;
let ochirishTartibi: any;
let ochirishUsuli: any;
let qolganKun: any;
let OYLASH_KUNI: number;
let ZAXIRA_JADVALLARI: readonly string[];

const KUN_MS = 24 * 60 * 60 * 1000;

/** Test kompaniyasi: bir nechta jadvalga real yozuv qo'yamiz. */
async function malumotliTenant(nomi: string, login: string) {
  const { tenant, user, business } = await createTenantWithOwner({
    kompaniyaNomi: nomi,
    ism: "Ega",
    login,
    parol: "parol12345",
  });
  const kassa = await rawPrisma.account.findFirst({ where: { businessId: business.id } });
  const kategoriya = await rawPrisma.category.findFirst({ where: { businessId: business.id } });

  await rawPrisma.transaction.create({
    data: {
      businessId: business.id,
      categoryId: kategoriya.id,
      accountId: kassa?.id ?? null,
      userId: user.id,
      turi: "kirim",
      summa: 150_000,
      sana: new Date("2026-08-01T00:00:00.000Z"),
      izoh: "test kirim",
    },
  });
  await rawPrisma.debt.create({
    data: {
      businessId: business.id,
      mijozNomi: "Test mijoz",
      jamiSumma: 90_000,
      sana: new Date("2026-08-02T00:00:00.000Z"),
      userId: user.id,
    },
  });
  return { tenantId: tenant.id, userId: user.id, businessId: business.id };
}

before(async () => {
  rmSync("prisma/test-hisob-ochirish.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ ZAXIRA_JADVALLARI } = await import("@/lib/backup/dump"));
  ({
    ochirishSora,
    ochirishBekor,
    ochirishgaTayyor,
    tenantniButunlayOchir,
    nomalumJadvallar,
    ochirishTartibi,
    ochirishUsuli,
    qolganKun,
    OYLASH_KUNI,
  } = await import("@/lib/db/hisobOchirish"));
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- 1. Fail-closed qo'riqchi ----------

test("har bir zaxira jadvali uchun o'chirish usuli aniq", () => {
  const nomalum = nomalumJadvallar();
  assert.deepEqual(
    nomalum,
    [],
    `Bu jadvallar qanday o'chirilishi noma'lum: ${nomalum.join(", ")}. ` +
      "lib/db/hisobOchirish.ts dagi ochirishUsuli() ni yangilang.",
  );
});

test("o'chirish tartibi — zaxira tartibining teskarisi", () => {
  assert.deepEqual(ochirishTartibi(), [...ZAXIRA_JADVALLARI].reverse());
});

test("biznes o'ziga bog'liq jadvallardan KEYIN o'chiriladi", () => {
  // FK xavfsizligi: `business` qatori o'chirilganda unga murojaat qiladigan
  // hech qanday qator qolmasligi kerak.
  const tartib = ochirishTartibi();
  const biznesO = tartib.indexOf("business");
  for (const jadval of tartib) {
    if (ochirishUsuli(jadval) !== "biznes") continue;
    assert.ok(
      tartib.indexOf(jadval) < biznesO,
      `${jadval} biznesdan KEYIN o'chirilmoqda — FK buziladi`,
    );
  }
});

test("tenant eng oxirida o'chiriladi", () => {
  const tartib = ochirishTartibi();
  assert.equal(tartib[tartib.length - 1], "tenant");
});

// ---------- 2. So'rov / bekor qilish ----------

test("so'rov belgi qo'yadi, ma'lumotga tegmaydi", async () => {
  const t = await malumotliTenant("O'chirish Test", "+998900000101");
  const oldin = await rawPrisma.transaction.count({ where: { businessId: t.businessId } });

  const soralgan = await ochirishSora(t.tenantId, t.userId);
  assert.ok(soralgan instanceof Date);

  const tenant = await rawPrisma.tenant.findUnique({ where: { id: t.tenantId } });
  assert.ok(tenant.deletionRequestedAt);
  assert.equal(tenant.deletionRequestedBy, t.userId);
  // Yozuvlar joyida — bu faqat belgi.
  assert.equal(await rawPrisma.transaction.count({ where: { businessId: t.businessId } }), oldin);
});

test("takroriy so'rov muddatni CHO'ZMAYDI", async () => {
  const t = await malumotliTenant("Takror So'rov", "+998900000102");
  const birinchi = await ochirishSora(t.tenantId, t.userId);
  const ikkinchi = await ochirishSora(t.tenantId, t.userId);
  assert.equal(ikkinchi.getTime(), birinchi.getTime());
});

test("bekor qilish belgini tozalaydi", async () => {
  const t = await malumotliTenant("Bekor Test", "+998900000103");
  await ochirishSora(t.tenantId, t.userId);
  await ochirishBekor(t.tenantId);

  const tenant = await rawPrisma.tenant.findUnique({ where: { id: t.tenantId } });
  assert.equal(tenant.deletionRequestedAt, null);
  assert.equal(tenant.deletionRequestedBy, null);
});

test("qolganKun: bugun so'ralsa 30, muddat o'tsa 0", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");
  assert.equal(qolganKun(now, now), OYLASH_KUNI);
  assert.equal(qolganKun(new Date(now.getTime() - 10 * KUN_MS), now), OYLASH_KUNI - 10);
  assert.equal(qolganKun(new Date(now.getTime() - 40 * KUN_MS), now), 0);
});

// ---------- 3. Muddat va haqiqiy o'chirish ----------

test("ochirishgaTayyor faqat 30 kundan oshganlarni qaytaradi", async () => {
  const yangi = await malumotliTenant("Yangi So'rov", "+998900000104");
  const eski = await malumotliTenant("Eski So'rov", "+998900000105");

  await ochirishSora(yangi.tenantId, yangi.userId);
  await ochirishSora(eski.tenantId, eski.userId);
  // "Eski" so'rovni 31 kun orqaga suramiz.
  await rawPrisma.tenant.update({
    where: { id: eski.tenantId },
    data: { deletionRequestedAt: new Date(Date.now() - 31 * KUN_MS) },
  });

  const tayyor = await ochirishgaTayyor();
  assert.ok(tayyor.includes(eski.tenantId), "muddati o'tgan kompaniya ro'yxatda bo'lishi kerak");
  assert.ok(!tayyor.includes(yangi.tenantId), "yangi so'rov hali o'chirilmasligi kerak");
});

test("butunlay o'chirish: kompaniya yo'qoladi, qo'shnisiga TEGILMAYDI", async () => {
  const ochiriladigan = await malumotliTenant("O'chadigan MCHJ", "+998900000106");
  const qolsin = await malumotliTenant("Qoladigan MCHJ", "+998900000107");

  const qolsinYozuv = await rawPrisma.transaction.count({ where: { businessId: qolsin.businessId } });
  assert.ok(qolsinYozuv > 0);

  await tenantniButunlayOchir(ochiriladigan.tenantId);

  // O'chirilgan tomon: hech narsa qolmagan.
  assert.equal(await rawPrisma.tenant.count({ where: { id: ochiriladigan.tenantId } }), 0);
  assert.equal(await rawPrisma.user.count({ where: { tenantId: ochiriladigan.tenantId } }), 0);
  assert.equal(await rawPrisma.business.count({ where: { tenantId: ochiriladigan.tenantId } }), 0);
  assert.equal(
    await rawPrisma.transaction.count({ where: { businessId: ochiriladigan.businessId } }),
    0,
  );
  assert.equal(await rawPrisma.debt.count({ where: { businessId: ochiriladigan.businessId } }), 0);
  assert.equal(await rawPrisma.account.count({ where: { businessId: ochiriladigan.businessId } }), 0);
  assert.equal(await rawPrisma.category.count({ where: { businessId: ochiriladigan.businessId } }), 0);

  // Qo'shni kompaniya butunlay tegilmagan.
  assert.equal(await rawPrisma.tenant.count({ where: { id: qolsin.tenantId } }), 1);
  assert.equal(
    await rawPrisma.transaction.count({ where: { businessId: qolsin.businessId } }),
    qolsinYozuv,
  );
});

test("o'chirilgan kompaniyaning logini qayta ishlatilishi mumkin", async () => {
  // Login global unique — o'chirish chala bo'lsa foydalanuvchi qayta
  // ro'yxatdan o'ta olmaydi. App Store uchun muhim: o'chirish HAQIQIY.
  const t = await malumotliTenant("Qayta Ro'yxat", "+998900000108");
  await tenantniButunlayOchir(t.tenantId);

  const yangi = await createTenantWithOwner({
    kompaniyaNomi: "Qayta Ro'yxat 2",
    ism: "Ega",
    login: "+998900000108",
    parol: "parol12345",
  });
  assert.ok(yangi.tenant.id, "o'chirilgan logindan keyin qayta ro'yxatdan o'tish ishlashi kerak");
  assert.notEqual(yangi.tenant.id, t.tenantId);
});
