/**
 * QARZNI TAHRIRLASH — DIREKTOR HUQUQI VA BALANS BUTUNLIGI.
 *
 * `tests/qarz.test.ts` qarz yaratish va to'lovni tekshiradi; bu yerda
 * XATO KIRITILGAN qarzni to'g'irlash sinaladi.
 *
 * TEKSHIRILADIGAN INVARIANTLAR:
 *   1. HUQUQ: tahrirlash faqat DIREKTOR (`OWNER`) da. Administrator,
 *      kassir va sotuvchi — API darajasida ham rad etiladi (interfeysdagi
 *      tugmani yashirish himoya emas).
 *   2. TO'LOVGA TEGILMAYDI: to'lov qilingan qarz tahrirlansa `tolangan`
 *      o'zgarmaydi, kassa qoldig'i o'zgarmaydi va
 *      `qolgan = jamiSumma − tolangan` invarianti saqlanadi.
 *   3. Summani to'langan qismdan PAST qilib bo'lmaydi (qoldiq manfiyga
 *      tushmasin).
 *   4. Summa oshirilsa YOPILGAN qarz qayta ochiladi, to'liq to'langanga
 *      tushirilsa yopiladi — holat qo'lda emas, qoida bilan hisoblanadi.
 *   5. MIJOZ ALMASHTIRISH kartochkani ham ko'chiradi va begona biznesning
 *      kartochkasi qabul qilinmaydi (tenant izolyatsiyasi).
 *   6. TELEFON JIMGINA O'CHMAYDI: faqat summa tahrirlanganda mijoz
 *      raqami joyida qoladi.
 *   7. Har o'zgarish auditga eski→yangi va SABAB bilan tushadi.
 *
 * Ishga tushirish: npm run test:qarz-tahrir
 */
process.env.DATABASE_URL = "file:./prisma/test-qarz-tahrir.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let qarz: any;
let qarzTuzatish: any;
let qarzAudit: any;
let accountQueries: any;
let createTenantWithOwner: any;

let t: any;
let ikkinchi: any;
let kassa: any;
let mijozA: any;
let mijozB: any;
/** BEGONA biznesning mijozi — tenant izolyatsiyasini sinash uchun. */
let begonaMijoz: any;

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

async function kassaQoldiq(): Promise<number> {
  const qoldiqlar = await T(() => accountQueries.getAccountBalances(t.business.id));
  return qoldiqlar.find((a: any) => a.id === kassa.id)?.qoldiq ?? 0;
}

/** Yangi "olinadigan" qarz — testlar bir-biriga xalaqit bermasin. */
function qarzYarat(opts: { summa: number; contactId?: string; izoh?: string; sana?: string }) {
  return T(() =>
    qarz.createQarz({
      businessId: t.business.id,
      userId: t.user.id,
      turi: "olinadigan",
      contactId: opts.contactId ?? mijozA.id,
      jamiSumma: opts.summa,
      sana: opts.sana ?? "2026-09-01",
      izoh: opts.izoh ?? null,
    })
  );
}

const tolovQil = (debtId: string, summa: number) =>
  T(() =>
    qarz.qarzTolov({
      businessId: t.business.id,
      debtId,
      userId: t.user.id,
      summa,
      sana: "2026-09-05",
      tolovTuri: "naqd",
      accountId: kassa.id,
    })
  );

const tahrir = (debtId: string, data: any) =>
  T(() =>
    qarzTuzatish.qarzTahrirla({
      businessId: t.business.id,
      debtId,
      userId: t.user.id,
      sabab: "test tuzatishi",
      ...data,
    })
  );

const oqi = (debtId: string) => rawPrisma.debt.findUnique({ where: { id: debtId } });

before(async () => {
  rmSync("prisma/test-qarz-tahrir.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  qarz = await import("@/lib/services/qarz");
  qarzTuzatish = await import("@/lib/services/qarzTuzatish");
  qarzAudit = await import("@/lib/queries/qarzAudit");
  accountQueries = await import("@/lib/queries/accounts");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Qarz do'koni",
    ism: "Egasi",
    login: "+998933333501",
    parol: "parol12345",
  });
  ikkinchi = await createTenantWithOwner({
    kompaniyaNomi: "Begona do'kon",
    ism: "Begona egasi",
    login: "+998933333502",
    parol: "parol12345",
  });

  kassa = await rawPrisma.account.findFirst({
    where: { businessId: t.business.id, turi: "naqd" },
  });
  assert.ok(kassa, "yangi biznesda naqd kassa ochilgan bo'lishi kerak");

  mijozA = await rawPrisma.contact.create({
    data: {
      businessId: t.business.id,
      ism: "Ali Valiyev",
      tel: "+998901112233",
      createdBy: t.user.id,
    },
  });
  mijozB = await rawPrisma.contact.create({
    data: {
      businessId: t.business.id,
      ism: "Vali Aliyev",
      tel: "+998904445566",
      createdBy: t.user.id,
    },
  });
  begonaMijoz = await rawPrisma.contact.create({
    data: {
      businessId: ikkinchi.business.id,
      ism: "Begona mijoz",
      tel: "+998907778899",
      createdBy: ikkinchi.user.id,
    },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1 — HUQUQ: faqat direktor
// ---------------------------------------------------------------------------

test("tahrirlash huquqi FAQAT direktorda — boshqa rollar rad etiladi", async () => {
  const { isDirektor, isManager } = await import("@/lib/auth/roles");

  assert.equal(isDirektor("OWNER"), true, "direktor tahrirlaydi");
  for (const rol of ["ADMIN", "CASHIER", "SELLER"]) {
    assert.equal(isDirektor(rol), false, `${rol} qarzni tahrirlay olmaydi`);
  }
  // ADMINISTRATOR boshqaruvchi bo'lsa ham qarz tahririga kirmaydi —
  // ikkalasi bitta tekshiruvga qo'shilib ketmasin.
  assert.equal(isManager("ADMIN"), true);
  assert.equal(isDirektor("ADMIN"), false, "ADMIN boshqaruvchi, lekin direktor EMAS");

  // Granular huquq ham direktorga qulflangan.
  const { FAQAT_DIREKTOR } = await import("@/lib/permissions/katalog");
  assert.ok(
    FAQAT_DIREKTOR.includes("qarz.tahrir"),
    "`qarz.tahrir` FAQAT_DIREKTOR ro'yxatida bo'lishi shart"
  );
});

// ---------------------------------------------------------------------------
// 2 — TO'LOV BALANSI BUZILMAYDI
// ---------------------------------------------------------------------------

test("to'lov qilingan qarz tahrirlansa to'lov ham, kassa ham o'zgarmaydi", async () => {
  const d = await qarzYarat({ summa: 5_000_000 });
  await tolovQil(d.id, 2_000_000);

  const kassaOldin = await kassaQoldiq();
  const oldin = await oqi(d.id);
  assert.equal(oldin.tolangan, 2_000_000);
  assert.equal(oldin.status, "PARTIALLY_PAID");

  // Summa 5 mln → 7 mln (xato kiritilgan qarz to'g'irlanmoqda).
  await tahrir(d.id, { jamiSumma: 7_000_000 });

  const keyin = await oqi(d.id);
  assert.equal(keyin.jamiSumma, 7_000_000, "summa yangilandi");
  assert.equal(keyin.tolangan, 2_000_000, "TO'LANGAN O'ZGARMAYDI");
  assert.equal(
    keyin.jamiSumma - keyin.tolangan,
    5_000_000,
    "qolgan = jamiSumma − tolangan invarianti"
  );
  assert.equal(await kassaQoldiq(), kassaOldin, "kassa qoldig'i tegilmaydi");

  // To'lov yozuvlari ham joyida.
  const tolovlar = await rawPrisma.debtPayment.count({ where: { debtId: d.id } });
  assert.equal(tolovlar, 1, "to'lov yozuvi o'chib ketmaydi");
});

test("summani to'langan qismdan PAST qilib bo'lmaydi", async () => {
  const d = await qarzYarat({ summa: 5_000_000 });
  await tolovQil(d.id, 3_000_000);

  await assert.rejects(
    () => tahrir(d.id, { jamiSumma: 1_000_000 }),
    /past bo'lmasligi kerak/,
    "qoldiq manfiyga tushishi mumkin emas"
  );

  const keyin = await oqi(d.id);
  assert.equal(keyin.jamiSumma, 5_000_000, "rad etilgan tahrir hech narsani o'zgartirmaydi");
  assert.equal(keyin.tolangan, 3_000_000);
});

// ---------------------------------------------------------------------------
// 3 — HOLAT QAYTA HISOBLANADI
// ---------------------------------------------------------------------------

test("yopilgan qarz summasi oshirilsa QAYTA OCHILADI", async () => {
  // Klassik xato: 5 mln o'rniga 500 ming yozilgan, mijoz 500 ming to'lagan.
  const d = await qarzYarat({ summa: 500_000 });
  await tolovQil(d.id, 500_000);

  const yopiq = await oqi(d.id);
  assert.equal(yopiq.status, "PAID");
  assert.equal(yopiq.isYopilgan, true);

  await tahrir(d.id, { jamiSumma: 5_000_000 });

  const ochiq = await oqi(d.id);
  assert.equal(ochiq.status, "PARTIALLY_PAID", "qarz qayta ochildi");
  assert.equal(ochiq.isYopilgan, false, "`isYopilgan` status bilan sinxron");
  assert.equal(ochiq.jamiSumma - ochiq.tolangan, 4_500_000, "qolgan qarz to'g'ri");
});

test("summa to'langanga tenglashtirilsa qarz YOPILADI", async () => {
  const d = await qarzYarat({ summa: 4_000_000 });
  await tolovQil(d.id, 1_000_000);

  await tahrir(d.id, { jamiSumma: 1_000_000 });

  const keyin = await oqi(d.id);
  assert.equal(keyin.status, "PAID");
  assert.equal(keyin.isYopilgan, true);
  assert.equal(keyin.jamiSumma - keyin.tolangan, 0);
});

// ---------------------------------------------------------------------------
// 4 — MIJOZ, SANA, IZOH
// ---------------------------------------------------------------------------

test("mijozni almashtirish kartochkani ham ko'chiradi", async () => {
  const d = await qarzYarat({ summa: 1_000_000 });
  assert.equal((await oqi(d.id)).contactId, mijozA.id);

  await tahrir(d.id, { contactId: mijozB.id });

  const keyin = await oqi(d.id);
  assert.equal(keyin.contactId, mijozB.id, "qarz yangi kartochkaga bog'landi");
  assert.equal(keyin.mijozNomi, "Vali Aliyev", "ism kartochkadan olindi");
  assert.equal(keyin.mijozTel, "+998904445566", "telefon ham kartochkadan");
});

test("BEGONA biznesning mijoz kartochkasi qabul qilinmaydi", async () => {
  const d = await qarzYarat({ summa: 1_000_000 });

  await assert.rejects(
    () => tahrir(d.id, { contactId: begonaMijoz.id }),
    /Mijoz kartochkasi topilmadi/,
    "tenant izolyatsiyasi: boshqa biznesning mijozi ko'rinmaydi"
  );

  assert.equal((await oqi(d.id)).contactId, mijozA.id, "bog'lanish o'zgarmadi");
});

test("sana va izoh tuzatiladi", async () => {
  const d = await qarzYarat({ summa: 1_000_000, izoh: "eski izoh", sana: "2026-09-01" });

  await tahrir(d.id, { sana: "2026-08-15", izoh: "to'g'ri izoh" });

  const keyin = await oqi(d.id);
  assert.equal(
    keyin.sana.toISOString(),
    "2026-08-15T00:00:00.000Z",
    "sana UTC-yarim tunga tushadi"
  );
  assert.equal(keyin.izoh, "to'g'ri izoh");
});

test("faqat summa tahrirlansa mijoz TELEFONI o'chib ketmaydi", async () => {
  const d = await qarzYarat({ summa: 1_000_000 });
  assert.equal((await oqi(d.id)).mijozTel, "+998901112233");

  // `mijozTel` kaliti UMUMAN yuborilmaydi — maydonga tegilmasligi kerak.
  await tahrir(d.id, { jamiSumma: 2_000_000 });

  assert.equal(
    (await oqi(d.id)).mijozTel,
    "+998901112233",
    "tegilmagan telefon saqlanib qoladi"
  );
});

test("qarz tahrir sxemasi: yuborilmagan telefon `undefined` bo'lib qoladi", async () => {
  const { qarzTahrirSchema } = await import("@/lib/validation/qarz");

  const faqatSumma = qarzTahrirSchema.parse({ jamiSumma: 100, sabab: "xato" });
  assert.equal(
    faqatSumma.mijozTel,
    undefined,
    "kalit yuborilmasa `undefined` — xizmat qatlami maydonga tegmaydi"
  );

  // Ataylab o'chirish esa ochiq `null` bilan.
  const ochirilgan = qarzTahrirSchema.parse({ mijozTel: null, sabab: "xato" });
  assert.equal(ochirilgan.mijozTel, null);

  // Noto'g'ri raqam baribir rad etiladi.
  assert.equal(
    qarzTahrirSchema.safeParse({ mijozTel: "123", sabab: "xato" }).success,
    false
  );
});

// ---------------------------------------------------------------------------
// 5 — AUDIT
// ---------------------------------------------------------------------------

test("har o'zgarish auditga eski→yangi va SABAB bilan tushadi", async () => {
  const d = await qarzYarat({ summa: 3_000_000, izoh: "eski izoh" });

  await T(() =>
    qarzTuzatish.qarzTahrirla({
      businessId: t.business.id,
      debtId: d.id,
      userId: t.user.id,
      jamiSumma: 3_500_000,
      contactId: mijozB.id,
      sana: "2026-08-20",
      izoh: "yangi izoh",
      sabab: "summa xato kiritilgan",
    })
  );

  const { items } = await T(() =>
    qarzAudit.listQarzAudit({ businessId: t.business.id, amal: "update" })
  );
  const yozuv = items.find((i: any) => i.debtId === d.id);
  assert.ok(yozuv, "audit yozuvi yaratildi");
  assert.equal(yozuv.sabab, "summa xato kiritilgan", "sabab saqlandi");
  assert.ok(yozuv.kim, "kim o'zgartirgani yozildi");
  assert.ok(yozuv.vaqt, "sana/vaqt yozildi");

  // MAYDONMA-MAYDON eski→yangi.
  const maydon = (nomi: string) => yozuv.ozgarishlar.find((o: any) => o.maydon === nomi);

  assert.deepEqual(
    { eski: maydon("Summa").eski, yangi: maydon("Summa").yangi },
    { eski: "3000000", yangi: "3500000" },
    "summa o'zgarishi"
  );
  assert.deepEqual(
    { eski: maydon("Mijoz").eski, yangi: maydon("Mijoz").yangi },
    { eski: "Ali Valiyev", yangi: "Vali Aliyev" },
    "mijoz o'zgarishi"
  );
  assert.deepEqual(
    { eski: maydon("Berilgan sana").eski, yangi: maydon("Berilgan sana").yangi },
    { eski: "2026-09-01", yangi: "2026-08-20" },
    "sana o'zgarishi kun aniqligida"
  );
  assert.deepEqual(
    { eski: maydon("Izoh").eski, yangi: maydon("Izoh").yangi },
    { eski: "eski izoh", yangi: "yangi izoh" },
    "izoh o'zgarishi"
  );
  // O'ZGARMAGAN maydon ro'yxatga tushmaydi — lenta shovqinsiz bo'lsin.
  assert.equal(maydon("Muddat"), undefined, "tegilmagan maydon ko'rsatilmaydi");
});

test("o'chirilgan qarz tahrirlanmaydi", async () => {
  const d = await qarzYarat({ summa: 1_000_000 });
  await T(() =>
    qarzTuzatish.qarzOchir({
      businessId: t.business.id,
      debtId: d.id,
      userId: t.user.id,
      sabab: "xato yozilgan",
    })
  );

  await assert.rejects(
    () => tahrir(d.id, { jamiSumma: 2_000_000 }),
    /O'chirilgan qarzni tahrirlab bo'lmaydi/
  );
});
