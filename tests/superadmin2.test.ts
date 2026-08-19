/**
 * SUPERADMIN 2.0 — CONTROL CENTER TESTLARI.
 *
 * Qamrov (talab 50 dagi ro'yxat bo'yicha):
 *  · RBAC matritsasi — SUPPORT xavfli amalni bajara olmaydi, ROOT bajaradi;
 *  · rol normalizatsiyasi (NULL -> ROOT, noma'lum -> READ_ONLY);
 *  · audit APPEND-ONLY — o'chirish/o'zgartirish rad etiladi;
 *  · modul yoqish/o'chirish MA'LUMOTNI O'CHIRMAYDI;
 *  · modul bog'liqligi (XARID -> OMBOR) majburlanadi;
 *  · tarifda yo'q modul yoqilmaydi;
 *  · sessiyani bekor qilish (sessionEpoch);
 *  · kompaniya o'chirilganda audit SAQLANADI;
 *  · server tomonda filtr/sahifalash;
 *  · global qidiruv rolga mos;
 *  · eksportda sir chiqmaydi va CSV in'ektsiyasi neytrallanadi;
 *  · dashboard KPI hisoblari;
 *  · support tiketi tenant izolyatsiyasi;
 *  · xavfli amal SABABI validatsiyasi.
 *
 * Ishga tushirish: npm run test:superadmin2
 */
process.env.DATABASE_URL = "file:./prisma/test-superadmin2.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let rbac: any;
let modullar: any;
let bogliqlik: any;
let sessiyalar: any;
let bizneslar: any;
let qidiruv: any;
let eksport: any;
let dashboard: any;
let support: any;
let svc: any;
let validation: any;
let auditModul: any;

let tA: any; // PRO tenant
let tB: any; // STANDARD tenant
let tBosh: any; // bo'sh tenant (o'chirish testi uchun)

const sa = (superRol: string) => ({
  session: { userId: "sa-test", ism: "Sinov Superadmin", login: "sa", rol: "SUPERADMIN" },
  superRol,
  ip: "198.51.100.10",
  userAgent: "SinovAgent/1.0",
});

before(async () => {
  rmSync("prisma/test-superadmin2.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  rbac = await import("@/lib/superadmin/rbac");
  modullar = await import("@/lib/superadmin/modullar");
  bogliqlik = await import("@/lib/modules/bogliqlik");
  sessiyalar = await import("@/lib/superadmin/sessiyalar");
  bizneslar = await import("@/lib/superadmin/bizneslar");
  qidiruv = await import("@/lib/superadmin/qidiruv");
  eksport = await import("@/lib/superadmin/eksport");
  dashboard = await import("@/lib/superadmin/dashboard");
  support = await import("@/lib/superadmin/support");
  svc = await import("@/lib/superadmin/service");
  validation = await import("@/lib/validation/superadmin");
  auditModul = await import("@/lib/superadmin/audit");

  const { createTenantWithOwner } = await import("@/lib/services/signup");
  tA = await createTenantWithOwner({
    kompaniyaNomi: "Pro Mijoz",
    ism: "Pro egasi",
    login: "+998900000001",
    parol: "parol12345",
    plan: "PRO",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Standart Mijoz",
    ism: "Std egasi",
    login: "+998900000002",
    parol: "parol12345",
  });
  tBosh = await createTenantWithOwner({
    kompaniyaNomi: "Bosh Mijoz",
    ism: "Bosh egasi",
    login: "+998900000003",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1-3. RBAC
// ---------------------------------------------------------------------------

test("RBAC: ROOT hamma narsani qila oladi", () => {
  assert.equal(rbac.can("ROOT", "bizneslar", "DELETE"), true);
  assert.equal(rbac.can("ROOT", "tizim", "MANAGE"), true);
  assert.equal(rbac.can("ROOT", "sozlamalar", "MANAGE"), true);
  assert.equal(rbac.can("ROOT", "impersonatsiya", "CREATE"), true);
});

test("RBAC: SUPPORT xavfli amallarni BAJARA OLMAYDI", () => {
  // Ko'rish — ha.
  assert.equal(rbac.can("SUPPORT", "bizneslar", "VIEW"), true);
  assert.equal(rbac.can("SUPPORT", "support", "MANAGE"), true);
  // Xavfli amallar — yo'q.
  assert.equal(rbac.can("SUPPORT", "bizneslar", "MANAGE"), false, "bloklay olmasligi kerak");
  assert.equal(rbac.can("SUPPORT", "bizneslar", "DELETE"), false);
  assert.equal(rbac.can("SUPPORT", "billing", "UPDATE"), false, "to'lov qarorini qabul qila olmaydi");
  assert.equal(rbac.can("SUPPORT", "obunalar", "UPDATE"), false);
  assert.equal(rbac.can("SUPPORT", "tizim", "MANAGE"), false);
  assert.equal(rbac.can("SUPPORT", "sozlamalar", "MANAGE"), false);
  assert.equal(rbac.can("SUPPORT", "impersonatsiya", "CREATE"), false);
  assert.equal(rbac.can("SUPPORT", "eksport", "VIEW"), false);
});

test("RBAC: FINANCE pul bilan ishlaydi, xavfsizlikka tegmaydi", () => {
  assert.equal(rbac.can("FINANCE", "billing", "UPDATE"), true);
  assert.equal(rbac.can("FINANCE", "obunalar", "UPDATE"), true);
  assert.equal(rbac.can("FINANCE", "eksport", "VIEW"), true);
  assert.equal(rbac.can("FINANCE", "xavfsizlik", "VIEW"), false);
  assert.equal(rbac.can("FINANCE", "foydalanuvchilar", "MANAGE"), false);
  assert.equal(rbac.can("FINANCE", "tizim", "MANAGE"), false);
});

test("RBAC: ANALYST va READ_ONLY hech narsani o'zgartira olmaydi", () => {
  for (const rol of ["ANALYST", "READ_ONLY"]) {
    for (const amal of ["CREATE", "UPDATE", "DELETE", "MANAGE"]) {
      for (const resurs of Object.keys(rbac.RESURS_LABEL)) {
        assert.equal(
          rbac.can(rol, resurs, amal),
          false,
          `${rol} roli ${resurs}.${amal} ni bajara olmasligi kerak`
        );
      }
    }
  }
  // READ_ONLY eksport ham qila olmaydi (ma'lumot chiqmaydi).
  assert.equal(rbac.can("READ_ONLY", "eksport", "VIEW"), false);
  assert.equal(rbac.can("ANALYST", "eksport", "VIEW"), true);
});

test("superRolNormalize: NULL -> ROOT (eski holat), noma'lum -> READ_ONLY", () => {
  assert.equal(rbac.superRolNormalize(null), "ROOT");
  assert.equal(rbac.superRolNormalize(undefined), "ROOT");
  assert.equal(rbac.superRolNormalize(""), "ROOT");
  assert.equal(rbac.superRolNormalize("SUPPORT"), "SUPPORT");
  assert.equal(rbac.superRolNormalize("XATO_ROL"), "READ_ONLY");
});

// ---------------------------------------------------------------------------
// 4. Audit — APPEND ONLY
// ---------------------------------------------------------------------------

test("audit: yozuvni O'CHIRIB va O'ZGARTIRIB bo'lmaydi", async () => {
  await auditModul.superadminAudit({
    sa: sa("ROOT"),
    amal: auditModul.SA_AMAL.SETTINGS_CHANGED,
    entity: "sinov",
    entityId: "append-only-1",
    after: { a: 1 },
  });
  const log = await rawPrisma.auditLog.findFirst({ where: { entityId: "append-only-1" } });
  assert.ok(log);

  await assert.rejects(
    () => rawPrisma.auditLog.delete({ where: { id: log.id } }),
    /append-only/,
    "delete rad etilishi kerak"
  );
  await assert.rejects(
    () => rawPrisma.auditLog.deleteMany({ where: { entityId: "append-only-1" } }),
    /append-only/,
    "deleteMany rad etilishi kerak"
  );
  await assert.rejects(
    () => rawPrisma.auditLog.update({ where: { id: log.id }, data: { sabab: "soxta" } }),
    /append-only/,
    "update rad etilishi kerak"
  );

  // Yozuv joyida qolganini tekshiramiz.
  const hali = await rawPrisma.auditLog.findUnique({ where: { id: log.id } });
  assert.ok(hali, "yozuv o'chmagan bo'lishi kerak");
});

test("audit: tenant clienti orqali ham o'chirib bo'lmaydi", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    await assert.rejects(() => prisma.auditLog.deleteMany({}), /append-only/);
  });
});

// ---------------------------------------------------------------------------
// 5-7. Modullar
// ---------------------------------------------------------------------------

test("modul: yoqish ishlaydi va holat to'g'ri qaytadi", async () => {
  const natija = await modullar.modulniOzgartir(tA.tenant.id, "OMBOR", true);
  assert.equal(natija.isActive, true);
  assert.equal(natija.amal, "MODULE_ENABLED");

  const holat = await modullar.tenantModulHolati(tA.tenant.id);
  assert.equal(holat.find((m: any) => m.code === "OMBOR").yoqilgan, true);
});

test("modul: O'CHIRISH MA'LUMOTNI O'CHIRMAYDI va qayta yoqilsa qaytadi", async () => {
  // Ombor moduli ma'lumoti: mahsulot.
  const mahsulot = await rawPrisma.product.create({
    data: { businessId: tA.business.id, nomi: "Sinov tovari", sotuvNarx: 15000, miqdor: 7 },
  });

  await modullar.modulniOzgartir(tA.tenant.id, "OMBOR", false);
  const ochiq = await modullar.tenantModulHolati(tA.tenant.id);
  assert.equal(ochiq.find((m: any) => m.code === "OMBOR").yoqilgan, false);

  // ENG MUHIM TEKSHIRUV: ma'lumot joyida.
  const hali = await rawPrisma.product.findUnique({ where: { id: mahsulot.id } });
  assert.ok(hali, "modul o'chirilganda mahsulot O'CHMASLIGI kerak");
  assert.equal(hali.miqdor, 7);

  // Qayta yoqamiz — eski ma'lumot o'sha joyda.
  await modullar.modulniOzgartir(tA.tenant.id, "OMBOR", true);
  const qayta = await rawPrisma.product.findUnique({ where: { id: mahsulot.id } });
  assert.equal(qayta.nomi, "Sinov tovari");
  assert.equal(qayta.miqdor, 7);
});

test("modul bog'liqligi: XARID uchun OMBOR shart, OMBOR esa XARID yoqiqda o'chmaydi", async () => {
  assert.deepEqual(bogliqlik.talabQiladi("XARID"), ["OMBOR"]);
  // OMBOR'ga BIR NECHTA modul tayanadi (XARID va MAGAZIN — kassa ham
  // mahsulot/qoldiqni o'sha modulda yuritadi). Tartibga bog'lanmaymiz:
  // yangi bog'liqlik qo'shilganda test sababsiz qizil bo'lmasin.
  const omborgaTayananlar = bogliqlik.tayanadiganlar("OMBOR");
  assert.ok(omborgaTayananlar.includes("XARID"));
  assert.ok(omborgaTayananlar.includes("MAGAZIN"));

  // OMBOR o'chiq holatda XARID yoqilmaydi.
  await modullar.modulniOzgartir(tA.tenant.id, "OMBOR", false);
  await assert.rejects(
    () => modullar.modulniOzgartir(tA.tenant.id, "XARID", true),
    /Ombor/,
    "bog'liq modul yoqilmagan bo'lsa rad etilishi kerak"
  );

  // OMBOR yoqilgach XARID ham yoqiladi.
  await modullar.modulniOzgartir(tA.tenant.id, "OMBOR", true);
  await modullar.modulniOzgartir(tA.tenant.id, "XARID", true);

  // Endi OMBOR ni o'chirib bo'lmaydi — unga XARID tayanadi.
  await assert.rejects(
    () => modullar.modulniOzgartir(tA.tenant.id, "OMBOR", false),
    /tayanadi/,
    "tayanuvchi modul yoqiq bo'lsa o'chirish rad etilishi kerak"
  );

  // Tartib bilan o'chirish ishlaydi.
  await modullar.modulniOzgartir(tA.tenant.id, "XARID", false);
  await modullar.modulniOzgartir(tA.tenant.id, "OMBOR", false);
});

test("modul: tarifda yo'q modul yoqilmaydi", async () => {
  // tB — STANDARD tarif, unda CRM yo'q.
  await assert.rejects(
    () => modullar.modulniOzgartir(tB.tenant.id, "CRM", true),
    /tarifida mavjud emas/
  );
});

test("modul: asosiy (core) modulni o'chirib bo'lmaydi", async () => {
  await assert.rejects(() => modullar.modulniOzgartir(tA.tenant.id, "MOLIYA", false), /Asosiy/);
});

// ---------------------------------------------------------------------------
// 8. Sessiyalar
// ---------------------------------------------------------------------------

test("sessiya: bekor qilinganda sessionEpoch oshadi", async () => {
  const oldin = await rawPrisma.user.findUnique({
    where: { id: tB.user.id },
    select: { sessionEpoch: true },
  });
  const natija = await sessiyalar.sessiyalarniBekorQil(tB.user.id);
  assert.equal(natija.yangiEpoch, oldin.sessionEpoch + 1);

  const keyin = await rawPrisma.user.findUnique({
    where: { id: tB.user.id },
    select: { sessionEpoch: true },
  });
  assert.equal(keyin.sessionEpoch, oldin.sessionEpoch + 1);
});

test("sessiya: kompaniya bo'ylab bekor qilish barcha hisoblarga tegadi", async () => {
  const soni = await sessiyalar.tenantSessiyalariniBekorQil(tA.tenant.id);
  assert.ok(soni >= 1);
});

// ---------------------------------------------------------------------------
// 9. Kompaniya o'chirilganda audit SAQLANADI
// ---------------------------------------------------------------------------

test("bo'sh kompaniya o'chirilganda AUDIT JURNALI saqlanadi", async () => {
  await auditModul.superadminAudit({
    sa: sa("ROOT"),
    amal: auditModul.SA_AMAL.BUSINESS_SUSPENDED,
    entity: "tenant",
    entityId: tBosh.tenant.id,
    tenantId: tBosh.tenant.id,
    sabab: "Sinov uchun yozilgan jurnal yozuvi",
  });

  const oldin = await rawPrisma.auditLog.count({ where: { tenantId: tBosh.tenant.id } });
  assert.ok(oldin > 0);

  await svc.deleteEmptyTenant(tBosh.tenant.id);

  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tBosh.tenant.id } });
  assert.equal(tenant, null, "kompaniya o'chirilgan bo'lishi kerak");

  const keyin = await rawPrisma.auditLog.count({ where: { tenantId: tBosh.tenant.id } });
  assert.equal(keyin, oldin, "audit yozuvlari SAQLANISHI kerak");
});

// ---------------------------------------------------------------------------
// 10. Server tomonda filtr va sahifalash
// ---------------------------------------------------------------------------

test("bizneslar: filtr va sahifalash bazada bajariladi", async () => {
  const hammasi = await bizneslar.bizneslarRoyxati({}, { sahifa: 1, limit: 25 });
  assert.ok(hammasi.jami >= 2);

  const qidirilgan = await bizneslar.bizneslarRoyxati(
    { qidiruv: "Pro Mijoz" },
    { sahifa: 1, limit: 25 }
  );
  assert.equal(qidirilgan.jami, 1);
  assert.equal(qidirilgan.qatorlar[0].name, "Pro Mijoz");

  const tarif = await bizneslar.bizneslarRoyxati({ plan: "PRO" }, { sahifa: 1, limit: 25 });
  assert.ok(tarif.qatorlar.every((q: any) => q.plan === "PRO"));

  // Sahifa hajmi hurmat qilinadi.
  const birinchi = await bizneslar.bizneslarRoyxati({}, { sahifa: 1, limit: 1 });
  assert.equal(birinchi.qatorlar.length, 1);
  assert.equal(birinchi.sahifalar, birinchi.jami);
});

test("biznes tafsiloti: ko'rsatkichlar hisoblanadi", async () => {
  const t = await bizneslar.biznesTafsiloti(tA.tenant.id);
  assert.ok(t);
  assert.equal(t.name, "Pro Mijoz");
  assert.ok(t.jamiUser >= 1);
  assert.ok(t.bizneslar.length >= 1);
  assert.ok(t.mahsulotSoni >= 1, "sinovda yaratilgan mahsulot hisobga olinishi kerak");
});

// ---------------------------------------------------------------------------
// 11. Global qidiruv ROLGA MOS
// ---------------------------------------------------------------------------

test("qidiruv: rol ko'ra olmaydigan turdagi natija qaytmaydi", async () => {
  const root = await qidiruv.globalQidiruv("Pro Mijoz", "ROOT");
  assert.ok(root.some((n: any) => n.turi === "biznes"));

  const readOnly = await qidiruv.globalQidiruv("Pro Mijoz", "READ_ONLY");
  // READ_ONLY auditni ko'rmaydi.
  assert.equal(readOnly.some((n: any) => n.turi === "audit"), false);

  const support = await qidiruv.globalQidiruv("Pro Mijoz", "SUPPORT");
  assert.ok(support.some((n: any) => n.turi === "biznes"));
});

test("qidiruv: 2 belgidan qisqa so'rov bo'sh natija beradi", async () => {
  assert.deepEqual(await qidiruv.globalQidiruv("a", "ROOT"), []);
});

// ---------------------------------------------------------------------------
// 12. Eksport
// ---------------------------------------------------------------------------

test("eksport: parol hash va Telegram ID CSV ga tushmaydi", async () => {
  const natija = await eksport.eksportQil("foydalanuvchilar");
  assert.ok(natija.csv.includes("Login"));
  assert.ok(!natija.csv.toLowerCase().includes("parolhash"));
  assert.ok(!natija.csv.includes("$2a$"), "bcrypt hash chiqmasligi kerak");
  assert.ok(!natija.csv.toLowerCase().includes("telegram"));
});

test("eksport: CSV formula in'ektsiyasi neytrallanadi", async () => {
  await rawPrisma.tenant.update({
    where: { id: tB.tenant.id },
    data: { name: "=CMD()|calc" },
  });
  const natija = await eksport.eksportQil("bizneslar");
  assert.ok(natija.csv.includes(`"'=CMD()|calc"`), "formula apostrof bilan neytrallanishi kerak");
  await rawPrisma.tenant.update({ where: { id: tB.tenant.id }, data: { name: "Standart Mijoz" } });
});

// ---------------------------------------------------------------------------
// 13. Dashboard
// ---------------------------------------------------------------------------

test("dashboard: KPI va ogohlantirishlar hisoblanadi", async () => {
  const davr = dashboard.davrniHisobla("30kun");
  const m = await dashboard.dashboardMalumot(davr);

  assert.ok(m.kpi.jamiBiznes >= 2);
  assert.equal(m.kpi.jamiBiznes, m.kpi.faolBiznes + m.kpi.bloklangan);
  assert.ok(m.kpi.mrr >= 0);
  assert.ok(Array.isArray(m.ogohlantirishlar));
  // Grafik nuqtalari davr uzunligiga mos.
  assert.equal(m.biznesOsishi.length, 30);
  assert.ok(m.modulQamrovi.length > 0);
});

test("dashboard: davr oralig'i to'g'ri hisoblanadi", () => {
  const now = new Date("2026-08-19T12:00:00.000Z");
  const d7 = dashboard.davrniHisobla("7kun", now);
  assert.equal(d7.kun, 7);
  assert.equal(d7.tugash.toISOString(), now.toISOString());
  assert.equal(d7.boshlanish.toISOString(), "2026-08-12T12:00:00.000Z");
});

// ---------------------------------------------------------------------------
// 14. Support tiketi va tenant izolyatsiyasi
// ---------------------------------------------------------------------------

test("support: tiket yaratiladi va boshqa tenantga KO'RINMAYDI", async () => {
  const { tiket } = await support.tiketYarat({
    tenantId: tA.tenant.id,
    mavzu: "Hisobotda xato",
    tavsif: "Oylik hisobotdagi summa noto'g'ri ko'rinmoqda",
    muhimlik: "YUQORI",
    yaratuvchiId: tA.user.id,
    yaratuvchiIsm: "Sinov Superadmin",
  });
  assert.ok(tiket.id);

  // Tenant-scoped client: A o'z tiketini ko'radi, B ko'rmaydi.
  await runWithTenant(tA.tenant.id, async () => {
    assert.equal(await prisma.supportTicket.count(), 1);
  });
  await runWithTenant(tB.tenant.id, async () => {
    assert.equal(await prisma.supportTicket.count(), 0, "boshqa tenant tiketni ko'rmasligi kerak");
    assert.equal(await prisma.supportTicket.findUnique({ where: { id: tiket.id } }), null);
  });

  const xulosa = await support.supportXulosa();
  assert.equal(xulosa.ochiq, 1);
});

// ---------------------------------------------------------------------------
// 15. Validatsiya — xavfli amal sababi
// ---------------------------------------------------------------------------

test("validatsiya: xavfli amal sababi MAJBURIY va mazmunli bo'lishi shart", () => {
  assert.equal(validation.blockSchema.safeParse({ blocked: true }).success, false);
  assert.equal(validation.blockSchema.safeParse({ blocked: true, sabab: "yo'q" }).success, false);
  assert.equal(
    validation.blockSchema.safeParse({ blocked: true, sabab: "To'lov 3 oydan beri kelmadi" }).success,
    true
  );
});

test("validatsiya: sabab talab qiladigan amallar ro'yxati to'liq", () => {
  for (const amal of [
    auditModul.SA_AMAL.BUSINESS_SUSPENDED,
    auditModul.SA_AMAL.BUSINESS_DELETED,
    auditModul.SA_AMAL.USER_SUSPENDED,
    auditModul.SA_AMAL.SESSION_REVOKED,
    auditModul.SA_AMAL.PLAN_CHANGED,
    auditModul.SA_AMAL.IMPERSONATION_START,
    auditModul.SA_AMAL.DATA_EXPORT,
  ]) {
    assert.equal(auditModul.sababTalabQiladi(amal), true, `${amal} sabab talab qilishi kerak`);
  }
  assert.equal(auditModul.sababTalabQiladi(auditModul.SA_AMAL.LOGIN), false);
});

test("bayroq: yozilmagan feature flag YOQILMAGAN deb hisoblanadi (fail-closed)", async () => {
  const bayroqlar = await import("@/lib/superadmin/bayroqlar");
  assert.equal(await bayroqlar.bayroqYoqilganmi("MAVJUD_EMAS_BAYROQ"), false);

  const b = await bayroqlar.bayroqYarat({
    kalit: "SINOV_BAYROQ",
    nomi: "Sinov",
    doira: "TENANT",
    yoqilgan: true,
    tenantIdlar: [tA.tenant.id],
  });
  assert.equal(await bayroqlar.bayroqYoqilganmi("SINOV_BAYROQ", tA.tenant.id), true);
  assert.equal(await bayroqlar.bayroqYoqilganmi("SINOV_BAYROQ", tB.tenant.id), false);
  assert.equal(await bayroqlar.bayroqYoqilganmi("SINOV_BAYROQ"), false);
  assert.ok(b.id);
});
