/**
 * AI QATLAMI TESTLARI (BOS-4).
 * Tool executor izolyatsiyasi, modul gating (PRO), kunlik limit, kalit yo'qligida
 * aniq xato. Claude API'ning o'zi chaqirilmaydi (tarmoq testi emas).
 * Ishga tushirish: npm run test:ai
 */
process.env.DATABASE_URL = "file:./prisma/test-ai.db";
delete process.env.ANTHROPIC_API_KEY;

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let createTransactionSvc: any;
let tools: any;
let claude: any;
let limit: any;
let guard: any;
let ForbiddenError: any;

let tA: any;
let tB: any;
const OY = new Date().toISOString().slice(0, 7);

before(async () => {
  rmSync("prisma/test-ai.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction: createTransactionSvc } = await import("@/lib/services/transactionService"));
  tools = await import("@/lib/ai/tools");
  claude = await import("@/lib/ai/claude");
  limit = await import("@/lib/ai/limit");
  guard = await import("@/lib/modules/guard");
  ({ ForbiddenError } = await import("@/lib/auth/guard"));

  tA = await createTenantWithOwner({ kompaniyaNomi: "AI A", ism: "A", login: "+998966666601", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "AI B", ism: "B", login: "+998966666602", parol: "parol12345" });

  // A tenantga kirim yozamiz (tool natijasini tekshirish uchun).
  await runWithTenant(tA.tenant.id, async () => {
    const cat = await rawPrisma.category.findFirst({ where: { businessId: tA.business.id, turi: "kirim" } });
    await createTransactionSvc(tA.user.id, tA.business.id, {
      turi: "kirim",
      categoryId: cat.id,
      summa: 7_500_000,
      sana: OY + "-15",
    });
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

test("oylik_xulosa tool'i faqat o'z tenanti raqamini ko'radi", async () => {
  const aNatija = JSON.parse(
    await runWithTenant(tA.tenant.id, () =>
      tools.runTool("oylik_xulosa", { oy: OY }, { businessId: tA.business.id, yoqilganModullar: new Set() })
    )
  );
  assert.equal(aNatija.jamiKirim, 7_500_000);

  // B tenant kontekstida — o'z biznesi bo'yicha 0 (A raqami sizib chiqmaydi).
  const bNatija = JSON.parse(
    await runWithTenant(tB.tenant.id, () =>
      tools.runTool("oylik_xulosa", { oy: OY }, { businessId: tB.business.id, yoqilganModullar: new Set() })
    )
  );
  assert.equal(bNatija.jamiKirim, 0);
});

test("modul yoqilmagan tool'lar ma'lumot o'rniga xabar qaytaradi", async () => {
  const crm = JSON.parse(
    await runWithTenant(tA.tenant.id, () =>
      tools.runTool("crm_holati", {}, { businessId: tA.business.id, yoqilganModullar: new Set() })
    )
  );
  assert.ok(crm.xabar.includes("yoqilmagan"));
});

test("noma'lum tool xavfsiz javob beradi", async () => {
  const r = JSON.parse(
    await runWithTenant(tA.tenant.id, () =>
      tools.runTool("baza_ochir", {}, { businessId: tA.business.id, yoqilganModullar: new Set() })
    )
  );
  assert.ok(r.xato.includes("Noma'lum tool"));
});

test("ANTHROPIC_API_KEY yo'q bo'lsa aniq AiSozlanmaganError", async () => {
  await assert.rejects(
    async () =>
      claude.aiSuhbat({ savol: "salom", tarix: [], ctx: { businessId: tA.business.id, yoqilganModullar: new Set() } }),
    claude.AiSozlanmaganError
  );
});

test("kunlik limit: 50 dan keyin bloklanadi", async () => {
  // Hisoblagichni 49 ga qo'yamiz — keyingi so'rov o'tadi, undan keyingisi yo'q.
  const bugun = new Date().toISOString().slice(0, 10);
  const key = `aiUsage:${tA.tenant.id}:${bugun}`;
  await rawPrisma.appSetting.upsert({ where: { key }, update: { value: "49" }, create: { key, value: "49" } });

  const birinchi = await limit.aiLimitTekshir(tA.tenant.id);
  assert.equal(birinchi.ok, true);
  assert.equal(birinchi.qoldi, 0);

  const ikkinchi = await limit.aiLimitTekshir(tA.tenant.id);
  assert.equal(ikkinchi.ok, false);

  // Boshqa tenant limiti alohida.
  const bTenant = await limit.aiLimitTekshir(tB.tenant.id);
  assert.equal(bTenant.ok, true);
});

test("AI moduli PRO tarifda va faqat boshqaruvchilarga", async () => {
  await rawPrisma.tenant.update({ where: { id: tA.tenant.id }, data: { plan: "PRO" } });
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tA.tenant.id } });
  await rawPrisma.tenantModule.create({ data: { tenantId: tA.tenant.id, code: "AI", isActive: true } });

  const ctx = (rol: string) => ({ session: { rol }, tenantId: tA.tenant.id, tenant, access: { mode: "FULL" } });
  await runWithTenant(tA.tenant.id, () => guard.requireModule(ctx("OWNER"), "AI"));
  await assert.rejects(
    async () => runWithTenant(tA.tenant.id, () => guard.requireModule(ctx("SELLER"), "AI")),
    ForbiddenError
  );

  // STANDARD tenantda AI ochilmaydi.
  const bTenant = await rawPrisma.tenant.findUnique({ where: { id: tB.tenant.id } });
  const bCtx = { session: { rol: "OWNER" }, tenantId: tB.tenant.id, tenant: bTenant, access: { mode: "FULL" } };
  await assert.rejects(
    async () => runWithTenant(tB.tenant.id, () => guard.requireModule(bCtx, "AI")),
    ForbiddenError
  );
});
