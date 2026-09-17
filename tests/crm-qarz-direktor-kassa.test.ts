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
let bugun: string;

const A = <T>(fn: () => Promise<T>): Promise<T> => runWithTenant(t.tenant.id, fn);

/** Sotuvchi nomidan zakaz (mas'ul — sotuvchi, ya'ni kassa ham uning). */
async function zakaz(
  nomi: string,
  summa: number,
  satrlar: Array<{ kanal: string; summa: number }>,
  opts: { tolovTuri?: string | null; mijoz?: { ism: string; tel: string } } = {}
) {
  return A(() =>
    crm.createDeal({
      businessId: t.business.id,
      nomi,
      summa,
      categoryId: kat.id,
      sana: bugun,
      userId: sotuvchi.id,
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

test("QADAM 7: direktor summani tuzatadi — kirim, qarz va kassa QAYTA hisoblanadi", async () => {
  const d = await zakaz("Direktor tuzatadi", 1_000_000, [
    { kanal: "naqd", summa: 200_000 },
    { kanal: "click", summa: 300_000 },
  ]);
  const boshlangich = await yakunla(d.id);
  assert.equal(boshlangich.qarzSumma, 500_000);

  const naqdOldin = await kassaKirimi(sKassa.id);
  const kartaOldin = await kassaKirimi(kartaKassa.id);

  // Narx 750 000 ga tushirildi, to'lov esa 200 000 naqd bo'lib qoldi.
  const natija = await A(() =>
    direktorTahrir.zakazniDirektorTahrirlash({
      businessId: t.business.id,
      dealId: d.id,
      userId: t.user.id,
      summa: 750_000,
      tolovlar: [{ kanal: "naqd", summa: 200_000 }],
      tolovTuri: null,
    })
  );
  assert.equal(natija.summa, 750_000);
  assert.equal(natija.tolangan, 200_000);
  assert.equal(natija.kirimSumma, 200_000, "kirim — haqiqatda olingan pul");
  assert.equal(natija.qarzSumma, 550_000, "qarz — YANGI qoldiq (750 000 − 200 000)");
  assert.equal(natija.ochirilganKirimlar.length, 2, "eski ikki kirim yumshoq o'chirildi");
  assert.ok(natija.bekorQilinganQarzId, "eski qarz bekor qilindi");

  // CRM raqami.
  const keyin = await A(() => prisma.deal.findFirst({ where: { id: d.id } }));
  assert.equal(keyin.summa, 750_000);
  assert.equal(keyin.tolangan, 200_000);
  assert.equal(keyin.holat, "YUTILDI");

  // KASSA: eski kirimlar o'chdi, yangisi faqat naqd 200 000.
  assert.equal(await kassaKirimi(sKassa.id), naqdOldin, "naqd kassa: −200k +200k");
  assert.equal(
    await kassaKirimi(kartaKassa.id),
    kartaOldin - 300_000,
    "click kirimi o'chirildi — karta kassasi kamaydi"
  );
  assert.equal((await kirimlar("Direktor tuzatadi")).length, 1, "faol kirim bitta");

  // QARZDORLAR: aynan 550 000 (eski 500 000 bekor bo'ldi).
  const ochiq = await A(() =>
    prisma.debt.findMany({
      where: {
        businessId: t.business.id,
        izoh: { contains: "Direktor tuzatadi" },
        status: { not: "CANCELLED" },
      },
    })
  );
  assert.equal(ochiq.length, 1, "bitta ochiq qarz");
  assert.equal(ochiq[0].jamiSumma, 550_000);
  assert.equal(ochiq[0].id, natija.debtId);
});

test("QADAM 8: Yutildi → Jarayonda → Yutildi dublikat kirim/qarz/to'lov yaratmaydi", async () => {
  const d = await zakaz("Qaytarish aylanishi", 800_000, [
    { kanal: "naqd", summa: 300_000 },
    { kanal: "payme", summa: 100_000 },
  ]);
  await yakunla(d.id);

  // DIREKTOR zakazni qaytaradi (moliya ham qaytadi).
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
  assert.equal(orta.holat, "JARAYONDA");
  assert.equal(orta.transactionId, null);
  assert.equal(orta.debtId, null);
  assert.equal((await kirimlar("Qaytarish aylanishi")).length, 0, "kirimlar o'chirildi");

  // Yana YUTILDI.
  const qayta = await yakunla(d.id);
  assert.equal(qayta.kirimSumma, 400_000);
  assert.equal(qayta.qarzSumma, 400_000);

  // DUBLIKAT YO'Q: faol kirim 2 ta (naqd + payme), ochiq qarz 1 ta.
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
  // To'lov yozuvlari (DebtPayment) umuman yaratilmaydi — pul kelmagan.
  const tolovlar = await A(() =>
    prisma.debtPayment.count({ where: { businessId: t.business.id } })
  );
  assert.equal(tolovlar, 0);

  // To'lov QATORLARI ham ikkilanmadi (har kanal bittadan).
  const satrlar = await A(() => prisma.dealTolov.findMany({ where: { dealId: d.id } }));
  assert.equal(satrlar.length, 2);
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
