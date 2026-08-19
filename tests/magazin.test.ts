/**
 * MAGAZIN (POS / QR / Barcode) MODULI.
 *
 * Bu modul mavjud bizneslarga MAJBURAN qo'shilmasligi kerak edi — shu bois
 * testlarning yarmi "yopiq holat" ni qo'riqlaydi: modul yoqilmagan tenantda
 * guard 403 berishi, mavjud bizneslarda bayroq false qolishi, modul
 * o'chirilganda ma'lumot yo'qolmasligi.
 *
 * Qolgan yarmi kassaning o'zi: skanerlash, savat, atomik chek sotuvi,
 * qoldiq poygasi (ikki kassir bir donani sotmoqchi) va chekni qaytarish.
 *
 * Ishga tushirish: npm run test:magazin
 */
process.env.DATABASE_URL = "file:./prisma/test-magazin.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let prisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let pos: any;
let mahsulotKod: any;
let registry: any;
let guard: any;
let kod: any;
let code128: any;
let ForbiddenError: any;
let BadRequestError: any;

/** Do'kon (MAGAZIN yoqiladigan) va do'kon bo'lmagan (SMM agentligi) tenantlar. */
let dokon: any;
let agency: any;

/**
 * Tenant kontekstida bajarish. Qaytish turi ATAYLAB `any`: bu fayldagi
 * modullar dinamik `import()` bilan olinadi va `any` turida, shu bois
 * generik `<T>` `unknown` ga tushib qolardi va har chaqiruvda qo'lda
 * annotatsiya talab qilardi (boshqa test fayllaridagi uslub bilan bir xil).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function D(fn: () => unknown): Promise<any> {
  return runWithTenant(dokon.tenant.id, fn, { userId: dokon.user.id, ism: "Kassir" });
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function A(fn: () => unknown): Promise<any> {
  return runWithTenant(agency.tenant.id, fn, { userId: agency.user.id, ism: "Direktor" });
}

function fakeCtx(tenant: any, rol: string) {
  return { session: { rol }, tenantId: tenant.id, tenant: { ...tenant }, access: { mode: "FULL" } };
}

/** Test uchun mahsulot yaratadi (do'kon biznesida). */
async function mahsulot(nomi: string, sotuvNarx: number, miqdor: number, barcode?: string) {
  return D(() =>
    prisma.product.create({
      data: {
        businessId: dokon.business.id,
        nomi,
        kelganNarx: Math.round(sotuvNarx * 0.7),
        sotuvNarx,
        miqdor,
        barcode: barcode ?? null,
      },
    })
  );
}

/** Chek sotish — har doim tenant konteksti ichida. */
function sot(params: Record<string, unknown>) {
  return D(() => pos.posSotuv({ businessId: dokon.business.id, userId: dokon.user.id, ...params }));
}

/** Chekni qaytarish — har doim tenant konteksti ichida. */
function qaytar(chekId: string, sabab: string) {
  return D(() =>
    pos.posChekBekor({ businessId: dokon.business.id, chekId, sabab, userId: dokon.user.id })
  );
}

before(async () => {
  rmSync("prisma/test-magazin.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ prisma } = await import("@/lib/prisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  pos = await import("@/lib/services/pos");
  mahsulotKod = await import("@/lib/services/mahsulotKod");
  registry = await import("@/lib/modules/registry");
  guard = await import("@/lib/modules/guard");
  kod = await import("@/lib/magazin/kod");
  code128 = await import("@/lib/magazin/code128");
  ({ ForbiddenError, BadRequestError } = await import("@/lib/auth/guard"));

  dokon = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy",
    ism: "Egasi",
    login: "+998944444401",
    parol: "parol12345",
  });
  agency = await createTenantWithOwner({
    kompaniyaNomi: "SMM Agency",
    ism: "Egasi",
    login: "+998944444402",
    parol: "parol12345",
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// =========================================================================
// MODUL: yoqish, o'chirish, mavjud bizneslar
// =========================================================================

test("1. Yangi tenantda MAGAZIN yoqilmagan (mavjud bizneslar bilan bir xil holat)", async () => {
  const yoqilgan = await D(() => guard.getEnabledModules(fakeCtx(dokon.tenant, "OWNER")));
  assert.ok(!yoqilgan.has("MAGAZIN"));
  assert.ok(!yoqilgan.has("OMBOR"));
});

test("2. Mavjud biznesda `magazin` va `omborli` bayroqlari false", async () => {
  const b = await rawPrisma.business.findUnique({ where: { id: dokon.business.id } });
  assert.equal(b.magazin, false);
  assert.equal(b.omborli, false);
  const a = await rawPrisma.business.findUnique({ where: { id: agency.business.id } });
  assert.equal(a.magazin, false);
});

test("3. MAGAZIN yoqilgan bo'lsa ham, OMBOR yopiq bo'lsa hisobga olinmaydi", async () => {
  await D(() => prisma.tenantModule.create({ data: { code: "MAGAZIN", isActive: true } }));
  const yoqilgan = await D(() => guard.getEnabledModules(fakeCtx(dokon.tenant, "OWNER")));
  assert.ok(!yoqilgan.has("MAGAZIN"), "OMBORsiz MAGAZIN ochilmasligi kerak");
});

test("4. Egasi OMBOR + MAGAZIN'ni yoqsa modul ochiladi", async () => {
  await D(() => prisma.tenantModule.create({ data: { code: "OMBOR", isActive: true } }));
  await rawPrisma.business.update({
    where: { id: dokon.business.id },
    data: { omborli: true, magazin: true },
  });
  const yoqilgan = await D(() => guard.getEnabledModules(fakeCtx(dokon.tenant, "OWNER")));
  assert.ok(yoqilgan.has("MAGAZIN"));
  await D(() => guard.requireModule(fakeCtx(dokon.tenant, "CASHIER"), "MAGAZIN"));
});

test("5. Superadmin modulni yoqa oladi (tenant kontekstisiz)", async () => {
  const { modulniOzgartir, tenantModulHolati } = await import("@/lib/superadmin/modullar");
  await modulniOzgartir(agency.tenant.id, "OMBOR", true);
  const holat = await tenantModulHolati(agency.tenant.id);
  assert.equal(holat.find((m) => m.code === "OMBOR")?.yoqilgan, true);
  assert.equal(holat.find((m) => m.code === "MAGAZIN")?.yoqilgan, false);
});

test("6. Superadmin modulni o'chira oladi", async () => {
  const { modulniOzgartir, tenantModulHolati } = await import("@/lib/superadmin/modullar");
  await modulniOzgartir(agency.tenant.id, "OMBOR", false);
  const holat = await tenantModulHolati(agency.tenant.id);
  assert.equal(holat.find((m) => m.code === "OMBOR")?.yoqilgan, false);
});

test("7. Modulni o'chirish MA'LUMOTNI o'chirmaydi", async () => {
  const { modulniOzgartir } = await import("@/lib/superadmin/modullar");
  const p = await mahsulot("Coca-Cola 1.5L", 12_000, 20, "4601234567890");
  const chek = await sot({ satrlar: [{ productId: p.id, miqdor: 2 }], tolovTuri: "naqd" });

  await modulniOzgartir(dokon.tenant.id, "MAGAZIN", false);

  // Modul o'chgan — lekin chek, sotuv satrlari va qoldiq joyida.
  const saqlangan = await rawPrisma.posChek.findUnique({ where: { id: chek.id } });
  assert.ok(saqlangan, "chek o'chib ketmasligi kerak");
  assert.equal(await rawPrisma.sale.count({ where: { chekId: chek.id } }), 1);
  const mahs = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(mahs.miqdor, 18);

  // Qayta yoqilganda hammasi ko'rinadi.
  await modulniOzgartir(dokon.tenant.id, "MAGAZIN", true);
  const yoqilgan = await D(() => guard.getEnabledModules(fakeCtx(dokon.tenant, "OWNER")));
  assert.ok(yoqilgan.has("MAGAZIN"));
});

// =========================================================================
// XAVFSIZLIK: modul guard, tenant va rol izolyatsiyasi
// =========================================================================

test("8. MAGAZIN yopiq tenantda requireModule 403 (MODULE_NOT_ENABLED)", async () => {
  await assert.rejects(
    async () => A(() => guard.requireModule(fakeCtx(agency.tenant, "OWNER"), "MAGAZIN")),
    (e: any) => e instanceof ForbiddenError && e.code === guard.MODULE_NOT_ENABLED
  );
});

test("9. Tenant izolyatsiyasi: boshqa kompaniyaning barcode'i topilmaydi", async () => {
  // SMM agentligida ham AYNAN SHU barcode bilan mahsulot bo'lsin.
  await rawPrisma.business.update({
    where: { id: agency.business.id },
    data: { omborli: true, magazin: true },
  });
  const agencyProduct = await A(() =>
    prisma.product.create({
      data: {
        businessId: agency.business.id,
        nomi: "Agency Coca-Cola",
        sotuvNarx: 99_000,
        miqdor: 5,
        barcode: "4601234567890",
      },
    })
  );

  // Do'konda qidirilganda O'ZINING mahsuloti qaytadi.
  const dokonda = await D(() =>
    mahsulotKod.kodBoyichaMahsulot(dokon.business.id, "4601234567890")
  );
  assert.equal(dokonda.nomi, "Coca-Cola 1.5L");
  assert.notEqual(dokonda.id, agencyProduct.id);

  // Agentlikda qidirilganda ham faqat o'ziniki.
  const agentlikda = await A(() =>
    mahsulotKod.kodBoyichaMahsulot(agency.business.id, "4601234567890")
  );
  assert.equal(agentlikda.nomi, "Agency Coca-Cola");

  // Bir xil barcode ikki tenantda YASHASHI MUMKIN — unique faqat biznes ichida.
  assert.equal(await rawPrisma.product.count({ where: { barcode: "4601234567890" } }), 2);
});

test("10. Rol izolyatsiyasi: SELLER uchun MAGAZIN yopiq", async () => {
  await assert.rejects(
    async () => D(() => guard.requireModule(fakeCtx(dokon.tenant, "SELLER"), "MAGAZIN")),
    ForbiddenError
  );
  const items = registry.computeNav({
    rol: "SELLER",
    yoqilgan: new Set(["MOLIYA", "OMBOR", "MAGAZIN"]),
    omborli: true,
    magazin: true,
  });
  assert.ok(!items.some((i: any) => i.href.startsWith("/app/pos")));
});

test("11. Nav: magazin bayrog'i qo'yilmagan biznesda kassa ko'rinmaydi", async () => {
  const yoq = registry.computeNav({
    rol: "CASHIER",
    yoqilgan: new Set(["MOLIYA", "OMBOR", "MAGAZIN"]),
    omborli: true,
    magazin: false,
  });
  assert.ok(!yoq.some((i: any) => i.href === "/app/pos"));

  const bor = registry.computeNav({
    rol: "CASHIER",
    yoqilgan: new Set(["MOLIYA", "OMBOR", "MAGAZIN"]),
    omborli: true,
    magazin: true,
  });
  assert.ok(bor.some((i: any) => i.href === "/app/pos"));

  // Mavjud (magazinsiz) mijozlar menyusi ZARRACHA o'zgarmasligi kerak.
  const eski = registry.computeNav({
    rol: "CASHIER",
    yoqilgan: new Set(["MOLIYA", "OMBOR"]),
    omborli: true,
  });
  assert.ok(!eski.some((i: any) => i.href.startsWith("/app/pos")));
});

// =========================================================================
// POS: kod qidirish
// =========================================================================

test("12. Barcode bo'yicha qidirish", async () => {
  const topildi = await D(() =>
    mahsulotKod.kodBoyichaMahsulot(dokon.business.id, "4601234567890")
  );
  assert.equal(topildi.manba, "barcode");
  assert.equal(topildi.nomi, "Coca-Cola 1.5L");

  const yoq = await D(() => mahsulotKod.kodBoyichaMahsulot(dokon.business.id, "0000000000000"));
  assert.equal(yoq, null);
});

test("13. Balansa QR: yaratish, barqarorlik va qidirish", async () => {
  const p = await mahsulot("Uyda pishirilgan non", 5_000, 30);
  const yaratildi = await D(() =>
    mahsulotKod.qrKodYarat({ businessId: dokon.business.id, productId: p.id })
  );
  assert.ok(kod.balansaQrMi(yaratildi.qrKod));
  assert.equal(yaratildi.yangi, true);

  // Idempotent: ikkinchi chaqiruv AYNAN SHU kalitni qaytaradi (stiker amal qiladi).
  const ikkinchi = await D(() =>
    mahsulotKod.qrKodYarat({ businessId: dokon.business.id, productId: p.id })
  );
  assert.equal(ikkinchi.qrKod, yaratildi.qrKod);
  assert.equal(ikkinchi.yangi, false);

  // Narx o'zgarsa QR O'ZGARMAYDI — narx QR ichida emas.
  await D(() => prisma.product.update({ where: { id: p.id }, data: { sotuvNarx: 6_000 } }));
  const keyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(keyin.qrKod, yaratildi.qrKod);

  const topildi = await D(() =>
    mahsulotKod.kodBoyichaMahsulot(dokon.business.id, yaratildi.qrKod)
  );
  assert.equal(topildi.manba, "qr");
  assert.equal(topildi.id, p.id);
});

test("14. Skaner/kamera chiqishi normallashtiriladi (Enter, bo'shliq, registr)", async () => {
  // HID skaner oxiriga \r\n qo'shadi, kamera esa bo'shliq qoldirishi mumkin.
  const topildi = await D(() =>
    mahsulotKod.kodBoyichaMahsulot(dokon.business.id, "  4601234567890\r\n")
  );
  assert.equal(topildi.nomi, "Coca-Cola 1.5L");

  const p = await D(() => prisma.product.findFirst({ where: { nomi: "Uyda pishirilgan non" } }));
  const kichikHarf = await D(() =>
    mahsulotKod.kodBoyichaMahsulot(dokon.business.id, p.qrKod.toLowerCase())
  );
  assert.equal(kichikHarf.id, p.id, "Balansa QR registrsiz solishtirilishi kerak");
});

test("15. Shtrix-kod chizilishi (Code 128-B): modul soni va nazorat yig'indisi", () => {
  const r = code128.code128Modullar("4601234567890");
  // start + 13 belgi + checksum = 15 naqsh × 11 modul + 13 (stop naqshi).
  assert.equal(r.moduller.length, 11 * 15 + 13);
  assert.equal(r.checksum, 39);
  assert.ok(code128.barcodeSvg("4601234567890").startsWith("<svg"));
  assert.ok(kod.qrSvg("BALANSA-PRODUCT-8F92KX21").includes("<rect"));
});

// =========================================================================
// POS: savat va chek sotuvi
// =========================================================================

test("16. Bir mahsulot ikki marta skanerlansa miqdor birlashadi (yangi satr emas)", async () => {
  const p = await mahsulot("Cheese Burger", 25_000, 10);
  const chek = await sot({
    // Kassir uch marta skanerladi.
    satrlar: [
      { productId: p.id, miqdor: 1 },
      { productId: p.id, miqdor: 1 },
      { productId: p.id, miqdor: 1 },
    ],
    tolovTuri: "naqd",
  });
  assert.equal(chek.satrlar.length, 1, "bitta mahsulot — bitta satr");
  assert.equal(chek.satrlar[0].miqdor, 3);
  assert.equal(chek.jamiSumma, 75_000);
});

test("17. Chek to'g'ri yaratiladi: satrlar, tannarx snapshot, ketma-ket raqam", async () => {
  const a = await mahsulot("Choy Lipton", 15_000, 50);
  const b = await mahsulot("Shokolad Snickers", 8_000, 40);
  const chek = await sot({
    satrlar: [
      { productId: a.id, miqdor: 2 },
      { productId: b.id, miqdor: 3 },
    ],
    tolovTuri: "naqd",
  });
  assert.equal(chek.jamiSumma, 2 * 15_000 + 3 * 8_000);

  const satrlar = await rawPrisma.sale.findMany({ where: { chekId: chek.id } });
  assert.equal(satrlar.length, 2);
  // Marja hisobi uchun tannarx muzlatiladi.
  const choy = satrlar.find((s: any) => s.productId === a.id);
  assert.equal(choy.tannarx, a.kelganNarx);
  // Pul yozuvi CHEKDA, satrda emas (bitta xarid — bitta kirim).
  assert.ok(satrlar.every((s: any) => s.transactionId === null));

  const hammasi = await rawPrisma.posChek.findMany({
    where: { businessId: dokon.business.id },
    orderBy: { raqam: "asc" },
  });
  assert.deepEqual(
    hammasi.map((c: any) => c.raqam),
    hammasi.map((_: any, i: number) => i + 1),
    "chek raqamlari biznes ichida ketma-ket bo'lishi kerak"
  );
});

test("18. Sotuvdan keyin ombor qoldig'i kamayadi", async () => {
  const p = await mahsulot("Suv Hydrolife 1L", 4_000, 100);
  await sot({ satrlar: [{ productId: p.id, miqdor: 7 }], tolovTuri: "karta" });
  const keyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(keyin.miqdor, 93);
});

test("19. Naqd/karta/Click — BITTA kirim tranzaksiya yoziladi", async () => {
  const p = await mahsulot("Pechenye", 6_000, 30);
  const chek = await sot({
    satrlar: [
      { productId: p.id, miqdor: 2 },
      { productId: p.id, miqdor: 1 },
    ],
    tolovTuri: "click",
  });

  const saqlangan = await rawPrisma.posChek.findUnique({ where: { id: chek.id } });
  assert.ok(saqlangan.transactionId, "chekka tranzaksiya bog'lanishi kerak");
  const txn = await rawPrisma.transaction.findUnique({ where: { id: saqlangan.transactionId } });
  assert.equal(txn.turi, "kirim");
  assert.equal(txn.summa, 18_000);
  // "karta" va "click" — naqdsiz pul, tranzaksiya darajasida ikkalasi "click".
  assert.equal(txn.tolovTuri, "click");
  assert.ok(txn.accountId, "pul kassaga bog'lanishi kerak");
});

test("20. Qarzga chek — qarzdorlik yoziladi, daromad YOZILMAYDI", async () => {
  const p = await mahsulot("Guruch 1kg", 14_000, 60);
  const oldingiKirim = await rawPrisma.transaction.count({
    where: { businessId: dokon.business.id, turi: "kirim" },
  });

  const chek = await sot({
    satrlar: [{ productId: p.id, miqdor: 5 }],
    tolovTuri: "qarz",
    mijozNomi: "Alisher aka",
    mijozTel: "+998901234567",
  });

  const saqlangan = await rawPrisma.posChek.findUnique({ where: { id: chek.id } });
  assert.equal(saqlangan.transactionId, null, "qarzda kirim yozilmaydi");
  assert.ok(saqlangan.debtId);
  const debt = await rawPrisma.debt.findUnique({ where: { id: saqlangan.debtId } });
  assert.equal(debt.jamiSumma, 70_000);
  assert.equal(debt.turi, "olinadigan");
  assert.equal(debt.mijozNomi, "Alisher aka");

  const keyingiKirim = await rawPrisma.transaction.count({
    where: { businessId: dokon.business.id, turi: "kirim" },
  });
  assert.equal(keyingiKirim, oldingiKirim, "qarz kirim tranzaksiyasini yaratmasligi kerak");

  // Mijoz ismisiz qarz — rad etiladi.
  await assert.rejects(
    async () => sot({ satrlar: [{ productId: p.id, miqdor: 1 }], tolovTuri: "qarz" }),
    BadRequestError
  );
});

test("21. Tranzaksiya ORQAGA QAYTADI: bitta satr o'tmasa butun chek bekor", async () => {
  const yetarli = await mahsulot("Yog' Oleyna", 30_000, 10);
  const kam = await mahsulot("Tuxum (oxirgi)", 1_500, 2);

  const chekOldin = await rawPrisma.posChek.count({ where: { businessId: dokon.business.id } });
  const txOldin = await rawPrisma.transaction.count({ where: { businessId: dokon.business.id } });

  await assert.rejects(
    async () =>
      sot({
        satrlar: [
          { productId: yetarli.id, miqdor: 3 },
          { productId: kam.id, miqdor: 5 }, // omborda 2 ta bor
        ],
        tolovTuri: "naqd",
      }),
    BadRequestError
  );

  // Birinchi satr qoldig'i ham QAYTGAN bo'lishi kerak.
  const y = await rawPrisma.product.findUnique({ where: { id: yetarli.id } });
  assert.equal(y.miqdor, 10, "yarim bajarilgan sotuv qolmasligi kerak");
  const k = await rawPrisma.product.findUnique({ where: { id: kam.id } });
  assert.equal(k.miqdor, 2);
  assert.equal(
    await rawPrisma.posChek.count({ where: { businessId: dokon.business.id } }),
    chekOldin
  );
  assert.equal(
    await rawPrisma.transaction.count({ where: { businessId: dokon.business.id } }),
    txOldin
  );
});

test("22. Qoldiq poygasi: 1 dona, ikki kassir — faqat bittasi o'tadi", async () => {
  const p = await mahsulot("Oxirgi bitta tort", 120_000, 1);

  const natijalar = await Promise.allSettled([
    sot({ satrlar: [{ productId: p.id, miqdor: 1 }], tolovTuri: "naqd" }),
    sot({ satrlar: [{ productId: p.id, miqdor: 1 }], tolovTuri: "naqd" }),
  ]);

  const otgan = natijalar.filter((r) => r.status === "fulfilled").length;
  assert.equal(otgan, 1, "manfiy qoldiq bo'lmasligi kerak — faqat bittasi o'tadi");

  const keyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(keyin.miqdor, 0);
});

// =========================================================================
// QAYTARISH
// =========================================================================

test("23. Chekni qaytarish: qoldiq qaytadi, pul chiqadi, tarix qoladi", async () => {
  const p = await mahsulot("Konfet Roshen", 22_000, 25);
  const chek = await sot({ satrlar: [{ productId: p.id, miqdor: 4 }], tolovTuri: "naqd" });
  const saqlangan = await rawPrisma.posChek.findUnique({ where: { id: chek.id } });

  await qaytar(chek.id, "Xaridor qaytardi");

  // Qoldiq qaytdi.
  const keyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(keyin.miqdor, 25);
  // Kirim tranzaksiya yumshoq o'chirildi (kassadagi pul qaytdi).
  const txn = await rawPrisma.transaction.findUnique({ where: { id: saqlangan.transactionId } });
  assert.ok(txn.deletedAt, "kirim tranzaksiya bekor qilinishi kerak");
  // Chek va satrlar TARIXDA qoladi — butunlay o'chmaydi.
  const bekor = await rawPrisma.posChek.findUnique({ where: { id: chek.id } });
  assert.ok(bekor.deletedAt);
  assert.equal(bekor.cancelReason, "Xaridor qaytardi");
  const satrlar = await rawPrisma.sale.findMany({ where: { chekId: chek.id } });
  assert.equal(satrlar.length, 1);
  assert.ok(satrlar[0].deletedAt);

  // Ikkinchi marta qaytarib bo'lmaydi.
  await assert.rejects(async () => qaytar(chek.id, "yana bir marta"), BadRequestError);
});

test("24. Qarz cheki qaytarilsa qarz ham o'chadi; to'lovi bo'lsa — rad etiladi", async () => {
  const p = await mahsulot("Un 50kg", 350_000, 8);
  const chek = await sot({
    satrlar: [{ productId: p.id, miqdor: 1 }],
    tolovTuri: "qarz",
    mijozNomi: "Bekzod",
  });
  const saqlangan = await rawPrisma.posChek.findUnique({ where: { id: chek.id } });

  // To'lov qilingan qarzli chek qaytarilmaydi.
  await rawPrisma.debt.update({ where: { id: saqlangan.debtId }, data: { tolangan: 100_000 } });
  await assert.rejects(async () => qaytar(chek.id, "test"), BadRequestError);

  // To'lov bekor qilingach — qaytarish o'tadi va qarz o'chadi.
  await rawPrisma.debt.update({ where: { id: saqlangan.debtId }, data: { tolangan: 0 } });
  await qaytar(chek.id, "Xaridor olmadi");
  const qarz = await rawPrisma.debt.findUnique({ where: { id: saqlangan.debtId } });
  assert.equal(qarz, null, "qaytarilgan qarz cheki qarzdorlikni ham olib tashlashi kerak");
  const keyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(keyin.miqdor, 8);
});

// =========================================================================
// KATALOG VA NARX
// =========================================================================

test("25. Kelishilgan narx katalogga QAYTA YOZILMAYDI (H-1 qoidasi)", async () => {
  const p = await mahsulot("Katalog narxli tovar", 10_000, 100);
  await sot({ satrlar: [{ productId: p.id, miqdor: 1, narx: 7_000 }], tolovTuri: "naqd" });

  const keyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(keyin.sotuvNarx, 10_000, "bitta chegirma butun katalog narxini o'zgartirmasin");

  const satr = await rawPrisma.sale.findFirst({
    where: { productId: p.id },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(satr.birlikNarx, 7_000, "chekda esa haqiqiy narx qolishi kerak");
});

test("26. Barcode biznes ichida takrorlanmaydi", async () => {
  const p = await mahsulot("Ikkinchi kola", 12_000, 5);
  await assert.rejects(
    async () =>
      D(() =>
        mahsulotKod.barcodeBiriktir({
          businessId: dokon.business.id,
          productId: p.id,
          barcode: "4601234567890", // Coca-Cola'da bor
        })
      ),
    BadRequestError
  );
  // Bo'sh qiymat — kodni olib tashlaydi.
  await D(() =>
    mahsulotKod.barcodeBiriktir({ businessId: dokon.business.id, productId: p.id, barcode: null })
  );
  const keyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
  assert.equal(keyin.barcode, null);
});

// =========================================================================
// IDOR va izolyatsiya
// =========================================================================

test("27. Boshqa biznesning mahsuloti bilan ishlab bo'lmaydi (IDOR)", async () => {
  const agencyProduct = await rawPrisma.product.findFirst({
    where: { businessId: agency.business.id },
  });
  await assert.rejects(
    async () =>
      D(() =>
        mahsulotKod.qrKodYarat({ businessId: dokon.business.id, productId: agencyProduct.id })
      ),
    ForbiddenError
  );
  await assert.rejects(
    async () => sot({ satrlar: [{ productId: agencyProduct.id, miqdor: 1 }], tolovTuri: "naqd" }),
    ForbiddenError
  );
});

test("28. PosChek boshqa tenantga ko'rinmaydi", async () => {
  const dokonCheklar = await D(() => prisma.posChek.count());
  assert.ok(dokonCheklar > 0);
  const agencyCheklar = await A(() => prisma.posChek.count());
  assert.equal(agencyCheklar, 0);
});

// =========================================================================
// MA'LUMOT YAXLITLIGI (invariant zanjiri)
// =========================================================================

test("29. INVARIANT ZANJIRI: chek -> satr -> to'lov -> qoldiq -> moliya", async () => {
  // Bitta sotuvda TO'LIQ zanjir tekshiriladi. Har bo'g'in alohida testlarda
  // ham bor, lekin ular alohida — zanjirning O'RTASIDA uzilib qolishi
  // (masalan chek bor, satr yo'q) faqat shu yerda ushlanadi.
  const a = await mahsulot("Zanjir A", 20_000, 30);
  const b = await mahsulot("Zanjir B", 7_000, 30);

  const oldingiKirim = await rawPrisma.transaction.count({
    where: { businessId: dokon.business.id, turi: "kirim", deletedAt: null },
  });

  const chek = await sot({
    satrlar: [
      { productId: a.id, miqdor: 2 },
      { productId: b.id, miqdor: 5 },
    ],
    tolovTuri: "naqd",
  });

  // 1. Chek yaratildi.
  const saqlangan = await rawPrisma.posChek.findUnique({ where: { id: chek.id } });
  assert.ok(saqlangan, "chek yaratilishi kerak");
  assert.equal(saqlangan.jamiSumma, 2 * 20_000 + 5 * 7_000);

  // 2. Har satr Sale yozuvi va chekka BOG'LANGAN.
  const satrlar = await rawPrisma.sale.findMany({ where: { chekId: chek.id } });
  assert.equal(satrlar.length, 2);
  assert.ok(satrlar.every((s: { chekId: string | null }) => s.chekId === chek.id));
  // Satrlar jami chek summasiga TENG — pul va tovar mos.
  assert.equal(
    satrlar.reduce((x: number, s: { jamiSumma: number }) => x + s.jamiSumma, 0),
    saqlangan.jamiSumma
  );

  // 3. To'lov to'g'ri qayd etildi (naqd -> BITTA kirim tranzaksiya).
  assert.ok(saqlangan.transactionId);
  const txn = await rawPrisma.transaction.findUnique({ where: { id: saqlangan.transactionId } });
  assert.equal(txn.turi, "kirim");
  assert.equal(txn.summa, saqlangan.jamiSumma);
  assert.equal(txn.deletedAt, null);

  // 4. Qoldiq kamaydi (har satr bo'yicha aniq).
  assert.equal((await rawPrisma.product.findUnique({ where: { id: a.id } })).miqdor, 28);
  assert.equal((await rawPrisma.product.findUnique({ where: { id: b.id } })).miqdor, 25);

  // 5. Moliyada ANIQ BITTA yangi kirim (satr soniga qarab ko'paymagan).
  const keyingiKirim = await rawPrisma.transaction.count({
    where: { businessId: dokon.business.id, turi: "kirim", deletedAt: null },
  });
  assert.equal(keyingiKirim, oldingiKirim + 1, "ikki satrli chek bitta kirim yozishi kerak");

  // 6. Qarz emas — qarzdorlik YARATILMAGAN.
  assert.equal(saqlangan.debtId, null);
});

test("30. YARIM YOZUV QOLMAYDI: xato bo'lsa zanjirning HAR bo'g'ini orqaga qaytadi", async () => {
  const yaxshi = await mahsulot("Rollback A", 10_000, 20);
  const kam = await mahsulot("Rollback B", 10_000, 1);

  const oldin = {
    chek: await rawPrisma.posChek.count({ where: { businessId: dokon.business.id } }),
    sale: await rawPrisma.sale.count({ where: { businessId: dokon.business.id } }),
    txn: await rawPrisma.transaction.count({ where: { businessId: dokon.business.id } }),
    debt: await rawPrisma.debt.count({ where: { businessId: dokon.business.id } }),
  };

  await assert.rejects(
    async () =>
      sot({
        satrlar: [
          { productId: yaxshi.id, miqdor: 5 },
          { productId: kam.id, miqdor: 10 }, // omborda 1 ta
        ],
        tolovTuri: "qarz",
        mijozNomi: "Rollback mijoz",
      }),
    BadRequestError
  );

  assert.equal(
    await rawPrisma.posChek.count({ where: { businessId: dokon.business.id } }),
    oldin.chek
  );
  assert.equal(await rawPrisma.sale.count({ where: { businessId: dokon.business.id } }), oldin.sale);
  assert.equal(
    await rawPrisma.transaction.count({ where: { businessId: dokon.business.id } }),
    oldin.txn
  );
  assert.equal(await rawPrisma.debt.count({ where: { businessId: dokon.business.id } }), oldin.debt);
  // Birinchi satr qoldig'i ham tegilmagan.
  assert.equal((await rawPrisma.product.findUnique({ where: { id: yaxshi.id } })).miqdor, 20);
});

// =========================================================================
// XAVFSIZLIK REGRESSIYASI (qolgan nuqtalar)
// =========================================================================

test("31. ProductCategory biznes/tenant doirasida qamalgan", async () => {
  await D(() =>
    prisma.productCategory.create({
      data: { businessId: dokon.business.id, nomi: "Ichimliklar" },
    })
  );
  const dokonda = await D(() => prisma.productCategory.count());
  assert.ok(dokonda > 0);

  // Boshqa tenant uni KO'RMAYDI.
  const agentlikda = await A(() => prisma.productCategory.count());
  assert.equal(agentlikda, 0, "mahsulot kategoriyasi boshqa tenantga ko'rinmasligi kerak");

  // Nom biznes ichida takrorlanmaydi (kategoriya ikkilanib ketmasin).
  await assert.rejects(async () =>
    D(() =>
      prisma.productCategory.create({
        data: { businessId: dokon.business.id, nomi: "Ichimliklar" },
      })
    )
  );
});

test("32. Superadmin: tarifda yo'q modulni yoqa OLMAYDI", async () => {
  const { modulniOzgartir } = await import("@/lib/superadmin/modullar");
  // STANDARD tarifida CRM yo'q (lib/billing/plans.ts).
  await assert.rejects(
    async () => modulniOzgartir(agency.tenant.id, "CRM", true),
    (e: Error) => /tarifida mavjud emas/.test(e.message)
  );
  // Bazaga ham yozilmagan.
  const row = await rawPrisma.tenantModule.findFirst({
    where: { tenantId: agency.tenant.id, code: "CRM" },
  });
  assert.equal(row, null);
});

test("33. Superadmin: asosiy (core) modulni o'chira OLMAYDI", async () => {
  const { modulniOzgartir } = await import("@/lib/superadmin/modullar");
  await assert.rejects(
    async () => modulniOzgartir(dokon.tenant.id, "MOLIYA", false),
    (e: Error) => /Asosiy modulni/.test(e.message)
  );
  // Noma'lum modul ham rad etiladi (kod injection'ga qarshi).
  await assert.rejects(
    async () => modulniOzgartir(dokon.tenant.id, "YOQ_MODUL", true),
    (e: Error) => /Noma'lum modul/.test(e.message)
  );
});

test("34. Boshqa tenantning chekini qaytarib bo'lmaydi (IDOR)", async () => {
  // Do'kon chekini agentlik biznesi nomidan bekor qilishga urinish.
  const p = await mahsulot("IDOR tovari", 15_000, 10);
  const chek = await sot({ satrlar: [{ productId: p.id, miqdor: 1 }], tolovTuri: "naqd" });

  await assert.rejects(
    async () =>
      A(() =>
        pos.posChekBekor({
          businessId: agency.business.id,
          chekId: chek.id,
          sabab: "ruxsatsiz urinish",
          userId: agency.user.id,
        })
      ),
    ForbiddenError
  );
  // Chek tegilmagan.
  const keyin = await rawPrisma.posChek.findUnique({ where: { id: chek.id } });
  assert.equal(keyin.deletedAt, null);
});

test("35. Kamera qo'llab-quvvatlanmasa aniq sabab qaytadi (iPhone Safari yo'li)", async () => {
  const { kameraHolati, KAMERASIZ_YORIQNOMA } = await import("@/lib/magazin/kameraQollab");

  // BarcodeDetector yo'q (iOS Safari, Firefox).
  const yoq = kameraHolati({ navigator: { mediaDevices: { getUserMedia: () => {} } } });
  assert.equal(yoq.qollab, false);
  assert.match((yoq as { sabab: string }).sabab, /Safari/);

  // API bor, lekin kameraga kirish yo'q (masalan HTTPS emas).
  const kamerasiz = kameraHolati({ BarcodeDetector: function () {}, navigator: {} });
  assert.equal(kamerasiz.qollab, false);

  // Hammasi joyida.
  const bor = kameraHolati({
    BarcodeDetector: function () {},
    navigator: { mediaDevices: { getUserMedia: () => {} } },
  });
  assert.equal(bor.qollab, true);

  // Yo'riqnoma bo'sh bo'lmasligi kerak — foydalanuvchi nima qilishini bilsin.
  assert.ok(KAMERASIZ_YORIQNOMA.length >= 2);
});

// =========================================================================
// QISMAN QAYTARISH — ARXITEKTURA TAYYORLIGI (hozir IMPLEMENT QILINMAGAN)
// =========================================================================

test("36. Arxitektura qisman qaytarishga TAYYOR (hozir yoqilmagan)", async () => {
  // Qisman qaytarish HOZIR yo'q va bu ataylab. Lekin keyinchalik qo'shish
  // uchun ma'lumot modeli yetarli bo'lishi kerak: har chek satri ALOHIDA
  // yozuv bo'lib, o'z miqdori, narxi, tannarxi va yumshoq o'chirish
  // maydonlari bilan kelishi shart. Agar satrlar chek ichida JSON sifatida
  // saqlanganda, qisman qaytarish uchun butun modelni qayta qurish kerak
  // bo'lardi. Bu test shu xususiyatni QO'RIQLAYDI.
  const a = await mahsulot("Qisman A", 9_000, 10);
  const b = await mahsulot("Qisman B", 4_000, 10);
  const chek = await sot({
    satrlar: [
      { productId: a.id, miqdor: 2 },
      { productId: b.id, miqdor: 3 },
    ],
    tolovTuri: "naqd",
  });

  const satrlar = await rawPrisma.sale.findMany({ where: { chekId: chek.id } });
  assert.equal(satrlar.length, 2, "har satr ALOHIDA yozuv bo'lishi kerak");
  for (const s of satrlar) {
    assert.ok(s.id, "satrning o'z identifikatori bo'lishi kerak");
    assert.ok(s.miqdor > 0, "satrda o'z miqdori bo'lishi kerak");
    assert.ok(s.birlikNarx > 0, "satrda o'z narxi bo'lishi kerak");
    assert.ok("tannarx" in s, "marja hisobi uchun tannarx snapshot bo'lishi kerak");
    assert.ok("deletedAt" in s, "satr alohida yumshoq o'chirilishi mumkin bo'lishi kerak");
  }
  // Chek summasi satrlardan HISOBLANADI — qisman qaytarishda uni qayta
  // hisoblash mumkin (qotirilgan qiymatga tayanmaydi).
  assert.equal(
    satrlar.reduce((x: number, s: { jamiSumma: number }) => x + s.jamiSumma, 0),
    chek.jamiSumma
  );
});

// =========================================================================
// MODUL BOG'LIQLIGI (Superadmin 2.0 bilan birlashtirilgandan keyin)
// =========================================================================

test("37. Bog'liqlik YAGONA manbada: MAGAZIN -> OMBOR", async () => {
  const { talabQiladi, tayanadiganlar } = await import("@/lib/modules/bogliqlik");
  // Ilgari bu bilim ikki joyda edi: registry'dagi `talabQiladi` maydoni va
  // Superadmin 2.0 dagi `MODUL_BOGLIQLIGI`. Ikki manba vaqt o'tib bir-biriga
  // mos kelmay qolardi — endi bitta manba.
  assert.deepEqual(talabQiladi("MAGAZIN"), ["OMBOR"]);
  assert.ok(tayanadiganlar("OMBOR").includes("MAGAZIN"));

  const registry = await import("@/lib/modules/registry");
  const magazin = registry.modulByCode("MAGAZIN");
  assert.ok(magazin && !("talabQiladi" in magazin), "registry'da takroriy maydon qolmasligi kerak");
});

test("38. Superadmin OMBORsiz MAGAZIN'ni yoqa OLMAYDI", async () => {
  const { modulniOzgartir } = await import("@/lib/superadmin/modullar");
  // `agency` da OMBOR o'chirilgan (6-test) — MAGAZIN yoqilmasligi kerak.
  await assert.rejects(
    async () => modulniOzgartir(agency.tenant.id, "MAGAZIN", true),
    (e: Error) => /Ombor|OMBOR|ombor/.test(e.message)
  );
  const row = await rawPrisma.tenantModule.findFirst({
    where: { tenantId: agency.tenant.id, code: "MAGAZIN", isActive: true },
  });
  assert.equal(row, null, "rad etilgan yoqish bazaga yozilmasligi kerak");
});

test("39. MAGAZIN yoqiq bo'lsa OMBOR o'chirilmaydi (jimgina sinmasin)", async () => {
  const { modulniOzgartir } = await import("@/lib/superadmin/modullar");
  // `dokon` da ikkalasi ham yoqiq (4-test). OMBOR o'chirilsa kassa
  // mahsulotsiz qolardi — shuning uchun sabab bilan rad etiladi.
  await assert.rejects(
    async () => modulniOzgartir(dokon.tenant.id, "OMBOR", false),
    (e: Error) => /Magazin|MAGAZIN|magazin/.test(e.message)
  );
  // OMBOR hali ham yoqiq.
  const yoqilgan = await D(() => guard.getEnabledModules(fakeCtx(dokon.tenant, "OWNER")));
  assert.ok(yoqilgan.has("OMBOR"));
  assert.ok(yoqilgan.has("MAGAZIN"));
});

// =========================================================================
// YORLIQ CHOP ETISH (stiker printeri) va OMMAVIY QR
// =========================================================================

test("40. Ommaviy QR: kodsiz tovarlarga yaratadi, kodlilarga TEGMAYDI", async () => {
  const bizniki = { businessId: dokon.business.id };

  // Zavod kodi bor tovar — unga QR YARATILMASLIGI kerak (kodi quti ustida).
  const zavodKodli = await mahsulot("Zavod kodli tovar", 9_000, 10, "4609999999991");
  // Kodsiz uchta tovar.
  const kodsizlar = [
    await mahsulot("Kodsiz A", 3_000, 10),
    await mahsulot("Kodsiz B", 4_000, 10),
    await mahsulot("Kodsiz C", 5_000, 10),
  ];
  // Allaqachon QR'i bor tovar — u QAYTA yaratilmasligi kerak.
  const qrli = await mahsulot("Allaqachon QR'li", 6_000, 10);
  const oldingi = await D(() =>
    mahsulotKod.qrKodYarat({ businessId: dokon.business.id, productId: qrli.id })
  );

  const natija = await D(() => mahsulotKod.qrKodHammasiga(bizniki));
  assert.ok(natija.yaratildi >= 3, `kamida 3 ta yaratilishi kerak, bo'ldi: ${natija.yaratildi}`);
  assert.equal(natija.qolgan, 0);

  for (const p of kodsizlar) {
    const keyin = await rawPrisma.product.findUnique({ where: { id: p.id } });
    assert.ok(kod.balansaQrMi(keyin.qrKod), `${keyin.nomi}: QR yaratilmadi`);
  }
  // Zavod kodli tovar tegilmagan.
  const z = await rawPrisma.product.findUnique({ where: { id: zavodKodli.id } });
  assert.equal(z.qrKod, null, "zavod shtrix-kodi bor tovarga QR yaratilmasligi kerak");
  // Mavjud QR o'zgarmagan (chop etilgan stikerlar amal qilaveradi).
  const q = await rawPrisma.product.findUnique({ where: { id: qrli.id } });
  assert.equal(q.qrKod, oldingi.qrKod);

  // IDEMPOTENT: ikkinchi yurishda yangi kod yaratilmaydi.
  const ikkinchi = await D(() => mahsulotKod.qrKodHammasiga(bizniki));
  assert.equal(ikkinchi.yaratildi, 0, "takroriy bosish yangi kod yaratmasligi kerak");
});

test("41. Ommaviy QR boshqa biznesga o'tib ketmaydi", async () => {
  // Agentlik biznesida kodsiz tovar bo'lsin.
  const agencyProduct = await A(() =>
    prisma.product.create({
      data: {
        businessId: agency.business.id,
        nomi: "Agentlik kodsiz tovari",
        sotuvNarx: 50_000,
        miqdor: 5,
      },
    })
  );
  // Do'kon uchun ommaviy yaratish — agentlik tovariga TEGMASLIGI kerak.
  await D(() => mahsulotKod.qrKodHammasiga({ businessId: dokon.business.id }));
  const keyin = await rawPrisma.product.findUnique({ where: { id: agencyProduct.id } });
  assert.equal(keyin.qrKod, null, "boshqa biznesning tovariga kod yozilmasligi kerak");
});

test("42. Yorliq o'lchamlari stiker printeriga mos", async () => {
  const { YORLIQ_OLCHAMLARI, yorliqByCode, STANDART_YORLIQ, MAKS_YORLIQ } = await import(
    "@/lib/magazin/yorliq"
  );

  assert.ok(YORLIQ_OLCHAMLARI.length >= 3);
  assert.ok(yorliqByCode(STANDART_YORLIQ), "standart o'lcham katalogda bo'lishi kerak");
  // Noma'lum kod berilsa ham yiqilmaydi — birinchi o'lcham qaytadi.
  assert.equal(yorliqByCode("yoq-olcham").code, YORLIQ_OLCHAMLARI[0].code);

  for (const y of YORLIQ_OLCHAMLARI) {
    // QR yorliqdan chiqib ketmasligi kerak: chetida "sokin zona" (quiet zone)
    // bo'lmasa skaner kodni umuman o'qiy olmaydi.
    assert.ok(
      y.qrMm < y.balandMm - 2,
      `${y.code}: QR (${y.qrMm}mm) balandlikka (${y.balandMm}mm) sig'maydi`
    );
    assert.ok(y.qrMm < y.kengMm - 2, `${y.code}: QR kenglikka sig'maydi`);
    // 2D skanerlar uchun amaliy minimal o'lcham.
    assert.ok(y.qrMm >= 12, `${y.code}: QR juda kichik (${y.qrMm}mm) — skanerlanmaydi`);
  }

  assert.ok(MAKS_YORLIQ > 0 && MAKS_YORLIQ <= 1000);
});

test("43. Yorliq QR'i skanerlanadigan kod qaytaradi", async () => {
  // Chop etilgan stikerdagi QR aynan mahsulot kalitini saqlashi va u
  // kassada topilishi kerak — zanjirning ikki uchi.
  const p = await mahsulot("Yorliq sinovi", 7_000, 10);
  const { qrKod } = await D(() =>
    mahsulotKod.qrKodYarat({ businessId: dokon.business.id, productId: p.id })
  );

  const svg = kod.qrSvg(qrKod, { olcham: 200 });
  assert.ok(svg.startsWith("<svg"), "QR chizilishi kerak");
  assert.ok(svg.includes("viewBox"), "viewBox bo'lishi kerak — yorliq o'lchamiga cho'ziladi");

  const topildi = await D(() => mahsulotKod.kodBoyichaMahsulot(dokon.business.id, qrKod));
  assert.equal(topildi.id, p.id, "stikerdagi kod kassada shu tovarni ochishi kerak");
});
