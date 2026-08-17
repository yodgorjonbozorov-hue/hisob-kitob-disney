/**
 * YOPILGAN DAVR QULFI — REGRESSIYA TESTI (audit: Critical #4).
 *
 * Muammo: loyihada ikkita "davr yopish" nazorati bor edi, lekin ikkalasi ham
 * moliyaviy yozuvni himoya qilmasdi.
 *
 *   1. Direktor kunlik hisobotni TASDIQLAGANDAN keyin (`holat: "CONFIRMED"`)
 *      ham o'sha kunga yangi kirim yozib, eskisini o'chirib yuborish mumkin
 *      edi. Tasdiqlangan hisobot raqamlari esa muzlagan — yozuvlar bilan
 *      hisobot bir-biriga mos kelmay qolardi.
 *   2. Smena yopilgandan keyin (kassa sanalgan, farq qayd etilgan) o'sha
 *      oynadagi tushumni o'chirish mumkin edi — ya'ni "kassada farq yo'q edi"
 *      degan yozuv yolg'onga aylanardi. Aynan o'g'irlikni yashirish yo'li.
 *
 * DAVR TUSHUNCHASI koddan olingan (yangisi o'ylab topilmagan):
 *   - kunlik hisobot — yozuvning `sana` si bo'yicha (kalendar kun);
 *   - smena — `createdAt` bo'yicha (`boshlanishAt < createdAt <= tugashAt`),
 *     chunki kassadagi pul yozuv sanasiga emas, kiritilgan paytiga bog'liq.
 *
 * Ishga tushirish: npm run test:davr-qulfi
 *
 * Alohida test bazasi (prisma/test-davr-qulfi.db) — dev/prod bazaga tegmaydi.
 */
process.env.DATABASE_URL = "file:./prisma/test-davr-qulfi.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let createTransaction: any;
let stornoTransaction: any;
let qulf: any;
let dateOnlyStringToUTCDate: any;

const TENANT = "t_dq";
const BIZ = "biz_dq";
const OWNER = "u_dq_owner";
const CAT = "cat_dq";
const ACC = "acc_dq";

/** Yopilgan (tasdiqlangan) kun va ochiq kun. */
const YOPIQ_KUN = "2026-07-10";
const OCHIQ_KUN = "2026-07-11";

const yopiqKunD = () => dateOnlyStringToUTCDate(YOPIQ_KUN);

/** Yozuvni to'g'ridan-to'g'ri bazaga qo'yadi (davr qulfini chetlab — fikstura uchun). */
async function xomYozuv(opts: { sana: string; createdAt?: Date; summa?: number }) {
  return rawPrisma.transaction.create({
    data: {
      turi: "kirim",
      categoryId: CAT,
      businessId: BIZ,
      accountId: ACC,
      tolovTuri: "naqd",
      summa: opts.summa ?? 100_000,
      sana: dateOnlyStringToUTCDate(opts.sana),
      userId: OWNER,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
}

/** Berilgan kun uchun kunlik hisobot yaratadi. */
async function kunlikHisobot(sana: string, holat: string) {
  return rawPrisma.dailyReport.upsert({
    where: { businessId_sana: { businessId: BIZ, sana: dateOnlyStringToUTCDate(sana) } },
    update: { holat },
    create: { businessId: BIZ, sana: dateOnlyStringToUTCDate(sana), holat },
  });
}

before(async () => {
  rmSync("prisma/test-davr-qulfi.db", { force: true });

  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));
  ({ stornoTransaction } = await import("@/lib/services/transactionStorno"));
  qulf = await import("@/lib/services/davrQulfi");
  ({ dateOnlyStringToUTCDate } = await import("@/lib/date"));

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "DQ tenant", slug: "dq-tenant", status: "ACTIVE" },
  });
  await rawPrisma.business.create({ data: { id: BIZ, nomi: "DQ biznes", tenantId: TENANT } });
  await rawPrisma.user.create({
    data: { id: OWNER, ism: "Direktor", login: "dq_owner", parolHash: "x", rol: "OWNER", tenantId: TENANT, businessId: BIZ },
  });
  await rawPrisma.category.create({
    data: { id: CAT, nomi: "Sotuv", turi: "kirim", businessId: BIZ },
  });
  await rawPrisma.account.create({
    data: { id: ACC, nomi: "Kassa", turi: "naqd", businessId: BIZ },
  });

  // Yopiq kun — tasdiqlangan hisobot. Ochiq kun — OPEN.
  await kunlikHisobot(YOPIQ_KUN, "CONFIRMED");
  await kunlikHisobot(OCHIQ_KUN, "OPEN");
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ───────────── 1. Tasdiqlangan kunga YANGI yozuv ─────────────

test("tasdiqlangan kunga yangi yozuv kiritib BO'LMAYDI", async () => {
  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        createTransaction(OWNER, BIZ, {
          turi: "kirim",
          categoryId: CAT,
          summa: 250_000,
          sana: YOPIQ_KUN,
          tolovTuri: "naqd",
        })
      ),
    (e: Error) => {
      assert.match(e.message, /tasdiqlangan \(yopilgan\)/, "sabab aytilishi kerak");
      assert.match(e.message, new RegExp(YOPIQ_KUN), "qaysi kun ekani aytilishi kerak");
      assert.match(e.message, /Qayta ochish/, "yechim ko'rsatilishi kerak");
      return true;
    }
  );

  const n = await rawPrisma.transaction.count({
    where: { businessId: BIZ, sana: yopiqKunD(), summa: 250_000 },
  });
  assert.equal(n, 0, "yozuv yaratilmasligi kerak");
});

test("OCHIQ kunga yozuv kiritish avvalgidek ishlaydi", async () => {
  const t = await runWithTenant(TENANT, () =>
    createTransaction(OWNER, BIZ, {
      turi: "kirim",
      categoryId: CAT,
      summa: 300_000,
      sana: OCHIQ_KUN,
      tolovTuri: "naqd",
    })
  );
  assert.ok(t.id);
  assert.equal(t.summa, 300_000);
});

test("hisoboti UMUMAN yo'q kunga yozuv kiritish ishlaydi (eski mijozlar)", async () => {
  // Kunlik modulidan foydalanmaydigan mijozda hisobot yozuvi bo'lmaydi —
  // qulf ularga tegmasligi kerak.
  const t = await runWithTenant(TENANT, () =>
    createTransaction(OWNER, BIZ, {
      turi: "kirim",
      categoryId: CAT,
      summa: 120_000,
      sana: "2026-06-01",
      tolovTuri: "naqd",
    })
  );
  assert.ok(t.id);
});

test("SUBMITTED (topshirilgan, lekin tasdiqlanmagan) kun bloklamaydi", async () => {
  // Ataylab: xodim kunni topshirgan, direktor hali tasdiqlamagan — kech
  // kelgan tushum kiritilishi kerak. Mavjud kunlik mantig'i ham shunday.
  await kunlikHisobot("2026-07-12", "SUBMITTED");
  const t = await runWithTenant(TENANT, () =>
    createTransaction(OWNER, BIZ, {
      turi: "kirim",
      categoryId: CAT,
      summa: 130_000,
      sana: "2026-07-12",
      tolovTuri: "naqd",
    })
  );
  assert.ok(t.id);
});

// ───────────── 2. Tasdiqlangan kundagi MAVJUD yozuv ─────────────

test("tasdiqlangan kundagi yozuvni o'zgartirib BO'LMAYDI", async () => {
  const t = await xomYozuv({ sana: YOPIQ_KUN });

  await assert.rejects(
    () => runWithTenant(TENANT, () => qulf.assertYozuvOzgarishi(BIZ, t, "o'chirish")),
    /tasdiqlangan \(yopilgan\)/
  );
});

test("tasdiqlangan kundagi yozuvni STORNO qilib ham bo'lmaydi", async () => {
  const t = await xomYozuv({ sana: YOPIQ_KUN });

  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        stornoTransaction({
          businessId: BIZ,
          transactionId: t.id,
          sabab: "Xato kiritilgan",
          actorId: OWNER,
          actorRol: "OWNER",
        })
      ),
    (e: Error) => {
      assert.match(e.message, /bekor qilish mumkin emas/);
      assert.match(e.message, /qarama-qarshi\) yozuv/, "tuzatish yo'li ko'rsatilishi kerak");
      return true;
    }
  );

  const asl = await rawPrisma.transaction.findUnique({ where: { id: t.id } });
  assert.equal(asl.deletedAt, null, "yopiq davrdagi yozuvga TEGILMASLIGI kerak");
});

test("storno: tuzatuvchi yozuv yopiq kunga yozilmaydi", async () => {
  const t = await xomYozuv({ sana: OCHIQ_KUN });

  await assert.rejects(
    () =>
      runWithTenant(TENANT, () =>
        stornoTransaction({
          businessId: BIZ,
          transactionId: t.id,
          sabab: "Sanani tuzatmoqchiman",
          actorId: OWNER,
          actorRol: "OWNER",
          // Tuzatuvchi yozuvni YOPIQ kunga surib qo'yish urinishi.
          tuzatish: { turi: "kirim", categoryId: CAT, summa: 100_000, sana: YOPIQ_KUN },
        })
      ),
    /tuzatuvchi yozuv kiritish mumkin emas/
  );

  const asl = await rawPrisma.transaction.findUnique({ where: { id: t.id } });
  assert.equal(asl.deletedAt, null, "amal butunlay orqaga qaytishi kerak");
});

// ───────────── 3. Keyingi OCHIQ davr orqali tuzatish ─────────────

test("yopiq kundagi xatoni OCHIQ kunga qarama-qarshi yozuv bilan tuzatish MUMKIN", async () => {
  // Bu — qulf taklif qiladigan yo'l: yopilgan kunga tegilmaydi, tuzatish
  // joriy ochiq kunga teskari yozuv sifatida kiritiladi.
  await rawPrisma.category.create({
    data: { id: "cat_dq_chiqim", nomi: "Tuzatish", turi: "chiqim", businessId: BIZ },
  });

  const teskari = await runWithTenant(TENANT, () =>
    createTransaction(OWNER, BIZ, {
      turi: "chiqim",
      categoryId: "cat_dq_chiqim",
      summa: 250_000,
      sana: OCHIQ_KUN,
      izoh: `Tuzatish: ${YOPIQ_KUN} kunidagi ortiqcha kirim`,
      tolovTuri: "naqd",
    })
  );

  assert.ok(teskari.id);
  assert.equal(teskari.turi, "chiqim");
  assert.equal(teskari.summa, 250_000);
});

// ───────────── 4. Yopilgan SMENA oynasi ─────────────

test("yopilgan smena oynasidagi yozuvni o'zgartirib BO'LMAYDI", async () => {
  // Smena oynasi: 09:00 — 18:00. Yozuv 12:00 da kiritilgan.
  const boshlanish = new Date("2026-07-11T04:00:00.000Z");
  const tugash = new Date("2026-07-11T13:00:00.000Z");
  await rawPrisma.smena.create({
    data: {
      businessId: BIZ,
      sana: dateOnlyStringToUTCDate(OCHIQ_KUN),
      raqam: 1,
      boshlanishAt: boshlanish,
      tugashAt: tugash,
      yopganUserId: OWNER,
      yopganIsm: "Direktor",
      naqd: 500_000,
      kutilganNaqd: 500_000,
      sanalganNaqd: 500_000,
    },
  });

  const ichkarida = await xomYozuv({
    sana: OCHIQ_KUN,
    createdAt: new Date("2026-07-11T07:00:00.000Z"),
  });

  await assert.rejects(
    () => runWithTenant(TENANT, () => qulf.assertYozuvOzgarishi(BIZ, ichkarida, "o'chirish")),
    (e: Error) => {
      assert.match(e.message, /yopilgan smenaga tegishli/);
      assert.match(e.message, /1-smena/, "qaysi smena ekani aytilishi kerak");
      return true;
    }
  );
});

test("smena oynasidan TASHQARIDAGI yozuv o'zgaradi", async () => {
  // Smena yopilgandan KEYIN kiritilgan yozuv joriy (ochiq) oynada — erkin.
  const tashqarida = await xomYozuv({
    sana: OCHIQ_KUN,
    createdAt: new Date("2026-07-11T15:00:00.000Z"),
  });

  await runWithTenant(TENANT, () => qulf.assertYozuvOzgarishi(BIZ, tashqarida, "o'chirish"));
});

test("smena chegarasi: boshlanish payti oynaga KIRMAYDI, tugash payti kiradi", async () => {
  // `boshlanishAt < createdAt <= tugashAt` — smena xizmatidagi qoidaning aynan o'zi.
  const bosh = await xomYozuv({ sana: OCHIQ_KUN, createdAt: new Date("2026-07-11T04:00:00.000Z") });
  await runWithTenant(TENANT, () => qulf.assertYozuvOzgarishi(BIZ, bosh, "o'chirish"));

  const oxir = await xomYozuv({ sana: OCHIQ_KUN, createdAt: new Date("2026-07-11T13:00:00.000Z") });
  await assert.rejects(
    () => runWithTenant(TENANT, () => qulf.assertYozuvOzgarishi(BIZ, oxir, "o'chirish")),
    /yopilgan smenaga tegishli/
  );
});

test("YANGI yozuv smena qulfiga tushmaydi (createdAt har doim hozir)", async () => {
  // Yopilgan smena o'tmishda; yangi yozuvning `createdAt` i undan keyin.
  const t = await runWithTenant(TENANT, () =>
    createTransaction(OWNER, BIZ, {
      turi: "kirim",
      categoryId: CAT,
      summa: 111_000,
      sana: OCHIQ_KUN,
      tolovTuri: "naqd",
    })
  );
  assert.ok(t.id, "yopilgan smena yangi yozuvni to'smasligi kerak");
});

// ───────────── 5. Ommaviy amal: hammasi yoki hech biri ─────────────

test("ommaviy o'chirish: bittasi yopiq davrda bo'lsa HECH BIRI o'chmaydi", async () => {
  const ochiq = await xomYozuv({ sana: "2026-06-02", summa: 10_000 });
  const yopiq = await xomYozuv({ sana: YOPIQ_KUN, summa: 20_000 });

  await assert.rejects(
    () => runWithTenant(TENANT, () => qulf.assertYozuvlarOzgarishi(BIZ, [ochiq, yopiq], "o'chirish")),
    /tasdiqlangan \(yopilgan\)/
  );

  // Tekshiruv amaldan OLDIN bo'lgani uchun ikkalasi ham joyida.
  for (const t of [ochiq, yopiq]) {
    const holat = await rawPrisma.transaction.findUnique({ where: { id: t.id } });
    assert.equal(holat.deletedAt, null);
  }
});

// ───────────── 6. Boshqa biznesga tegmaydi ─────────────

test("bir biznesning yopiq kuni BOSHQA biznesni bloklamaydi", async () => {
  await rawPrisma.business.create({ data: { id: "biz_dq2", nomi: "Ikkinchi", tenantId: TENANT } });
  await rawPrisma.category.create({
    data: { id: "cat_dq2", nomi: "Sotuv", turi: "kirim", businessId: "biz_dq2" },
  });

  const t = await runWithTenant(TENANT, () =>
    createTransaction(OWNER, "biz_dq2", {
      turi: "kirim",
      categoryId: "cat_dq2",
      summa: 140_000,
      // Birinchi biznesda bu kun TASDIQLANGAN, ikkinchisida hisobot yo'q.
      sana: YOPIQ_KUN,
      tolovTuri: "naqd",
    })
  );
  assert.ok(t.id, "qulf faqat o'z biznesiga tegishli bo'lishi kerak");
});

// ───────────── 7. Qayta ochilgan kun ─────────────

test("kun QAYTA OCHILSA yozuv kiritish yana ishlaydi", async () => {
  await kunlikHisobot(YOPIQ_KUN, "OPEN");
  const t = await runWithTenant(TENANT, () =>
    createTransaction(OWNER, BIZ, {
      turi: "kirim",
      categoryId: CAT,
      summa: 260_000,
      sana: YOPIQ_KUN,
      tolovTuri: "naqd",
    })
  );
  assert.ok(t.id);

  // Keyingi testlar uchun holatni qaytaramiz.
  await kunlikHisobot(YOPIQ_KUN, "CONFIRMED");
});
