/**
 * TASDIQLASH MODULI (Faza 6.2) — chegaradan oshgan chiqimga rahbar tasdig'i.
 *
 * Asosiy invariant: tasdiq kutayotgan chiqim HALI PUL EMAS. U hisobotga,
 * kassa qoldig'iga va budjetga ta'sir qilmasligi kerak — `Transaction` faqat
 * tasdiqlangan paytda tug'iladi.
 *
 * Ishga tushirish: npm run test:tasdiqlash
 */
process.env.DATABASE_URL = "file:./prisma/test-tasdiqlash.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let approval: any;
let queries: any;
let createTenantWithOwner: any;

let t: any;
let t2: any;
let kassir: any;
let admin: any;
let katChiqim: any;
let katIjara: any;
let katKirim: any;
let umumiyQoida: any;

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

/** Chiqim kiritish yordamchisi — modul yoqilgan holatda. */
function chiqim(user: any, summa: number, categoryId: string) {
  return T(async () =>
    approval.chiqimYubor({
      modulYoqilgan: true,
      businessId: t.business.id,
      user: { id: user.id, rol: user.rol, ism: user.ism },
      data: { turi: "chiqim", categoryId, summa, sana: "2026-08-04" },
    })
  );
}

before(async () => {
  rmSync("prisma/test-tasdiqlash.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  approval = await import("@/lib/services/approval");
  queries = await import("@/lib/queries/approval");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Tasdiq test",
    ism: "Egasi",
    login: "+998922222401",
    parol: "parol12345",
  });
  t2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona firma",
    ism: "Begona",
    login: "+998922222402",
    parol: "parol12345",
  });

  kassir = await rawPrisma.user.create({
    data: {
      ism: "Kassir", login: "+998922222403", parolHash: "x", rol: "CASHIER",
      tenantId: t.tenant.id, businessId: t.business.id,
    },
  });
  admin = await rawPrisma.user.create({
    data: {
      ism: "Administrator", login: "+998922222404", parolHash: "x", rol: "ADMIN",
      tenantId: t.tenant.id,
    },
  });

  katChiqim = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Test xo'jalik", turi: "chiqim" },
  });
  katIjara = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Test ijara", turi: "chiqim" },
  });
  katKirim = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Test sotuv", turi: "kirim" },
  });
  await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Test kassa", turi: "naqd" },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Qoidalar ----------

test("umumiy qoida yaratiladi", async () => {
  umumiyQoida = await T(async () =>
    approval.createRule(t.business.id, { chegara: 1_000_000, tasdiqlovchiRol: "OWNER" })
  );
  assert.equal(umumiyQoida.categoryId, null, "kategoriyasiz qoida — barcha chiqimlarga");
  assert.equal(umumiyQoida.isActive, true);
});

test("bir xil qamrovdagi ikkinchi qoida rad etiladi", async () => {
  await assert.rejects(
    () => T(async () => approval.createRule(t.business.id, { chegara: 500_000 })),
    /allaqachon bor/
  );
});

test("kirim kategoriyasiga qoida qo'yib bo'lmaydi", async () => {
  await assert.rejects(
    () => T(async () => approval.createRule(t.business.id, {
      categoryId: katKirim.id, chegara: 100_000,
    })),
    /faqat chiqim kategoriyasiga/
  );
});

// ---------- Chegara ishlashi ----------

test("chegaradan PAST chiqim odatdagidek darhol yoziladi", async () => {
  const natija = await chiqim(kassir, 900_000, katChiqim.id);
  assert.equal(natija.tasdiqKerak, false);

  const soni = await rawPrisma.approvalRequest.count({ where: { businessId: t.business.id } });
  assert.equal(soni, 0, "chegaradan past summa so'rov yaratmasligi kerak");
});

test("chegaradan OSHGAN chiqim yozilmaydi — so'rov yaratiladi", async () => {
  const oldingi = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });

  const natija = await chiqim(kassir, 2_000_000, katChiqim.id);
  assert.equal(natija.tasdiqKerak, true);
  assert.equal(natija.chegara, 1_000_000);
  assert.equal(natija.request.holat, "kutilmoqda");
  assert.equal(natija.request.transactionId, null);

  const keyingi = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });
  assert.equal(keyingi, oldingi, "tasdiq kutayotgan chiqim pul yozuvi EMAS");
});

test("chegarada TENG summa o'tadi (faqat KATTASI tasdiq talab qiladi)", async () => {
  const natija = await chiqim(kassir, 1_000_000, katChiqim.id);
  assert.equal(natija.tasdiqKerak, false);
});

test("direktorning o'z chiqimi tasdiq talab qilmaydi", async () => {
  const natija = await chiqim(
    { id: t.user.id, rol: "OWNER", ism: "Egasi" },
    50_000_000,
    katChiqim.id
  );
  assert.equal(natija.tasdiqKerak, false, "so'rovchi darajasi tasdiqlovchidan past emas");
});

test("modul yoqilmagan bo'lsa qoida ishlamaydi", async () => {
  const natija = await T(async () =>
    approval.chiqimYubor({
      modulYoqilgan: false,
      businessId: t.business.id,
      user: { id: kassir.id, rol: kassir.rol, ism: kassir.ism },
      data: { turi: "chiqim", categoryId: katChiqim.id, summa: 9_000_000, sana: "2026-08-04" },
    })
  );
  assert.equal(natija.tasdiqKerak, false);
});

test("kirim hech qachon tasdiq talab qilmaydi", async () => {
  const natija = await T(async () =>
    approval.chiqimYubor({
      modulYoqilgan: true,
      businessId: t.business.id,
      user: { id: kassir.id, rol: kassir.rol, ism: kassir.ism },
      data: { turi: "kirim", categoryId: katKirim.id, summa: 80_000_000, sana: "2026-08-04" },
    })
  );
  assert.equal(natija.tasdiqKerak, false);
});

test("kategoriyaga atalgan qattiqroq qoida umumiysidan ustun", async () => {
  await T(async () =>
    approval.createRule(t.business.id, {
      categoryId: katIjara.id, chegara: 100_000, tasdiqlovchiRol: "OWNER",
    })
  );
  // 500 000: umumiy qoida (1 mln) uchun past, lekin ijara qoidasi (100 ming) uchun baland.
  const natija = await chiqim(kassir, 500_000, katIjara.id);
  assert.equal(natija.tasdiqKerak, true);
  assert.equal(natija.chegara, 100_000, "eng qattiq qoida ishlashi kerak");
});

// ---------- Qaror ----------

test("tasdiqlash chiqim yozuvini yaratadi va so'rovga bog'laydi", async () => {
  const sorovlar = await T(async () =>
    queries.listRequests({ businessId: t.business.id, holat: "kutilmoqda" })
  );
  const sorov = sorovlar.find((s: any) => s.summa === 2_000_000);
  assert.ok(sorov, "kutayotgan so'rov bo'lishi kerak");

  const natija = await T(async () =>
    approval.tasdiqla({
      businessId: t.business.id,
      requestId: sorov.id,
      tasdiqlovchi: { id: t.user.id, rol: "OWNER" },
    })
  );
  assert.equal(natija.holat, "tasdiqlangan");
  assert.ok(natija.transactionId);
  assert.equal(natija.tasdiqlovchiId, t.user.id);

  const txn = await rawPrisma.transaction.findUnique({ where: { id: natija.transactionId } });
  assert.equal(txn.turi, "chiqim");
  assert.equal(txn.summa, 2_000_000);
  assert.equal(txn.userId, kassir.id, "yozuv SO'RAGAN xodim nomidan yoziladi");
  assert.ok(txn.accountId, "kassa avtomatik bog'lanadi");
});

test("tasdiqlangan so'rovni qayta tasdiqlab bo'lmaydi", async () => {
  const sorovlar = await T(async () =>
    queries.listRequests({ businessId: t.business.id, holat: "tasdiqlangan" })
  );
  await assert.rejects(
    () => T(async () => approval.tasdiqla({
      businessId: t.business.id,
      requestId: sorovlar[0].id,
      tasdiqlovchi: { id: t.user.id, rol: "OWNER" },
    })),
    /allaqachon tasdiqlangan/
  );
});

test("rad etish pul yozuvi yaratmaydi va sabab saqlanadi", async () => {
  const oldingi = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });
  const sorovlar = await T(async () =>
    queries.listRequests({ businessId: t.business.id, holat: "kutilmoqda" })
  );
  assert.ok(sorovlar.length > 0);

  const natija = await T(async () =>
    approval.radEt({
      businessId: t.business.id,
      requestId: sorovlar[0].id,
      tasdiqlovchi: { id: t.user.id, rol: "OWNER" },
      sabab: "Budjetdan tashqarida",
    })
  );
  assert.equal(natija.holat, "rad");
  assert.equal(natija.radSabab, "Budjetdan tashqarida");
  assert.equal(natija.transactionId, null);

  const keyingi = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });
  assert.equal(keyingi, oldingi, "rad etilgan so'rov pul yozuvi yaratmaydi");
});

test("rad etilgan so'rovni tasdiqlab bo'lmaydi", async () => {
  const sorovlar = await T(async () =>
    queries.listRequests({ businessId: t.business.id, holat: "rad" })
  );
  await assert.rejects(
    () => T(async () => approval.tasdiqla({
      businessId: t.business.id,
      requestId: sorovlar[0].id,
      tasdiqlovchi: { id: t.user.id, rol: "OWNER" },
    })),
    /rad etilgan/
  );
});

test("o'z so'rovini o'zi tasdiqlay olmaydi", async () => {
  // Administrator so'raydi (OWNER tasdiqlovchi bo'lgan qoida bo'yicha).
  const natija = await chiqim(admin, 3_000_000, katChiqim.id);
  assert.equal(natija.tasdiqKerak, true);

  await assert.rejects(
    () => T(async () => approval.tasdiqla({
      businessId: t.business.id,
      requestId: natija.request.id,
      tasdiqlovchi: { id: admin.id, rol: "ADMIN" },
    })),
    /o'zingiz tasdiqlay olmaysiz/i
  );
});

test("past darajali rol OWNER qoidasi bo'yicha qaror chiqara olmaydi", async () => {
  const sorovlar = await T(async () =>
    queries.listRequests({ businessId: t.business.id, holat: "kutilmoqda" })
  );
  const sorov = sorovlar[0];
  await assert.rejects(
    () => T(async () => approval.tasdiqla({
      businessId: t.business.id,
      requestId: sorov.id,
      tasdiqlovchi: { id: kassir.id, rol: "CASHIER" },
    })),
    /rolingizga ochiq emas/
  );
  await assert.rejects(
    () => T(async () => approval.radEt({
      businessId: t.business.id,
      requestId: sorov.id,
      tasdiqlovchi: { id: kassir.id, rol: "CASHIER" },
      sabab: "shunchaki",
    })),
    /rolingizga ochiq emas/
  );
});

// ---------- Ko'rinuvchanlik, statistika, izolyatsiya ----------

test("xodim faqat o'z so'rovlarini ko'radi", async () => {
  const kassirniki = await T(async () =>
    queries.listRequests({ businessId: t.business.id, userId: kassir.id })
  );
  assert.ok(kassirniki.length > 0);
  assert.ok(
    kassirniki.every((s: any) => s.sorovchiId === kassir.id),
    "boshqa xodimning so'rovi ko'rinmasligi kerak"
  );

  const hammasi = await T(async () => queries.listRequests({ businessId: t.business.id }));
  assert.ok(hammasi.length > kassirniki.length, "direktor barchasini ko'radi");
});

test("statistika faqat kutayotganlarni sanaydi", async () => {
  const stats = await T(async () => queries.getTasdiqStats(t.business.id));
  const kutayotgan = await T(async () =>
    queries.listRequests({ businessId: t.business.id, holat: "kutilmoqda" })
  );
  assert.equal(stats.kutilmoqda, kutayotgan.length);
  assert.equal(
    stats.kutilmoqdaSumma,
    kutayotgan.reduce((a: number, s: any) => a + s.summa, 0)
  );
});

test("qoidani o'chirish yumshoq — chiqimlar tasdiqsiz o'tadi", async () => {
  await T(async () => approval.deleteRule(t.business.id, umumiyQoida.id));
  const ochirilgan = await rawPrisma.approvalRule.findUnique({ where: { id: umumiyQoida.id } });
  assert.ok(ochirilgan.deletedAt, "yozuv qoladi — nega tasdiq so'ralgani tarixda ko'rinadi");
  assert.equal(ochirilgan.isActive, false);

  const natija = await chiqim(kassir, 5_000_000, katChiqim.id);
  assert.equal(natija.tasdiqKerak, false, "o'chirilgan qoida ishlamaydi");
});

test("begona tenant so'rov va qoidalarni ko'rmaydi", async () => {
  const begona = await runWithTenant(t2.tenant.id, async () =>
    queries.listRequests({ businessId: t2.business.id })
  );
  assert.equal(begona.length, 0);

  const qoidalar = await runWithTenant(t2.tenant.id, async () => queries.listRules(t2.business.id));
  assert.equal(qoidalar.length, 0);
});
