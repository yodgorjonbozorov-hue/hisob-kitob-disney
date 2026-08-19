/**
 * KO'P-BIZNESLIK TESTLARI — bir xodim bir nechta biznesga biriktiriladi.
 *
 * Nega kerak: bir jamoa ikki biznesni yuritishi mumkin (masalan gullar va
 * sovg'a qutilari — sotuvchilar bir xil, bizneslar esa hisob-kitob
 * chalkashmasligi uchun alohida). Ilgari xodim FAQAT bitta biznesga
 * biriktirilardi.
 *
 * Bu test qo'riqlaydigan narsalar:
 *   1. biriktiruv ro'yxati ruxsatni CHEKLAYDI (kengaytirmaydi);
 *   2. biriktirilmagan xodim — barcha bizneslarni ko'radi (avvalgidek);
 *   3. kassirda kamida bitta biznes majburiy;
 *   4. begona tenant biznesiga biriktirib bo'lmaydi (tenant izolyatsiyasi);
 *   5. `User.businessId` qulaylik nusxasi sinxron qoladi (bitta bo'lsa o'sha,
 *      ko'p bo'lsa NULL);
 *   6. biriktiruv qatori bo'lmasa-yu eski `businessId` to'lgan bo'lsa —
 *      ruxsat KENGAYMAYDI (fail-closed).
 *
 * Ishga tushirish: npm run test:kop-biznes
 */
process.env.DATABASE_URL = "file:./prisma/test-kop-biznes.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: <T>(tenantId: string, fn: () => T) => T;
let getAccessibleBusinesses: any;
let resolveActiveBusinessId: any;
let biznesRuxsatiBormi: any;
let biriktirilganBiznesIdlari: any;
let biznesIdlariniHalQil: any;
let biriktiruvlarniYangila: any;
let birlamchiBiznes: any;

const TENANT = "t_kb";
const TENANT_B = "t_kb_begona";
const GULLAR = "biz_kb_gullar";
const SOVGA = "biz_kb_sovga";
const NOFAOL = "biz_kb_nofaol";
const BEGONA = "biz_kb_begona";

/** Ikkala biznesga biriktirilgan sotuvchi (asosiy stsenariy). */
const IKKI = { userId: "u_kb_ikki", rol: "SELLER", ism: "Sotuvchi Ikki", login: "kb_ikki" };
/** Bitta biznesga biriktirilgan kassir. */
const BITTA = { userId: "u_kb_bitta", rol: "CASHIER", ism: "Kassir Bitta", login: "kb_bitta" };
/** Biriktirilmagan direktor — barcha bizneslar. */
const EGA = { userId: "u_kb_ega", rol: "OWNER", ism: "Direktor", login: "kb_ega" };
/** Eski hisob: `businessId` to'lgan, biriktiruv qatori YO'Q. */
const ESKI = { userId: "u_kb_eski", rol: "CASHIER", ism: "Eski Kassir", login: "kb_eski" };

const sessiya = (u: { userId: string; rol: string }, businessId: string | null = null) => ({
  userId: u.userId,
  rol: u.rol as any,
  tenantId: TENANT,
  businessId,
  login: "x",
  ism: "x",
});

before(async () => {
  rmSync("prisma/test-kop-biznes.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({
    getAccessibleBusinesses,
    resolveActiveBusinessId,
    biznesRuxsatiBormi,
    biriktirilganBiznesIdlari,
  } = await import("@/lib/business"));
  ({ biznesIdlariniHalQil, biriktiruvlarniYangila, birlamchiBiznes } = await import(
    "@/lib/services/userBiznes"
  ));

  await rawPrisma.tenant.create({
    data: { id: TENANT, name: "KB tenant", slug: "kb-tenant", status: "ACTIVE" },
  });
  await rawPrisma.tenant.create({
    data: { id: TENANT_B, name: "KB begona", slug: "kb-begona", status: "ACTIVE" },
  });

  await rawPrisma.business.create({ data: { id: GULLAR, nomi: "Disney Flowers", tenantId: TENANT } });
  await rawPrisma.business.create({ data: { id: SOVGA, nomi: "Disney Giftbox", tenantId: TENANT } });
  await rawPrisma.business.create({
    data: { id: NOFAOL, nomi: "Yopilgan filial", tenantId: TENANT, isActive: false },
  });
  await rawPrisma.business.create({ data: { id: BEGONA, nomi: "Begona", tenantId: TENANT_B } });

  for (const u of [IKKI, BITTA, EGA, ESKI]) {
    await rawPrisma.user.create({
      data: { id: u.userId, ism: u.ism, login: u.login, parolHash: "x", rol: u.rol, tenantId: TENANT },
    });
  }
  // Eski hisob: ustun to'lgan, biriktiruv qatori yo'q (migratsiyadan tashqari yo'l).
  await rawPrisma.user.update({ where: { id: ESKI.userId }, data: { businessId: GULLAR } });

  await rawPrisma.userBusiness.createMany({
    data: [
      { id: "ub_kb_1", userId: IKKI.userId, businessId: GULLAR },
      { id: "ub_kb_2", userId: IKKI.userId, businessId: SOVGA },
      { id: "ub_kb_3", userId: BITTA.userId, businessId: GULLAR },
    ],
  });
  await rawPrisma.user.update({ where: { id: BITTA.userId }, data: { businessId: GULLAR } });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1. Ruxsat ro'yxati
// ---------------------------------------------------------------------------

test("ikki biznesga biriktirilgan xodim AYNAN o'sha ikkitasini ko'radi", async () => {
  const bizneslar = await runWithTenant(TENANT, () => getAccessibleBusinesses(sessiya(IKKI)));
  assert.deepEqual(
    bizneslar.map((b: any) => b.id).sort(),
    [GULLAR, SOVGA].sort()
  );
});

test("bitta biznesga biriktirilgan kassir faqat o'z biznesini ko'radi", async () => {
  const bizneslar = await runWithTenant(TENANT, () => getAccessibleBusinesses(sessiya(BITTA, GULLAR)));
  assert.deepEqual(bizneslar.map((b: any) => b.id), [GULLAR]);
});

test("biriktirilmagan direktor barcha FAOL bizneslarni ko'radi", async () => {
  const bizneslar = await runWithTenant(TENANT, () => getAccessibleBusinesses(sessiya(EGA)));
  assert.deepEqual(
    bizneslar.map((b: any) => b.id).sort(),
    [GULLAR, SOVGA].sort(),
    "nofaol biznes ro'yxatga tushmasligi kerak"
  );
});

test("bitta biznesga biriktirilgan xodimning aktiv biznesi — o'sha biznes", async () => {
  const id = await runWithTenant(TENANT, () => resolveActiveBusinessId(sessiya(BITTA, GULLAR)));
  assert.equal(id, GULLAR);
});

test("ruxsat tekshiruvi: biriktirilmagan biznes yopiq, biriktirilgani ochiq", async () => {
  await runWithTenant(TENANT, async () => {
    assert.equal(await biznesRuxsatiBormi(sessiya(IKKI), GULLAR), true);
    assert.equal(await biznesRuxsatiBormi(sessiya(IKKI), SOVGA), true);
    assert.equal(await biznesRuxsatiBormi(sessiya(IKKI), NOFAOL), false);
    assert.equal(await biznesRuxsatiBormi(sessiya(BITTA, GULLAR), SOVGA), false);
    // Direktor cheklanmagan — har qanday biznes ochiq.
    assert.equal(await biznesRuxsatiBormi(sessiya(EGA), SOVGA), true);
  });
});

test("FAIL-CLOSED: biriktiruvsiz eski hisob sessiyadagi biznes bilan cheklanadi", async () => {
  await runWithTenant(TENANT, async () => {
    const idlar = await biriktirilganBiznesIdlari(ESKI.userId);
    assert.deepEqual(idlar, [], "biriktiruv qatori yo'q");

    const bizneslar = await getAccessibleBusinesses(sessiya(ESKI, GULLAR));
    assert.deepEqual(
      bizneslar.map((b: any) => b.id),
      [GULLAR],
      "qator yo'qligi 'cheklov yo'q' deb o'qilmasligi kerak"
    );
    assert.equal(await biznesRuxsatiBormi(sessiya(ESKI, GULLAR), SOVGA), false);
  });
});

// ---------------------------------------------------------------------------
// 2. Biriktiruvni o'zgartirish qoidalari
// ---------------------------------------------------------------------------

test("kassir uchun kamida bitta biznes majburiy", async () => {
  await runWithTenant(TENANT, async () => {
    await assert.rejects(
      () => biznesIdlariniHalQil({ rol: "CASHIER", businessIds: [], mavjud: [] }),
      /kamida bitta biznes/
    );
  });
});

test("sotuvchi bo'sh ro'yxat bilan qolishi mumkin (barcha bizneslar)", async () => {
  const idlar = await runWithTenant(TENANT, () =>
    biznesIdlariniHalQil({ rol: "SELLER", businessIds: [], mavjud: [GULLAR] })
  );
  assert.deepEqual(idlar, []);
});

test("direktorga biznes biriktirilmaydi (ro'yxat e'tiborsiz)", async () => {
  const idlar = await runWithTenant(TENANT, () =>
    biznesIdlariniHalQil({ rol: "OWNER", businessIds: [GULLAR, SOVGA], mavjud: [] })
  );
  assert.deepEqual(idlar, []);
});

test("begona tenant biznesiga biriktirib bo'lmaydi", async () => {
  await runWithTenant(TENANT, async () => {
    await assert.rejects(
      () => biznesIdlariniHalQil({ rol: "SELLER", businessIds: [GULLAR, BEGONA], mavjud: [] }),
      /Biznes topilmadi/
    );
  });
});

test("takrorlangan id bir marta hisoblanadi", async () => {
  const idlar = await runWithTenant(TENANT, () =>
    biznesIdlariniHalQil({ rol: "CASHIER", businessIds: [GULLAR, GULLAR], mavjud: [] })
  );
  assert.deepEqual(idlar, [GULLAR]);
});

test("eski `businessId` maydoni ham qabul qilinadi (orqaga moslik)", async () => {
  const idlar = await runWithTenant(TENANT, () =>
    biznesIdlariniHalQil({ rol: "CASHIER", businessId: SOVGA, mavjud: [GULLAR] })
  );
  assert.deepEqual(idlar, [SOVGA]);
});

test("hech narsa berilmasa mavjud biriktiruvlar o'zgarmaydi", async () => {
  const idlar = await runWithTenant(TENANT, () =>
    biznesIdlariniHalQil({ rol: "SELLER", mavjud: [GULLAR, SOVGA] })
  );
  assert.deepEqual(idlar.sort(), [GULLAR, SOVGA].sort());
});

// ---------------------------------------------------------------------------
// 3. Yozish: biriktiruvlar va `User.businessId` sinxronligi
// ---------------------------------------------------------------------------

test("biriktiruvlar almashtiriladi va birlamchi biznes sinxron qoladi", async () => {
  await runWithTenant(TENANT, async () => {
    // Kassir bitta bizneste edi — endi ikkalasida ishlaydi.
    await biriktiruvlarniYangila(BITTA.userId, [GULLAR, SOVGA]);
    await rawPrisma.user.update({
      where: { id: BITTA.userId },
      data: { businessId: birlamchiBiznes([GULLAR, SOVGA]) },
    });

    const idlar = await biriktirilganBiznesIdlari(BITTA.userId);
    assert.deepEqual(idlar.sort(), [GULLAR, SOVGA].sort());

    const user = await rawPrisma.user.findUnique({ where: { id: BITTA.userId } });
    assert.equal(user.businessId, null, "ikki bizneste birlamchi biznes NULL bo'ladi");

    const bizneslar = await getAccessibleBusinesses(sessiya(BITTA));
    assert.equal(bizneslar.length, 2);
  });
});

test("ro'yxat bittaga qisqarsa birlamchi biznes qaytadi", async () => {
  await runWithTenant(TENANT, async () => {
    await biriktiruvlarniYangila(BITTA.userId, [SOVGA]);
    await rawPrisma.user.update({
      where: { id: BITTA.userId },
      data: { businessId: birlamchiBiznes([SOVGA]) },
    });

    assert.deepEqual(await biriktirilganBiznesIdlari(BITTA.userId), [SOVGA]);
    const user = await rawPrisma.user.findUnique({ where: { id: BITTA.userId } });
    assert.equal(user.businessId, SOVGA);

    const id = await resolveActiveBusinessId(sessiya(BITTA, SOVGA));
    assert.equal(id, SOVGA);
  });
});

test("biriktiruv o'chirilsa faqat o'sha xodimniki ketadi", async () => {
  await runWithTenant(TENANT, async () => {
    await biriktiruvlarniYangila(BITTA.userId, [GULLAR]);
    // IKKI xodimning ikkala biriktiruvi joyida qolishi kerak.
    assert.equal((await biriktirilganBiznesIdlari(IKKI.userId)).length, 2);
  });
});

// ---------------------------------------------------------------------------
// 4. Tenant izolyatsiyasi
// ---------------------------------------------------------------------------

test("begona tenant biriktiruvni ko'rmaydi", async () => {
  const idlar = await runWithTenant(TENANT_B, () => biriktirilganBiznesIdlari(IKKI.userId));
  assert.deepEqual(idlar, [], "boshqa tenant kontekstida biriktiruv ko'rinmasligi kerak");
});

test("begona tenant biznesiga to'g'ridan-to'g'ri biriktirish bloklanadi", async () => {
  await runWithTenant(TENANT, async () => {
    await assert.rejects(() => biriktiruvlarniYangila(IKKI.userId, [GULLAR, SOVGA, BEGONA]));
  });
});
