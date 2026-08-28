/**
 * KATEGORIYA BOSHQARUVI — /app/admin/kategoriyalar sahifasining qoidalari.
 *
 * ENG MUHIM INVARIANT: TARIX HECH QACHON BUZILMAYDI. Kategoriyani qayta
 * nomlash mumkin, nofaollashtirish mumkin — lekin eski tranzaksiyalar
 * o'sha kategoriyada, o'sha `categoryId` bilan qolishi SHART. Shu bois bu
 * yerda rename'dan keyin ID, yozuvlar soni va bosh sahifadagi taqsimot
 * uchalasi ham tekshiriladi.
 *
 * Ishga tushirish: npm run test:kategoriya-boshqaruv
 */
process.env.DATABASE_URL = "file:./prisma/test-kategoriya-boshqaruv.db";

import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let createTransaction: any;
let kat: any;
let dashboardQ: any;
let nomQ: any;
let inventoryQ: any;

let T: any;
let T2: any;
let naqdKassa: any;

const OY = new Date().toISOString().slice(0, 7);
const SANA = `${OY}-05`;

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

function yoz(categoryId: string, turi: "kirim" | "chiqim", summa: number) {
  return A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi,
      categoryId,
      summa,
      sana: SANA,
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
    })
  );
}

/** Xato matnini qaytaradi (xato bo'lmasa — null). */
async function xato(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

before(async () => {
  for (const f of [
    "prisma/test-kategoriya-boshqaruv.db",
    "prisma/test-kategoriya-boshqaruv.db-journal",
  ]) {
    rmSync(f, { force: true });
  }
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));
  kat = await import("@/lib/services/kategoriya");
  dashboardQ = await import("@/lib/queries/dashboard");
  nomQ = await import("@/lib/kategoriyaNom");
  inventoryQ = await import("@/lib/services/inventory");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Bezak studiyasi",
    ism: "Direktor",
    login: "+998900000401",
    parol: "parol12345",
  });
  T2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona kompaniya",
    ism: "Begona",
    login: "+998900000402",
    parol: "parol12345",
  });

  const accountsQ = await import("@/lib/queries/accounts");
  naqdKassa = (await A(async () => accountsQ.listAccounts(T.business.id)))[0];
});

// ─────────────────────────────────────────────────────────────────────────
// 1. DUBLIKAT — registrga befarq
// ─────────────────────────────────────────────────────────────────────────

test("bir xil nom har xil registrda ikkinchi marta yaratilmaydi", async () => {
  await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Bantik", turi: "kirim" }));

  for (const nomi of ["bantik", "BANTIK", "  Bantik  "]) {
    const x = await xato(() =>
      A(() => kat.kategoriyaYarat(T.business.id, { nomi, turi: "kirim" }))
    );
    assert.match(String(x), /allaqachon mavjud/, `"${nomi}" rad etilishi kerak edi`);
  }

  const soni = await A(async () =>
    rawPrisma.category.count({ where: { businessId: T.business.id, turi: "kirim", nomi: { contains: "antik" } } })
  );
  assert.equal(soni, 1);
});

test("kirim va chiqimda bir xil nom BO'LADI", async () => {
  await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Reklama", turi: "kirim" }));
  await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Reklama", turi: "chiqim" }));

  const soni = await A(async () =>
    rawPrisma.category.count({ where: { businessId: T.business.id, nomi: "Reklama" } })
  );
  assert.equal(soni, 2, "tur bo'yicha ajralgan ikki kategoriya qolishi kerak");
});

test("parallel ikki so'rov bitta kategoriya yaratadi (poyga)", async () => {
  const natijalar = await Promise.allSettled([
    A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Dekoratsiya", turi: "kirim" })),
    A(() => kat.kategoriyaYarat(T.business.id, { nomi: "dekoratsiya", turi: "kirim" })),
  ]);
  const otgan = natijalar.filter((r) => r.status === "fulfilled").length;
  assert.equal(otgan, 1, "ikkinchisi baza cheklovida to'xtashi kerak");

  const soni = await A(async () =>
    rawPrisma.category.count({
      where: { businessId: T.business.id, turi: "kirim", nomi: { contains: "ekoratsiya" } },
    })
  );
  assert.equal(soni, 1);
});

test("bo'sh va haddan uzun nom rad etiladi", async () => {
  const v = await import("@/lib/validation/category");
  assert.equal(v.createCategorySchema.safeParse({ nomi: "   ", turi: "kirim" }).success, false);
  assert.equal(v.createCategorySchema.safeParse({ nomi: "x".repeat(61), turi: "kirim" }).success, false);
  // Chetlardagi bo'shliq kesiladi, ichkarisi saqlanadi.
  const ok = v.createCategorySchema.safeParse({ nomi: "  Shar bezak  ", turi: "kirim" });
  assert.equal(ok.success && ok.data.nomi, "Shar bezak");
});

// ─────────────────────────────────────────────────────────────────────────
// 2. RENAME — tarix buzilmaydi
// ─────────────────────────────────────────────────────────────────────────

test("qayta nomlashda ID, yozuvlar va taqsimot joyida qoladi", async () => {
  const c = await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "shar bezaklar", turi: "chiqim" }));
  for (let i = 0; i < 10; i++) await yoz(c.id, "chiqim", 100_000);

  const yangi = await A(() => kat.kategoriyaYangila(T.business.id, c.id, { nomi: "Shar bezaklari" }));

  assert.equal(yangi.id, c.id, "ID O'ZGARMASLIGI SHART — aks holda bog'lanishlar uziladi");
  assert.equal(yangi.nomi, "Shar bezaklari");

  const bogliq = await A(async () =>
    rawPrisma.transaction.count({ where: { categoryId: c.id, deletedAt: null } })
  );
  assert.equal(bogliq, 10, "o'nta yozuv ham eski categoryId bilan qolishi kerak");

  const taqsimot = await A(() => dashboardQ.getCategoryBreakdown(T.business.id, OY, "chiqim"));
  const qator = taqsimot.find((r: any) => r.categoryId === c.id);
  assert.equal(qator?.nomi, "Shar bezaklari", "bosh sahifa yangi nomni ko'rsatadi");
  assert.equal(qator?.summa, 1_000_000);

  const royxat = await A(() => kat.kategoriyaRoyxati(T.business.id, OY));
  assert.equal(royxat.find((r: any) => r.id === c.id)?.yozuvSoni, 10);
});

test("mavjud nomga qayta nomlash rad etiladi (registrga befarq)", async () => {
  const c = await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Vaqtinchalik", turi: "kirim" }));
  const x = await xato(() => A(() => kat.kategoriyaYangila(T.business.id, c.id, { nomi: "BANTIK" })));
  assert.match(String(x), /allaqachon mavjud/);
});

// ─────────────────────────────────────────────────────────────────────────
// 3. NOFAOLLASHTIRISH — yangi formalardan yashirin, tarixda ko'rinadi
// ─────────────────────────────────────────────────────────────────────────

test("nofaol kategoriya formalarda chiqmaydi, tarixda esa qoladi", async () => {
  const c = await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Eski xizmat", turi: "kirim" }));
  await yoz(c.id, "kirim", 250_000);

  await A(() => kat.kategoriyaYangila(T.business.id, c.id, { isActive: false }));

  // Yangi yozuv formalari AYNAN shu shart bilan o'qiydi (tranzaksiyalar,
  // takroriy, CRM, bot, tasdiqlash qoidalari va byudjet sahifalari).
  const formaRoyxati = await A(async () =>
    rawPrisma.category.findMany({ where: { businessId: T.business.id, isActive: true }, select: { id: true } })
  );
  assert.equal(
    formaRoyxati.some((r: any) => r.id === c.id),
    false,
    "nofaol kategoriya yangi yozuv formasida chiqmasligi kerak"
  );

  const taqsimot = await A(() => dashboardQ.getCategoryBreakdown(T.business.id, OY, "kirim"));
  const qator = taqsimot.find((r: any) => r.categoryId === c.id);
  assert.equal(qator?.nomi, "Eski xizmat", "tarixiy taqsimotda hamon ko'rinadi");
  assert.equal(qator?.summa, 250_000);

  // Qayta faollashtirish — yana formalarga qaytadi.
  await A(() => kat.kategoriyaYangila(T.business.id, c.id, { isActive: true }));
  const qayta = await A(async () =>
    rawPrisma.category.findMany({ where: { businessId: T.business.id, isActive: true }, select: { id: true } })
  );
  assert.equal(qayta.some((r: any) => r.id === c.id), true);
});

// ─────────────────────────────────────────────────────────────────────────
// 4. TURNI O'ZGARTIRISH
// ─────────────────────────────────────────────────────────────────────────

test("ishlatilgan kategoriyaning turi o'zgartirilmaydi", async () => {
  const c = await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Ishlatilgan", turi: "kirim" }));
  await yoz(c.id, "kirim", 50_000);

  const x = await xato(() => A(() => kat.kategoriyaYangila(T.business.id, c.id, { turi: "chiqim" })));
  assert.match(String(x), /turini o'zgartirib bo'lmaydi/);

  const holat = await A(async () => rawPrisma.category.findUnique({ where: { id: c.id } }));
  assert.equal(holat.turi, "kirim");
});

test("ishlatilmagan kategoriyaning turi o'zgaradi", async () => {
  const c = await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Hali ishlatilmagan", turi: "kirim" }));
  const yangi = await A(() => kat.kategoriyaYangila(T.business.id, c.id, { turi: "chiqim" }));
  assert.equal(yangi.turi, "chiqim");
  assert.equal(yangi.id, c.id);
});

test("byudjetga bog'langan kategoriya ham ishlatilgan hisoblanadi", async () => {
  const c = await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Byudjetli", turi: "chiqim" }));
  await A(async () =>
    rawPrisma.budget.create({
      data: { businessId: T.business.id, categoryId: c.id, oy: OY, limitSumma: 1_000_000 },
    })
  );
  const x = await xato(() => A(() => kat.kategoriyaYangila(T.business.id, c.id, { turi: "kirim" })));
  assert.match(String(x), /turini o'zgartirib bo'lmaydi/);
});

// ─────────────────────────────────────────────────────────────────────────
// 5. TIZIM KATEGORIYALARI
// ─────────────────────────────────────────────────────────────────────────

test("tizim kategoriyasi qayta nomlanmaydi, nofaollashmaydi, turi o'zgarmaydi", async () => {
  const sotuv = await A(async () =>
    rawPrisma.category.findFirst({ where: { businessId: T.business.id, nomi: "Sotuv", turi: "kirim" } })
  );
  assert.ok(sotuv, "signup 'Sotuv' kirim kategoriyasini yaratishi kerak");

  for (const ozgarish of [{ nomi: "Savdo" }, { isActive: false }, { turi: "chiqim" }]) {
    const x = await xato(() => A(() => kat.kategoriyaYangila(T.business.id, sotuv.id, ozgarish)));
    assert.match(String(x), /tizim kategoriyasi/i, `${JSON.stringify(ozgarish)} rad etilishi kerak`);
  }

  const holat = await A(async () => rawPrisma.category.findUnique({ where: { id: sotuv.id } }));
  assert.equal(holat.nomi, "Sotuv");
  assert.equal(holat.isActive, true);
  assert.equal(holat.turi, "kirim");
});

test("tizim ro'yxati servislardagi qotirilgan nomlar bilan bir xil", async () => {
  // Servis kategoriyani NOMI bo'yicha topadi. Ro'yxat undan ajralib qolsa,
  // himoya jimgina ishlamay qolardi — shuning uchun manba fayl o'qiladi.
  const manbalar = [
    "src/lib/services/inventory.ts",
    "src/lib/services/qarz.ts",
    "src/lib/services/xarid.ts",
    "src/lib/services/hr.ts",
    "src/lib/services/pos.ts",
  ];
  const matn = manbalar.map((f) => readFileSync(f, "utf8")).join("\n");
  const qotirilgan = new Set(
    [...matn.matchAll(/_KATEGORIYA = "([^"]+)"/g)].map((m) => m[1])
  );
  assert.ok(qotirilgan.size >= 8, `kutilmagan darajada kam nom topildi: ${qotirilgan.size}`);

  const himoyalangan = new Set([
    ...nomQ.TIZIM_KATEGORIYALARI.kirim,
    ...nomQ.TIZIM_KATEGORIYALARI.chiqim,
  ]);
  for (const nomi of qotirilgan) {
    assert.ok(
      himoyalangan.has(nomi),
      `"${nomi}" servislarda ishlatiladi, lekin TIZIM_KATEGORIYALARI da yo'q`
    );
  }
});

test("servis kategoriyani registrga befarq topadi (qayta yaratmaydi)", async () => {
  // Foydalanuvchi qo'lda kichik harf bilan yaratib qo'ygan holat.
  const qolda = await A(() =>
    kat.kategoriyaYarat(T.business.id, { nomi: "tovar xaridi", turi: "chiqim" })
  );
  const topilgan = await A(() =>
    inventoryQ.ensureCategory(T.business.id, "Tovar xaridi", "chiqim")
  );
  assert.equal(topilgan, qolda.id, "yangi kategoriya yaratilmasligi kerak edi");
});

// ─────────────────────────────────────────────────────────────────────────
// 6. IZOLYATSIYA VA RBAC
// ─────────────────────────────────────────────────────────────────────────

test("begona biznes kategoriyasi ko'rinmaydi va o'zgarmaydi (IDOR)", async () => {
  const begona = await runWithTenant(T2.tenant.id, async () =>
    kat.kategoriyaYarat(T2.business.id, { nomi: "Begona kategoriya", turi: "kirim" })
  );

  const x = await xato(() => A(() => kat.kategoriyaYangila(T.business.id, begona.id, { nomi: "O'g'irlangan" })));
  assert.match(String(x), /topilmadi yoki sizga tegishli emas/);

  const royxat = await A(() => kat.kategoriyaRoyxati(T.business.id, OY));
  assert.equal(royxat.some((r: any) => r.id === begona.id), false);

  const holat = await runWithTenant(T2.tenant.id, async () =>
    rawPrisma.category.findUnique({ where: { id: begona.id } })
  );
  assert.equal(holat.nomi, "Begona kategoriya");
});

test("kategoriya API'lari boshqaruvchi rolini talab qiladi", async () => {
  const guard = await import("@/lib/auth/guard");
  for (const rol of ["SELLER", "CASHIER"] as const) {
    assert.throws(() => guard.requireManager(rol), /Ruxsat yo'q/);
  }
  for (const rol of ["OWNER", "ADMIN"] as const) {
    assert.doesNotThrow(() => guard.requireManager(rol));
  }
  // Tugmani yashirish himoya emas — tekshiruv route'ning O'ZIDA bo'lishi shart.
  for (const f of ["src/app/api/categories/route.ts", "src/app/api/categories/[id]/route.ts"]) {
    assert.match(readFileSync(f, "utf8"), /requireManager\(user\.rol\)/, `${f} da requireManager yo'q`);
  }
});

test("kategoriya route'larida DELETE yo'q", async () => {
  // Ishlatilgan kategoriyani o'chirish tarixni buzardi; nofaollashtirish
  // uning o'rnini bosadi. Bu qoida kod darajasida qo'riqlanadi.
  for (const f of ["src/app/api/categories/route.ts", "src/app/api/categories/[id]/route.ts"]) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /export const DELETE/, `${f} da DELETE paydo bo'ldi`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 7. RO'YXAT STATISTIKASI
// ─────────────────────────────────────────────────────────────────────────

test("yozuv soni va davr summasi faqat joriy biznesniki", async () => {
  const c = await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Statistika", turi: "kirim" }));
  await yoz(c.id, "kirim", 300_000);
  await yoz(c.id, "kirim", 200_000);

  const royxat = await A(() => kat.kategoriyaRoyxati(T.business.id, OY));
  const qator = royxat.find((r: any) => r.id === c.id);
  assert.equal(qator.yozuvSoni, 2);
  assert.equal(qator.davrSummasi, 500_000);
  assert.equal(qator.tizim, false);

  // Begona biznesning kategoriyalari ro'yxatga umuman kirmaydi.
  const begonaIdlar = await runWithTenant(T2.tenant.id, async () =>
    rawPrisma.category.findMany({ where: { businessId: T2.business.id }, select: { id: true } })
  );
  for (const b of begonaIdlar) {
    assert.equal(royxat.some((r: any) => r.id === b.id), false);
  }
});

test("qarzga yozilgan kirim davr summasiga kirmaydi (bosh sahifa bilan bir xil)", async () => {
  const c = await A(() => kat.kategoriyaYarat(T.business.id, { nomi: "Qarzli savdo", turi: "kirim" }));
  await yoz(c.id, "kirim", 400_000);
  await A(async () =>
    createTransaction(T.user.id, T.business.id, {
      turi: "kirim",
      categoryId: c.id,
      summa: 900_000,
      sana: SANA,
      tolovTuri: "qarz",
    })
  );

  const royxat = await A(() => kat.kategoriyaRoyxati(T.business.id, OY));
  const qator = royxat.find((r: any) => r.id === c.id);
  assert.equal(qator.yozuvSoni, 2, "sanoq BARCHA yozuvlarni ko'rsatadi");
  assert.equal(qator.davrSummasi, 400_000, "summa faqat real pulni oladi");

  const taqsimot = await A(() => dashboardQ.getCategoryBreakdown(T.business.id, OY, "kirim"));
  assert.equal(
    taqsimot.find((r: any) => r.categoryId === c.id)?.summa,
    qator.davrSummasi,
    "kategoriyalar sahifasi va bosh sahifa BIR XIL raqam ko'rsatishi shart"
  );
});

// ─────────────────────────────────────────────────────────────────────────
// 8. NORMALLASHTIRISH QOIDASI
// ─────────────────────────────────────────────────────────────────────────

test("normallashtirish bazadagi indeksdan qat'iyroq (teskarisi emas)", async () => {
  const { kategoriyaNormal } = nomQ;
  assert.equal(kategoriyaNormal("  Bantik  "), "bantik");
  assert.equal(kategoriyaNormal("Shar   bezaklari"), "shar bezaklari");
  // Baza `lower(trim(nomi))` bo'yicha teng deb bilgan har juftlik bu yerda
  // ham teng bo'lishi shart — aks holda ilova o'tkazgan nom bazada
  // kutilmagan xatoga urilardi.
  const bazaNormal = (s: string) => s.trim().toLowerCase();
  for (const [a, b] of [["Bantik", " bantik "], ["Oylik", "OYLIK"]]) {
    if (bazaNormal(a) === bazaNormal(b)) {
      assert.equal(kategoriyaNormal(a), kategoriyaNormal(b));
    }
  }
});
