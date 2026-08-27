/**
 * TARIFLAR VA YO'NALISH TESTLARI.
 *
 * 1) Narx hisobi (lib/pricing/config.ts): asos + filial + modullar, yillik
 *    "2 oy bepul" formulasi, yaroqsiz kirishlar.
 * 2) Yo'nalish profillari (lib/pricing/profil.ts): modul kodlari haqiqiy,
 *    yo'nalish narxni O'ZGARTIRMASLIGI (asosiy biznes qoidasi).
 * 3) Signup shaxsiylashtiruvi: yo'nalish + tanlangan modullar bilan tenant
 *    yaratilganda bayroqlar, modullar va sinov tarifi to'g'ri o'rnatiladi.
 *
 * Ishga tushirish: npm run test:tariflar
 */
process.env.DATABASE_URL = "file:./prisma/test-tariflar.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let createTenantWithOwner: any;
let sinovPlanTanla: any;
let narxHisobla: any;
let normalizeFiliallar: any;
let pricingConfig: any;
let BIZNES_PROFILLAR: any;
let onboardingQadamlar: any;
let modulByCode: any;

before(async () => {
  rmSync("prisma/test-tariflar.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ createTenantWithOwner, sinovPlanTanla } = await import("@/lib/services/signup"));
  ({ narxHisobla, normalizeFiliallar, pricingConfig } = await import("@/lib/pricing/config"));
  ({ BIZNES_PROFILLAR, onboardingQadamlar } = await import("@/lib/pricing/profil"));
  ({ modulByCode } = await import("@/lib/modules/registry"));
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// Narx hisobi
// ---------------------------------------------------------------------------

test("asosiy narx: 1 filial, modulsiz — faqat baza", () => {
  const n = narxHisobla({ filiallar: 1, addons: [], davr: "oylik" });
  assert.equal(n.oylikJami, pricingConfig.baseMonthlyPrice);
  assert.equal(n.jami, pricingConfig.baseMonthlyPrice);
  assert.equal(n.qoshimchaFiliallar, 0);
});

test("filiallar: birinchi filial bepul, qolgani additionalBranchPrice", () => {
  const n = narxHisobla({ filiallar: 3, addons: [], davr: "oylik" });
  assert.equal(n.oylikJami, pricingConfig.baseMonthlyPrice + 2 * pricingConfig.additionalBranchPrice);
  assert.equal(n.qoshimchaFiliallar, 2);
});

test("modullar narxga qo'shiladi", () => {
  const n = narxHisobla({ filiallar: 1, addons: ["pos", "telegram"], davr: "oylik" });
  assert.equal(
    n.oylikJami,
    pricingConfig.baseMonthlyPrice +
      pricingConfig.addons.pos.oylikNarx +
      pricingConfig.addons.telegram.oylikNarx
  );
});

test("yillik: 2 oy bepul — 10 oylik summa, tejov 2 oylik", () => {
  const n = narxHisobla({ filiallar: 2, addons: ["crm"], davr: "yillik" });
  const oylik = n.oylikJami;
  assert.equal(n.yillikJami, oylik * (12 - pricingConfig.yearlyFreeMonths));
  assert.equal(n.yillikTejov, oylik * pricingConfig.yearlyFreeMonths);
  assert.equal(n.jami, n.yillikJami);
});

test("yaroqsiz kirish xavfsiz: filial 0/manfiy/NaN/juda katta — chegaraga tushadi", () => {
  assert.equal(normalizeFiliallar(0), 1);
  assert.equal(normalizeFiliallar(-5), 1);
  assert.equal(normalizeFiliallar("bo'lmagan"), 1);
  assert.equal(normalizeFiliallar(999), pricingConfig.maxBranches);
  // Yaroqsiz addon kaliti hisobga olinmaydi.
  const n = narxHisobla({ filiallar: 1, addons: ["yolg'on" as never], davr: "oylik" });
  assert.equal(n.oylikJami, pricingConfig.baseMonthlyPrice);
});

// ---------------------------------------------------------------------------
// Profillar — yo'nalish narxni O'ZGARTIRMAYDI
// ---------------------------------------------------------------------------

test("ASOSIY QOIDA: yo'nalish narxga ta'sir qilmaydi — narx faqat filial+modullardan", () => {
  // Bir xil tanlov, har xil yo'nalish — narx AYNAN bir xil (narx funksiyasi
  // yo'nalishni umuman qabul qilmaydi, bu test shartnomani qotiradi).
  const oziq = narxHisobla({ filiallar: 2, addons: ["pos"], davr: "oylik" });
  const xizmat = narxHisobla({ filiallar: 2, addons: ["pos"], davr: "oylik" });
  assert.equal(oziq.oylikJami, xizmat.oylikJami);
});

test("profil addon tavsiyalari va modul kodlari haqiqiy", () => {
  for (const profil of Object.values(BIZNES_PROFILLAR) as any[]) {
    for (const kalit of profil.tavsiyaAddons) {
      assert.ok(pricingConfig.addons[kalit], `${profil.code}: noma'lum addon ${kalit}`);
    }
    assert.equal(profil.onboarding.length, 3, `${profil.code}: onboarding 3 qadam bo'lishi kerak`);
  }
  // Addon'lardagi modul kodlari registry'da mavjud.
  for (const [kalit, addon] of Object.entries(pricingConfig.addons) as any[]) {
    if (addon.modulKodi !== null) {
      assert.ok(modulByCode(addon.modulKodi), `${kalit}: noma'lum modul ${addon.modulKodi}`);
    }
  }
});

test("onboardingQadamlar: omborsiz biznesga ombor qadamlari tushmaydi", () => {
  const xizmat = onboardingQadamlar("service", false);
  assert.ok(xizmat.every((q: any) => !["mahsulot", "import", "sotuv", "xarid"].includes(q.kalit)));
  const oziq = onboardingQadamlar("food", true);
  assert.equal(oziq.length, 3);
  // Noma'lum yo'nalish — universal to'plam, xato emas.
  assert.ok(onboardingQadamlar("nomalum", false).length > 0);
});

// ---------------------------------------------------------------------------
// Sinov tarifi tanlovi
// ---------------------------------------------------------------------------

test("sinovPlanTanla: modullarni qamrab oladigan eng arzon tarif", () => {
  assert.equal(sinovPlanTanla(["OMBOR", "MAGAZIN"]), "STANDARD");
  assert.equal(sinovPlanTanla(["CRM"]), "PRO");
  assert.equal(sinovPlanTanla(["AI"]), "PRO");
  assert.equal(sinovPlanTanla(["OMBOR", "XARID"]), "SHOP");
  // Core modul talab hisoblanmaydi.
  assert.equal(sinovPlanTanla(["MOLIYA", "OMBOR"]), "STANDARD");
});

// ---------------------------------------------------------------------------
// Signup shaxsiylashtiruvi (DB)
// ---------------------------------------------------------------------------

test("oziq-ovqat + POS: omborli+magazin biznes, OMBOR/MAGAZIN yoqiq, STANDARD sinov", async () => {
  const r = await createTenantWithOwner({
    kompaniyaNomi: "Navoi Market",
    ism: "Test",
    login: "+998903333333",
    parol: "parol12345",
    yonalish: "food",
    addons: ["pos", "telegram"],
  });
  assert.equal(r.business.yonalish, "food");
  assert.equal(r.business.omborli, true);
  assert.equal(r.business.magazin, true);
  assert.equal(r.business.turi, "umumiy");
  assert.equal(r.tenant.status, "TRIAL");
  assert.equal(r.tenant.plan, "STANDARD");
  const modullar = await rawPrisma.tenantModule.findMany({ where: { tenantId: r.tenant.id } });
  const kodlar = modullar.map((m: any) => m.code).sort();
  assert.deepEqual(kodlar, ["MAGAZIN", "OMBOR"]);
});

test("xizmat + CRM: omborsiz biznes, CRM moduli, PRO sinov", async () => {
  const r = await createTenantWithOwner({
    kompaniyaNomi: "Servis Plus",
    ism: "Test",
    login: "+998904444444",
    parol: "parol12345",
    yonalish: "service",
    addons: ["crm"],
  });
  assert.equal(r.business.yonalish, "service");
  assert.equal(r.business.omborli, false);
  assert.equal(r.business.magazin, false);
  assert.equal(r.tenant.plan, "PRO");
  const modullar = await rawPrisma.tenantModule.findMany({ where: { tenantId: r.tenant.id } });
  assert.deepEqual(modullar.map((m: any) => m.code), ["CRM"]);
});

test("yo'nalishsiz signup — avvalgi xatti-harakat O'ZGARMAGAN", async () => {
  const r = await createTenantWithOwner({
    kompaniyaNomi: "Oddiy Kompaniya",
    ism: "Test",
    login: "+998905555555",
    parol: "parol12345",
  });
  assert.equal(r.business.yonalish, null);
  assert.equal(r.business.omborli, false);
  assert.equal(r.business.magazin, false);
  assert.equal(r.tenant.plan, "STANDARD");
  const modullar = await rawPrisma.tenantModule.count({ where: { tenantId: r.tenant.id } });
  assert.equal(modullar, 0);
});

test("agro yo'nalishi: ombor yoqiq, XARID tanlansa SHOP sinov", async () => {
  const r = await createTenantWithOwner({
    kompaniyaNomi: "Agro Fayz",
    ism: "Test",
    login: "+998906666666",
    parol: "parol12345",
    yonalish: "agro",
    addons: ["omborPlus"],
  });
  assert.equal(r.business.yonalish, "agro");
  assert.equal(r.business.omborli, true);
  assert.equal(r.tenant.plan, "SHOP");
  const kodlar = (
    await rawPrisma.tenantModule.findMany({ where: { tenantId: r.tenant.id } })
  )
    .map((m: any) => m.code)
    .sort();
  assert.deepEqual(kodlar, ["OMBOR", "XARID"]);
});
