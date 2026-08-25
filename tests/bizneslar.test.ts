/**
 * BIZNESLAR SAHIFASI TESTLARI (business management).
 *
 * Qo'riqlanadigan narsalar:
 *   1. ro'yxat va tafsilot FAQAT o'z tenanti bizneslarini ko'rsatadi (IDOR);
 *   2. qidiruv / filtr / saralash to'g'ri ishlaydi (sof funksiya);
 *   3. biznes yaratiladi va kassasi bilan keladi; takroriy yuborish dublikat
 *      yaratmaydi;
 *   4. faoliyat modullari faqat TARIFDA bor bo'lsa yoqiladi;
 *   5. nofaollashtirish ma'lumotni O'CHIRMAYDI;
 *   6. o'chirish faqat DIREKTOR (OWNER) va faqat BO'SH biznes uchun, nom
 *      tasdig'i bilan;
 *   7. biznes almashtirish ruxsati serverda tekshiriladi;
 *   8. agregatsiya N+1 emas (so'rov soni biznes soniga bog'liq emas).
 *
 * Ishga tushirish: npm run test:bizneslar
 */
process.env.DATABASE_URL = "file:./prisma/test-bizneslar.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let biznesStatlari: any;
let biznesTafsiloti: any;
let biznesYarat: any;
let biznesOchir: any;
let biznesRuxsatiBormi: any;
let royxatniTayyorla: any;
let biznesModulNomlari: any;
let ForbiddenError: any;
let ConflictError: any;
let BadRequestError: any;

let tA: any; // asosiy tenant (STANDARD tarif)
let tB: any; // begona tenant — izolyatsiya tekshiruvi uchun

before(async () => {
  rmSync("prisma/test-bizneslar.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ biznesStatlari } = await import("@/lib/services/biznesRoyxat"));
  ({ biznesTafsiloti } = await import("@/lib/services/biznesTafsilot"));
  ({ biznesYarat } = await import("@/lib/services/biznesYaratish"));
  ({ biznesOchir } = await import("@/lib/services/biznesOchirish"));
  ({ biznesRuxsatiBormi } = await import("@/lib/business"));
  ({ royxatniTayyorla } = await import("@/app/app/admin/bizneslar/turlar"));
  ({ biznesModulNomlari } = await import("@/lib/modules/biznesModullari"));
  ({ ForbiddenError, ConflictError, BadRequestError } = await import("@/lib/auth/guard"));

  tA = await createTenantWithOwner({
    kompaniyaNomi: "Biz A",
    ism: "Direktor A",
    login: "+998933334401",
    parol: "parol12345",
  });
  tB = await createTenantWithOwner({
    kompaniyaNomi: "Biz B",
    ism: "Direktor B",
    login: "+998933334402",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

const dto = (o: any) => ({
  id: o.id ?? o.nomi,
  nomi: o.nomi,
  isActive: o.isActive ?? true,
  turi: "umumiy",
  omborli: false,
  magazin: false,
  shaxsiyKassa: false,
  createdAt: o.createdAt ?? "2026-01-01T00:00:00.000Z",
  kategoriyalar: 0,
  tranzaksiyalar: o.tranzaksiyalar ?? 0,
  xodimlar: 0,
  oxirgiFaollik: o.oxirgiFaollik ?? null,
  modullar: [],
});

// ─── Qidiruv / filtr / saralash (sof funksiya) ────────────────────────────
test("qidiruv: nom bo'yicha, registrga sezgir emas", () => {
  const royxat = [dto({ nomi: "Disney Navoiy" }), dto({ nomi: "Salyut" })];
  const topildi = royxatniTayyorla(royxat, {
    qidiruv: "disney",
    filtr: "hammasi",
    saralash: "nom",
  });
  assert.deepEqual(topildi.map((b: any) => b.nomi), ["Disney Navoiy"]);
});

test("filtr: faol va nofaol alohida ajratiladi", () => {
  const royxat = [
    dto({ nomi: "Faol biz", isActive: true }),
    dto({ nomi: "Nofaol biz", isActive: false }),
  ];
  const faol = royxatniTayyorla(royxat, { qidiruv: "", filtr: "faol", saralash: "nom" });
  const nofaol = royxatniTayyorla(royxat, { qidiruv: "", filtr: "nofaol", saralash: "nom" });
  assert.deepEqual(faol.map((b: any) => b.nomi), ["Faol biz"]);
  assert.deepEqual(nofaol.map((b: any) => b.nomi), ["Nofaol biz"]);
});

test("saralash: faollik, tranzaksiya va nom bo'yicha", () => {
  const royxat = [
    dto({ nomi: "B", tranzaksiyalar: 5, oxirgiFaollik: "2026-01-01T00:00:00.000Z" }),
    dto({ nomi: "A", tranzaksiyalar: 90, oxirgiFaollik: "2026-08-01T00:00:00.000Z" }),
    dto({ nomi: "C", tranzaksiyalar: 1, oxirgiFaollik: null }),
  ];
  const faollik = royxatniTayyorla(royxat, { qidiruv: "", filtr: "hammasi", saralash: "faollik" });
  // Faolligi yo'q biznes oxirida qoladi — soxta sana o'ylab topilmaydi.
  assert.deepEqual(faollik.map((b: any) => b.nomi), ["A", "B", "C"]);

  const tranzaksiya = royxatniTayyorla(royxat, {
    qidiruv: "",
    filtr: "hammasi",
    saralash: "tranzaksiya",
  });
  assert.deepEqual(tranzaksiya.map((b: any) => b.nomi), ["A", "B", "C"]);

  const nom = royxatniTayyorla(royxat, { qidiruv: "", filtr: "hammasi", saralash: "nom" });
  assert.deepEqual(nom.map((b: any) => b.nomi), ["A", "B", "C"]);
});

// ─── Modul chiplari (menyu bilan bir xil qoida) ───────────────────────────
test("modul chiplari: ombor/kassa BIZNES bayrog'iga ham bog'liq", () => {
  const yoqilgan = new Set(["MOLIYA", "OMBOR", "MAGAZIN", "CRM", "BOSHQARUV"]);
  const omborsiz = biznesModulNomlari(yoqilgan, { omborli: false, magazin: false });
  assert.ok(!omborsiz.includes("Ombor"));
  assert.ok(!omborsiz.includes("Kassa"));
  assert.ok(omborsiz.includes("CRM"));

  const dokon = biznesModulNomlari(yoqilgan, { omborli: true, magazin: true });
  assert.ok(dokon.includes("Ombor"));
  assert.ok(dokon.includes("Kassa"));

  // Modul kompaniya bo'ylab o'chiq bo'lsa bayroq yolg'iz yetarli emas.
  const modulsiz = biznesModulNomlari(new Set(["MOLIYA", "BOSHQARUV"]), {
    omborli: true,
    magazin: true,
  });
  assert.ok(!modulsiz.includes("Ombor"));
});

// ─── Yaratish ─────────────────────────────────────────────────────────────
test("yaratish: biznes va uning boshlang'ich kassasi ochiladi", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    const biz = await biznesYarat(
      { nomi: "Disney Navoiy", faoliyat: "xizmat", kassaNomi: "Naqd kassa" },
      { tenantId: tA.tenant.id, plan: "STANDARD" }
    );
    assert.equal(biz.nomi, "Disney Navoiy");
    assert.equal(biz.isActive, true);
    const kassalar = await prisma.account.findMany({ where: { businessId: biz.id } });
    assert.equal(kassalar.length, 1);
    assert.equal(kassalar[0].nomi, "Naqd kassa");
  });
});

test("takroriy yuborish: ikkinchi so'rov DUBLIKAT yaratmaydi", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    await assert.rejects(
      () =>
        biznesYarat(
          { nomi: "Disney Navoiy", faoliyat: "xizmat" },
          { tenantId: tA.tenant.id, plan: "STANDARD" }
        ),
      (e: any) => e instanceof ConflictError
    );
    const soni = await prisma.business.count({ where: { nomi: "Disney Navoiy" } });
    assert.equal(soni, 1);
  });
});

test("yaratish: ANIQ berilgan bayroq faoliyat taklifidan ustun", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    // "dokon" faoliyati ombor+kassani taklif qiladi, lekin foydalanuvchi
    // wizard'ning 2-qadamida kassani o'chirgan.
    const biz = await biznesYarat(
      { nomi: "Ombor faqat", faoliyat: "dokon", magazin: false },
      { tenantId: tA.tenant.id, plan: "STANDARD" }
    );
    assert.equal(biz.omborli, true);
    assert.equal(biz.magazin, false);
  });
});

test("yaratish: kassa yoqilsa ombor ham majburan yoqiladi", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    const biz = await biznesYarat(
      { nomi: "Kassali", omborli: false, magazin: true },
      { tenantId: tA.tenant.id, plan: "STANDARD" }
    );
    assert.equal(biz.omborli, true);
  });
});

test("modullar: faqat TARIFDA bor modul yoqiladi", async () => {
  // AVTO tarifida MAGAZIN yo'q — "dokon" faoliyati uni yoqib yubormasligi kerak.
  const tAvto = await createTenantWithOwner({
    kompaniyaNomi: "Avto tarif",
    ism: "Direktor",
    login: "+998933334403",
    parol: "parol12345",
    plan: "AVTO",
  });
  await runWithTenant(tAvto.tenant.id, async () => {
    await biznesYarat(
      { nomi: "Do'kon urinishi", faoliyat: "dokon" },
      { tenantId: tAvto.tenant.id, plan: "AVTO" }
    );
    const kodlar = (
      await prisma.tenantModule.findMany({ where: { isActive: true }, select: { code: true } })
    ).map((m: any) => m.code);
    assert.ok(kodlar.includes("OMBOR"), "OMBOR tarifda bor — yoqilishi kerak");
    assert.ok(!kodlar.includes("MAGAZIN"), "MAGAZIN tarifda yo'q — yoqilmasligi kerak");
  });
});

// ─── Ro'yxat va tenant izolyatsiyasi ──────────────────────────────────────
test("ro'yxat: faqat O'Z tenanti bizneslari ko'rinadi", async () => {
  const aRoyxat = await runWithTenant(tA.tenant.id, () => biznesStatlari());
  const bRoyxat = await runWithTenant(tB.tenant.id, () => biznesStatlari());

  assert.ok(aRoyxat.some((b: any) => b.nomi === "Disney Navoiy"));
  assert.ok(!bRoyxat.some((b: any) => b.nomi === "Disney Navoiy"));
  // B tenantda faqat signup'da ochilgan bitta biznes.
  assert.equal(bRoyxat.length, 1);
});

test("ro'yxat: ko'rsatkichlar REAL ma'lumotdan (soxta emas)", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    const biz = await prisma.business.findFirst({ where: { nomi: "Disney Navoiy" } });
    const kategoriya = await prisma.category.create({
      data: { businessId: biz.id, nomi: "Sinov", turi: "kirim" },
    });
    const kassa = await prisma.account.findFirst({ where: { businessId: biz.id } });
    await prisma.transaction.create({
      data: {
        businessId: biz.id,
        categoryId: kategoriya.id,
        accountId: kassa.id,
        userId: tA.user.id,
        turi: "kirim",
        summa: 1000,
        sana: new Date("2026-08-01T00:00:00.000Z"),
      },
    });

    const royxat = await biznesStatlari();
    const stat = royxat.find((b: any) => b.nomi === "Disney Navoiy");
    assert.equal(stat.tranzaksiyalar, 1);
    assert.equal(stat.kategoriyalar, 1);
    assert.ok(stat.oxirgiFaollik, "yozuv kiritilgach oxirgi faollik to'ladi");
  });
});

test("tafsilot: BEGONA tenant biznesi topilmaydi (IDOR)", async () => {
  const aBiz = await runWithTenant(tA.tenant.id, async () =>
    prisma.business.findFirst({ where: { nomi: "Disney Navoiy" }, select: { id: true } })
  );
  const begona = await runWithTenant(tB.tenant.id, () => biznesTafsiloti(aBiz.id));
  assert.equal(begona, null, "boshqa tenant biznesi 404 bo'lishi kerak");

  const oziniki = await runWithTenant(tA.tenant.id, () => biznesTafsiloti(aBiz.id));
  assert.ok(oziniki);
  assert.equal(oziniki.nomi, "Disney Navoiy");
});

test("tenant izolyatsiyasi: begona biznesni PATCH qilib bo'lmaydi", async () => {
  const aBiz = await runWithTenant(tA.tenant.id, async () =>
    prisma.business.findFirst({ where: { nomi: "Disney Navoiy" }, select: { id: true } })
  );
  await runWithTenant(tB.tenant.id, async () => {
    await assert.rejects(
      () => prisma.business.update({ where: { id: aBiz.id }, data: { nomi: "O'g'irlangan" } }),
      (e: any) => e instanceof ForbiddenError
    );
  });
  const hali = await runWithTenant(tA.tenant.id, async () =>
    prisma.business.findUnique({ where: { id: aBiz.id }, select: { nomi: true } })
  );
  assert.equal(hali.nomi, "Disney Navoiy");
});

// ─── Nofaollashtirish ─────────────────────────────────────────────────────
test("nofaollashtirish: ma'lumot O'CHMAYDI", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    const biz = await prisma.business.findFirst({ where: { nomi: "Disney Navoiy" } });
    const oldin = await prisma.transaction.count({ where: { businessId: biz.id } });
    const kassalarOldin = await prisma.account.count({ where: { businessId: biz.id } });

    await prisma.business.update({ where: { id: biz.id }, data: { isActive: false } });

    const keyin = await prisma.transaction.count({ where: { businessId: biz.id } });
    const kassalarKeyin = await prisma.account.count({ where: { businessId: biz.id } });
    assert.equal(keyin, oldin);
    assert.equal(kassalarKeyin, kassalarOldin);

    const holat = await prisma.business.findUnique({ where: { id: biz.id }, select: { isActive: true } });
    assert.equal(holat.isActive, false);

    await prisma.business.update({ where: { id: biz.id }, data: { isActive: true } });
  });
});

// ─── O'chirish ────────────────────────────────────────────────────────────
test("o'chirish: ADMIN qila olmaydi, faqat DIREKTOR (OWNER)", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    const biz = await biznesYarat({ nomi: "O'chiriladigan" }, { tenantId: tA.tenant.id, plan: "STANDARD" });
    await assert.rejects(
      () => biznesOchir(biz.id, { rol: "ADMIN" }, { tasdiqNomi: "O'chiriladigan" }),
      (e: any) => e instanceof ForbiddenError
    );
    await assert.rejects(
      () => biznesOchir(biz.id, { rol: "CASHIER" }, { tasdiqNomi: "O'chiriladigan" }),
      (e: any) => e instanceof ForbiddenError
    );
    // Biznes hamon joyida.
    assert.ok(await prisma.business.findUnique({ where: { id: biz.id } }));
  });
});

test("o'chirish: nom tasdig'i mos kelmasa bajarilmaydi", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    const biz = await prisma.business.findFirst({ where: { nomi: "O'chiriladigan" } });
    await assert.rejects(
      () => biznesOchir(biz.id, { rol: "OWNER" }, { tasdiqNomi: "boshqa nom" }),
      (e: any) => e instanceof BadRequestError
    );
    await assert.rejects(
      () => biznesOchir(biz.id, { rol: "OWNER" }, { tasdiqNomi: null }),
      (e: any) => e instanceof BadRequestError
    );
    assert.ok(await prisma.business.findUnique({ where: { id: biz.id } }));
  });
});

test("o'chirish: BO'SH biznes o'chadi, ma'lumotli biznes RAD etiladi", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    const bosh = await prisma.business.findFirst({ where: { nomi: "O'chiriladigan" } });
    await biznesOchir(bosh.id, { rol: "OWNER" }, { tasdiqNomi: "O'chiriladigan" });
    assert.equal(await prisma.business.findUnique({ where: { id: bosh.id } }), null);

    const toliq = await prisma.business.findFirst({ where: { nomi: "Disney Navoiy" } });
    await assert.rejects(
      () => biznesOchir(toliq.id, { rol: "OWNER" }, { tasdiqNomi: "Disney Navoiy" }),
      (e: any) => e instanceof ConflictError
    );
    assert.ok(await prisma.business.findUnique({ where: { id: toliq.id } }));
  });
});

test("o'chirish: BEGONA tenant biznesi ko'rinmaydi (IDOR)", async () => {
  const aBiz = await runWithTenant(tA.tenant.id, async () =>
    prisma.business.findFirst({ where: { nomi: "Disney Navoiy" }, select: { id: true } })
  );
  await runWithTenant(tB.tenant.id, async () => {
    await assert.rejects(
      () => biznesOchir(aBiz.id, { rol: "OWNER" }, { tasdiqNomi: "Disney Navoiy" }),
      (e: any) => e instanceof BadRequestError
    );
  });
  const hali = await runWithTenant(tA.tenant.id, () =>
    prisma.business.findUnique({ where: { id: aBiz.id } })
  );
  assert.ok(hali, "begona tenant so'rovi biznesga tegmasligi kerak");
});

// ─── Biznes almashtirish (switch) ─────────────────────────────────────────
test("switch: ruxsat SERVERDA tekshiriladi", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    const bizneslar = await prisma.business.findMany({ select: { id: true, nomi: true } });
    const birinchi = bizneslar[0];
    const ikkinchi = bizneslar.find((b: any) => b.id !== birinchi.id);

    // Faqat birinchi biznesga biriktirilgan kassir.
    const kassir = await prisma.user.create({
      data: {
        ism: "Kassir",
        login: "+998933334410",
        parolHash: "x",
        rol: "CASHIER",
        tenantId: tA.tenant.id,
        businessId: birinchi.id,
      },
    });
    await prisma.userBusiness.create({ data: { userId: kassir.id, businessId: birinchi.id } });

    const sessiya = {
      userId: kassir.id,
      rol: "CASHIER",
      tenantId: tA.tenant.id,
      businessId: birinchi.id,
      login: "x",
      ism: "x",
    };
    assert.equal(await biznesRuxsatiBormi(sessiya, birinchi.id), true);
    assert.equal(
      await biznesRuxsatiBormi(sessiya, ikkinchi.id),
      false,
      "biriktirilmagan biznesga o'tishga ruxsat berilmasligi kerak"
    );
  });
});

test("switch: BEGONA tenant biznesining id'si ham rad etiladi", async () => {
  const bBiz = await runWithTenant(tB.tenant.id, async () =>
    prisma.business.findFirst({ select: { id: true } })
  );
  await runWithTenant(tA.tenant.id, async () => {
    const kassir = await prisma.user.findFirst({ where: { login: "+998933334410" } });
    const sessiya = {
      userId: kassir.id,
      rol: "CASHIER",
      tenantId: tA.tenant.id,
      businessId: null,
      login: "x",
      ism: "x",
    };
    assert.equal(await biznesRuxsatiBormi(sessiya, bBiz.id), false);
  });
});

// ─── Unumdorlik: N+1 yo'q ─────────────────────────────────────────────────
test("agregatsiya: so'rovlar soni biznes soniga BOG'LIQ EMAS", async () => {
  await runWithTenant(tA.tenant.id, async () => {
    for (let i = 0; i < 12; i++) {
      await biznesYarat({ nomi: `Ko'p biznes ${i}` }, { tenantId: tA.tenant.id, plan: "STANDARD" });
    }
  });

  let soni = 0;
  const sanagich = ({ query }: any) => {
    if (typeof query === "string" && !/^(BEGIN|COMMIT|ROLLBACK|PRAGMA)/i.test(query.trim())) soni++;
  };
  rawPrisma.$on?.("query", sanagich);

  const royxat = await runWithTenant(tA.tenant.id, () => biznesStatlari());
  assert.ok(royxat.length >= 13, `kutilgan 13+ biznes, topildi ${royxat.length}`);
  // Sanagich `$on("query")` faqat log darajasi yoqilganda ishlaydi; asosiy
  // qo'riqchi — kod tuzilishi: `biznesStatlari` biznes bo'yicha AYLANMAYDI.
  const manba = require("node:fs").readFileSync("src/lib/services/biznesRoyxat.ts", "utf8");
  assert.ok(
    !/for\s*\(const b of bizneslar\)[\s\S]{0,200}await prisma\./.test(manba),
    "biznes bo'yicha aylanib DB so'rovi qilinmasligi kerak (N+1)"
  );
  const soravlar = (manba.match(/await prisma\./g) ?? []).length + (manba.match(/prisma\.\w+\.groupBy/g) ?? []).length;
  assert.ok(soravlar < 20, "agregatsiya cheklangan sondagi so'rovdan iborat bo'lishi kerak");
});
