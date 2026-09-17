/**
 * CRM → QARZDORLIK, DIREKTOR TUZATISHI VA KANAL KESIMIDA KASSA TOPSHIRISH.
 *
 * Uchta vazifaning yakuniy stsenariysi (topshiriqdagi 10 qadam):
 *   1. 1 000 000 so'mlik CRM zakaz;
 *   2. 200 000 naqd + 300 000 Click qabul qilinadi;
 *   3. qoldiq 500 000 — qarz;
 *   4. "Yutildi";
 *   5. Qarzdorlar ro'yxatida mijoz va AYNAN 500 000 ko'rinadi;
 *   6. CRM'dan "Qarzdorlikni ochish" AYNI shu qarzni ochadi (deep link);
 *   7. direktor summani tahrir qila oladi (moliya qayta hisoblanadi);
 *   8. "Yutildi → Jarayonda → Yutildi" dublikat kirim/qarz/to'lov yaratmaydi;
 *   9. kassa topshirishda 200 000 Naqd va 300 000 Click ALOHIDA chiqadi;
 *  10. topshirilgandan keyin ikkalasi ham balansga QAYTA qo'shilmaydi.
 *
 * Qo'shimcha invariantlar:
 *   - QOLDIQ NOL bo'lsa `Debt` UMUMAN yaratilmaydi ("Qarzdorlikka yozildi"
 *     deb yolg'on ko'rsatilmasin);
 *   - CRM mijozi mavjud `Contact` bilan bog'lanadi, dublikat ochilmaydi;
 *   - qarziga to'lov qabul qilingan zakaz direktor tuzatishida ham rad
 *     etiladi (pul haqiqatda kelgan);
 *   - moliya tuzatishi API darajasida FAQAT direktorga ochiq.
 *
 * Ishga tushirish: npm run test:crm-qarz-direktor
 */
process.env.DATABASE_URL = "file:./prisma/test-crm-qarz-direktor.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let crm: any;
let yakunlash: any;
let direktorTahrir: any;
let qarzQ: any;
let qarzS: any;
let panel: any;
let kassaTransfer: any;
let kanalQ: any;
let dto: any;
let todayTashkentDateOnlyString: any;

let t: any;
let sotuvchi: any;
let kat: any;
/** Sotuvchining shaxsiy naqd kassasi. */
let sKassa: any;
/** Direktorning shaxsiy kassasi — topshirish nishoni. */
let dKassa: any;
/** Karta/terminal kassasi — click/payme puli shunga tushadi. */
let kartaKassa: any;
/**
 * IKKINCHI SOTUVCHI — YAKUNIY STSENARIY uchun ATAYLAB ajratilgan.
 *
 * Kassa topshirishning kanal kesimi XODIM bo'yicha hisoblanadi, shuning
 * uchun yakuniy stsenariy (1M → 750k → topshirish) o'z sotuvchisida
 * bajariladi: "200 000 Naqd + 300 000 Click" raqamlari boshqa testlarning
 * zakazlaridan mustaqil bo'lsin.
 */
let ikkinchi: any;
let iKassa: any;
let bugun: string;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(t.tenant.id, fn);

/** Sotuvchi nomidan zakaz (mas'ul — sotuvchi, ya'ni kassa ham uning). */
async function zakaz(
  nomi: string,
  summa: number,
  satrlar: Array<{ kanal: string; summa: number }>,
  opts: {
    tolovTuri?: string | null;
    mijoz?: { ism: string; tel: string };
    /** Zakazni kim oladi (mas'ul) — berilmasa asosiy sotuvchi. */
    kim?: string;
  } = {}
) {
  return A(() =>
    crm.createDeal({
      businessId: t.business.id,
      nomi,
      summa,
      categoryId: kat.id,
      sana: bugun,
      userId: opts.kim ?? sotuvchi.id,
      tolovlar: satrlar,
      ...(opts.mijoz ? { kontaktIsm: opts.mijoz.ism, kontaktTel: opts.mijoz.tel } : {}),
      ...(opts.tolovTuri === undefined ? {} : { tolovTuri: opts.tolovTuri }),
    })
  );
}

async function yakunla(dealId: string, userId = t.user.id) {
  return A(() => yakunlash.zakazniYakunlash({ businessId: t.business.id, dealId, userId }));
}

/** Zakazning FAOL (o'chirilmagan) kirimlari. */
async function kirimlar(nomi: string) {
  return A(() =>
    prisma.transaction.findMany({
      where: {
        businessId: t.business.id,
        turi: "kirim",
        deletedAt: null,
        izoh: { contains: nomi },
      },
      select: { id: true, summa: true, tolovTuri: true, accountId: true },
      orderBy: { summa: "desc" },
    })
  );
}

/** Kassa qoldig'i — shu kassadagi kirim − chiqim (transferlar hisobga olinmaydi). */
async function kassaKirimi(accountId: string) {
  const agg = await A(() =>
    prisma.transaction.aggregate({
      where: { businessId: t.business.id, accountId, turi: "kirim", deletedAt: null },
      _sum: { summa: true },
    })
  );
  return agg._sum.summa ?? 0;
}

before(async () => {
  rmSync("prisma/test-crm-qarz-direktor.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  crm = await import("@/lib/crm/service");
  yakunlash = await import("@/lib/crm/yakunlash");
  direktorTahrir = await import("@/lib/crm/direktorTahrir");
  qarzQ = await import("@/lib/queries/qarz");
  qarzS = await import("@/lib/services/qarz");
  panel = await import("@/lib/crm/yuqoriPanel");
  kassaTransfer = await import("@/lib/services/kassaTransfer");
  kanalQ = await import("@/lib/queries/topshirishKanali");
  dto = await import("@/lib/crm/dto");
  ({ todayTashkentDateOnlyString } = await import("@/lib/date"));

  bugun = todayTashkentDateOnlyString();
  t = await createTenantWithOwner({
    kompaniyaNomi: "Disney Flowers",
    ism: "Direktor",
    login: "+998945555501",
    parol: "parol12345",
  });
  await rawPrisma.tenant.update({ where: { id: t.tenant.id }, data: { plan: "PRO" } });
  await rawPrisma.tenantModule.create({
    data: { tenantId: t.tenant.id, code: "CRM", isActive: true },
  });
  // SHAXSIY KASSA REJIMI — naqd pul zakaz mas'ulining kassasiga tushadi.
  await rawPrisma.business.update({
    where: { id: t.business.id },
    data: { shaxsiyKassa: true },
  });

  sotuvchi = await rawPrisma.user.create({
    data: {
      ism: "Nilufar",
      login: "qd_nilufar",
      parolHash: "x",
      rol: "SELLER",
      tenantId: t.tenant.id,
      businessId: t.business.id,
    },
  });
  sKassa = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Nilufar (shaxsiy)", turi: "naqd", userId: sotuvchi.id },
  });
  dKassa = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Direktor (shaxsiy)", turi: "naqd", userId: t.user.id },
  });
  kartaKassa = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Karta / terminal", turi: "plastik", tartib: 5 },
  });
  ikkinchi = await rawPrisma.user.create({
    data: {
      ism: "Dilnoza",
      login: "qd_dilnoza",
      parolHash: "x",
      rol: "SELLER",
      tenantId: t.tenant.id,
      businessId: t.business.id,
    },
  });
  iKassa = await rawPrisma.account.create({
    data: { businessId: t.business.id, nomi: "Dilnoza (shaxsiy)", turi: "naqd", userId: ikkinchi.id },
  });
  kat = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Guldasta", turi: "kirim" },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1-VAZIFA: CRM → QARZDORLIK
// ---------------------------------------------------------------------------

test("QADAM 1-5: 1M zakaz, 200k naqd + 300k Click, qoldiq 500k Qarzdorlarda ko'rinadi", async () => {
  const d = await zakaz(
    "Buket 1M",
    1_000_000,
    [
      { kanal: "naqd", summa: 200_000 },
      { kanal: "click", summa: 300_000 },
    ],
    { mijoz: { ism: "Ali Valiyev", tel: "+998901112233" } }
  );
  assert.equal(d.tolangan, 500_000, "to'langan qatorlardan hisoblanadi");
  assert.ok(d.contactId, "CRM mijozi Contact kartochkasiga bog'landi");

  const n = await yakunla(d.id);
  assert.equal(n.kirimSumma, 500_000);
  assert.equal(n.qarzSumma, 500_000, "qarz = QOLDIQ (1 000 000 − 500 000)");
  assert.ok(n.debtId);

  // QARZ YOZUVI: summa, mijoz va bog'lanish.
  const qarz = await A(() => prisma.debt.findFirst({ where: { id: n.debtId } }));
  assert.equal(qarz.businessId, t.business.id, "businessId to'g'ri yozildi");
  assert.equal(qarz.contactId, d.contactId, "qarz AYNI mijoz kartochkasiga bog'landi");
  assert.equal(qarz.mijozNomi, "Ali Valiyev");
  assert.equal(qarz.jamiSumma, 500_000, "qarz summasi — QOLDIQ");
  assert.equal(qarz.tolangan, 0);
  assert.equal(qarz.status, "OPEN");
  assert.equal(qarz.isYopilgan, false);
  assert.equal(qarz.turi, "olinadigan");

  // QARZDORLAR SAHIFASI (shaxs kesimi) — aynan 500 000.
  const qarzdorlar = await A(() => qarzQ.listQarzdorlar(t.business.id, {}));
  const mijoz = qarzdorlar.find((q: any) => q.ism === "Ali Valiyev");
  assert.ok(mijoz, "CRM'dan yaratilgan qarz Qarzdorlar bo'limida ko'rinadi");
  assert.equal(mijoz.qarz, 500_000);
  assert.equal(mijoz.contactId, d.contactId);

  // YOZUVLAR kesimi ham AYNI raqamni beradi.
  const yozuvlar = await A(() => qarzQ.listQarzlar(t.business.id, {}));
  const yozuv = yozuvlar.find((q: any) => q.id === n.debtId);
  assert.ok(yozuv);
  assert.equal(yozuv.qolgan, 500_000);

  // MIJOZ DUBLIKATI YO'Q.
  const kontaktlar = await A(() =>
    prisma.contact.findMany({ where: { businessId: t.business.id, deletedAt: null } })
  );
  assert.equal(kontaktlar.length, 1, "yangi dublikat mijoz yaratilmadi");

  // KIRIM: har kanal O'Z kassasiga.
  const k = await kirimlar("Buket 1M");
  assert.equal(k.length, 2, "naqd va click uchun alohida kirim");
  assert.equal(await kassaKirimi(sKassa.id), 200_000, "naqd qismi sotuvchi kassasiga");
  assert.equal(await kassaKirimi(kartaKassa.id), 300_000, "click qismi karta kassasiga");
});

test("QADAM 6: 'Qarzdorlikni ochish' AYNAN shu qarzni ochadi (deep link)", async () => {
  const deal = await A(() =>
    prisma.deal.findFirst({ where: { businessId: t.business.id, nomi: "Buket 1M" } })
  );
  // Havola qarz IDsi bilan keladi — sahifa uni to'g'ridan-to'g'ri ochadi.
  const { qarzHavolasi } = await import("@/app/app/crm/turlar");
  const havola = qarzHavolasi({ debtId: deal.debtId });
  assert.ok(havola.includes(`qarz=${deal.debtId}`), `havolada qarz IDsi yo'q: ${havola}`);
  assert.ok(havola.includes("turi=olinadigan"));

  // Havola ochadigan tafsilot serverdan o'qiladi (ro'yxatga bog'liq emas).
  const tafsilot = await A(() => qarzQ.getQarzTafsilot(t.business.id, deal.debtId));
  assert.ok(tafsilot, "qarz tafsiloti IDsi bo'yicha o'qiladi");
  assert.equal(tafsilot.qolgan, 500_000);
});

test("QOLDIQ NOL: to'liq to'langan zakazda Debt UMUMAN yaratilmaydi", async () => {
  const d = await zakaz("To'liq to'langan", 300_000, [{ kanal: "naqd", summa: 300_000 }]);
  const n = await yakunla(d.id);
  assert.equal(n.qarzSumma, 0);
  assert.equal(n.debtId, null, "qoldiq 0 — qarz yozuvi yo'q");

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.debtId, null, "zakazda ham qarz bog'lanishi yo'q");

  // Nol summali qarz bazada ham paydo bo'lmasligi kerak.
  const nolQarzlar = await A(() =>
    prisma.debt.count({ where: { businessId: t.business.id, jamiSumma: { lte: 0 } } })
  );
  assert.equal(nolQarzlar, 0, "jamiSumma <= 0 bo'lgan qarz yo'q");
});

test("QOLDIQ NOL: narxsiz zakazda 'Qarzga' tanlansa ham qarz ochilmaydi", async () => {
  const d = await zakaz("Narxsiz qarzga", 0, [], { tolovTuri: "qarz" });
  const n = await yakunla(d.id);
  assert.equal(n.kirimSumma, 0);
  assert.equal(n.qarzSumma, 0);
  assert.equal(n.debtId, null);
});

test("IDEMPOTENT: 'Yutildi' ikki marta bosilsa bitta qarz va bitta kirim to'plami", async () => {
  const d = await zakaz("Takror yakun", 400_000, [{ kanal: "naqd", summa: 100_000 }]);
  const n1 = await yakunla(d.id);
  const n2 = await yakunla(d.id);
  assert.equal(n2.yangiYakun, false, "takror chaqiruv jimgina mavjud natijani qaytaradi");
  assert.equal(n2.debtId, n1.debtId);

  const qarzSoni = await A(() =>
    prisma.debt.count({ where: { businessId: t.business.id, izoh: { contains: "Takror yakun" } } })
  );
  assert.equal(qarzSoni, 1, "ikkinchi qarz yaratilmadi");
  assert.equal((await kirimlar("Takror yakun")).length, 1);
});

test("DTO: qarz holati serverdan keladi — to'langan qarz 'qarzdorlik' deb ko'rsatilmaydi", async () => {
  const yopiq = { jamiSumma: 500_000, tolangan: 500_000, status: "PAID", isYopilgan: true };
  const ochiq = { jamiSumma: 500_000, tolangan: 0, status: "OPEN", isYopilgan: false };
  const bekor = { jamiSumma: 500_000, tolangan: 0, status: "CANCELLED", isYopilgan: true };
  const asos = { transactionId: "tx", debtId: "d", transaction: null, tolovlar: [] };

  const a = dto.zakazMoliyaSnapshot({ ...asos, debt: ochiq });
  assert.equal(a.qarzQoldiq, 500_000);
  assert.equal(a.qarzOchiq, true);
  assert.equal(a.qarzHolat, "OPEN");

  const b = dto.zakazMoliyaSnapshot({ ...asos, debt: yopiq });
  assert.equal(b.qarzQoldiq, 0);
  assert.equal(b.qarzOchiq, false, "to'langan qarz — qarzdorlik emas");
  assert.equal(b.qarzHolat, "PAID");

  const c = dto.zakazMoliyaSnapshot({ ...asos, debt: bekor });
  assert.equal(c.qarzOchiq, false);
  assert.equal(c.qarzHolat, "CANCELLED");

  const d = dto.zakazMoliyaSnapshot({ ...asos, debtId: null, debt: null });
  assert.equal(d.qarzHolat, null, "qarz yo'q — holat ham yo'q");
});

// ---------------------------------------------------------------------------
// 2-VAZIFA: DIREKTOR TUZATISHI
// ---------------------------------------------------------------------------

/**
 * YAKUNIY STSENARIY — bitta zakaz ustida ketma-ket (7 → 8 → 9 → 10 qadam).
 *
 * KUTILGAN NATIJA (direktor FAQAT narxni tuzatgandan keyin):
 *   Zakaz: 750 000 · Naqd: 200 000 · Click: 300 000
 *   Jami to'langan: 500 000 · Qarz: 250 000
 *
 * ═══ NEGA BU TEST AYNI SHU KO'RINISHDA ═══
 * Avvalgi variantda tuzatish chaqiruviga `tolovlar: [{naqd: 200 000}]`
 * uzatilardi, ya'ni Click qatori JIMGINA olib tashlanardi va qoldiq
 * 750 000 − 200 000 = 550 000 chiqardi. Raqam arifmetik to'g'ri edi,
 * lekin stsenariy YOLG'ON edi: direktor "faqat narxni tuzatdim" desa,
 * Click to'lovi joyida qolishi SHART. Endi tuzatishga FAQAT `summa`
 * uzatiladi va to'lov snapshotiga umuman tegilmaydi.
 */
let stsenariyDealId: string;

test("QADAM 7: direktor FAQAT narxni tuzatadi — Click saqlanadi, qarz 250 000", async () => {
  const d = await zakaz(
    "Yakuniy stsenariy",
    1_000_000,
    [
      { kanal: "naqd", summa: 200_000 },
      { kanal: "click", summa: 300_000 },
    ],
    { kim: ikkinchi.id, mijoz: { ism: "Gulnora Rashidova", tel: "+998907778899" } }
  );
  stsenariyDealId = d.id;
  const boshlangich = await yakunla(d.id);
  assert.equal(boshlangich.kirimSumma, 500_000);
  assert.equal(boshlangich.qarzSumma, 500_000, "boshida qarz 1 000 000 − 500 000");

  // TO'LOV QATORLARINING SNAPSHOTI (id bilan) — tuzatishdan keyin
  // AYNI shu qatorlar qolishi kerak.
  const satrOldin = await A(() =>
    prisma.dealTolov.findMany({
      where: { dealId: d.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, kanal: true, summa: true },
    })
  );
  assert.deepEqual(
    satrOldin.map((x: any) => [x.kanal, x.summa]),
    [
      ["naqd", 200_000],
      ["click", 300_000],
    ]
  );

  // ═══ DIREKTOR TUZATISHI: FAQAT NARX ═══
  // `tolovlar` UMUMAN uzatilmaydi — to'lov kesimi tegilmasligi kerak.
  const natija = await A(() =>
    direktorTahrir.zakazniDirektorTahrirlash({
      businessId: t.business.id,
      dealId: d.id,
      userId: t.user.id,
      summa: 750_000,
    })
  );

  // ─── KUTILGAN NATIJA ───
  assert.equal(natija.summa, 750_000, "Zakaz: 750 000");
  assert.equal(natija.tolangan, 500_000, "Jami to'langan: 500 000 (Click YO'QOLMADI)");
  assert.equal(natija.kirimSumma, 500_000, "kirimga o'tgan: 500 000");
  assert.equal(natija.qarzSumma, 250_000, "Qarz: 750 000 − 500 000 = 250 000");
  assert.equal(natija.tolovTuri, "aralash", "aralash to'lov belgisi saqlanadi");

  // TO'LOV SNAPSHOTI QAYTA YARATILMADI — aynan o'sha qatorlar, o'sha `id`.
  const satrKeyin = await A(() =>
    prisma.dealTolov.findMany({
      where: { dealId: d.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, kanal: true, summa: true },
    })
  );
  assert.deepEqual(
    satrKeyin.map((x: any) => x.id),
    satrOldin.map((x: any) => x.id),
    "to'lov qatorlari o'chirilib qayta yaratilmadi (id o'zgarmadi)"
  );
  assert.deepEqual(
    satrKeyin.map((x: any) => [x.kanal, x.summa]),
    [
      ["naqd", 200_000],
      ["click", 300_000],
    ],
    "Naqd: 200 000 · Click: 300 000"
  );

  // CRM raqami.
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.summa, 750_000);
  assert.equal(keyin.tolangan, 500_000);
  assert.equal(keyin.holat, "YUTILDI");

  // KIRIM: yangi ikki yozuv (naqd 200k + click 300k), kanal kassalari joyida.
  const faol = await kirimlar("Yakuniy stsenariy");
  assert.equal(faol.length, 2, "faol kirim ikkita — naqd va click");
  assert.equal(
    faol.reduce((x: number, k: any) => x + k.summa, 0),
    500_000
  );
  assert.equal(await kassaKirimi(iKassa.id), 200_000, "naqd kassa: 200 000");
  assert.equal(await kassaKirimi(kartaKassa.id) >= 300_000, true, "click puli karta kassasida");

  // ═══ MOLIYAVIY TARIX: FIZIK O'CHIRISH YO'Q ═══
  // Eski kirimlar BAZADA QOLADI — faqat `deletedAt` + `deletedBy` qo'yiladi
  // (savatdan tiklash mumkin, audit izi uzilmaydi).
  assert.equal(natija.ochirilganKirimlar.length, 2);
  const eskilar = await A(() =>
    prisma.transaction.findMany({
      where: { id: { in: natija.ochirilganKirimlar } },
      select: { id: true, summa: true, deletedAt: true, deletedBy: true },
    })
  );
  assert.equal(eskilar.length, 2, "eski kirim yozuvlari BAZADAN yo'qolmadi");
  for (const e of eskilar) {
    assert.ok(e.deletedAt, "yumshoq o'chirilgan (deletedAt bor)");
    assert.equal(e.deletedBy, t.user.id, "kim o'chirgani yozuvning O'ZIDA");
  }
  // Eski qarz ham o'chirilmaydi — BEKOR qilinadi.
  const eskiQarz = await A(() =>
    prisma.debt.findFirst({ where: { id: natija.bekorQilinganQarzId } })
  );
  assert.ok(eskiQarz, "eski qarz yozuvi bazada qoldi");
  assert.equal(eskiQarz.status, "CANCELLED", "o'chirilmadi — bekor qilindi");
  assert.equal(eskiQarz.deletedAt, null, "fizik ham, yumshoq ham o'chirilmagan");
  assert.ok(eskiQarz.cancelReason, "bekor qilish sababi yozilgan");

  // QARZDORLAR: aynan 250 000 va bittadan ortiq emas.
  const ochiq = await A(() =>
    prisma.debt.findMany({
      where: {
        businessId: t.business.id,
        izoh: { contains: "Yakuniy stsenariy" },
        status: { not: "CANCELLED" },
      },
    })
  );
  assert.equal(ochiq.length, 1, "bitta ochiq qarz");
  assert.equal(ochiq[0].jamiSumma, 250_000, "Qarz: 250 000");
  const qarzdorlar = await A(() => qarzQ.listQarzdorlar(t.business.id, {}));
  const mijoz = qarzdorlar.find((q: any) => q.ism === "Gulnora Rashidova");
  assert.ok(mijoz, "mijoz Qarzdorlar bo'limida");
  assert.equal(mijoz.qarz, 250_000, "Qarzdorlar bo'limi ham 250 000 ko'rsatadi");
});

test("QADAM 8: Yutildi → Jarayonda → Yutildi — Naqd 200k, Click 300k, Qarz 250k, dublikatsiz", async () => {
  const dealId = stsenariyDealId;

  // ─── Yutildi → Jarayonda (direktor) ───
  await A(() =>
    crm.holatniOzgartirish({
      businessId: t.business.id,
      dealId,
      holat: "JARAYONDA",
      userId: t.user.id,
      boshqaruvchi: true,
    })
  );
  const orta = await A(() => prisma.deal.findFirst({ where: { id: dealId } }));
  assert.equal(orta.holat, "JARAYONDA");
  assert.equal(orta.transactionId, null);
  assert.equal(orta.debtId, null);
  assert.equal(orta.summa, 750_000, "narx saqlandi");
  assert.equal(orta.tolangan, 500_000, "to'lov kesimi saqlandi");
  assert.equal((await kirimlar("Yakuniy stsenariy")).length, 0, "kirimlar qaytarildi");

  // To'lov qatorlari QAYTARISHDA HAM yo'qolmaydi (faqat kirim bog'lanishi uziladi).
  const ortaSatr = await A(() =>
    prisma.dealTolov.findMany({ where: { dealId }, orderBy: { createdAt: "asc" } })
  );
  assert.deepEqual(
    ortaSatr.map((x: any) => [x.kanal, x.summa]),
    [
      ["naqd", 200_000],
      ["click", 300_000],
    ]
  );
  assert.deepEqual(
    ortaSatr.map((x: any) => x.transactionId),
    [null, null],
    "kirim bog'lanishi uzildi — qayta yutilganda YANGI kirim yoziladi"
  );

  // ─── Jarayonda → Yutildi ───
  const qayta = await yakunla(dealId);
  assert.equal(qayta.kirimSumma, 500_000, "Jami to'langan: 500 000");
  assert.equal(qayta.qarzSumma, 250_000, "Qarz: 250 000");

  // ═══ DUBLIKAT YO'Q ═══
  const faol = await kirimlar("Yakuniy stsenariy");
  assert.equal(faol.length, 2, "faol kirim AYNAN ikkita (naqd + click)");
  assert.equal(
    faol.reduce((x: number, k: any) => x + k.summa, 0),
    500_000,
    "faol kirim jami 500 000 — ikkilanmadi"
  );
  const naqdFaol = faol.filter((k: any) => k.tolovTuri === "naqd");
  const clickFaol = faol.filter((k: any) => k.tolovTuri === "click");
  assert.equal(naqdFaol.length, 1);
  assert.equal(naqdFaol[0].summa, 200_000, "Naqd: 200 000");
  assert.equal(clickFaol.length, 1);
  assert.equal(clickFaol[0].summa, 300_000, "Click: 300 000");

  const ochiqQarz = await A(() =>
    prisma.debt.findMany({
      where: {
        businessId: t.business.id,
        izoh: { contains: "Yakuniy stsenariy" },
        status: { not: "CANCELLED" },
      },
    })
  );
  assert.equal(ochiqQarz.length, 1, "ochiq qarz bittadan oshmadi");
  assert.equal(ochiqQarz[0].jamiSumma, 250_000);

  const tolovSoni = await A(() =>
    prisma.debtPayment.count({ where: { businessId: t.business.id, debtId: ochiqQarz[0].id } })
  );
  assert.equal(tolovSoni, 0, "hech qanday to'lov yozuvi yaratilmadi");

  const satrSoni = await A(() => prisma.dealTolov.count({ where: { dealId } }));
  assert.equal(satrSoni, 2, "to'lov qatorlari ikkilanmadi");

  // Kassa: naqd 200 000 (qaytarish −200k, qayta yozish +200k).
  assert.equal(await kassaKirimi(iKassa.id), 200_000, "naqd kassa 200 000 da qoldi");
});

test("QADAM 9-10: yakuniy stsenariyda topshirish — 200k Naqd + 300k Click alohida", async () => {
  // Kanal kesimi XODIM bo'yicha: bu sotuvchida faqat yakuniy stsenariy bor.
  const kassa = await A(() => panel.xodimKassaHolati(t.business.id, ikkinchi.id, "Dilnoza"));
  assert.ok(kassa);
  const xarita = new Map(kassa.kanallar.map((k: any) => [k.kanal, k.summa]));
  assert.equal(xarita.get("naqd"), 200_000, "Naqd: 200 000 so'm");
  assert.equal(xarita.get("click"), 300_000, "Click: 300 000 so'm");
  assert.equal(xarita.get("payme"), 0, "Payme bu stsenariyda yo'q");
  assert.equal(kassa.mavjud, 200_000, "topshiriladigan naqd — ledgerdan");

  // TOPSHIRISH: ikkala kanal birga.
  const transfer = await A(() =>
    kassaTransfer.kassaTransferYarat(
      t.business.id,
      { userId: ikkinchi.id, ism: "Dilnoza", rol: "SELLER" },
      {
        fromAccountId: iKassa.id,
        toAccountId: dKassa.id,
        summa: 200_000,
        turi: "smena",
        kanallar: ["click"],
      }
    )
  );
  assert.equal(transfer.summa, 200_000, "ledgerda faqat naqd ko'chadi");

  // DIREKTOR QARORIDA kesim: 200 000 Naqd + 300 000 Click, jami 500 000.
  const { listTopshirishlar } = await import("@/lib/queries/accounts");
  const royxat = await A(() => listTopshirishlar(t.business.id, ["kutilmoqda"], 20));
  const qator = royxat.find((x: any) => x.id === transfer.id);
  assert.ok(qator);
  const kesim = new Map(qator.kanallar.map((k: any) => [k.kanal, k.summa]));
  assert.equal(kesim.get("naqd"), 200_000, "Naqd: 200 000");
  assert.equal(kesim.get("click"), 300_000, "Click: 300 000");
  assert.equal(
    qator.kanallar.reduce((x: number, k: any) => x + k.summa, 0),
    500_000,
    "Jami topshirish: 500 000"
  );

  // QAYTA QO'SHILMAYDI: ikkalasi ham keyingi balansda yo'q.
  await A(() =>
    kassaTransfer.kassaTransferQaror(
      t.business.id,
      { userId: t.user.id, ism: "Direktor", rol: "OWNER" },
      transfer.id,
      { amal: "qabul" }
    )
  );
  const keyin = await A(() => panel.xodimKassaHolati(t.business.id, ikkinchi.id, "Dilnoza"));
  const keyingi = new Map(keyin.kanallar.map((k: any) => [k.kanal, k.summa]));
  assert.equal(keyingi.get("naqd"), 0, "naqd topshirildi — balansda qolmadi");
  assert.equal(keyingi.get("click"), 0, "Click ikkinchi marta topshirilmaydi");
});

test("DIREKTOR TUZATISHI: qarziga to'lov qabul qilingan zakaz RAD etiladi", async () => {
  const d = await zakaz("To'lovi bor qarz", 500_000, [{ kanal: "naqd", summa: 100_000 }]);
  const n = await yakunla(d.id);
  assert.ok(n.debtId);

  // Qarzga to'lov tushdi — bu pul haqiqatda keldi.
  await A(() =>
    qarzS.qarzTolov({
      businessId: t.business.id,
      debtId: n.debtId,
      summa: 50_000,
      sana: bugun,
      userId: t.user.id,
      tolovTuri: "naqd",
    })
  );

  await assert.rejects(
    () =>
      A(() =>
        direktorTahrir.zakazniDirektorTahrirlash({
          businessId: t.business.id,
          dealId: d.id,
          userId: t.user.id,
          summa: 300_000,
        })
      ),
    /to'lov qabul qilingan/i,
    "to'lovi bor qarz jimgina yo'q qilinmaydi"
  );

  // Hech narsa o'zgarmagan.
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.summa, 500_000);
  assert.equal(keyin.debtId, n.debtId);
});

test("DIREKTOR TUZATISHI: holatni ham o'zgartiradi (Yutildi → Jarayonda, moliya qaytadi)", async () => {
  const d = await zakaz("Holat tuzatish", 600_000, [{ kanal: "naqd", summa: 600_000 }]);
  await yakunla(d.id);

  const natija = await A(() =>
    direktorTahrir.zakazniDirektorTahrirlash({
      businessId: t.business.id,
      dealId: d.id,
      userId: t.user.id,
      holat: "JARAYONDA",
      summa: 600_000,
    })
  );
  assert.equal(natija.holat, "JARAYONDA");
  assert.equal(natija.transactionId, null, "moliyaviy yozuv yo'q");
  assert.equal((await kirimlar("Holat tuzatish")).length, 0);

  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.holat, "JARAYONDA");
  assert.equal(keyin.transactionId, null);
  assert.equal(keyin.debtId, null);
});

test("HUQUQ: moliya tuzatishi API darajasida FAQAT direktorga ochiq", () => {
  const route = readFileSync("src/app/api/crm/deals/[id]/route.ts", "utf8");
  assert.match(
    route,
    /const direktorTuzatadi =[\s\S]{0,200}isDirektor\(user\.rol\)/,
    "route moliya tuzatishini `isDirektor` bilan cheklashi shart"
  );
  assert.match(
    route,
    /zakazniDirektorTahrirlash\(/,
    "route direktor yo'lini xizmat qatlamiga uzatishi shart"
  );
  // Oddiy yo'l avvalgidek qulflangan bo'lib qoladi.
  assert.match(route, /Moliyaga o'tgan zakazning summasi va to'lovi o'zgartirilmaydi/);
});

test("QAYTARISH AYLANISHI (naqd + Payme): dublikat kirim/qarz/to'lov yaratmaydi", async () => {
  const d = await zakaz("Qaytarish aylanishi", 800_000, [
    { kanal: "naqd", summa: 300_000 },
    { kanal: "payme", summa: 100_000 },
  ]);
  await yakunla(d.id);

  await A(() =>
    crm.holatniOzgartirish({
      businessId: t.business.id,
      dealId: d.id,
      holat: "JARAYONDA",
      userId: t.user.id,
      boshqaruvchi: true,
    })
  );
  const orta = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(orta.transactionId, null);
  assert.equal(orta.debtId, null);
  assert.equal((await kirimlar("Qaytarish aylanishi")).length, 0);

  const qayta = await yakunla(d.id);
  assert.equal(qayta.kirimSumma, 400_000);
  assert.equal(qayta.qarzSumma, 400_000);

  assert.equal((await kirimlar("Qaytarish aylanishi")).length, 2, "faol kirim ikkita");
  const ochiq = await A(() =>
    prisma.debt.count({
      where: {
        businessId: t.business.id,
        izoh: { contains: "Qaytarish aylanishi" },
        status: { not: "CANCELLED" },
      },
    })
  );
  assert.equal(ochiq, 1, "ochiq qarz bittadan oshmadi");
  assert.equal(await A(() => prisma.dealTolov.count({ where: { dealId: d.id } })), 2);
});

// ---------------------------------------------------------------------------
// 3-VAZIFA: KASSA TOPSHIRISH — KANAL KESIMI
// ---------------------------------------------------------------------------

test("QADAM 9: topshirish kesimi — Naqd, Click va Payme ALOHIDA chiqadi", async () => {
  const kesim = await A(() => kanalQ.topshirishKesimi(t.business.id, sotuvchi.id, 1_000_000));
  const xarita = new Map(kesim.map((k: any) => [k.kanal, k]));

  assert.equal(xarita.get("naqd").summa, 1_000_000, "naqd — kassa ledgeridan (chaqiruvchi beradi)");
  assert.equal(xarita.get("naqd").manba, "kassa");
  // Yuqoridagi testlarda yozilgan click: 300 000 (1M zakaz) + 300 000
  // (direktor tuzatishida o'chirilgan — sanalmaydi) = 300 000.
  assert.equal(xarita.get("click").summa, 300_000, "Click — CRM to'lovlaridan");
  assert.equal(xarita.get("click").manba, "crm", "qo'lda kiritilgan raqam emas");
  assert.equal(xarita.get("payme").summa, 100_000, "Payme alohida kanal");
  assert.ok(xarita.has("terminal"), "terminal kanali ham kesimda bor");
});

test("YUQORI PANEL: xodim kassasi kanal kesimini beradi (online naqdga qo'shilmaydi)", async () => {
  const k = await A(() => panel.xodimKassaHolati(t.business.id, sotuvchi.id, "Nilufar"));
  assert.ok(k);
  const online = k.kanallar.filter((x: any) => x.kanal !== "naqd" && x.summa > 0);
  assert.equal(online.length, 2, "Click va Payme");
  assert.equal(
    k.kanallar.find((x: any) => x.kanal === "naqd").summa,
    k.mavjud,
    "naqd kesimi ledgerdagi band bo'lmagan qismga teng"
  );
  // Online pul naqd kassaga TUSHMAYDI: u karta kassasida.
  assert.equal(k.kassada, await kassaKirimi(sKassa.id), "kassada — faqat naqd");
});

test("QADAM 9-10: naqd + Click topshiriladi, qatorlar saqlanadi, balans qayta qo'shilmaydi", async () => {
  const oldin = await A(() => kanalQ.topshirishKesimi(t.business.id, sotuvchi.id, 0));
  const clickOldin = oldin.find((k: any) => k.kanal === "click").summa;
  assert.ok(clickOldin > 0);

  const naqd = await A(() => panel.xodimKassaHolati(t.business.id, sotuvchi.id, "Nilufar"));
  const topshiriladiganNaqd = naqd.mavjud;
  assert.ok(topshiriladiganNaqd > 0);

  const transfer = await A(() =>
    kassaTransfer.kassaTransferYarat(
      t.business.id,
      { userId: sotuvchi.id, ism: "Nilufar", rol: "SELLER" },
      {
        fromAccountId: sKassa.id,
        toAccountId: dKassa.id,
        summa: topshiriladiganNaqd,
        turi: "smena",
        kanallar: ["click"],
      }
    )
  );
  assert.equal(transfer.turi, "smena");
  assert.equal(transfer.summa, topshiriladiganNaqd, "pul harakati — FAQAT naqd");
  assert.equal(transfer.holat, "kutilmoqda");

  // QATORLAR: naqd + click, har biri o'z summasi bilan.
  const qatorlar = await A(() =>
    prisma.topshirishKanali.findMany({
      where: { businessId: t.business.id, transferId: transfer.id },
      orderBy: { kanal: "asc" },
    })
  );
  assert.equal(qatorlar.length, 2);
  const xarita = new Map(qatorlar.map((q: any) => [q.kanal, q.summa]));
  assert.equal(xarita.get("naqd"), topshiriladiganNaqd);
  assert.equal(xarita.get("click"), clickOldin, "Click summasi SERVER hisobidan");

  // DIREKTOR QARORIDA kesim ko'rinadi.
  const { listTopshirishlar } = await import("@/lib/queries/accounts");
  const royxat = await A(() => listTopshirishlar(t.business.id, ["kutilmoqda"], 10));
  const qator = royxat.find((x: any) => x.id === transfer.id);
  assert.ok(qator, "topshiriq direktor ro'yxatida");
  assert.equal(qator.kanallar.length, 2);
  assert.equal(
    qator.kanallar.find((k: any) => k.kanal === "click").summa,
    clickOldin,
    "direktor Click summasini alohida ko'radi"
  );
  assert.equal(
    qator.kanallar.reduce((s: number, k: any) => s + k.summa, 0),
    topshiriladiganNaqd + clickOldin,
    "jami topshirish = naqd + online"
  );

  // QAYTA QO'SHILMAYDI: topshirilgan Click keyingi balansda YO'Q.
  const keyin = await A(() => kanalQ.topshirishKesimi(t.business.id, sotuvchi.id, 0));
  assert.equal(
    keyin.find((k: any) => k.kanal === "click").summa,
    0,
    "topshirilgan Click puli ikkinchi marta chiqmaydi"
  );
  // Payme TANLANMAGAN edi — u yo'qolmaydi va keyingi topshirishda chiqadi.
  assert.equal(
    keyin.find((k: any) => k.kanal === "payme").summa,
    100_000,
    "tanlanmagan kanal keyingi topshirishda ham chiqadi"
  );
});

test("ONLINE-ONLY TOPSHIRISH: naqd 0 — ledger tegilmaydi va naqd smena yopilmaydi", async () => {
  // Avvalgi ochiq topshiriqni yopamiz (bir vaqtda bitta ochiq topshiriq).
  const ochiq = await A(() =>
    prisma.accountTransfer.findFirst({
      where: { businessId: t.business.id, fromAccountId: sKassa.id, holat: "kutilmoqda" },
    })
  );
  if (ochiq) {
    await A(() =>
      kassaTransfer.kassaTransferQaror(
        t.business.id,
        { userId: t.user.id, ism: "Direktor", rol: "OWNER" },
        ochiq.id,
        { amal: "qabul" }
      )
    );
  }

  const smenaOldin = await A(() => panel.xodimKassaHolati(t.business.id, sotuvchi.id, "Nilufar"));

  const transfer = await A(() =>
    kassaTransfer.kassaTransferYarat(
      t.business.id,
      { userId: sotuvchi.id, ism: "Nilufar", rol: "SELLER" },
      {
        fromAccountId: sKassa.id,
        toAccountId: dKassa.id,
        summa: 0,
        turi: "smena",
        kanallar: ["payme"],
      }
    )
  );
  assert.equal(transfer.summa, 0, "pul ko'chmaydi");
  assert.equal(transfer.hisoblangan, 0, "naqd topshirilmagan — tizim hisobi ham 0");
  assert.equal(transfer.farq, 0, "sun'iy kamomad yozilmaydi");

  const qatorlar = await A(() =>
    prisma.topshirishKanali.findMany({ where: { transferId: transfer.id } })
  );
  assert.equal(qatorlar.length, 1, "faqat Payme qatori");
  assert.equal(qatorlar[0].kanal, "payme");
  assert.equal(qatorlar[0].summa, 100_000);

  // NAQD SMENA YOPILMADI: kirim/chiqim kesimi avvalgidek.
  const smenaKeyin = await A(() => panel.xodimKassaHolati(t.business.id, sotuvchi.id, "Nilufar"));
  assert.equal(smenaKeyin.kirim, smenaOldin.kirim, "naqd smena kesimi nolga tushmadi");
  assert.equal(smenaKeyin.kassada, smenaOldin.kassada, "kassa qoldig'i o'zgarmadi");

  // Payme endi topshirilgan.
  const kesim = await A(() => kanalQ.topshirishKesimi(t.business.id, sotuvchi.id, 0));
  assert.equal(kesim.find((k: any) => k.kanal === "payme").summa, 0);
});

test("ONLINE KANAL BO'SH bo'lsa topshirish RAD etiladi (bo'sh qator reset nuqtasini surmaydi)", async () => {
  // Avvalgi ochiq topshiriq yopiladi — bir vaqtda bitta ochiq topshiriq
  // qoidasi tekshirmoqchi bo'lgan xatoni to'sib qo'ymasin.
  const ochiq = await A(() =>
    prisma.accountTransfer.findFirst({
      where: { businessId: t.business.id, fromAccountId: sKassa.id, holat: "kutilmoqda" },
    })
  );
  if (ochiq) {
    await A(() =>
      kassaTransfer.kassaTransferQaror(
        t.business.id,
        { userId: t.user.id, ism: "Direktor", rol: "OWNER" },
        ochiq.id,
        { amal: "qabul" }
      )
    );
  }

  await assert.rejects(
    () =>
      A(() =>
        kassaTransfer.kassaTransferYarat(
          t.business.id,
          { userId: sotuvchi.id, ism: "Nilufar", rol: "SELLER" },
          {
            fromAccountId: sKassa.id,
            toAccountId: dKassa.id,
            summa: 0,
            turi: "smena",
            kanallar: ["terminal"],
          }
        )
      ),
    /topshiriladigan tushum yo'q/i
  );
});

test("VALIDATSIYA: summa ham, kanal ham bo'lmasa topshirish o'tmaydi", async () => {
  const { kassaTransferSchema } = await import("@/lib/validation/account");
  const bos = kassaTransferSchema.safeParse({ toAccountId: "x", summa: 0, turi: "smena" });
  assert.equal(bos.success, false, "bo'sh topshiriq rad etiladi");

  const naqdgina = kassaTransferSchema.safeParse({ toAccountId: "x", summa: 100 });
  assert.equal(naqdgina.success, true, "oddiy naqd o'tkazma avvalgidek ishlaydi");

  const onlinegina = kassaTransferSchema.safeParse({
    toAccountId: "x",
    summa: 0,
    turi: "smena",
    kanallar: ["click"],
  });
  assert.equal(onlinegina.success, true, "faqat online topshirish mumkin");

  const notogri = kassaTransferSchema.safeParse({
    toAccountId: "x",
    summa: 0,
    turi: "smena",
    kanallar: ["naqd"],
  });
  assert.equal(notogri.success, false, "naqd online kanal sifatida yuborilmaydi");
});
