/**
 * SMENA YAKUNI TESTLARI — ikki smenali savdoda kassa nazorati.
 *
 * Asosiy invariantlar:
 *  - kutilgan naqd = boshlangich qoldiq + smena naqd tushumi − naqd chiqimi;
 *  - farq = sanalgan − kutilgan (manfiy = KAM), aynan shu raqam xodimni tekshiradi;
 *  - 1-smena yopilgach 2-smena NOLDAN boshlanadi — birinchi smenaning puli
 *    ikkinchisiga qo'shilib ketmaydi;
 *  - kunlik hisobotning kirim/chiqim raqamlari SMENADAN o'zgarmaydi;
 *  - kassada ataylab qoldirilgan pul keyingi smenaning boshlangich qoldig'i bo'ladi;
 *  - yopilgan smena raqamlari MUZLAYDI (keyin tushum kiritilsa ham o'zgarmaydi);
 *  - qayta ochish faqat OXIRGI smenaga ruxsat, faqat direktor/boshqaruvchiga;
 *  - tenant izolyatsiyasi.
 *
 * Ishga tushirish: npm run test:smena
 */
process.env.DATABASE_URL = "file:./prisma/test-smena.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let kunlikSvc: any;
let kunlikQ: any;
let smenaSvc: any;
let smenaQ: any;
let validation: any;
let createTenantWithOwner: any;

let tA: any;
let tB: any;
let kassir: any;
let kategoriya: any;
let bugun: string;

function A(fn: () => unknown): Promise<any> {
  return runWithTenant(tA.tenant.id, fn, { userId: tA.user.id, ism: "A egasi" });
}
function B(fn: () => unknown): Promise<any> {
  return runWithTenant(tB.tenant.id, fn, { userId: tB.user.id, ism: "B egasi" });
}

const egaAktor = () => ({ userId: tA.user.id, ism: "A egasi", rol: "OWNER" });
const kassirAktor = () => ({ userId: kassir.id, ism: kassir.ism, rol: "CASHIER" });

/** Soat aniqligi millisekundda — oyna chegaralari aralashib ketmasin. */
const kut = () => new Promise((r) => setTimeout(r, 10));

/** Naqd tushum kiritish (kunlik hisobot orqali — kassaga tushgan pul). */
const naqdTushum = (summa: number) =>
  A(() => kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa, tolovTuri: "CASH" }));

/** Kassadan naqd chiqim (Yozuvlar orqali). */
async function naqdChiqim(summa: number) {
  await A(() =>
    prisma.transaction.create({
      data: {
        businessId: tA.business.id,
        categoryId: kategoriya.id,
        userId: tA.user.id,
        turi: "chiqim",
        tolovTuri: "naqd",
        summa,
        sana: new Date(`${bugun}T00:00:00.000Z`),
      },
    })
  );
}

before(async () => {
  rmSync("prisma/test-smena.db", { force: true });
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
  smenaSvc = await import("@/lib/services/smena");
  smenaQ = await import("@/lib/queries/smena");
  validation = await import("@/lib/validation/smena");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Smena A",
    ism: "A egasi",
    login: "+998900000201",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Smena B",
    ism: "B egasi",
    login: "+998900000202",
    parol: "parol12345",
  });

  kassir = await rawPrisma.user.create({
    data: {
      ism: "Sotuvchi Zilola",
      login: "+998900000203",
      parolHash: "x",
      rol: "CASHIER",
      tenantId: tA.tenant.id,
      businessId: tA.business.id,
    },
  });

  kategoriya = await rawPrisma.category.findFirst({
    where: { businessId: tA.business.id, turi: "chiqim" },
  });
  assert.ok(kategoriya, "Chiqim kategoriyasi topilmadi");

  bugun = kunlikSvc.kunlikBugun();
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Zod ----------

test("manfiy va kasrli summa rad etiladi, qoldirilgan sanalgandan oshmaydi", () => {
  const s = validation.smenaYopishSchema;
  assert.equal(s.safeParse({ sanalganNaqd: -1 }).success, false);
  assert.equal(s.safeParse({ sanalganNaqd: 10.5 }).success, false);
  assert.equal(s.safeParse({ sanalganNaqd: 0 }).success, true);
  assert.equal(s.safeParse({ sanalganNaqd: 100_000, qoldirilganNaqd: 200_000 }).success, false);
  assert.equal(s.safeParse({ sanalganNaqd: 100_000, qoldirilganNaqd: 50_000 }).success, true);
});

// ---------- 1-smena ----------

test("joriy smena bo'sh bazada 1-raqam va 0 kutilgan naqd bilan boshlanadi", async () => {
  const j = await A(() => smenaQ.getJoriySmena(tA.business.id, bugun));
  assert.equal(j.raqam, 1);
  assert.equal(j.naqd, 0);
  assert.equal(j.kutilganNaqd, 0);
  assert.equal(j.boshlangichQoldiq, 0);
});

test("kutilgan naqd = naqd tushum − naqd chiqim (click/qarz kirmaydi)", async () => {
  await naqdTushum(1_000_000);
  await A(() =>
    kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa: 400_000, tolovTuri: "CLICK" })
  );
  await A(() =>
    kunlikSvc.addKunlikTushum(tA.business.id, kassirAktor(), { summa: 300_000, tolovTuri: "DEBT" })
  );
  await naqdChiqim(150_000);

  const j = await A(() => smenaQ.getJoriySmena(tA.business.id, bugun));
  assert.equal(j.naqd, 1_000_000);
  assert.equal(j.click, 400_000);
  assert.equal(j.qarz, 300_000);
  assert.equal(j.naqdChiqim, 150_000);
  // Click va qarz kassadagi naqdga ta'sir qilmaydi.
  assert.equal(j.kutilganNaqd, 850_000);
});

test("1-smena yopiladi: farq = sanalgan − kutilgan, raqamlar muzlaydi", async () => {
  await kut();
  // Xodim 20 000 kam topshirdi — nazorat aynan shuni ko'rsatishi kerak.
  const s = await A(() =>
    smenaSvc.smenaYop(tA.business.id, kassirAktor(), { sanalganNaqd: 830_000, izoh: "kassa" })
  );
  assert.equal(s.raqam, 1);
  assert.equal(s.kutilganNaqd, 850_000);
  assert.equal(s.sanalganNaqd, 830_000);
  assert.equal(s.farq, -20_000);
  assert.equal(s.qoldirilganNaqd, 0);
  assert.equal(s.yopganIsm, "Sotuvchi Zilola");
});

// ---------- 2-smena noldan boshlanadi ----------

test("2-smena 0 dan boshlanadi — 1-smena puli unga qo'shilmaydi", async () => {
  await kut();
  const j = await A(() => smenaQ.getJoriySmena(tA.business.id, bugun));
  assert.equal(j.raqam, 2);
  assert.equal(j.naqd, 0);
  assert.equal(j.naqdChiqim, 0);
  assert.equal(j.kutilganNaqd, 0);
  assert.equal(j.boshlangichQoldiq, 0);
});

test("2-smena o'z tushumi bilan yuradi va alohida yopiladi", async () => {
  await naqdTushum(600_000);
  await kut();

  const j = await A(() => smenaQ.getJoriySmena(tA.business.id, bugun));
  assert.equal(j.kutilganNaqd, 600_000);

  const s = await A(() =>
    smenaSvc.smenaYop(tA.business.id, kassirAktor(), {
      sanalganNaqd: 600_000,
      qoldirilganNaqd: 100_000,
    })
  );
  assert.equal(s.raqam, 2);
  assert.equal(s.kutilganNaqd, 600_000);
  assert.equal(s.farq, 0);
});

test("kassada qoldirilgan pul keyingi smenaning boshlangich qoldig'i bo'ladi", async () => {
  await kut();
  const j = await A(() => smenaQ.getJoriySmena(tA.business.id, bugun));
  assert.equal(j.raqam, 3);
  assert.equal(j.boshlangichQoldiq, 100_000);
  assert.equal(j.naqd, 0);
  // Tushum yo'q, lekin kassada qaytim puli bor.
  assert.equal(j.kutilganNaqd, 100_000);
});

// ---------- Kunlik raqamlarga tegilmaydi ----------

test("kunlik kirim/chiqim jamlari smenadan keyin ham o'zgarmaydi", async () => {
  const r = await A(() => kunlikQ.getKunlikReport(tA.business.id, bugun));
  // 1 000 000 + 600 000 naqd, 400 000 click, 300 000 qarz — kun bo'yicha to'liq.
  assert.equal(r.naqdSumma, 1_600_000);
  assert.equal(r.clickSumma, 400_000);
  assert.equal(r.qarzSumma, 300_000);
  assert.equal(r.jamiSumma, 2_300_000);
  assert.equal(r.chiqimSumma, 150_000);
  // Smena hech qanday tushum yoki yozuv qo'shmaydi.
  assert.equal(r.items.length, 4);
});

test("yopilgan smena raqamlari keyingi tushumdan o'zgarmaydi (muzlagan)", async () => {
  const oldin = await A(() => smenaQ.getSmenaHolat(tA.business.id, bugun, bugun));
  const birinchi = oldin.yopilganlar[0];
  await naqdTushum(50_000);
  const keyin = await A(() => smenaQ.getSmenaHolat(tA.business.id, bugun, bugun));
  assert.deepEqual(keyin.yopilganlar[0], birinchi);
  // Yangi pul faqat JORIY smenaga tushadi.
  assert.equal(keyin.joriy.naqd, 50_000);
  assert.equal(keyin.joriy.kutilganNaqd, 150_000);
});

// ---------- Holat ko'rinishi ----------

test("smena holati: yopilganlar tartib bo'yicha, joriy faqat bugun uchun", async () => {
  const h = await A(() => smenaQ.getSmenaHolat(tA.business.id, bugun, bugun));
  assert.equal(h.yopilganlar.length, 2);
  assert.deepEqual(
    h.yopilganlar.map((s: any) => s.raqam),
    [1, 2]
  );
  assert.ok(h.joriy);

  const kecha = await A(() => smenaQ.getSmenaHolat(tA.business.id, "2026-01-05", bugun));
  assert.equal(kecha.yopilganlar.length, 0);
  assert.equal(kecha.joriy, null);
});

// ---------- Qayta ochish ----------

test("oddiy xodim smenani qayta ocha olmaydi", async () => {
  const h = await A(() => smenaQ.getSmenaHolat(tA.business.id, bugun, bugun));
  await assert.rejects(
    () => A(() => smenaSvc.smenaQaytaOch(tA.business.id, kassirAktor(), h.yopilganlar[1].id)),
    /direktor|boshqaruvchi/i
  );
});

test("o'rtadagi smenani qayta ochib bo'lmaydi — faqat oxirgisi", async () => {
  const h = await A(() => smenaQ.getSmenaHolat(tA.business.id, bugun, bugun));
  await assert.rejects(
    () => A(() => smenaSvc.smenaQaytaOch(tA.business.id, egaAktor(), h.yopilganlar[0].id)),
    /oxirgi/i
  );
});

test("oxirgi smena qayta ochilsa uning oynasi joriy smenaga qaytadi", async () => {
  const h = await A(() => smenaQ.getSmenaHolat(tA.business.id, bugun, bugun));
  const ikkinchi = h.yopilganlar[1];
  await A(() => smenaSvc.smenaQaytaOch(tA.business.id, egaAktor(), ikkinchi.id));

  const keyin = await A(() => smenaQ.getSmenaHolat(tA.business.id, bugun, bugun));
  assert.equal(keyin.yopilganlar.length, 1);
  // 2-smena (600 000) + undan keyingi 50 000 endi joriy smenada; qaytim puli yo'q.
  assert.equal(keyin.joriy.raqam, 2);
  assert.equal(keyin.joriy.boshlangichQoldiq, 0);
  assert.equal(keyin.joriy.naqd, 650_000);
  assert.equal(keyin.joriy.kutilganNaqd, 650_000);
});

// ---------- Tenant izolyatsiyasi ----------

test("boshqa tenant smenani ko'rmaydi va qayta ocha olmaydi", async () => {
  const h = await A(() => smenaQ.getSmenaHolat(tA.business.id, bugun, bugun));
  const begona = h.yopilganlar[0].id;

  const bHolat = await B(() => smenaQ.getSmenaHolat(tB.business.id, bugun, bugun));
  assert.equal(bHolat.yopilganlar.length, 0);
  assert.equal(bHolat.joriy.kutilganNaqd, 0);

  await assert.rejects(
    () =>
      B(() =>
        smenaSvc.smenaQaytaOch(
          tB.business.id,
          { userId: tB.user.id, ism: "B egasi", rol: "OWNER" },
          begona
        )
      ),
    /topilmadi/i
  );

  // A ning smenasi joyida qoldi.
  const aHolat = await A(() => smenaQ.getSmenaHolat(tA.business.id, bugun, bugun));
  assert.equal(aHolat.yopilganlar.length, 1);
});
