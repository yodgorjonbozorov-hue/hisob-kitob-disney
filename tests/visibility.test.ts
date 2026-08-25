/**
 * KIRIM/CHIQIM KO'RINUVCHANLIGI TESTLARI.
 *
 * Qoida: xodim (CASHIER/SELLER) faqat O'ZI kiritgan yozuvlarni ko'radi,
 * direktor (OWNER/ADMIN) — biznesdagi barchasini. Ishga tushirish:
 *   npm run test:visibility
 *
 * Alohida test bazasi ishlatiladi (prisma/test-visibility.db) — dev/prod bazaga tegmaydi.
 */
process.env.DATABASE_URL = "file:./prisma/test-visibility.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

// Prisma bilan bog'liq modullar env o'rnatilgandan KEYIN dinamik yuklanadi.
let rawPrisma: any;
let runWithTenant: <T>(tenantId: string, fn: () => T) => T;
let transactionScopeUserId: any;
let listTransactions: any;
let listAllTransactions: any;
let getTodayTotals: any;
let getExpectedCash: any;

const TENANT = "t_vis";
const BIZ = "biz_vis";
const CAT_KIRIM = "cat_vis_kirim";
const CAT_CHIQIM = "cat_vis_chiqim";

const OWNER = { userId: "u_vis_owner", rol: "OWNER" as const, ism: "Direktor", login: "vis_owner" };
const KASSIR = { userId: "u_vis_kassir", rol: "CASHIER" as const, ism: "Kassir", login: "vis_kassir" };
const SOTUVCHI = { userId: "u_vis_sotuvchi", rol: "SELLER" as const, ism: "Sotuvchi", login: "vis_sotuvchi" };

const KUN = "2026-07-01";
const SANA = new Date("2026-07-01T00:00:00Z");

before(async () => {
  rmSync("prisma/test-visibility.db", { force: true });

  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) {
    throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);
  }

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ transactionScopeUserId } = await import("@/lib/auth/visibility"));
  ({ listTransactions, listAllTransactions } = await import("@/lib/queries/transactions"));
  ({ getTodayTotals, getExpectedCash } = await import("@/lib/queries/shift"));

  // ---- Fixture: bitta tenant/biznes, uchta foydalanuvchi, har birida yozuvlar ----
  await rawPrisma.tenant.create({ data: { id: TENANT, name: "Vis tenant", slug: "vis-tenant", status: "ACTIVE" } });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "Vis biznes", tenantId: TENANT } });

  for (const u of [OWNER, KASSIR, SOTUVCHI]) {
    await rawPrisma.user.create({
      data: { id: u.userId, ism: u.ism, login: u.login, parolHash: "x", rol: u.rol, tenantId: TENANT, businessId: BIZ },
    });
  }

  await rawPrisma.category.create({ data: { id: CAT_KIRIM, nomi: "Sotuv", turi: "kirim", businessId: BIZ } });
  await rawPrisma.category.create({ data: { id: CAT_CHIQIM, nomi: "Xarajat", turi: "chiqim", businessId: BIZ } });

  const tx = (id: string, userId: string, turi: "kirim" | "chiqim", summa: number) =>
    rawPrisma.transaction.create({
      data: {
        id,
        turi,
        categoryId: turi === "kirim" ? CAT_KIRIM : CAT_CHIQIM,
        businessId: BIZ,
        summa,
        sana: SANA,
        userId,
      },
    });

  await tx("tx_vis_owner_kirim", OWNER.userId, "kirim", 1000);
  await tx("tx_vis_kassir_kirim", KASSIR.userId, "kirim", 200);
  await tx("tx_vis_kassir_chiqim", KASSIR.userId, "chiqim", 50);
  await tx("tx_vis_sotuvchi_kirim", SOTUVCHI.userId, "kirim", 300);
  // O'chirilgan yozuv — hech kimga ko'rinmaydi.
  await rawPrisma.transaction.create({
    data: {
      id: "tx_vis_kassir_ochirilgan",
      turi: "kirim",
      categoryId: CAT_KIRIM,
      businessId: BIZ,
      summa: 777,
      sana: SANA,
      userId: KASSIR.userId,
      deletedAt: new Date(),
    },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- 1. Qoidaning o'zi ----------
test("transactionScopeUserId: direktor/administrator — cheklovsiz", () => {
  assert.equal(transactionScopeUserId(OWNER), null);
  assert.equal(transactionScopeUserId({ userId: "u_x", rol: "ADMIN" }), null);
});

test("transactionScopeUserId: kassir/sotuvchi — faqat o'z userId'si", () => {
  assert.equal(transactionScopeUserId(KASSIR), KASSIR.userId);
  assert.equal(transactionScopeUserId(SOTUVCHI), SOTUVCHI.userId);
});

// ---------- 2. Ro'yxat ----------
test("kassir ro'yxatda faqat o'zi kiritgan yozuvlarni ko'radi", async () => {
  const res = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(KASSIR) })
  );
  const ids = res.items.map((t: any) => t.id).sort();
  assert.deepEqual(ids, ["tx_vis_kassir_chiqim", "tx_vis_kassir_kirim"]);
  assert.equal(res.total, 2);
});

test("sotuvchi boshqa xodim yozuvini ko'rmaydi", async () => {
  const res = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(SOTUVCHI) })
  );
  assert.deepEqual(res.items.map((t: any) => t.id), ["tx_vis_sotuvchi_kirim"]);
});

test("direktor biznesdagi barcha yozuvlarni ko'radi", async () => {
  const res = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(OWNER) })
  );
  assert.equal(res.total, 4); // o'chirilgani kirmaydi
  const userIds = new Set(res.items.map((t: any) => t.userId));
  assert.deepEqual([...userIds].sort(), [OWNER.userId, KASSIR.userId, SOTUVCHI.userId].sort());
});

// ---------- 3. Jamlanmalar ----------
test("jami kirim/chiqim ham xodim ko'rgan yozuvlar bo'yicha hisoblanadi", async () => {
  const kassir = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(KASSIR) })
  );
  // Kassasiz (accountId null) va tolovTuri'siz yozuvlar naqd bo'limiga tushadi.
  assert.deepEqual(kassir.totals, {
    jamiKirim: 200,
    jamiChiqim: 50,
    sof: 150,
    naqdKirim: 200,
    clickKirim: 0,
    qarzKirim: 0,
    // To'lov guruhlari taqsimoti ham AYNI chegarada — kirim va chiqim alohida.
    taqsimot: {
      kirim: { naqd: 200, click: 0, karta: 0 },
      chiqim: { naqd: 50, click: 0, karta: 0 },
      qarz: 0,
    },
  });

  const owner = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(OWNER) })
  );
  assert.deepEqual(owner.totals, {
    jamiKirim: 1500,
    jamiChiqim: 50,
    sof: 1450,
    naqdKirim: 1500,
    clickKirim: 0,
    qarzKirim: 0,
    taqsimot: {
      kirim: { naqd: 1500, click: 0, karta: 0 },
      chiqim: { naqd: 50, click: 0, karta: 0 },
      qarz: 0,
    },
  });
});

test("filtrlar ko'rinuvchanlik chegarasi bilan birga ishlaydi", async () => {
  const res = await runWithTenant(TENANT, () =>
    listTransactions({ businessId: BIZ, userId: transactionScopeUserId(KASSIR), turi: "kirim" })
  );
  assert.deepEqual(res.items.map((t: any) => t.id), ["tx_vis_kassir_kirim"]);
});

// ---------- 4. Eksport ----------
test("Excel eksporti ham xodim uchun faqat o'z yozuvlarini beradi", async () => {
  const rows = await runWithTenant(TENANT, () =>
    listAllTransactions({ businessId: BIZ, userId: transactionScopeUserId(KASSIR) })
  );
  assert.deepEqual(rows.map((t: any) => t.id).sort(), ["tx_vis_kassir_chiqim", "tx_vis_kassir_kirim"]);

  const hammasi = await runWithTenant(TENANT, () =>
    listAllTransactions({ businessId: BIZ, userId: transactionScopeUserId(OWNER) })
  );
  assert.equal(hammasi.length, 4);
});

// ---------- 5. Kassa ekrani va kun yakuni ----------
test("bugungi jami — kassirga o'ziniki, direktorga hammasi", async () => {
  const kassir = await runWithTenant(TENANT, () => getTodayTotals(BIZ, KUN, transactionScopeUserId(KASSIR)));
  assert.deepEqual(kassir, { kirim: 200, chiqim: 50 });

  const owner = await runWithTenant(TENANT, () => getTodayTotals(BIZ, KUN, transactionScopeUserId(OWNER)));
  assert.deepEqual(owner, { kirim: 1500, chiqim: 50 });
});

test("kun yakunidagi kutilgan naqd — kassirning o'z kirimlari", async () => {
  const kassir = await runWithTenant(TENANT, () => getExpectedCash(BIZ, KUN, transactionScopeUserId(KASSIR)));
  assert.equal(kassir, 200);

  const owner = await runWithTenant(TENANT, () => getExpectedCash(BIZ, KUN, transactionScopeUserId(OWNER)));
  assert.equal(owner, 1500);
});
