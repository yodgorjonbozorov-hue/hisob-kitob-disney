/**
 * KUNLIK HISOBOT TESTLARI.
 *
 * Asosiy invariantlar:
 *  - bir biznes + bir sana = bitta hisobot (parallel kiritishda ham);
 *  - jami = naqd + click + qarz, har mutatsiyada bazadan qayta jamlanadi;
 *  - tasdiqlangan kunga yozib/o'zgartirib bo'lmaydi, qayta tasdiqlash rad;
 *  - tasdiqlash — faqat tayinlangan direktor (yo'q bo'lsa boshqaruvchi);
 *  - yangi kun 0 dan boshlanadi, eski kunlar tarixda qoladi;
 *  - tenant izolyatsiyasi.
 *
 * Ishga tushirish: npm run test:kunlik
 */
process.env.DATABASE_URL = "file:./prisma/test-kunlik.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let kunlikSvc: any;
let kunlikQ: any;
let validation: any;
let date: any;
let createTenantWithOwner: any;

let tA: any;
let tB: any;
let kassir: any;
let bugun: string;

function A<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(tA.tenant.id, fn, { userId: tA.user.id, ism: "A egasi" });
}
function B<T>(fn: () => Promise<T>): Promise<T> {
  return runWithTenant(tB.tenant.id, fn, { userId: tB.user.id, ism: "B egasi" });
}

const egaAktor = () => ({ userId: tA.user.id, ism: "A egasi", rol: "OWNER" });
const kassirAktor = () => ({ userId: kassir.id, ism: kassir.ism, rol: "CASHIER" });

before(async () => {
  rmSync("prisma/test-kunlik.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  kunlikSvc = await import("@/lib/services/kunlik");
  kunlikQ = await import("@/lib/queries/kunlik");
  validation = await import("@/lib/validation/kunlik");
  date = await import("@/lib/date");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Kunlik A",
    ism: "A egasi",
    login: "+998900000101",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Kunlik B",
    ism: "B egasi",
    login: "+998900000102",
    parol: "parol12345",
  });

  // Kassir — keyinchalik direktor etib tayinlanadi (rol emas, tayinlov muhim).
  kassir = await rawPrisma.user.create({
    data: {
      ism: "Abdulloh Karimov",
      login: "+998900000103",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: tA.tenant.id,
      businessId: tA.business.id,
    },
  });

  bugun = kunlikSvc.kunlikBugun();
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Toshkent kun chegarasi ----------

test("todayTashkentDateOnlyString UTC+5 bo'yicha kunni beradi", () => {
  // 20:30 UTC = 01:30 Toshkent (ertasi kun)
  assert.equal(
    date.todayTashkentDateOnlyString(new Date("2026-08-11T20:30:00.000Z")),
    "2026-08-12"
  );
  // 18:00 UTC = 23:00 Toshkent (o'sha kun)
  assert.equal(
    date.todayTashkentDateOnlyString(new Date("2026-08-11T18:00:00.000Z")),
    "2026-08-11"
  );
});

// ---------- Zod ----------

test("0 va manfiy summa, noto'g'ri to'lov turi rad etiladi", () => {
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: 0, tolovTuri: "CASH" }).success, false);
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: -5, tolovTuri: "CASH" }).success, false);
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: 10.5, tolovTuri: "CASH" }).success, false);
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: 100, tolovTuri: "PAYPAL" }).success, false);
  assert.equal(validation.createKunlikTushumSchema.safeParse({ summa: 100, tolovTuri: "CLICK" }).success, true);
});

// ---------- Tushum kiritish va jamlash ----------

test("tushum bugungi hisobotga tushadi, jami avtomatik hisoblanadi", async () => {
  await A(() => kunlikSvc.addKunlikTushum(tA.business.id, egaAktor(), { summa: 2_500_000, tolovTuri: "CASH" }));
  await A(() => kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa: 1_350_000, tolovTuri: "CLICK", izoh: "terminal" }));
  await A(() => kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa: 500_000, tolovTuri: "DEBT" }));

  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.naqdSumma, 2_500_000);
  assert.equal(r.clickSumma, 1_350_000);
  assert.equal(r.qarzSumma, 500_000);
  assert.equal(r.jamiSumma, 4_350_000);
  assert.equal(r.holat, "OPEN");
  assert.equal(r.items.length, 3);
  // Kim kiritgani saqlanadi
  assert.equal(r.items.some((i: any) => i.userIsm === "Abdulloh Karimov"), true);
});

test("parallel kiritish dublikat hisobot ochmaydi (race)", async () => {
  const soni = 8;
  await Promise.all(
    Array.from({ length: soni }, (_, i) =>
      A(() => kunlikSvc.addKunlikTushum(tA.business.id, egaAktor(), { summa: 10_000 + i, tolovTuri: "CASH" }))
    )
  );
  const reportlar = await A(() =>
    prisma.dailyReport.findMany({ where: { businessId: tA.business.id } })
  );
  assert.equal(reportlar.length, 1);
  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r.items.length, 3 + soni);
  const kutilgan = 4_350_000 + Array.from({ length: soni }, (_, i) => 10_000 + i).reduce((a, b) => a + b, 0);
  assert.equal(r.jamiSumma, kutilgan);
});

// ---------- Direktor tayinlanmaganda: boshqaruvchi fallback ----------

test("direktor yo'q bo'lsa boshqaruvchi tasdiqlaydi (bo'sh kun 0 bilan)", async () => {
  const r = await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, egaAktor(), "2026-08-01"));
  assert.equal(r.holat, "CONFIRMED");
  assert.equal(r.jamiSumma, 0);
  assert.equal(r.confirmedByIsm, "A egasi");
});

test("oddiy xodim tasdiqlay olmaydi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun)),
    /direktor/i
  );
});

test("kelajak kunni tasdiqlab bo'lmaydi", async () => {
  const ertaga = date.utcDateToDateOnlyString(
    new Date(date.dateOnlyStringToUTCDate(bugun).getTime() + 24 * 60 * 60 * 1000)
  );
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, egaAktor(), ertaga)),
    /kelajak/i
  );
});

// ---------- Direktor tayinlash ----------

test("begona tenant foydalanuvchisini direktor qilib bo'lmaydi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.setKunlikDirektor(tA.business.id, tB.user.id)),
    /topilmadi/i
  );
});

test("direktor tayinlanadi va almashtirilishi mumkin", async () => {
  await A(() => kunlikSvc.setKunlikDirektor(tA.business.id, kassir.id));
  const d = await A(() => kunlikQ.getKunlikDirektor(tA.business.id));
  assert.equal(d.direktorId, kassir.id);
  assert.equal(d.direktorIsm, "Abdulloh Karimov");
});

test("direktor tayinlangach boshqaruvchi tasdiqlay olmaydi, direktor tasdiqlaydi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, egaAktor(), bugun)),
    /direktor/i
  );

  const r = await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun));
  assert.equal(r.holat, "CONFIRMED");
  assert.equal(r.confirmedBy, kassir.id);
  assert.equal(r.confirmedByIsm, "Abdulloh Karimov");
  assert.ok(r.confirmedAt);
});

// ---------- Tasdiqlangan kun qulflanadi ----------

test("bir kunni qayta tasdiqlash rad etiladi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun)),
    /allaqachon tasdiqlangan/i
  );
});

test("tasdiqlangan kunga tushum kiritib bo'lmaydi", async () => {
  await assert.rejects(
    () => A(() => kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa: 1_000, tolovTuri: "CASH" })),
    /tasdiqlangan/i
  );
});

test("tasdiqlangan kun tushumini o'zgartirish/o'chirish rad etiladi", async () => {
  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  const id = r.items[0].id;
  await assert.rejects(
    () => A(() => kunlikSvc.updateKunlikTushum(tA.business.id, egaAktor(), id, { summa: 999 })),
    /tasdiqlangan/i
  );
  await assert.rejects(
    () => A(() => kunlikSvc.deleteKunlikTushum(tA.business.id, egaAktor(), id)),
    /tasdiqlangan/i
  );
});

// ---------- Qayta ochish va tuzatish ----------

test("qayta ochish: xodimga taqiq, direktor/boshqaruvchiga ruxsat; keyin tuzatiladi", async () => {
  const oddiyXodim = { userId: "yoq-user", ism: "Xodim", rol: "SELLER" as const };
  await assert.rejects(
    () => A(() => kunlikSvc.reopenKunlikReport(tA.business.id, oddiyXodim, bugun)),
    /direktor|boshqaruvchi/i
  );

  const ochildi = await A(() => kunlikSvc.reopenKunlikReport(tA.business.id, egaAktor(), bugun));
  assert.equal(ochildi.holat, "OPEN");
  assert.equal(ochildi.confirmedBy, null);

  // Tuzatish: bitta tushum o'chiriladi — jami kamayadi (soft delete, tarixda qoladi)
  const r1 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  const oxirgi = r1.items[0];
  await A(() => kunlikSvc.deleteKunlikTushum(tA.business.id, egaAktor(), oxirgi.id));
  const r2 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r2.jamiSumma, r1.jamiSumma - oxirgi.summa);
  assert.equal(r2.items.length, r1.items.length - 1);
  const ochirilgan = await rawPrisma.dailyTransaction.findUnique({ where: { id: oxirgi.id } });
  assert.ok(ochirilgan.deletedAt);

  // Tahrirlash ham ishlaydi va qayta jamlanadi
  const t = r2.items[0];
  await A(() => kunlikSvc.updateKunlikTushum(tA.business.id, egaAktor(), t.id, { summa: t.summa + 1_000 }));
  const r3 = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  assert.equal(r3.jamiSumma, r2.jamiSumma + 1_000);

  // Kun qayta tasdiqlanadi
  const r4 = await A(() => kunlikSvc.confirmKunlikReport(tA.business.id, kassirAktor(), bugun));
  assert.equal(r4.holat, "CONFIRMED");
  assert.equal(r4.jamiSumma, r3.jamiSumma);
});

// ---------- Tarix va yangi kun ----------

test("tarix saqlanadi: eski kun o'z summasi bilan, boshqa kun unga ta'sir qilmaydi", async () => {
  const tarix = await A(() => kunlikQ.listKunlikTarix(tA.business.id));
  assert.equal(tarix.length, 2); // bugun + 2026-08-01
  assert.equal(tarix[0].sana, bugun);
  const eski = tarix.find((x: any) => x.sana === "2026-08-01");
  assert.equal(eski.jamiSumma, 0);
  assert.equal(eski.holat, "CONFIRMED");

  // Hisobot ochilmagan kun 0 dan boshlanadi (virtual DTO)
  const bosh = await A(() => kunlikQ.getKunlikReport(tA.business.id, "2026-08-05"));
  assert.equal(bosh.id, null);
  assert.equal(bosh.jamiSumma, 0);
  assert.equal(bosh.holat, "OPEN");
});

// ---------- Ruxsat matritsasi ----------

test("getKunlikRuxsat: direktor/boshqaruvchi/xodim to'g'ri ajratiladi", async () => {
  const ega = await A(() => kunlikSvc.getKunlikRuxsat(tA.business.id, egaAktor()));
  assert.equal(ega.boshqaruvchimi, true);
  assert.equal(ega.direktormi, false);
  assert.equal(ega.tasdiqlaydi, false); // direktor tayinlangan — ega tasdiqlamaydi
  assert.equal(ega.tahrirlaydi, true);
  assert.equal(ega.tarixniKoradi, true);

  const dir = await A(() => kunlikSvc.getKunlikRuxsat(tA.business.id, kassirAktor()));
  assert.equal(dir.direktormi, true);
  assert.equal(dir.tasdiqlaydi, true);
  assert.equal(dir.tarixniKoradi, true);

  const xodim = await A(() =>
    kunlikSvc.getKunlikRuxsat(tA.business.id, { userId: "boshqa", ism: "X", rol: "SELLER" })
  );
  assert.equal(xodim.tasdiqlaydi, false);
  assert.equal(xodim.tahrirlaydi, false);
  assert.equal(xodim.tarixniKoradi, false);
});

// ---------- Tenant izolyatsiyasi ----------

test("begona tenant kunlik hisobotni ko'rmaydi va yoza olmaydi", async () => {
  const soni = await B(() => prisma.dailyReport.count());
  assert.equal(soni, 0);

  const tarix = await B(() => kunlikQ.listKunlikTarix(tA.business.id));
  assert.equal(tarix.length, 0);

  await assert.rejects(
    () =>
      B(() =>
        kunlikSvc.addKunlikTushum(tA.business.id, { userId: tB.user.id, ism: "B egasi", rol: "OWNER" }, { summa: 1_000, tolovTuri: "CASH" })
      ),
    /tegishli emas|topilmadi/i
  );

  await assert.rejects(
    () => B(() => kunlikSvc.confirmKunlikReport(tA.business.id, { userId: tB.user.id, ism: "B egasi", rol: "OWNER" }, bugun)),
    /tegishli emas|topilmadi/i
  );
});

// ---------- Audit ----------

test("tushum va tasdiqlash audit jurnaliga tushadi", async () => {
  const loglar = await rawPrisma.auditLog.findMany({
    where: { businessId: tA.business.id, entity: { in: ["dailyTransaction", "dailyReport", "dailyReportSetting"] } },
  });
  assert.ok(loglar.some((l: any) => l.entity === "dailyTransaction" && l.action === "create"));
  assert.ok(loglar.some((l: any) => l.entity === "dailyTransaction" && l.action === "delete"));
  assert.ok(loglar.some((l: any) => l.entity === "dailyReport" && l.action === "update"));
  assert.ok(loglar.some((l: any) => l.entity === "dailyReportSetting"));
});
