/**
 * TENANT IZOLYATSIYASI RO'YXATI — TO'LIQLIK QO'RIQCHISI.
 *
 * `lib/db/tenantDb.ts` dagi extension ro'yxatlarga tushmagan model so'rovini
 * FILTRSIZ o'tkazadi (`return query(args)`). Ya'ni yangi model ro'yxatga
 * qo'shilmasa, u BARCHA tenantlarga ko'rinadi — va hech qanday test buni
 * sezmasdi. Bu FAIL-OPEN: xato bo'lganda himoya o'chadi, yoqilmaydi.
 *
 * Zaxira ro'yxatida (`ZAXIRA_JADVALLARI`) shunday qo'riqchi allaqachon bor
 * edi va u ishlagan — bu sessiyada 12 yangi model qo'shildi va zaxira testi
 * har birini talab qildi. Izolyatsiya ro'yxatida esa bunday qo'riqchi
 * YO'Q edi: modellar faqat qo'lda qo'shildi, ya'ni bittasini unutish
 * mumkin edi va oqibati zaxiradagidan ancha og'irroq.
 *
 * Bu test shu bo'shliqni yopadi.
 *
 * Ishga tushirish: npm run test:izolyatsiya-royxati
 */
process.env.DATABASE_URL = "file:./prisma/test-izo-royxat.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

let TENANT_DIRECT: Set<string>;
let BUSINESS_SCOPED: ReadonlySet<string>;
let TIZIM_MODELLAR: Record<string, string>;
let AUDIT_MODEL: string;
let rawPrisma: any;
let runWithTenant: any;
let prisma: any;

let tA: any;
let tB: any;

/** Sxemadagi modellar va ularning maydonlari. */
function sxemaModellari(): { nomi: string; maydonlar: string[] }[] {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  return [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((m) => ({
    nomi: m[1],
    maydonlar: m[2]
      .split("\n")
      .map((l) => l.trim().split(/\s+/)[0])
      .filter(Boolean),
  }));
}

before(async () => {
  rmSync("prisma/test-izo-royxat.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({
    TENANT_DIRECT,
    BUSINESS_SCOPED_MODELLAR: BUSINESS_SCOPED,
    TIZIM_MODELLAR,
    AUDIT_MODEL,
  } = await import("@/lib/db/tenantDb"));
  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ prisma } = await import("@/lib/prisma"));

  const { createTenantWithOwner } = await import("@/lib/services/signup");
  tA = await createTenantWithOwner({
    kompaniyaNomi: "Izo A", ism: "A", login: "+998923333001", parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Izo B", ism: "B", login: "+998923333002", parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Ro'yxat to'liqligi ----------

test("sxemadagi HAR model aniq bir toifaga tegishli", () => {
  const tasniflanmagan: string[] = [];
  for (const { nomi } of sxemaModellari()) {
    const bor =
      TENANT_DIRECT.has(nomi) ||
      BUSINESS_SCOPED.has(nomi) ||
      nomi === AUDIT_MODEL ||
      nomi in TIZIM_MODELLAR;
    if (!bor) tasniflanmagan.push(nomi);
  }

  assert.deepEqual(
    tasniflanmagan,
    [],
    "Bu modellar tenant izolyatsiyasi ro'yxatlarida YO'Q va so'rovlari FILTRSIZ o'tadi. " +
      "src/lib/db/tenantDb.ts da BUSINESS_SCOPED yoki TENANT_DIRECT ga qo'shing, " +
      `yoki TIZIM_MODELLAR ga SABABI bilan yozing: ${tasniflanmagan.join(", ")}`
  );
});

test("model bir vaqtda ikki toifada bo'lmaydi", () => {
  const ikkilangan: string[] = [];
  for (const { nomi } of sxemaModellari()) {
    const soni =
      Number(TENANT_DIRECT.has(nomi)) +
      Number(BUSINESS_SCOPED.has(nomi)) +
      Number(nomi === AUDIT_MODEL) +
      Number(nomi in TIZIM_MODELLAR);
    if (soni > 1) ikkilangan.push(nomi);
  }
  assert.deepEqual(ikkilangan, [], `Ikki toifada turgan modellar: ${ikkilangan.join(", ")}`);
});

test("ro'yxatlarda sxemada mavjud bo'lmagan model qolmagan", () => {
  // Model o'chirilsa yoki qayta nomlansa ro'yxat eskirmasin.
  const sxemada = new Set(sxemaModellari().map((m) => m.nomi));
  const ortiqcha = [
    ...TENANT_DIRECT,
    ...BUSINESS_SCOPED,
    ...Object.keys(TIZIM_MODELLAR),
    AUDIT_MODEL,
  ].filter((m) => !sxemada.has(m));

  assert.deepEqual(ortiqcha, [], `Sxemada yo'q, lekin ro'yxatda bor: ${ortiqcha.join(", ")}`);
});

test("tenantId yoki businessId maydoni bor model tenantsiz qolmaydi", () => {
  // Eng kuchli shart: model tenantga tegishli EKANI sxemadan ko'rinib tursa,
  // u albatta filtrlanishi yoki TIZIM_MODELLAR da sababi yozilishi kerak.
  const shubhali: string[] = [];
  for (const { nomi, maydonlar } of sxemaModellari()) {
    const bogliq = maydonlar.includes("tenantId") || maydonlar.includes("businessId");
    if (!bogliq) continue;

    const filtrlanadi =
      TENANT_DIRECT.has(nomi) || BUSINESS_SCOPED.has(nomi) || nomi === AUDIT_MODEL;
    if (!filtrlanadi && !(nomi in TIZIM_MODELLAR)) shubhali.push(nomi);
  }

  assert.deepEqual(
    shubhali,
    [],
    `Bu modellarda tenantId/businessId bor, lekin filtr qo'llanmaydi: ${shubhali.join(", ")}`
  );
});

test("TIZIM_MODELLAR dagi har istisno sababi bilan yozilgan", () => {
  for (const [model, sabab] of Object.entries(TIZIM_MODELLAR)) {
    assert.ok(
      typeof sabab === "string" && sabab.trim().length >= 15,
      `${model}: istisno sababi juda qisqa yoki yo'q ("${sabab}")`
    );
  }
});

// ---------- Yangi modullarning haqiqiy izolyatsiyasi ----------

test("HR yozuvlari boshqa tenantga ko'rinmaydi", async () => {
  const xodim = await rawPrisma.employee.create({
    data: { businessId: tB.business.id, ism: "B xodimi", stavka: 1_000_000 },
  });
  await rawPrisma.payroll.create({
    data: {
      businessId: tB.business.id, employeeId: xodim.id, oy: "2026-07",
      hisoblangan: 1_000_000, tolanadigan: 1_000_000, userId: tB.user.id,
    },
  });

  await runWithTenant(tA.tenant.id, async () => {
    assert.equal(await prisma.employee.count(), 0, "A tenant B ning xodimini ko'rmasligi kerak");
    assert.equal(await prisma.payroll.count(), 0);
    assert.equal(await prisma.employee.findUnique({ where: { id: xodim.id } }), null);
  });

  await runWithTenant(tB.tenant.id, async () => {
    assert.equal(await prisma.employee.count(), 1, "B o'z xodimini ko'rishi kerak");
  });
});

test("shartnoma va ILOVA boshqa tenantga ko'rinmaydi", async () => {
  // Ilova ataylab polimorf (FK yo'q) — shuning uchun uning izolyatsiyasi
  // faqat `businessId` filtriga tayanadi va alohida tekshirilishi kerak.
  const shartnoma = await rawPrisma.contract.create({
    data: {
      businessId: tB.business.id, raqam: "B-1", nomi: "B shartnomasi",
      boshlanish: new Date("2026-01-01T00:00:00.000Z"), userId: tB.user.id,
    },
  });
  await rawPrisma.attachment.create({
    data: {
      businessId: tB.business.id, entity: "contract", entityId: shartnoma.id,
      nomi: "B hujjati", url: "https://example.com/b.pdf", userId: tB.user.id,
    },
  });

  await runWithTenant(tA.tenant.id, async () => {
    assert.equal(await prisma.contract.count(), 0);
    assert.equal(await prisma.attachment.count(), 0, "ilova ham filtrlanishi kerak");
    // entityId ni bilgan holda ham ochib bo'lmaydi (IDOR).
    const ilovalar = await prisma.attachment.findMany({
      where: { entity: "contract", entityId: shartnoma.id },
    });
    assert.equal(ilovalar.length, 0, "boshqa tenant ilovasini id bo'yicha ham olib bo'lmaydi");
  });
});

test("xarid va tasdiqlash yozuvlari boshqa tenantga ko'rinmaydi", async () => {
  const taminotchi = await rawPrisma.supplier.create({
    data: { businessId: tB.business.id, nomi: "B ta'minotchisi" },
  });
  await rawPrisma.approvalRule.create({
    data: { businessId: tB.business.id, chegara: 1_000_000, tasdiqlovchiRol: "OWNER" },
  });

  await runWithTenant(tA.tenant.id, async () => {
    assert.equal(await prisma.supplier.count(), 0);
    assert.equal(await prisma.approvalRule.count(), 0);
    assert.equal(await prisma.supplier.findUnique({ where: { id: taminotchi.id } }), null);
  });
});

test("boshqa tenant yozuvini o'zgartirib bo'lmaydi", async () => {
  const xodim = await rawPrisma.employee.findFirst({ where: { businessId: tB.business.id } });
  assert.ok(xodim, "fikstura xodimi bo'lishi kerak");

  await runWithTenant(tA.tenant.id, async () => {
    // Unique amallar avval egalikni tekshiradi (IDOR himoyasi).
    await assert.rejects(
      () => prisma.employee.update({ where: { id: xodim.id }, data: { ism: "O'g'irlandi" } }),
      /tegishli emas|topilmadi/i
    );
    // Guruh amallari esa filtr tufayli hech nimaga tegmaydi.
    const natija = await prisma.employee.updateMany({ data: { isActive: false } });
    assert.equal(natija.count, 0, "boshqa tenant xodimlariga updateMany tegmasligi kerak");
  });

  const keyin = await rawPrisma.employee.findUnique({ where: { id: xodim.id } });
  assert.equal(keyin.ism, "B xodimi", "ism o'zgarmasligi kerak");
  assert.equal(keyin.isActive, true, "isActive o'zgarmasligi kerak");
});
