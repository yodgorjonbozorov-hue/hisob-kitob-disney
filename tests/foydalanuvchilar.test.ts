/**
 * FOYDALANUVCHILAR (XODIMLAR) SAHIFASI — XAVFSIZLIK VA RO'YXAT TESTLARI.
 *
 * Sahifa soddalashtirilganda UI o'zgardi, LEKIN himoyalar aynan shu yerda
 * kuchaydi. Test qo'riqlaydigan narsalar:
 *
 *   1. Ro'yxat/qidiruv/filtr SERVER tomonda va TENANT ichida qoladi;
 *   2. o'zini o'zi qulflab qo'yish (nofaollashtirish, rolini tushirish,
 *      o'chirish) — RAD etiladi;
 *   3. kompaniyadagi OXIRGI faol direktorni boshqaruvdan chiqarib bo'lmaydi;
 *   4. begona tenant xodimi va begona biznes ko'rinmaydi/biriktirilmaydi;
 *   5. parol tiklangach eskisi ishlamaydi va hech qayerda ochiq saqlanmaydi;
 *   6. muhim amallar audit jurnaliga tushadi, parol esa tushmaydi.
 *
 * Ishga tushirish: npm run test:foydalanuvchilar
 */
process.env.DATABASE_URL = "file:./prisma/test-foydalanuvchilar.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: <T>(tenantId: string, fn: () => T) => T;
let listXodimlar: any;
let xodimSanoqlari: any;
let xodimniOqi: any;
let ozingniQulflama: any;
let oxirgiBoshqaruvchiTekshir: any;
let xodimHimoyasi: any;
let biznesIdlariniHalQil: any;
let biriktiruvlarniYangila: any;
let hashPassword: any;
let verifyPassword: any;
let auditUchunTozala: any;

const A = "t_fx_a";
const B = "t_fx_b";
const NAVOIY = "biz_fx_navoiy";
const FLOWERS = "biz_fx_flowers";
const GIFTBOX = "biz_fx_giftbox";
const BEGONA_BIZ = "biz_fx_begona";

/** Ikkinchi direktor — "oxirgi direktor" testlarida yoqib-o'chiriladi. */
const EGA = { id: "u_fx_ega", ism: "Direktor Aziz", login: "fx_ega", rol: "OWNER" };
const EGA2 = { id: "u_fx_ega2", ism: "Direktor Bobur", login: "fx_ega2", rol: "OWNER" };
const KASSIR = { id: "u_fx_kassir", ism: "Fayruza", login: "Fayruza0000", rol: "CASHIER" };
const SOTUVCHI = { id: "u_fx_sotuvchi", ism: "Sabina", login: "fx_sabina", rol: "SELLER" };
const NOFAOL = { id: "u_fx_nofaol", ism: "Nodir", login: "fx_nodir", rol: "SELLER" };
const BEGONA = { id: "u_fx_begona", ism: "Begona Xodim", login: "fx_begona", rol: "OWNER" };

/** Guard chaqiruvlari uchun nishon holati. */
const holat = (u: { id: string; rol: string }, isActive = true) => ({
  id: u.id,
  rol: u.rol,
  isActive,
});

before(async () => {
  rmSync("prisma/test-foydalanuvchilar.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ listXodimlar, xodimSanoqlari, xodimniOqi } = await import("@/lib/queries/xodimlar"));
  ({ ozingniQulflama, oxirgiBoshqaruvchiTekshir, xodimHimoyasi } = await import(
    "@/lib/services/userGuard"
  ));
  ({ biznesIdlariniHalQil, biriktiruvlarniYangila } = await import("@/lib/services/userBiznes"));
  ({ hashPassword, verifyPassword } = await import("@/lib/auth/password"));
  ({ auditUchunTozala } = await import("@/lib/db/auditWriter"));

  await rawPrisma.tenant.create({
    data: { id: A, name: "Disney", slug: "fx-disney", status: "ACTIVE" },
  });
  await rawPrisma.tenant.create({
    data: { id: B, name: "Begona", slug: "fx-begona", status: "ACTIVE" },
  });

  await rawPrisma.business.createMany({
    data: [
      { id: NAVOIY, nomi: "Disney Navoiy", tenantId: A },
      { id: FLOWERS, nomi: "Disney Flowers", tenantId: A },
      { id: GIFTBOX, nomi: "Disney Giftbox", tenantId: A },
      { id: BEGONA_BIZ, nomi: "Begona biznes", tenantId: B },
    ],
  });

  const parolHash = await hashPassword("boshlangich123");
  for (const u of [EGA, EGA2, KASSIR, SOTUVCHI, NOFAOL]) {
    await rawPrisma.user.create({
      data: { ...u, parolHash, tenantId: A, isActive: u.id !== NOFAOL.id },
    });
  }
  await rawPrisma.user.create({
    data: { ...BEGONA, parolHash, tenantId: B },
  });

  // Fayruza — bitta biznes; Sabina — ikkita (ko'p-bizneslik).
  await rawPrisma.userBusiness.createMany({
    data: [
      { id: "ub_fx_1", userId: KASSIR.id, businessId: NAVOIY },
      { id: "ub_fx_2", userId: SOTUVCHI.id, businessId: FLOWERS },
      { id: "ub_fx_3", userId: SOTUVCHI.id, businessId: GIFTBOX },
    ],
  });
  await rawPrisma.user.update({ where: { id: KASSIR.id }, data: { businessId: NAVOIY } });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1. RO'YXAT, QIDIRUV, FILTR — server tomonda
// ---------------------------------------------------------------------------

test("ro'yxat FAQAT o'z tenanti xodimlarini qaytaradi", async () => {
  const { items, total } = await runWithTenant(A, () => listXodimlar({}));
  const idlar = items.map((x: any) => x.id);
  assert.equal(total, 5, "A tenantida 5 xodim");
  assert.ok(!idlar.includes(BEGONA.id), "begona tenant xodimi ro'yxatda bo'lmasligi kerak");
});

test("qidiruv ism va login bo'yicha ishlaydi", async () => {
  await runWithTenant(A, async () => {
    const ism = await listXodimlar({ q: "Fayruza" });
    assert.deepEqual(ism.items.map((x: any) => x.id), [KASSIR.id]);

    const login = await listXodimlar({ q: "fx_sabina" });
    assert.deepEqual(login.items.map((x: any) => x.id), [SOTUVCHI.id]);

    const yoq = await listXodimlar({ q: "bunday-odam-yoq" });
    assert.equal(yoq.total, 0);
  });
});

test("holat filtri faol/nofaolni ajratadi", async () => {
  await runWithTenant(A, async () => {
    const faol = await listXodimlar({ holat: "faol" });
    const nofaol = await listXodimlar({ holat: "nofaol" });
    assert.equal(faol.total, 4);
    assert.deepEqual(nofaol.items.map((x: any) => x.id), [NOFAOL.id]);
  });
});

test("rol va biznes filtrlari kesim beradi", async () => {
  await runWithTenant(A, async () => {
    const kassirlar = await listXodimlar({ rol: "CASHIER" });
    assert.deepEqual(kassirlar.items.map((x: any) => x.id), [KASSIR.id]);

    const navoiy = await listXodimlar({ biznes: NAVOIY });
    assert.deepEqual(navoiy.items.map((x: any) => x.id), [KASSIR.id]);

    // Begona tenant biznesi bo'yicha filtr — hech kim chiqmaydi.
    const begona = await listXodimlar({ biznes: BEGONA_BIZ });
    assert.equal(begona.total, 0);
  });
});

test("sahifalash: pageSize ro'yxatni cheklaydi, total esa to'liq qoladi", async () => {
  const { items, total } = await runWithTenant(A, () => listXodimlar({ page: 1, pageSize: 2 }));
  assert.equal(items.length, 2);
  assert.equal(total, 5, "total sahifadan emas, butun natijadan");
});

test("DTO biznes nomlarini beradi; biriktirilmagan xodimda ro'yxat bo'sh", async () => {
  await runWithTenant(A, async () => {
    const sabina = await xodimniOqi(SOTUVCHI.id);
    assert.deepEqual(
      sabina.bizneslar.map((b: any) => b.nomi),
      ["Disney Flowers", "Disney Giftbox"]
    );
    const ega = await xodimniOqi(EGA.id);
    assert.deepEqual(ega.bizneslar, [], "direktor biriktirilmaydi — cheklov yo'q");
  });
});

test("KPI sanoqlari to'g'ri (jami/faol/nofaol/boshqaruvchi/ko'p biznes)", async () => {
  const s = await runWithTenant(A, () => xodimSanoqlari());
  assert.equal(s.jami, 5);
  assert.equal(s.faol, 4);
  assert.equal(s.nofaol, 1);
  assert.equal(s.boshqaruvchi, 2, "ikkita faol direktor");
  assert.equal(s.kopBiznes, 1, "faqat Sabina 2 biznesda");
});

// ---------------------------------------------------------------------------
// 2. O'ZINI O'ZI QULFLASHDAN HIMOYA
// ---------------------------------------------------------------------------

test("o'zini nofaollashtirish RAD etiladi", () => {
  assert.throws(
    () => ozingniQulflama(EGA.id, holat(EGA), { yangiFaol: false }),
    /nofaollashtira olmaysiz/
  );
});

test("o'z rolini kassirga tushirish RAD etiladi", () => {
  assert.throws(
    () => ozingniQulflama(EGA.id, holat(EGA), { yangiRol: "CASHIER" }),
    /boshqaruv huquqini olib tashlay olmaysiz/
  );
});

test("o'zini o'chirish RAD etiladi", () => {
  assert.throws(() => ozingniQulflama(EGA.id, holat(EGA), { ochirish: true }), /o'chira olmaysiz/);
});

test("o'z ismini/loginini o'zgartirish RUXSAT etiladi", () => {
  assert.doesNotThrow(() => ozingniQulflama(EGA.id, holat(EGA), {}));
  // Direktorlikda qolgan holda o'zini yangilash ham mumkin.
  assert.doesNotThrow(() => ozingniQulflama(EGA.id, holat(EGA), { yangiRol: "OWNER", yangiFaol: true }));
});

test("boshqa xodimga bu qoida umuman tegishli emas", () => {
  assert.doesNotThrow(() => ozingniQulflama(EGA.id, holat(KASSIR), { yangiFaol: false }));
});

// ---------------------------------------------------------------------------
// 3. OXIRGI DIREKTOR HIMOYASI
// ---------------------------------------------------------------------------

test("ikkita direktor bo'lsa — birini nofaollashtirish mumkin", async () => {
  await runWithTenant(A, async () => {
    await assert.doesNotReject(() =>
      oxirgiBoshqaruvchiTekshir(holat(EGA2), { yangiFaol: false })
    );
  });
});

test("yagona faol direktorni nofaollashtirish/o'chirish/tushirish RAD etiladi", async () => {
  // EGA2 vaqtincha nofaol — kompaniyada bitta faol direktor qoladi.
  await rawPrisma.user.update({ where: { id: EGA2.id }, data: { isActive: false } });
  try {
    await runWithTenant(A, async () => {
      await assert.rejects(
        () => oxirgiBoshqaruvchiTekshir(holat(EGA), { yangiFaol: false }),
        /yagona direktor/
      );
      await assert.rejects(
        () => oxirgiBoshqaruvchiTekshir(holat(EGA), { ochirish: true }),
        /yagona direktor/
      );
      await assert.rejects(
        () => oxirgiBoshqaruvchiTekshir(holat(EGA), { yangiRol: "SELLER" }),
        /yagona direktor/
      );
      // Ismini o'zgartirish yoki faol qoldirish — bemalol.
      await assert.doesNotReject(() => oxirgiBoshqaruvchiTekshir(holat(EGA), {}));
    });
  } finally {
    await rawPrisma.user.update({ where: { id: EGA2.id }, data: { isActive: true } });
  }
});

test("ALLAQACHON nofaol direktorni o'chirish to'sib qo'yilmaydi", async () => {
  await runWithTenant(A, async () => {
    await assert.doesNotReject(() =>
      oxirgiBoshqaruvchiTekshir(holat(EGA, false), { ochirish: true })
    );
  });
});

test("boshqa tenantdagi direktor bu hisobga KIRMAYDI (tenant izolyatsiyasi)", async () => {
  // B tenantida ham bitta direktor bor; A tenantining yagona direktori
  // baribir himoyalanishi kerak — sanoq tenant ichida yuritiladi.
  await rawPrisma.user.update({ where: { id: EGA2.id }, data: { isActive: false } });
  try {
    await runWithTenant(A, async () => {
      await assert.rejects(
        () => oxirgiBoshqaruvchiTekshir(holat(EGA), { ochirish: true }),
        /yagona direktor/
      );
    });
  } finally {
    await rawPrisma.user.update({ where: { id: EGA2.id }, data: { isActive: true } });
  }
});

test("xodimHimoyasi ikkala tekshiruvni birga qo'llaydi", async () => {
  await runWithTenant(A, async () => {
    await assert.rejects(
      () => xodimHimoyasi(EGA.id, holat(EGA), { yangiFaol: false }),
      /nofaollashtira olmaysiz/
    );
    await assert.doesNotReject(() => xodimHimoyasi(EGA.id, holat(KASSIR), { yangiFaol: false }));
  });
});

// ---------------------------------------------------------------------------
// 4. TENANT VA BIZNES IZOLYATSIYASI
// ---------------------------------------------------------------------------

test("begona tenant xodimini O'QIB bo'lmaydi", async () => {
  await runWithTenant(A, async () => {
    const topilgan = await (await import("@/lib/prisma")).prisma.user.findUnique({
      where: { id: BEGONA.id },
    });
    assert.equal(topilgan, null, "begona tenant xodimi null bo'lishi kerak");
  });
});

test("begona tenant xodimini YANGILAB bo'lmaydi", async () => {
  const { prisma } = await import("@/lib/prisma");
  await runWithTenant(A, async () => {
    await assert.rejects(
      () => prisma.user.update({ where: { id: BEGONA.id }, data: { isActive: false } }),
      /boshqa kompaniyaga tegishli/
    );
  });
  const hali = await rawPrisma.user.findUnique({ where: { id: BEGONA.id } });
  assert.equal(hali.isActive, true, "begona xodim o'zgarmagan bo'lishi kerak");
});

test("begona tenant xodimini O'CHIRIB bo'lmaydi", async () => {
  const { prisma } = await import("@/lib/prisma");
  await runWithTenant(A, async () => {
    await assert.rejects(
      () => prisma.user.delete({ where: { id: BEGONA.id } }),
      /boshqa kompaniyaga tegishli/
    );
  });
  assert.ok(await rawPrisma.user.findUnique({ where: { id: BEGONA.id } }));
});

test("xodimni begona tenant biznesiga biriktirib bo'lmaydi", async () => {
  await runWithTenant(A, async () => {
    await assert.rejects(
      () => biznesIdlariniHalQil({ rol: "CASHIER", businessIds: [BEGONA_BIZ], mavjud: [] }),
      /Biznes topilmadi/
    );
    // O'z biznesi bilan aralash yuborilsa ham — hammasi rad etiladi.
    await assert.rejects(
      () => biznesIdlariniHalQil({ rol: "SELLER", businessIds: [NAVOIY, BEGONA_BIZ], mavjud: [] }),
      /Biznes topilmadi/
    );
  });
});

test("biriktiruv ro'yxati ALMASHADI: A+B → faqat A+B qoladi", async () => {
  await runWithTenant(A, async () => {
    await biriktiruvlarniYangila(SOTUVCHI.id, [FLOWERS, GIFTBOX]);
    const x = await xodimniOqi(SOTUVCHI.id);
    assert.deepEqual(x.bizneslar.map((b: any) => b.id).sort(), [FLOWERS, GIFTBOX].sort());
    assert.ok(!x.bizneslar.some((b: any) => b.id === NAVOIY), "Navoiy biriktirilmagan");
  });
});

// ---------------------------------------------------------------------------
// 5. PAROL XAVFSIZLIGI
// ---------------------------------------------------------------------------

test("parol tiklangach eskisi ishlamaydi, yangisi ishlaydi", async () => {
  const yangi = "YangiParol2026";
  await rawPrisma.user.update({
    where: { id: KASSIR.id },
    data: { parolHash: await hashPassword(yangi), mustChangePassword: true },
  });
  const u = await rawPrisma.user.findUnique({ where: { id: KASSIR.id } });
  assert.equal(await verifyPassword("boshlangich123", u.parolHash), false, "eski parol rad etiladi");
  assert.equal(await verifyPassword(yangi, u.parolHash), true, "yangi parol ishlaydi");
  assert.equal(u.mustChangePassword, true, "vaqtinchalik parol — birinchi kirishda almashtiriladi");
});

test("parol bazada OCHIQ saqlanmaydi", async () => {
  const u = await rawPrisma.user.findUnique({ where: { id: KASSIR.id } });
  assert.ok(!u.parolHash.includes("YangiParol2026"), "hash ichida ochiq parol bo'lmasligi kerak");
  assert.match(u.parolHash, /^\$2[aby]\$|^\$argon|^scrypt|:/, "hash formatida saqlanadi");
});

test("audit yozuvida parol MASKALANADI", () => {
  const tozalangan: any = auditUchunTozala({
    ism: "Fayruza",
    parolHash: "$2b$10$haqiqiy-hash",
    parol: "ochiq-parol",
  });
  assert.equal(tozalangan.parolHash, "***");
  assert.equal(tozalangan.parol, "***");
  assert.equal(tozalangan.ism, "Fayruza", "parol bo'lmagan maydonlar qoladi");
});

// ---------------------------------------------------------------------------
// 6. AUDIT JURNALI
// ---------------------------------------------------------------------------

test("xodim yaratish va rol o'zgarishi audit jurnaliga tushadi", async () => {
  const { prisma } = await import("@/lib/prisma");
  const yaratilgan = await runWithTenant(A, async () =>
    prisma.user.create({
      data: { ism: "Audit Test", login: "fx_audit", parolHash: "x", rol: "CASHIER" },
    })
  );
  await runWithTenant(A, async () =>
    prisma.user.update({ where: { id: yaratilgan.id }, data: { rol: "SELLER" } })
  );

  const yozuvlar = await rawPrisma.auditLog.findMany({
    where: { entity: "user", entityId: yaratilgan.id },
    orderBy: { createdAt: "asc" },
  });
  const amallar = yozuvlar.map((y: any) => y.action);
  assert.ok(amallar.includes("create"), "yaratish yozilgan");
  assert.ok(amallar.includes("update"), "rol o'zgarishi yozilgan");
  assert.ok(
    yozuvlar.every((y: any) => y.tenantId === A),
    "audit yozuvi tenantga bog'langan"
  );
  assert.ok(
    !JSON.stringify(yozuvlar).includes("parolHash\":\"x"),
    "audit ichida ochiq parol hash bo'lmasligi kerak"
  );
});

// ---------------------------------------------------------------------------
// 7. ROUTE ULANISHI — himoya chaqirilmay qolib ketmasin
// ---------------------------------------------------------------------------

const ID_ROUTE = readFileSync("src/app/api/users/[id]/route.ts", "utf8");
const ROOT_ROUTE = readFileSync("src/app/api/users/route.ts", "utf8");

test("PATCH va DELETE route'lari xodimHimoyasi ni chaqiradi", () => {
  const chaqiruvlar = ID_ROUTE.match(/xodimHimoyasi\(/g) ?? [];
  assert.equal(chaqiruvlar.length, 2, "PATCH va DELETE — ikkalasida ham");
});

test("barcha user route'lari requireManager bilan himoyalangan", () => {
  assert.equal((ROOT_ROUTE.match(/requireManager\(/g) ?? []).length, 2, "GET va POST");
  assert.equal((ID_ROUTE.match(/requireManager\(/g) ?? []).length, 2, "PATCH va DELETE");
  assert.match(ROOT_ROUTE, /withTenant\(/);
  assert.match(ID_ROUTE, /withTenant</);
});

test("direktor qo'ygan parol VAQTINCHALIK (mustChangePassword)", () => {
  assert.match(ROOT_ROUTE, /mustChangePassword:\s*true/, "yaratishda");
  assert.match(
    ID_ROUTE,
    /mustChangePassword:\s*params\.id\s*!==\s*user\.userId/,
    "boshqa xodimning paroli tiklanganda"
  );
});

test("maxsus roldan CHIQARISH PRO talab qilmaydi", () => {
  // Tarifi PRO dan tushgan mijoz xodimini tahrirlay olishi kerak. Agar
  // `roleId: null` ham PRO ostida bo'lsa, har saqlash 403 beradi va xodim
  // umuman tahrirlanmaydi.
  const nullBolimi = ID_ROUTE.slice(
    ID_ROUTE.indexOf("if (roleId === null)"),
    ID_ROUTE.indexOf("} else {", ID_ROUTE.indexOf("if (roleId === null)"))
  );
  assert.ok(nullBolimi.length > 0, "null tarmog'i topilishi kerak");
  // ATAYLAB `requirePro(` — izohda bu nom eslatilgan bo'lishi mumkin,
  // bizni esa CHAQIRUV qiziqtiradi.
  assert.ok(
    !nullBolimi.includes("requirePro("),
    "maxsus rolni olib tashlash imtiyoz bermaydi — PRO talab qilinmasligi kerak"
  );
});

test("nofaol xodim tizimga kira olmaydi (login route fail-closed)", () => {
  const login = readFileSync("src/app/api/auth/login/route.ts", "utf8");
  assert.match(login, /!user\s*\|\|\s*!user\.isActive/, "login route isActive ni tekshiradi");
  const tenant = readFileSync("src/lib/auth/tenant.ts", "utf8");
  assert.match(tenant, /if \(!user \|\| !user\.isActive\) return null/, "mavjud sessiya ham to'xtaydi");
});

test("rol har so'rovda bazadan yangilanadi (rol o'zgarishi qayta kirishni kutmaydi)", () => {
  // Sessiya cookie'si 7 kun yashaydi. Rol faqat login paytida yozilsa,
  // direktor qilib ko'tarilgan xodim qayta kirmaguncha eski rol bilan yuradi
  // (menyuda Ombor chiqmaydi), tushirilgan xodimda esa olib tashlangan huquq
  // cookie tugagunicha amal qiladi. Guard buni har so'rovda bazadan tuzatadi.
  const tenant = readFileSync("src/lib/auth/tenant.ts", "utf8");
  assert.match(
    tenant,
    /select: \{ tenantId: true, isActive: true, sessionEpoch: true, rol: true \}/,
    "guard so'rovi rolni ham o'qishi kerak"
  );
  assert.match(
    tenant,
    /session\.rol = normalizeRol\(user\.rol\)/,
    "sessiyadagi rol bazadagi bilan almashtirilishi kerak"
  );
});

test("sahifada moliya ustunlari (balans/qarz/yozuvlar) qolmagan", () => {
  const client = readFileSync("src/app/app/admin/foydalanuvchilar/XodimlarRoyxat.tsx", "utf8");
  for (const ustun of ["Balans", "Qarz", "Yozuvlar"]) {
    assert.ok(!client.includes(`>${ustun}<`), `"${ustun}" ustuni olib tashlangan bo'lishi kerak`);
  }
});

test("tahrirlashda rol O'ZGARMASA rol maydonlari yuborilmaydi", () => {
  const modal = readFileSync(
    "src/app/app/admin/foydalanuvchilar/XodimTahrirModal.tsx",
    "utf8"
  );
  assert.match(modal, /rolOzgardi \? rolBody\(rol\) : \{\}/, "rol faqat o'zgarganda yuboriladi");
});

test("rol jadval qatorida TANLAGICH emas (tasodifan o'zgarmasin)", () => {
  const royxat = readFileSync("src/app/app/admin/foydalanuvchilar/XodimlarRoyxat.tsx", "utf8");
  assert.ok(!royxat.includes("<select"), "jadval qatorida rol tanlagichi bo'lmasligi kerak");
});
