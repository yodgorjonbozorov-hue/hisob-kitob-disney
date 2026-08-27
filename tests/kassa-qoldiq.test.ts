/**
 * KASSA QOLDIG'I — YAGONA HAQIQAT MANBAI TESTLARI.
 *
 * Dashborddagi "Kassada" kartasi tarixiy kirim statistikasi EMAS — u barcha
 * faol kassalarning REAL joriy qoldig'i (ledger: kirim − chiqim ± transfer).
 * Bu fayl o'sha qoidani buzadigan to'rtta yo'lni qamrab oladi:
 *
 *   1. To'liq ssenariy: kirim → chiqim → transfer → chiqim = 0 (foydalanuvchi
 *      misoli: pul sarflab bo'lingach karta 0 ko'rsatishi shart);
 *   2. Qarzga yozilgan kirim kassaga bog'lanib qolgan bo'lsa ham (eski
 *      migratsiya xatosi) qoldiqqa KIRMAYDI;
 *   3. Takroriy (recurring) chiqim kassaga bog'lanadi va qoldiqni kamaytiradi;
 *   4. Bulk-move ko'chirilgan yozuvning kassasini maqsad biznesga qayta
 *      bog'laydi — manba kassa soxta ko'tarilib qolmaydi;
 *   5. `kassa-migratsiya` skripti eski buzilgan bog'lanishlarni tuzatadi.
 *
 * Ishga tushirish: npm run test:kassa-qoldiq
 */
process.env.DATABASE_URL = "file:./prisma/test-kassa-qoldiq.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let panel: any;
let accounts: any;
let recurring: any;
let kochirish: any;
let dashboard: any;

const T = "t_kq";
const BIZ_A = "biz_kq_a";
const BIZ_B = "biz_kq_b";
const USER = "u_kq";
const NAQD_A = `a_${BIZ_A}_naqd`;
const PLASTIK_A = `a_${BIZ_A}_plastik`;
const NAQD_B = `a_${BIZ_B}_naqd`;

const kun = (s: string) => new Date(`${s}T00:00:00.000Z`);
/** Oldingi oyning 15-kuni — "tarixiy" yozuvlar uchun barqaror sana. */
let OTGAN_OY = "";

before(async () => {
  rmSync("prisma/test-kassa-qoldiq.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  panel = await import("@/lib/queries/dashboardPanel");
  accounts = await import("@/lib/queries/accounts");
  recurring = await import("@/lib/services/recurring");
  kochirish = await import("@/lib/services/tranzaksiyaKochirish");
  dashboard = await import("@/lib/queries/dashboard");

  const sana = await import("@/lib/date");
  OTGAN_OY = sana.shiftMonthString(sana.currentMonthString(), -1);

  await rawPrisma.tenant.create({ data: { id: T, name: T, slug: T, status: "ACTIVE" } });
  await rawPrisma.user.create({
    data: { id: USER, ism: "U", login: "kq_u", parolHash: "x", rol: "OWNER", tenantId: T },
  });
  for (const biz of [BIZ_A, BIZ_B]) {
    await rawPrisma.business.create({ data: { id: biz, nomi: biz, tenantId: T } });
    await rawPrisma.category.create({
      data: { id: `c_${biz}_k`, nomi: "Savdo", turi: "kirim", businessId: biz },
    });
    await rawPrisma.category.create({
      data: { id: `c_${biz}_c`, nomi: "Xarajat", turi: "chiqim", businessId: biz },
    });
    await rawPrisma.account.create({
      data: { id: `a_${biz}_naqd`, businessId: biz, nomi: "Naqd", turi: "naqd", tartib: 0 },
    });
  }
  await rawPrisma.account.create({
    data: { id: PLASTIK_A, businessId: BIZ_A, nomi: "Plastik", turi: "plastik", tartib: 1 },
  });
});

after(async () => {
  await rawPrisma.$disconnect();
  rmSync("prisma/test-kassa-qoldiq.db", { force: true });
});

/** A biznesga yozuv — panel testidagi bilan bir xil yordamchi. */
function yoz(
  biz: string,
  turi: "kirim" | "chiqim",
  summa: number,
  s: string,
  qoshimcha: Record<string, unknown> = {}
) {
  return rawPrisma.transaction.create({
    data: {
      turi,
      categoryId: turi === "kirim" ? `c_${biz}_k` : `c_${biz}_c`,
      businessId: biz,
      summa,
      sana: kun(s),
      userId: USER,
      accountId: `a_${biz}_naqd`,
      ...qoshimcha,
    },
  });
}

test("to'liq ssenariy: kirim → chiqim → transfer → chiqim = kassa 0", async () => {
  // O'tgan oy: 150 mln kirim, 100 mln chiqim (naqd kassa).
  await yoz(BIZ_A, "kirim", 150_000_000, `${OTGAN_OY}-05`);
  await yoz(BIZ_A, "chiqim", 100_000_000, `${OTGAN_OY}-20`);
  // Qolgan 50 mln plastik kassaga topshirildi (transfer — kirim EMAS).
  await rawPrisma.accountTransfer.create({
    data: {
      businessId: BIZ_A,
      fromAccountId: NAQD_A,
      toAccountId: PLASTIK_A,
      summa: 50_000_000,
      sana: kun(`${OTGAN_OY}-25`),
      userId: USER,
      holat: "bajarildi",
    },
  });
  // Keyin o'sha 50 mln ham sarflandi.
  await yoz(BIZ_A, "chiqim", 50_000_000, `${OTGAN_OY}-28`, { accountId: PLASTIK_A });

  await runWithTenant(T, async () => {
    const xulosa = await panel.getKassaXulosa(BIZ_A);
    // Real qoldiq 0 — oy tanlovidan qat'i nazar karta 0 ko'rsatadi.
    assert.equal(xulosa.jami, 0);
    for (const b of xulosa.bolimlar) assert.equal(b.qoldiq, 0);

    // Transfer oy statistikasida kirim sifatida IKKINCHI marta sanalmagan.
    const oy = await dashboard.getMonthSummary(BIZ_A, OTGAN_OY);
    assert.equal(oy.jamiKirim, 150_000_000);
    assert.equal(oy.jamiChiqim, 150_000_000);
  });
});

test("kassaga bog'lanib qolgan qarz kirimi qoldiqqa kirmaydi", async () => {
  // Buzilgan holat: qarz yozuvi kassaga bog'langan (eski migratsiya xatosi).
  const buzilgan = await yoz(BIZ_A, "kirim", 90_000_000, `${OTGAN_OY}-10`, {
    tolovTuri: "qarz",
    accountId: NAQD_A,
  });

  await runWithTenant(T, async () => {
    const xulosa = await panel.getKassaXulosa(BIZ_A);
    assert.equal(xulosa.jami, 0); // qarz — pul emas, qoldiq o'zgarmadi

    const qoldiqlar = await accounts.getAccountBalances(BIZ_A);
    const naqd = qoldiqlar.find((q: any) => q.id === NAQD_A);
    assert.equal(naqd.kirim, 150_000_000); // 90 mln qarz hisobga olinmagan
  });

  await rawPrisma.transaction.delete({ where: { id: buzilgan.id } });
});

test("takroriy chiqim kassaga bog'lanadi va qoldiqni kamaytiradi", async () => {
  // Boshlang'ich holat: kassada 10 mln bor.
  await yoz(BIZ_A, "kirim", 10_000_000, `${OTGAN_OY}-02`);

  // Andoza O'TGAN OYDA yaratilgan (joriy oy o'rtasida qo'shilgan andoza
  // o'tib ketgan kun uchun yozuv yaratmaydi — o'sha himoyani chetlab o'tamiz).
  await rawPrisma.recurringTransaction.create({
    data: {
      id: "rec_kq",
      businessId: BIZ_A,
      categoryId: `c_${BIZ_A}_c`,
      turi: "chiqim",
      summa: 3_000_000,
      kun: 1,
      izoh: "Ijara",
      createdAt: kun(`${OTGAN_OY}-01`),
    },
  });

  await runWithTenant(T, async () => {
    const yaratildi = await recurring.generateDueRecurring();
    assert.equal(yaratildi, 1);

    const tx = await rawPrisma.transaction.findFirst({
      where: { businessId: BIZ_A, izoh: { contains: "Takroriy" } },
    });
    assert.ok(tx, "takroriy yozuv yaratilishi kerak");
    // ASOSIY TEKSHIRUV: yozuv kassaga BOG'LANGAN (ilgari null edi va
    // takroriy chiqim kassadan hech qachon ayrilmasdi).
    assert.equal(tx.accountId, NAQD_A);

    const xulosa = await panel.getKassaXulosa(BIZ_A);
    assert.equal(xulosa.jami, 7_000_000); // 10 − 3
  });
});

test("bulk-move kassani maqsad biznesga qayta bog'laydi", async () => {
  // A da 7 mln bor (oldingi testdan). B ga 20 mln kirim yozamiz.
  await yoz(BIZ_B, "kirim", 20_000_000, `${OTGAN_OY}-03`);
  // A dagi 5 mln chiqim aslida B biznesniki ekan — ko'chiramiz.
  const chiqim = await yoz(BIZ_A, "chiqim", 5_000_000, `${OTGAN_OY}-04`);

  await runWithTenant(T, async () => {
    const moved = await kochirish.tranzaksiyalarniKochir(BIZ_A, BIZ_B, [chiqim.id]);
    assert.equal(moved, 1);

    const kochgan = await rawPrisma.transaction.findUnique({ where: { id: chiqim.id } });
    assert.equal(kochgan.businessId, BIZ_B);
    // ASOSIY TEKSHIRUV: kassa ham maqsad biznesniki (ilgari A kassasi
    // ko'rsatilib qolardi va chiqim hech qaysi ledgerda ko'rinmasdi).
    assert.equal(kochgan.accountId, NAQD_B);

    // Manba kassa chiqimdan OLDINGI holatiga qaytdi (2 mln emas, 7 mln):
    // yozuv ketdi — uning ta'siri ham ketdi.
    const aXulosa = await panel.getKassaXulosa(BIZ_A);
    assert.equal(aXulosa.jami, 7_000_000);
    // Maqsad kassa chiqimni o'z ledgerida ko'radi: 20 − 5.
    const bXulosa = await panel.getKassaXulosa(BIZ_B);
    assert.equal(bXulosa.jami, 15_000_000);
  });
});

test("kassa-migratsiya skripti eski buzilgan bog'lanishlarni tuzatadi", async () => {
  // Buzilgan holat 1: qarz kirimi kassaga bog'langan (eski skript oqibati).
  const qarz = await yoz(BIZ_A, "kirim", 40_000_000, `${OTGAN_OY}-06`, {
    tolovTuri: "qarz",
    accountId: NAQD_A,
  });
  // Buzilgan holat 2: B yozuvi A kassasiga ishora qiladi (eski bulk-move).
  const begona = await yoz(BIZ_B, "chiqim", 2_000_000, `${OTGAN_OY}-07`, {
    accountId: NAQD_A,
  });

  const res = spawnSync(
    process.execPath,
    ["-r", "ts-node/register", "scripts/kassa-migratsiya.ts"],
    { env: { ...process.env }, encoding: "utf8" }
  );
  assert.equal(res.status, 0, `Skript xatosi:\n${res.stdout}\n${res.stderr}`);

  const qarzKeyin = await rawPrisma.transaction.findUnique({ where: { id: qarz.id } });
  assert.equal(qarzKeyin.accountId, null); // qarz kassadan uzildi

  const begonaKeyin = await rawPrisma.transaction.findUnique({ where: { id: begona.id } });
  assert.equal(begonaKeyin.accountId, NAQD_B); // o'z biznesining mos kassasiga o'tdi

  await runWithTenant(T, async () => {
    const bXulosa = await panel.getKassaXulosa(BIZ_B);
    assert.equal(bXulosa.jami, 13_000_000); // 15 − 2 (chiqim endi ledgerda)
    const aXulosa = await panel.getKassaXulosa(BIZ_A);
    assert.equal(aXulosa.jami, 7_000_000); // qarz uzilishi qoldiqni o'zgartirmadi
  });
});
