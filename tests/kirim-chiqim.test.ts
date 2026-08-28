/**
 * KIRIM / CHIQIM SAHIFASI — yangi filtrlar va davr yakuni.
 *
 * Sahifa qayta ishlanganda qo'shilgan narsalar, ularning har biri xato
 * bo'lsa raqamlar yolg'on chiqadi:
 *
 *   1. TO'LOV GURUHI filtri (naqd | click | karta | qarz) — guruhlar
 *      KESISHMASLIGI va butun to'plamni QOPLASHI shart, aks holda
 *      "Naqd" ni bosgan odam yozuvning bir qismini umuman ko'rmay qoladi.
 *   2. Davr yakuni (Jami kirim / chiqim / Sof) — qarzsiz to'plamdan va
 *      joriy FILTRGA bo'ysunadi. Bu raqamlar sahifada FAQAT direktorga
 *      ko'rsatiladi, lekin ular baribir to'g'ri hisoblanishi kerak.
 *   3. "Kim kiritdi" filtri — u KO'RINUVCHANLIK chegarasini KENGAYTIRMASLIGI
 *      shart: xodim `xodimId` yuborib boshqa xodimning yozuvlarini ko'ra
 *      olmasligi kerak (bu xavfsizlik talabi, qulaylik emas).
 *
 * Ishga tushirish: npm run test:kirim-chiqim
 */
process.env.DATABASE_URL = "file:./prisma/test-kirim-chiqim.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let createTransaction: any;
let txQ: any;
let tezQ: any;
let bolimLib: any;
let huquqLib: any;

let T: any;
let xodim: any;
let naqdKassa: any;
let plastikKassa: any;
let bankKassa: any;
let katKirim: any;
let katKirim2: any;
let katChiqim: any;

const FROM = "2026-08-01";
const TO = "2026-08-31";

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

function royxat(qoshimcha: Record<string, unknown> = {}) {
  return A(async () =>
    txQ.listTransactions({
      businessId: T.business.id,
      from: FROM,
      to: TO,
      pageSize: 100,
      ...qoshimcha,
    })
  );
}

function yoz(o: {
  turi: "kirim" | "chiqim";
  summa: number;
  tolovTuri?: string | null;
  accountId?: string | null;
  categoryId?: string;
  izoh?: string;
  userId?: string;
}) {
  return A(async () =>
    createTransaction(o.userId ?? T.user.id, T.business.id, {
      turi: o.turi,
      categoryId: o.categoryId ?? (o.turi === "kirim" ? katKirim.id : katChiqim.id),
      summa: o.summa,
      sana: "2026-08-12",
      izoh: o.izoh,
      tolovTuri: o.tolovTuri ?? null,
      accountId: o.accountId ?? undefined,
    })
  );
}

before(async () => {
  rmSync("prisma/test-kirim-chiqim.db", { force: true });
  rmSync("prisma/test-kirim-chiqim.db-journal", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  ({ createTransaction } = await import("@/lib/services/transactionService"));
  txQ = await import("@/lib/queries/transactions");
  tezQ = await import("@/lib/queries/tezKategoriyalar");
  bolimLib = await import("@/lib/tolovBolimi");
  huquqLib = await import("@/lib/permissions/tekshir");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Disney Navoiy",
    ism: "Direktor",
    login: "+998900000501",
    parol: "parol12345",
  });

  xodim = await rawPrisma.user.create({
    data: {
      tenantId: T.tenant.id,
      businessId: T.business.id,
      ism: "Fayruza",
      login: "+998900000502",
      parolHash: "x",
      rol: "CASHIER",
    },
  });

  const accountsQ = await import("@/lib/queries/accounts");
  const accountsSvc = await import("@/lib/services/accounts");
  naqdKassa = (await A(async () => accountsQ.listAccounts(T.business.id)))[0];
  plastikKassa = await A(async () =>
    accountsSvc.createAccount(T.business.id, { nomi: "Terminal", turi: "plastik" })
  );
  bankKassa = await A(async () =>
    accountsSvc.createAccount(T.business.id, { nomi: "Bank", turi: "bank" })
  );

  katKirim = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Bezak", turi: "kirim" },
  });
  katKirim2 = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Reklama", turi: "kirim" },
  });
  katChiqim = await rawPrisma.category.create({
    data: { businessId: T.business.id, nomi: "Xarajat", turi: "chiqim" },
  });

  // KIRIM: naqd 100, click 200, plastik-eski 30, bank-eski 20 (karta = 50), qarz 500.
  await yoz({ turi: "kirim", summa: 100, tolovTuri: "naqd", accountId: naqdKassa.id });
  await yoz({ turi: "kirim", summa: 200, tolovTuri: "click", accountId: plastikKassa.id });
  await yoz({ turi: "kirim", summa: 30, tolovTuri: null, accountId: plastikKassa.id });
  await yoz({ turi: "kirim", summa: 20, tolovTuri: null, accountId: bankKassa.id });
  await yoz({ turi: "kirim", summa: 500, tolovTuri: "qarz" });
  // Xodim kiritgan kirim — "Kim kiritdi" filtri uchun.
  await yoz({
    turi: "kirim",
    summa: 70,
    tolovTuri: "naqd",
    accountId: naqdKassa.id,
    categoryId: katKirim2.id,
    izoh: "reklama uz",
    userId: xodim.id,
  });

  // CHIQIM: naqd 40, click 60, bank-eski 10 (karta = 10).
  await yoz({ turi: "chiqim", summa: 40, tolovTuri: "naqd", accountId: naqdKassa.id });
  await yoz({ turi: "chiqim", summa: 60, tolovTuri: "click", accountId: plastikKassa.id });
  await yoz({ turi: "chiqim", summa: 10, tolovTuri: null, accountId: bankKassa.id });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1. Guruhga biriktirish qoidasi (sof funksiya)
// ---------------------------------------------------------------------------

test("tolovGuruhi: plastik va bank 'karta' guruhida, qarz alohida", () => {
  const f = bolimLib.tolovGuruhi;
  assert.equal(f("naqd", "plastik"), "naqd", "aniq tur kassadan ustun");
  assert.equal(f("click", "naqd"), "click");
  assert.equal(f("qarz", "naqd"), "qarz", "qarz alohida guruh");
  assert.equal(f(null, "plastik"), "karta");
  assert.equal(f(null, "bank"), "karta");
  assert.equal(f(null, "naqd"), "naqd");
  assert.equal(f(null, null), "naqd", "kassasiz eski yozuv naqd");
});

// ---------------------------------------------------------------------------
// 2. Davr yakuni (faqat direktorga ko'rsatiladi, lekin to'g'ri bo'lishi shart)
// ---------------------------------------------------------------------------

test("jami kirim/chiqim QARZSIZ to'plamdan hisoblanadi", async () => {
  const r = await royxat();
  // Kirim: 100 + 200 + 30 + 20 + 70 = 420. Qarzga yozilgan 500 KIRMAYDI.
  assert.equal(r.totals.jamiKirim, 420, "qarz (500) jamiga kirmaydi");
  assert.equal(r.totals.jamiChiqim, 110);
  assert.equal(r.totals.sof, 310);
  assert.equal(r.totals.sof, r.totals.jamiKirim - r.totals.jamiChiqim);
});

test("davr yakuni FILTRGA bo'ysunadi", async () => {
  const faqatChiqim = await royxat({ turi: "chiqim" });
  assert.equal(faqatChiqim.totals.jamiKirim, 0);
  assert.equal(faqatChiqim.totals.jamiChiqim, 110);

  const faqatNaqd = await royxat({ tolov: "naqd" });
  assert.equal(faqatNaqd.totals.jamiKirim, 170, "naqd kirim: 100 + 70");
  assert.equal(faqatNaqd.totals.jamiChiqim, 40);
});

// ---------------------------------------------------------------------------
// 3. To'lov guruhi filtri
// ---------------------------------------------------------------------------

test("to'lov filtri: guruhlar kesishmaydi va butun to'plamni qoplaydi", async () => {
  const hammasi = await royxat();
  const guruhlar = ["naqd", "click", "karta", "qarz"];
  const idlar = new Set<string>();
  let jami = 0;
  for (const g of guruhlar) {
    const r = await royxat({ tolov: g });
    jami += r.total;
    for (const it of r.items) {
      assert.equal(idlar.has(it.id), false, `${it.id} ikki guruhda ko'rindi`);
      idlar.add(it.id);
    }
  }
  assert.equal(jami, hammasi.total, "guruhlar yig'indisi butun to'plamga teng");
  assert.equal(idlar.size, hammasi.total);
});

test("to'lov filtri 'karta' — plastik va bank yozuvlari", async () => {
  const r = await royxat({ tolov: "karta" });
  assert.equal(r.total, 3, "kirimdagi 2 ta + chiqimdagi 1 ta eski yozuv");
  assert.equal(
    r.items.reduce((a: number, t: any) => a + t.summa, 0),
    60
  );
});

test("to'lov filtri boshqa filtrlar bilan birga ishlaydi", async () => {
  const r = await royxat({ tolov: "naqd", turi: "chiqim" });
  assert.equal(r.total, 1);
  assert.equal(r.items[0].summa, 40);
});

// ---------------------------------------------------------------------------
// 4. "Kim kiritdi" filtri — va uning XAVFSIZLIK chegarasi
// ---------------------------------------------------------------------------

test("xodimId: direktor bitta xodimning yozuvlarini ajratib ko'radi", async () => {
  const r = await royxat({ xodimId: xodim.id });
  assert.equal(r.total, 1);
  assert.equal(r.items[0].summa, 70);
  assert.equal(r.totals.jamiKirim, 70, "jami ham filtrga mos");
});

test("xodimId ko'rinuvchanlik chegarasini KENGAYTIRA OLMAYDI", async () => {
  // Xodim o'z yozuvlarini ko'radi (userId = xodim). Endi u boshqa odamning
  // idsini `xodimId` bilan so'raydi — chegara ustun turishi shart.
  const r = await royxat({ userId: xodim.id, xodimId: T.user.id });
  assert.equal(r.total, 1, "faqat o'z yozuvi qaytadi");
  assert.equal(r.items[0].userId, xodim.id);
});

// ---------------------------------------------------------------------------
// 5. Qidiruv — izoh va kategoriya nomi
// ---------------------------------------------------------------------------

test("qidiruv izoh bo'yicha ham, kategoriya nomi bo'yicha ham topadi", async () => {
  const izohBoyicha = await royxat({ q: "reklama uz" });
  assert.equal(izohBoyicha.total, 1);

  const kategoriyaBoyicha = await royxat({ q: "Reklama" });
  assert.equal(kategoriyaBoyicha.total, 1, "kategoriya nomi ham qidiriladi");
  assert.equal(kategoriyaBoyicha.items[0].category.nomi, "Reklama");

  const topilmadi = await royxat({ q: "umuman-yoq-matn" });
  assert.equal(topilmadi.total, 0);
});

// ---------------------------------------------------------------------------
// 6. Ko'p ishlatiladigan kategoriyalar (faqat UX tartibi)
// ---------------------------------------------------------------------------

test("tez kategoriyalar: kirim va chiqim alohida, tarixdan chiqadi", async () => {
  const tez = await A(async () => tezQ.getTezKategoriyalar(T.business.id, null));
  assert.ok(tez.kirim.includes(katKirim.id), "eng ko'p ishlatilgan kirim kategoriyasi");
  assert.ok(tez.chiqim.includes(katChiqim.id));
  assert.equal(tez.chiqim.includes(katKirim.id), false, "kirim kategoriyasi chiqimga tushmaydi");
});

test("tez kategoriyalar xodim uchun faqat O'Z tarixidan", async () => {
  const tez = await A(async () => tezQ.getTezKategoriyalar(T.business.id, xodim.id));
  assert.deepEqual(tez.kirim, [katKirim2.id], "xodim faqat 'Reklama' ni ishlatgan");
  assert.deepEqual(tez.chiqim, []);
});

// ---------------------------------------------------------------------------
// 7. KATEGORIYA KESIMI — sahifaning asosiy ro'yxati
// ---------------------------------------------------------------------------

function kesim(qoshimcha: Record<string, unknown> = {}) {
  return A(async () =>
    txQ.listKategoriyaJamlari({
      businessId: T.business.id,
      from: FROM,
      to: TO,
      ...qoshimcha,
    })
  );
}

test("kategoriya kesimi: har kategoriya BIR MARTA, jami o'z yozuvlari yig'indisi", async () => {
  const k = await kesim();
  const idlar = k.map((x: any) => x.categoryId);
  assert.equal(new Set(idlar).size, idlar.length, "kategoriya takrorlanmaydi");

  const bezak = k.find((x: any) => x.categoryId === katKirim.id);
  // Bezak: 100 (naqd) + 200 (click) + 30 + 20 + 500 (qarz) = 850, 5 ta yozuv.
  assert.equal(bezak.summa, 850);
  assert.equal(bezak.soni, 5);
  assert.equal(bezak.turi, "kirim");

  const reklama = k.find((x: any) => x.categoryId === katKirim2.id);
  assert.equal(reklama.summa, 70);
  assert.equal(reklama.soni, 1);

  const xarajat = k.find((x: any) => x.categoryId === katChiqim.id);
  assert.equal(xarajat.summa, 110, "40 + 60 + 10");
  assert.equal(xarajat.soni, 3);
  assert.equal(xarajat.turi, "chiqim");
});

test("kategoriya jamisi ro'yxatdagi AYNI yozuvlardan chiqadi", async () => {
  // Kartadagi summa ochilgandagi yozuvlar yig'indisiga teng bo'lishi shart.
  const k = await kesim();
  for (const kat of k) {
    const r = await royxat({ categoryId: kat.categoryId });
    assert.equal(r.total, kat.soni, `${kat.nomi}: yozuvlar soni`);
    assert.equal(
      r.items.reduce((a: number, t: any) => a + t.summa, 0),
      kat.summa,
      `${kat.nomi}: yozuvlar yig'indisi`
    );
  }
});

test("kirim va chiqim kategoriyalari ARALASHMAYDI", async () => {
  const faqatKirim = await kesim({ turi: "kirim" });
  assert.equal(faqatKirim.every((x: any) => x.turi === "kirim"), true);
  assert.equal(faqatKirim.some((x: any) => x.categoryId === katChiqim.id), false);

  const faqatChiqim = await kesim({ turi: "chiqim" });
  assert.deepEqual(
    faqatChiqim.map((x: any) => x.categoryId),
    [katChiqim.id]
  );
});

test("sana filtri kategoriya jamlarini ham o'zgartiradi", async () => {
  // Yozuvlarning hammasi 2026-08-12 da — undan oldingi kunda hech nima yo'q.
  const bosh = await kesim({ from: "2026-08-01", to: "2026-08-11" });
  assert.deepEqual(bosh, [], "davrda yozuv yo'q — kesim ham bo'sh");

  const bir = await kesim({ from: "2026-08-12", to: "2026-08-12" });
  assert.equal(bir.length, 3, "uchala kategoriya ham shu kunda");
});

test("qidiruv kategoriya kesimiga ham qo'llanadi", async () => {
  const k = await kesim({ q: "Reklama" });
  assert.deepEqual(
    k.map((x: any) => x.categoryId),
    [katKirim2.id]
  );
  assert.equal(k[0].summa, 70);
});

test("kategoriya kesimi ko'rinuvchanlik chegarasiga bo'ysunadi", async () => {
  const k = await kesim({ userId: xodim.id });
  assert.deepEqual(
    k.map((x: any) => x.categoryId),
    [katKirim2.id],
    "xodim faqat o'z yozuvining kategoriyasini ko'radi"
  );
  assert.equal(k[0].summa, 70);
});

// ---------------------------------------------------------------------------
// 8. DAVR YAKUNI HUQUQI — mavjud granular huquq (`hisobot.korish`)
// ---------------------------------------------------------------------------

test("hisobot.korish: direktorda bor, kassirda yo'q", async () => {
  assert.equal(
    await A(async () => huquqLib.hasPermission(T.user.id, "hisobot.korish")),
    true,
    "direktor davr yakunini ko'radi"
  );
  assert.equal(
    await A(async () => huquqLib.hasPermission(xodim.id, "hisobot.korish")),
    false,
    "kassir davr yakunini KO'RMAYDI"
  );
  // Yozuv kiritish huquqi esa kassirda saqlanadi — kundalik ishi to'xtamaydi.
  assert.equal(
    await A(async () => huquqLib.hasPermission(xodim.id, "tranzaksiya.yaratish")),
    true
  );
});

// ---------------------------------------------------------------------------
// 7. Sahifalash — filtr butun to'plam bo'yicha ishlaydi
// ---------------------------------------------------------------------------

test("sahifalash: jami sahifaga bog'liq EMAS", async () => {
  const birinchi = await royxat({ page: 1, pageSize: 2 });
  const ikkinchi = await royxat({ page: 2, pageSize: 2 });
  assert.equal(birinchi.items.length, 2);
  assert.equal(birinchi.total, ikkinchi.total);
  assert.equal(birinchi.totals.jamiKirim, ikkinchi.totals.jamiKirim);
  assert.equal(birinchi.totals.sof, ikkinchi.totals.sof);
});
