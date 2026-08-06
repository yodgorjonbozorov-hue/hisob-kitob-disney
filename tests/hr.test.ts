/**
 * HR-LITE MODULI (Faza 6.4) — xodim, davomat va oylik.
 *
 * Asosiy invariant: oylik hisoblash PUL EMAS. `qoralama` vedomost hisobotga
 * ta'sir qilmaydi; chiqim faqat "to'lash" da yoziladi. Avans esa aksincha —
 * pul darhol chiqadi, shuning uchun u oy yopilganda hisobdan CHEGIRILADI,
 * aks holda bir xil pul ikki marta chiqim bo'lib ko'rinardi.
 *
 * Ishga tushirish: npm run test:hr
 */
process.env.DATABASE_URL = "file:./prisma/test-hr.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let hr: any;
let queries: any;
let createTenantWithOwner: any;

let t: any;
let t2: any;
let oylikchi: any;
let kunlikchi: any;

const OY = "2026-07";

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

/** Chiqim tranzaksiyalari yig'indisi — pul haqiqatan chiqdimi, shuni tekshiradi. */
async function chiqimJami(): Promise<number> {
  const agg = await rawPrisma.transaction.aggregate({
    where: { businessId: t.business.id, turi: "chiqim", deletedAt: null },
    _sum: { summa: true },
  });
  return agg._sum.summa ?? 0;
}

before(async () => {
  rmSync("prisma/test-hr.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  hr = await import("@/lib/services/hr");
  queries = await import("@/lib/queries/hr");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "HR test",
    ism: "Egasi",
    login: "+998922222601",
    parol: "parol12345",
  });
  t2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona firma",
    ism: "Begona",
    login: "+998922222602",
    parol: "parol12345",
  });
  await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "HR kassa", turi: "naqd" },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Xodimlar ----------

test("xodim yaratiladi va ro'yxatda ko'rinadi", async () => {
  oylikchi = await T(async () =>
    hr.createEmployee(t.business.id, {
      ism: "Dilshod", lavozim: "Menejer", stavka: 5_000_000, stavkaTuri: "oylik",
    })
  );
  kunlikchi = await T(async () =>
    hr.createEmployee(t.business.id, {
      ism: "Sardor", lavozim: "Yuk tashuvchi", stavka: 200_000, stavkaTuri: "kunlik",
    })
  );

  const royxat = await T(async () => queries.listXodimlar(t.business.id));
  assert.equal(royxat.length, 2);
  assert.equal(royxat.find((x: any) => x.id === oylikchi.id).stavkaTuri, "oylik");
});

test("bir xil ismdagi ikkinchi xodim rad etiladi", async () => {
  await assert.rejects(
    () => T(async () => hr.createEmployee(t.business.id, { ism: "Dilshod", stavka: 1, stavkaTuri: "oylik" })),
    /allaqachon bor/
  );
});

test("begona tenant xodimini tahrirlab bo'lmaydi", async () => {
  await assert.rejects(
    () => runWithTenant(t2.tenant.id, async () =>
      hr.updateEmployee(t2.business.id, oylikchi.id, { ism: "O'g'irlandi" })
    ),
    /topilmadi/
  );
});

// ---------- Davomat ----------

test("davomat belgilanadi va qayta belgilanganda ustiga yoziladi", async () => {
  await T(async () =>
    hr.davomatBelgila(t.business.id, { employeeId: kunlikchi.id, sana: "2026-07-01", holat: "keldi" })
  );
  await T(async () =>
    hr.davomatBelgila(t.business.id, { employeeId: kunlikchi.id, sana: "2026-07-01", holat: "yarim" })
  );

  const soni = await rawPrisma.attendance.count({
    where: { businessId: t.business.id, employeeId: kunlikchi.id },
  });
  assert.equal(soni, 1, "bir kun uchun bitta yozuv");

  const yozuv = await rawPrisma.attendance.findFirst({
    where: { businessId: t.business.id, employeeId: kunlikchi.id },
  });
  assert.equal(yozuv.holat, "yarim");
});

test("davomat jadvali oy bo'yicha qaytadi", async () => {
  // 1-kun yarim (allaqachon), 2..11 to'liq, 12 kelmadi.
  for (let k = 2; k <= 11; k++) {
    await T(async () =>
      hr.davomatBelgila(t.business.id, {
        employeeId: kunlikchi.id, sana: `2026-07-${String(k).padStart(2, "0")}`, holat: "keldi",
      })
    );
  }
  await T(async () =>
    hr.davomatBelgila(t.business.id, { employeeId: kunlikchi.id, sana: "2026-07-12", holat: "kelmadi" })
  );

  const d = await T(async () => queries.getDavomat(t.business.id, OY));
  assert.equal(d.xodimlar.length, 2);
  assert.equal(d.kunlar.length, 12);
});

// ---------- Oylik hisoblash ----------

test("kunlik stavkada oylik davomatdan hisoblanadi", async () => {
  const oldingiChiqim = await chiqimJami();

  const p = await T(async () =>
    hr.oylikHisobla(t.business.id, t.user.id, { employeeId: kunlikchi.id, oy: OY })
  );
  // 10 to'liq + 1 yarim = 10.5 kun -> yarimKunlar = 21
  assert.equal(p.yarimKunlar, 21);
  assert.equal(p.hisoblangan, Math.round((200_000 * 21) / 2), "10.5 kun × 200 000");
  assert.equal(p.tolanadigan, 2_100_000);
  assert.equal(p.holat, "qoralama");
  assert.equal(p.transactionId, null);

  assert.equal(await chiqimJami(), oldingiChiqim, "hisoblash PUL YOZUVI EMAS");
});

test("oylik stavkada asos to'liq stavka bo'ladi", async () => {
  const p = await T(async () =>
    hr.oylikHisobla(t.business.id, t.user.id, { employeeId: oylikchi.id, oy: OY })
  );
  assert.equal(p.hisoblangan, 5_000_000, "davomatdan qat'i nazar to'liq stavka");
  assert.equal(p.tolanadigan, 5_000_000);
});

test("ustama qo'shadi, ushlab qolish kamaytiradi", async () => {
  const p = await T(async () =>
    hr.oylikHisobla(t.business.id, t.user.id, {
      employeeId: oylikchi.id, oy: OY, qoshimcha: 500_000, ushlab: 200_000,
    })
  );
  assert.equal(p.tolanadigan, 5_000_000 + 500_000 - 200_000);
});

// ---------- Avans ----------

test("avans DARHOL chiqim yozadi va oylikdan chegiriladi", async () => {
  const oldingiChiqim = await chiqimJami();

  const a = await T(async () =>
    hr.avansBer(t.business.id, t.user.id, {
      employeeId: oylikchi.id, oy: OY, summa: 1_000_000, sana: "2026-07-15",
    })
  );
  assert.ok(a.transactionId, "avans chiqim tranzaksiyasi yozishi kerak");

  assert.equal(await chiqimJami(), oldingiChiqim + 1_000_000, "pul haqiqatan chiqdi");

  // Qoralama vedomost darhol yangilanadi.
  const p = await rawPrisma.payroll.findFirst({
    where: { businessId: t.business.id, employeeId: oylikchi.id, oy: OY },
  });
  assert.equal(p.avans, 1_000_000);
  assert.equal(p.tolanadigan, 5_000_000 + 500_000 - 200_000 - 1_000_000);
});

test("qayta hisoblash avansni yo'qotmaydi", async () => {
  const p = await T(async () =>
    hr.oylikHisobla(t.business.id, t.user.id, { employeeId: oylikchi.id, oy: OY })
  );
  assert.equal(p.avans, 1_000_000, "avans qayta hisoblashda ham hisobga olinadi");
  assert.equal(p.qoshimcha, 500_000, "berilmagan qiymatlar saqlanadi");
  assert.equal(p.tolanadigan, 4_300_000);
});

test("avans hisoblangandan ko'p bo'lsa to'lanadigan manfiy bo'lmaydi", async () => {
  const kambag = await T(async () =>
    hr.createEmployee(t.business.id, { ism: "Kichik stavka", stavka: 100_000, stavkaTuri: "oylik" })
  );
  await T(async () =>
    hr.avansBer(t.business.id, t.user.id, { employeeId: kambag.id, oy: OY, summa: 500_000 })
  );
  const p = await T(async () =>
    hr.oylikHisobla(t.business.id, t.user.id, { employeeId: kambag.id, oy: OY })
  );
  assert.equal(p.avans, 500_000);
  assert.equal(p.tolanadigan, 0, "manfiy oylik yozilmaydi");

  await assert.rejects(
    () => T(async () => hr.oylikTola({
      businessId: t.business.id, payrollId: p.id, userId: t.user.id,
    })),
    /nol/
  );
});

// ---------- To'lash ----------

test("to'lash chiqim yozuvini yaratadi va vedomostni yopadi", async () => {
  const oldingiChiqim = await chiqimJami();
  const vedomost = await rawPrisma.payroll.findFirst({
    where: { businessId: t.business.id, employeeId: oylikchi.id, oy: OY },
  });

  const p = await T(async () =>
    hr.oylikTola({
      businessId: t.business.id, payrollId: vedomost.id, userId: t.user.id, sana: "2026-08-01",
    })
  );
  assert.equal(p.holat, "tolangan");
  assert.ok(p.transactionId);

  const txn = await rawPrisma.transaction.findUnique({ where: { id: p.transactionId } });
  assert.equal(txn.turi, "chiqim");
  assert.equal(txn.summa, 4_300_000, "avans chegirilgan summa yoziladi");
  assert.ok(txn.accountId, "kassa avtomatik bog'lanadi");

  assert.equal(
    await chiqimJami(),
    oldingiChiqim + 4_300_000,
    "avans (1 mln) + oylik (4.3 mln) = jami 5.3 mln — ikki marta hisoblanmadi"
  );
});

test("to'langan oylikni qayta to'lab ham, qayta hisoblab ham bo'lmaydi", async () => {
  const vedomost = await rawPrisma.payroll.findFirst({
    where: { businessId: t.business.id, employeeId: oylikchi.id, oy: OY },
  });
  await assert.rejects(
    () => T(async () => hr.oylikTola({
      businessId: t.business.id, payrollId: vedomost.id, userId: t.user.id,
    })),
    /allaqachon to'langan/
  );
  await assert.rejects(
    () => T(async () => hr.oylikHisobla(t.business.id, t.user.id, {
      employeeId: oylikchi.id, oy: OY,
    })),
    /allaqachon to'langan/
  );
});

test("to'langan oyga avans yozib bo'lmaydi", async () => {
  await assert.rejects(
    () => T(async () => hr.avansBer(t.business.id, t.user.id, {
      employeeId: oylikchi.id, oy: OY, summa: 100_000,
    })),
    /keyingi oyga/
  );
});

// ---------- Ro'yxat, statistika, o'chirish ----------

test("vedomost ro'yxatida hisoblanmagan xodim ham ko'rinadi", async () => {
  const yangi = await T(async () =>
    hr.createEmployee(t.business.id, { ism: "Yangi kelgan", stavka: 3_000_000, stavkaTuri: "oylik" })
  );
  const royxat = await T(async () => queries.listOyliklar(t.business.id, OY));
  const q = royxat.find((r: any) => r.employeeId === yangi.id);
  assert.ok(q, "vedomosti yo'q xodim ham ro'yxatda bo'lishi kerak");
  assert.equal(q.id, null);
  assert.equal(q.holat, "hisoblanmagan");
});

test("statistika to'lanadigan va to'langanni ajratadi", async () => {
  const stats = await T(async () => queries.getHrStats(t.business.id, OY));
  const royxat = await T(async () => queries.listOyliklar(t.business.id, OY));

  const qoralamaJami = royxat
    .filter((r: any) => r.holat === "qoralama")
    .reduce((a: number, r: any) => a + r.tolanadigan, 0);
  assert.equal(stats.tolanadigan, qoralamaJami);
  // To'langan: oylik 4.3 mln + avanslar (1 mln + 0.5 mln)
  assert.equal(stats.tolangan, 4_300_000 + 1_500_000);
  assert.ok(stats.faolXodim >= 4);
});

test("to'lanmagan vedomosti bor xodim o'chirilmaydi", async () => {
  await assert.rejects(
    () => T(async () => hr.deleteEmployee(t.business.id, kunlikchi.id)),
    /to'lanmagan oylik/
  );
});

test("qarzsiz xodim yumshoq o'chiriladi, tarixi qoladi", async () => {
  await T(async () => hr.deleteEmployee(t.business.id, oylikchi.id));

  const ochirilgan = await rawPrisma.employee.findUnique({ where: { id: oylikchi.id } });
  assert.ok(ochirilgan.deletedAt);
  assert.equal(ochirilgan.isActive, false);

  const vedomostlar = await rawPrisma.payroll.count({ where: { employeeId: oylikchi.id } });
  assert.equal(vedomostlar, 1, "oylik tarixi saqlanadi");

  const royxat = await T(async () => queries.listXodimlar(t.business.id));
  assert.ok(!royxat.some((x: any) => x.id === oylikchi.id));
});

test("begona tenant xodim va vedomostlarni ko'rmaydi", async () => {
  const xodimlar = await runWithTenant(t2.tenant.id, async () =>
    queries.listXodimlar(t2.business.id)
  );
  assert.equal(xodimlar.length, 0);

  const oyliklar = await runWithTenant(t2.tenant.id, async () =>
    queries.listOyliklar(t2.business.id, OY)
  );
  assert.equal(oyliklar.length, 0);
});
