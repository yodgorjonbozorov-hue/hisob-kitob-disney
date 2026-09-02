/**
 * MODUL TIZIMI TESTLARI (BOS-1).
 * computeNav (sof), getEnabledModules/requireModule (guard), TenantModule izolyatsiyasi.
 * Ishga tushirish: npm run test:modules
 */
process.env.DATABASE_URL = "file:./prisma/test-modules.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let registry: any;
let guard: any;
let ForbiddenError: any;

let tA: any;
let tB: any;

function fakeCtx(tenant: any, rol: string) {
  return {
    session: { rol },
    tenantId: tenant.id,
    tenant: { ...tenant },
    access: { mode: "FULL" },
  };
}

before(async () => {
  rmSync("prisma/test-modules.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], { env: { ...process.env }, encoding: "utf8" });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  registry = await import("@/lib/modules/registry");
  guard = await import("@/lib/modules/guard");
  ({ ForbiddenError } = await import("@/lib/auth/guard"));

  tA = await createTenantWithOwner({ kompaniyaNomi: "Modul A", ism: "A", login: "+998933333301", parol: "parol12345" });
  tB = await createTenantWithOwner({ kompaniyaNomi: "Modul B", ism: "B", login: "+998933333302", parol: "parol12345" });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- computeNav (sof funksiya) ----------
test("computeNav: OWNER + OMBOR yoqiq + omborli — to'liq nav", () => {
  const items = registry.computeNav({ rol: "OWNER", yoqilgan: new Set(["MOLIYA", "OMBOR", "BOSHQARUV"]), omborli: true });
  const hrefs = items.map((i: any) => i.href);
  assert.ok(hrefs.includes("/app"));
  assert.ok(hrefs.includes("/app/ombor"));
  assert.ok(hrefs.includes("/app/admin/audit"));
  assert.ok(hrefs.includes("/app/sozlamalar/modullar"));
  // Tartib: asosiy -> ombor -> takroriy/smena -> boshqaruv
  assert.ok(hrefs.indexOf("/app/ombor") < hrefs.indexOf("/app/takroriy"));
});

test("computeNav: OMBOR yoqilmagan bo'lsa ombor havolalari yo'q (omborli bo'lsa ham)", () => {
  const items = registry.computeNav({ rol: "OWNER", yoqilgan: new Set(["MOLIYA", "BOSHQARUV"]), omborli: true });
  const hrefs = items.map((i: any) => i.href);
  assert.ok(!hrefs.includes("/app/ombor"));
  assert.ok(!hrefs.includes("/app/sotuv"));
});

test("computeNav: aktiv biznes omborli bo'lmasa ham ombor ko'rinmaydi", () => {
  const items = registry.computeNav({ rol: "OWNER", yoqilgan: new Set(["MOLIYA", "OMBOR", "BOSHQARUV"]), omborli: false });
  assert.ok(!items.some((i: any) => i.href === "/app/sotuv"));
});

test("computeNav: SELLER faqat Yozuvlar ko'radi", () => {
  const items = registry.computeNav({ rol: "SELLER", yoqilgan: new Set(["MOLIYA", "OMBOR", "BOSHQARUV"]), omborli: true });
  assert.deepEqual(items.map((i: any) => i.href), ["/app/tranzaksiyalar"]);
});

test("computeNav: CASHIER — yozuvlar, qarzlar, smena va (omborli bo'lsa) sotuv", () => {
  const items = registry.computeNav({ rol: "CASHIER", yoqilgan: new Set(["MOLIYA", "OMBOR", "BOSHQARUV"]), omborli: true });
  const hrefs = items.map((i: any) => i.href);
  // Tartib "asosiy" bo'limdan boshlanadi (Kirim/Chiqim, Qarzlar),
  // keyin ish jarayoni havolalari keladi.
  // "Kassalar" (barcha kassalar va JAMI pul) kassirga YOPIQ — kassa
  // maxfiyligi: u boshqa xodimning kassasidagi pulni ko'rmaydi va o'z
  // kassasi bilan "Mening kassam"da ishlaydi.
  assert.deepEqual(hrefs, [
    "/app/tranzaksiyalar",
    "/app/qarzlar",
    "/app/smena",
    "/app/kassam",
    "/app/sotuv",
  ]);
  assert.ok(!hrefs.includes("/app/kassa"), "kassir menyusida Kassalar yo'q");
});

// ---------- Sidebar bo'limlari (UX guruhlash) ----------
test("guruhlanganNav: asosiy / ish jarayoni / sozlamalar bo'limlari", () => {
  const items = registry.computeNav({
    rol: "OWNER",
    yoqilgan: new Set(["MOLIYA", "OMBOR", "CRM", "VAZIFALAR", "BOSHQARUV"]),
    omborli: true,
  });
  const bolimlar = registry.guruhlanganNav(items);
  const kodlar = bolimlar.map((b: any) => b.guruh);
  assert.deepEqual(kodlar, ["asosiy", "ish", "sozlamalar"]);

  const asosiy = bolimlar.find((b: any) => b.guruh === "asosiy").items.map((i: any) => i.href);
  // Ustuvor havolalar — aynan shu tartibda.
  assert.deepEqual(asosiy, [
    "/app",
    "/app/crm",
    "/app/tranzaksiyalar",
    "/app/qarzlar",
    "/app/kassa",
    "/app/ombor",
    "/app/hisobot",
  ]);

  const ish = bolimlar.find((b: any) => b.guruh === "ish").items.map((i: any) => i.href);
  for (const href of ["/app/crm/kontaktlar", "/app/vazifalar", "/app/takroriy", "/app/smena"]) {
    assert.ok(ish.includes(href), `${href} "Ish jarayoni" bo'limida bo'lishi kerak`);
  }

  const sozlamalar = bolimlar
    .find((b: any) => b.guruh === "sozlamalar")
    .items.map((i: any) => i.href);
  assert.deepEqual(sozlamalar, [
    "/app/admin/bizneslar",
    "/app/admin/kategoriyalar",
    "/app/admin/foydalanuvchilar",
    "/app/admin/ochirilganlar",
    "/app/admin/audit",
    "/app/sozlamalar/modullar",
    "/billing",
  ]);
});

test("guruhlanganNav: bo'sh bo'lim chizilmaydi (SELLER)", () => {
  const items = registry.computeNav({ rol: "SELLER", yoqilgan: new Set(["MOLIYA", "BOSHQARUV"]), omborli: false });
  const bolimlar = registry.guruhlanganNav(items);
  assert.deepEqual(bolimlar.map((b: any) => b.guruh), ["asosiy"]);
  assert.deepEqual(bolimlar[0].items.map((i: any) => i.href), ["/app/tranzaksiyalar"]);
});

test("guruhlanganNav: hech bir havola yo'qolmaydi", () => {
  const items = registry.computeNav({
    rol: "OWNER",
    yoqilgan: new Set(registry.MODULLAR.map((m: any) => m.code)),
    omborli: true,
    magazin: true,
    pro: true,
    kgSavdo: true,
  });
  const bolimlar = registry.guruhlanganNav(items);
  const jami = bolimlar.reduce((a: number, b: any) => a + b.items.length, 0);
  assert.equal(jami, items.length);
});

test("Rollar va huquqlar — PRO'da sozlamalar bo'limida", () => {
  const items = registry.computeNav({
    rol: "OWNER",
    yoqilgan: new Set(["MOLIYA", "BOSHQARUV"]),
    omborli: false,
    pro: true,
  });
  const sozlamalar = registry
    .guruhlanganNav(items)
    .find((b: any) => b.guruh === "sozlamalar")
    .items.map((i: any) => i.href);
  assert.ok(sozlamalar.includes("/app/admin/rollar"));
});

test("AI yordamchi havolasi registry'da qoladi (Sidebar uni tugma qilib chizadi)", () => {
  const yoqiq = registry.computeNav({ rol: "OWNER", yoqilgan: new Set(["MOLIYA", "AI"]), omborli: false });
  assert.ok(yoqiq.some((i: any) => i.href === registry.AI_HREF));
  // Modul yoqilmagan bo'lsa havola ham, tugma ham yo'q.
  const yoq = registry.computeNav({ rol: "OWNER", yoqilgan: new Set(["MOLIYA"]), omborli: false });
  assert.ok(!yoq.some((i: any) => i.href === registry.AI_HREF));
  // Kassirga AI ochiq emas (rol matritsasi o'zgarmagan).
  const kassir = registry.computeNav({ rol: "CASHIER", yoqilgan: new Set(["MOLIYA", "AI"]), omborli: false });
  assert.ok(!kassir.some((i: any) => i.href === registry.AI_HREF));
});

test("yorliqlar: Kirim / Chiqim va Hisobotlar", () => {
  const items = registry.computeNav({ rol: "OWNER", yoqilgan: new Set(["MOLIYA"]), omborli: false });
  const yorliq = (href: string) => items.find((i: any) => i.href === href)?.label;
  assert.equal(yorliq("/app/tranzaksiyalar"), "Kirim / Chiqim");
  assert.equal(yorliq("/app/hisobot"), "Hisobotlar");
  const tabs = registry.computeMobileTabs({ rol: "SELLER", yoqilgan: new Set(["MOLIYA"]), omborli: false });
  // Pastki panel yorlig'i ataylab qisqaroq (375px da uch tab sig'ishi kerak).
  assert.equal(tabs.find((t: any) => t.href === "/app/tranzaksiyalar")?.label, "Kirim/Chiqim");
});

test("computeNav: OMBORSIZ biznesda ham Qarzlar ko'rinadi", () => {
  // Qarz ombordan mustaqil moliyaviy majburiyat: "Kirim → Qarz" har qanday
  // biznesda ishlaydi, demak uni ko'rsatadigan sahifa ham bo'lishi shart.
  const items = registry.computeNav({ rol: "CASHIER", yoqilgan: new Set(["MOLIYA"]), omborli: false });
  const hrefs = items.map((i: any) => i.href);
  assert.ok(hrefs.includes("/app/qarzlar"));
  assert.ok(!hrefs.includes("/app/sotuv"));
});

test("computeMobileTabs: maksimal 3 tab", () => {
  const tabs = registry.computeMobileTabs({ rol: "OWNER", yoqilgan: new Set(["MOLIYA", "OMBOR"]), omborli: true });
  assert.ok(tabs.length <= 3);
  assert.equal(tabs[0].href, "/app");
});

test("KUNLIK yoqilganda sotuvchi va kassir uni ko'radi (nav + mobil tab)", () => {
  // Sidebar/menyu: SELLER uchun Kunlik hisobot havolasi chiqadi
  const items = registry.computeNav({ rol: "SELLER", yoqilgan: new Set(["MOLIYA", "KUNLIK", "BOSHQARUV"]), omborli: false });
  assert.ok(items.some((i: any) => i.href === "/app/kunlik"));

  // Telefon pastki paneli: sotuvchi va kassirda "Kunlik" tab bor, 3 tadan oshmaydi
  const seller = registry.computeMobileTabs({ rol: "SELLER", yoqilgan: new Set(["MOLIYA", "KUNLIK", "CRM"]), omborli: false });
  assert.ok(seller.some((t: any) => t.href === "/app/kunlik"));
  assert.ok(seller.length <= 3);

  const kassir = registry.computeMobileTabs({ rol: "CASHIER", yoqilgan: new Set(["MOLIYA", "KUNLIK", "OMBOR"]), omborli: true });
  assert.ok(kassir.some((t: any) => t.href === "/app/kunlik"));
  assert.ok(kassir.length <= 3);

  // KUNLIK yoqilmagan tenantda tab chiqmaydi
  const yoq = registry.computeMobileTabs({ rol: "SELLER", yoqilgan: new Set(["MOLIYA"]), omborli: false });
  assert.ok(!yoq.some((t: any) => t.href === "/app/kunlik"));
});

// ---------- getEnabledModules / requireModule ----------
test("core modullar yozuvsiz ham yoqilgan; OMBOR yozuvsiz yoqilmagan", async () => {
  const yoqilgan = await runWithTenant(tA.tenant.id, () => guard.getEnabledModules(fakeCtx(tA.tenant, "OWNER")));
  assert.ok(yoqilgan.has("MOLIYA"));
  assert.ok(yoqilgan.has("BOSHQARUV"));
  assert.ok(!yoqilgan.has("OMBOR")); // yangi signup tenantida OMBOR yoqilmagan
});

test("modul yoqilgach getEnabledModules uni ko'radi", async () => {
  await runWithTenant(tA.tenant.id, () =>
    prisma.tenantModule.create({ data: { code: "OMBOR", isActive: true } })
  );
  const yoqilgan = await runWithTenant(tA.tenant.id, () => guard.getEnabledModules(fakeCtx(tA.tenant, "OWNER")));
  assert.ok(yoqilgan.has("OMBOR"));
});

test("requireModule: yoqilmagan modul -> ForbiddenError", async () => {
  await assert.rejects(
    async () => runWithTenant(tB.tenant.id, () => guard.requireModule(fakeCtx(tB.tenant, "OWNER"), "OMBOR")),
    ForbiddenError
  );
});

test("requireModule: SELLER uchun OMBOR rol matritsasida yopiq", async () => {
  await assert.rejects(
    async () => runWithTenant(tA.tenant.id, () => guard.requireModule(fakeCtx(tA.tenant, "SELLER"), "OMBOR")),
    ForbiddenError
  );
});

test("requireModule: yoqilgan modul + to'g'ri rol -> o'tadi", async () => {
  await runWithTenant(tA.tenant.id, () => guard.requireModule(fakeCtx(tA.tenant, "CASHIER"), "OMBOR"));
});

// ---------- Izolyatsiya ----------
test("TenantModule boshqa tenantga ko'rinmaydi", async () => {
  const bRows = await runWithTenant(tB.tenant.id, () => prisma.tenantModule.findMany());
  assert.equal(bRows.length, 0); // A'ning OMBOR yozuvi B'da yo'q
});

test("tarifda yo'q modul yoqilgan bo'lsa ham hisobga olinmaydi", async () => {
  await runWithTenant(tB.tenant.id, () =>
    prisma.tenantModule.create({ data: { code: "CRM_MAVJUD_EMAS", isActive: true } })
  );
  const yoqilgan = await runWithTenant(tB.tenant.id, () => guard.getEnabledModules(fakeCtx(tB.tenant, "OWNER")));
  assert.ok(!yoqilgan.has("CRM_MAVJUD_EMAS"));
});
