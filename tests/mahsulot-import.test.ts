/**
 * KATALOG IMPORT/EKSPORT TESTLARI.
 *
 * Import mijozning eski dasturidagi (Bito, MoySklad, Excel) katalogini
 * Balansa'ga ko'chirish yo'li. Bu yerda tekshiriladigan asosiy xavflar:
 *
 *  - narx ustuni yo'q fayl bilan yangilash butun katalog narxini NOLGA
 *    tushirib yuborishi mumkin edi;
 *  - boshlang'ich qoldiq pul tranzaksiyasi yozib mijozning hisobotini
 *    buzishi mumkin edi;
 *  - bitta xato qator butun importni yiqitishi mumkin edi.
 *
 * Ishga tushirish: npm run test:mahsulot-import
 */
process.env.DATABASE_URL = "file:./prisma/test-mahsulot-import.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

// Dinamik importlar `any` bo'lgani uchun natija turi ham `any` — bu test
// faylining o'zida qat'iy turlar yo'q (magazin testlari bilan bir xil usul).
let rawPrisma: any;
let runWithTenant: any;
let imp: any;
let eksport: any;
let createTenantWithOwner: any;

let t: any;

function T(fn: () => unknown): Promise<any> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

const BALANSA_CSV = `Nomi,SKU,Shtrix kod,Kategoriya,Birlik,Tannarx,Sotuv narxi,Qoldiq,Min qoldiq,Izoh
Coca-Cola 1L,CC-1L,4601234567890,Ichimlik,dona,9 000,12 000,48,10,
Shar 12 dyuym,SH-012,,Sharlar,dona,1500,4000,200,20,Rangli`;

/** Bito eksporti: boshqa ustun nomlari, narx ham, qoldiq ham yo'q. */
const BITO_CSV = `Surati,Mahsulot,SKU,Ombordagi o'rni,Shtrix kod,Kategoriya,O'lchov birligi,Teglar
,fonus,1141975,,,Gullar,Dona,
,vaza 200 minglik,1141905,,,Gullar,Dona,
,teddi 1.2 mln,1141900,,,teddi,Dona,`;

before(async () => {
  rmSync("prisma/test-mahsulot-import.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  imp = await import("@/lib/services/mahsulotImport");
  eksport = await import("@/lib/queries/mahsulotEksport");
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  t = await createTenantWithOwner({
    kompaniyaNomi: "Import katalog test",
    ism: "Egasi",
    login: "+998933333401",
    parol: "parol12345",
  });
  await rawPrisma.business.update({
    where: { id: t.business.id },
    data: { omborli: true, magazin: true },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Faylni o'qish ----------

test("Balansa formatidagi CSV to'liq o'qiladi", () => {
  const { qatorlar, xatolar, ustunlar } = imp.mahsulotlarniOqi(BALANSA_CSV);
  assert.equal(xatolar.length, 0);
  assert.equal(qatorlar.length, 2);
  assert.equal(qatorlar[0].nomi, "Coca-Cola 1L");
  assert.equal(qatorlar[0].barcode, "4601234567890");
  // "9 000" kabi bo'shliqli raqam ham tushuniladi.
  assert.equal(qatorlar[0].kelganNarx, 9000);
  assert.equal(qatorlar[0].sotuvNarx, 12000);
  assert.equal(qatorlar[0].miqdor, 48);
  assert.equal(qatorlar[1].kategoriya, "Sharlar");
  assert.ok(ustunlar.includes("sotuvNarx"));
});

test("BITO eksporti (boshqa ustun nomlari) taniladi", () => {
  const { qatorlar, xatolar, ustunlar } = imp.mahsulotlarniOqi(BITO_CSV);
  assert.equal(xatolar.length, 0);
  assert.equal(qatorlar.length, 3);
  assert.equal(qatorlar[0].nomi, "fonus");
  assert.equal(qatorlar[0].sku, "1141975");
  assert.equal(qatorlar[0].kategoriya, "Gullar");
  // "Dona" -> "dona".
  assert.equal(qatorlar[0].birlik, "dona");
  // Narx va qoldiq ustunlari faylda YO'Q — yangilashda ularga tegilmasin.
  assert.ok(!ustunlar.includes("sotuvNarx"));
  assert.ok(!ustunlar.includes("miqdor"));
});

test("nom ustuni bo'lmasa import boshlanmaydi", () => {
  const { qatorlar, xatolar } = imp.mahsulotlarniOqi("SKU,Narx\n123,5000");
  assert.equal(qatorlar.length, 0);
  assert.equal(xatolar.length, 1);
  assert.match(xatolar[0].xato, /nomi ustuni/i);
});

test("nuqtali vergul bilan saqlangan Excel fayli ham o'qiladi", () => {
  const { qatorlar, xatolar } = imp.mahsulotlarniOqi(
    "Nomi;Sotuv narxi;Qoldiq\nNon;4000;12\nSut;9000;5"
  );
  assert.equal(xatolar.length, 0);
  assert.equal(qatorlar.length, 2);
  assert.equal(qatorlar[0].sotuvNarx, 4000);
  assert.equal(qatorlar[1].miqdor, 5);
});

test("nomida vergul bor tovar qo'shtirnoq bilan buzilmaydi", () => {
  const { qatorlar } = imp.mahsulotlarniOqi('Nomi,Sotuv narxi\n"Shar, katta",5000');
  assert.equal(qatorlar[0].nomi, "Shar, katta");
  assert.equal(qatorlar[0].sotuvNarx, 5000);
});

test("faylda takrorlangan nom/SKU xato beradi, qolgani o'tadi", () => {
  const { qatorlar, xatolar } = imp.mahsulotlarniOqi(
    "Nomi,SKU\nNon,A1\nNon,A2\nSut,A1\nQaymoq,A3"
  );
  assert.equal(qatorlar.length, 2);
  assert.equal(xatolar.length, 2);
  assert.match(xatolar[0].xato, /takrorlangan/);
});

test("manfiy narx qatori xato beradi, boshqalari yoziladi", () => {
  const { qatorlar, xatolar } = imp.mahsulotlarniOqi(
    "Nomi,Sotuv narxi\nNon,-500\nSut,9000"
  );
  assert.equal(qatorlar.length, 1);
  assert.equal(qatorlar[0].nomi, "Sut");
  assert.equal(xatolar.length, 1);
});

test("chegaradan oshgan qatorlar jimgina kesilmaydi", () => {
  const satrlar = ["Nomi"];
  for (let i = 0; i < imp.MAKS_MAHSULOT + 5; i++) satrlar.push(`Tovar ${i}`);
  const { qatorlar, xatolar } = imp.mahsulotlarniOqi(satrlar.join("\n"));
  assert.equal(qatorlar.length, imp.MAKS_MAHSULOT);
  assert.equal(xatolar.length, 1);
  assert.match(xatolar[0].xato, /ko'p tovar/);
});

// ---------- Bazaga yozish ----------

test("yangi tovarlar qo'shiladi va kategoriya yaratiladi", async () => {
  const { qatorlar, ustunlar } = imp.mahsulotlarniOqi(BALANSA_CSV);
  const n = await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar,
      ustunlar,
      rejim: "qoshish",
    })
  );
  assert.equal(n.qoshildi, 2);
  assert.equal(n.yangilandi, 0);

  const cola = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Coca-Cola 1L" },
    include: { category: true },
  });
  assert.equal(cola.sotuvNarx, 12000);
  assert.equal(cola.kelganNarx, 9000);
  assert.equal(cola.barcode, "4601234567890");
  assert.equal(cola.sku, "CC-1L");
  assert.equal(cola.minQoldiq, 10);
  assert.equal(cola.category.nomi, "Ichimlik");
});

test("BOSHLANG'ICH QOLDIQ yoziladi, lekin PUL harakati YARATILMAYDI", async () => {
  const cola = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Coca-Cola 1L" },
  });
  assert.equal(cola.miqdor, 48);

  const tuzatish = await rawPrisma.stockAdjustment.findFirst({
    where: { businessId: t.business.id, productId: cola.id },
  });
  assert.ok(tuzatish, "qoldiq o'zgarishi izsiz qolmasligi kerak");
  assert.equal(tuzatish.turi, "inventarizatsiya");
  assert.equal(tuzatish.eskiMiqdor, 0);
  assert.equal(tuzatish.yangiMiqdor, 48);

  // Eng muhimi: ko'chirilgan tovar uchun xarid chiqimi yozilmasin.
  const pul = await rawPrisma.transaction.count({ where: { businessId: t.business.id } });
  assert.equal(pul, 0);
  const kirim = await rawPrisma.stockEntry.count({ where: { businessId: t.business.id } });
  assert.equal(kirim, 0);
});

test("'qoshish' rejimi mavjud tovarga TEGMAYDI", async () => {
  const yangiCsv = `Nomi,Sotuv narxi,Qoldiq
Coca-Cola 1L,99000,1
Fanta 1L,11000,7`;
  const { qatorlar, ustunlar } = imp.mahsulotlarniOqi(yangiCsv);
  const n = await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar,
      ustunlar,
      rejim: "qoshish",
    })
  );
  assert.equal(n.qoshildi, 1);
  assert.equal(n.otkazildi, 1);

  const cola = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Coca-Cola 1L" },
  });
  assert.equal(cola.sotuvNarx, 12000, "narx o'zgarmasligi kerak edi");
  assert.equal(cola.miqdor, 48, "qoldiq o'zgarmasligi kerak edi");
});

test("'yangilash' rejimi narx va qoldiqni yangilaydi", async () => {
  const { qatorlar, ustunlar } = imp.mahsulotlarniOqi(
    "Nomi,Sotuv narxi,Qoldiq\nCoca-Cola 1L,13000,60"
  );
  const n = await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar,
      ustunlar,
      rejim: "yangilash",
    })
  );
  assert.equal(n.yangilandi, 1);
  assert.equal(n.qoldiqTogrilandi, 1);

  const cola = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Coca-Cola 1L" },
  });
  assert.equal(cola.sotuvNarx, 13000);
  assert.equal(cola.miqdor, 60);
});

test("NARX USTUNI YO'Q fayl bilan yangilash narxni nolga tushirmaydi", async () => {
  const { qatorlar, ustunlar } = imp.mahsulotlarniOqi("Nomi,Kategoriya\nCoca-Cola 1L,Gazli suv");
  await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar,
      ustunlar,
      rejim: "yangilash",
    })
  );
  const cola = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Coca-Cola 1L" },
    include: { category: true },
  });
  assert.equal(cola.sotuvNarx, 13000, "narx saqlanishi kerak");
  assert.equal(cola.kelganNarx, 9000, "tannarx saqlanishi kerak");
  assert.equal(cola.miqdor, 60, "qoldiq saqlanishi kerak");
  assert.equal(cola.category.nomi, "Gazli suv", "kategoriya esa yangilanishi kerak");
});

test("ZIDDIYATLI qator chetga chiqadi, qolgan qatorlar yoziladi", async () => {
  // "Fanta 1L" bazada bor, lekin bu qatordagi shtrix-kod Coca-Cola'niki.
  // Dastur qaysi biri to'g'ri ekanini bilmaydi — taxmin qilmasligi kerak.
  const { qatorlar, ustunlar } = imp.mahsulotlarniOqi(
    `Nomi,Shtrix kod
Fanta 1L,4601234567890
Pepsi 1L,4609999999999`
  );
  const n = await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar,
      ustunlar,
      rejim: "yangilash",
    })
  );
  assert.equal(n.qoshildi, 1, "toza qator baribir yozilishi kerak");
  assert.equal(n.xatolar.length, 1);
  assert.match(n.xatolar[0].xato, /boshqa nomdagi tovarga/);

  // Eng muhimi: mavjud tovarlarning kimligi buzilmadi.
  const cola = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, barcode: "4601234567890" },
  });
  assert.equal(cola.nomi, "Coca-Cola 1L", "Cola nomi almashib ketmasligi kerak");
  const fanta = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Fanta 1L" },
  });
  assert.equal(fanta.barcode, null);
});

test("shtrix-kod bo'yicha moslashtirilgan tovar QAYTA yaratilmaydi", async () => {
  // Nomi o'zgargan, lekin kod o'sha — bu ayni tovar, dublikat emas.
  const { qatorlar, ustunlar } = imp.mahsulotlarniOqi(
    "Nomi,Shtrix kod,Sotuv narxi\nCoca-Cola 1 litr,4601234567890,14000"
  );
  const n = await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar,
      ustunlar,
      rejim: "yangilash",
    })
  );
  assert.equal(n.qoshildi, 0);
  assert.equal(n.yangilandi, 1);
  const soni = await rawPrisma.product.count({
    where: { businessId: t.business.id, barcode: "4601234567890" },
  });
  assert.equal(soni, 1);
});

test("SKU bo'yicha moslashtiriladi — nomi o'zgargan bo'lsa ham", async () => {
  const { qatorlar, ustunlar } = imp.mahsulotlarniOqi(
    "Nomi,SKU,Sotuv narxi\nShar 12 dyuym (yangi nom),SH-012,4500"
  );
  const n = await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar,
      ustunlar,
      rejim: "yangilash",
    })
  );
  assert.equal(n.qoshildi, 0);
  assert.equal(n.yangilandi, 1);
  const shar = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, sku: "SH-012" },
  });
  assert.equal(shar.nomi, "Shar 12 dyuym (yangi nom)");
  assert.equal(shar.sotuvNarx, 4500);
});

// ---------- Eksport va aylanma ----------

test("eksport sarlavhasi import tanidigan ustunlar bilan bir xil", () => {
  const { ustunlar, xatolar } = imp.mahsulotlarniOqi(eksport.EKSPORT_SARLAVHASI.join(",") + "\nX");
  assert.equal(xatolar.length, 0);
  assert.deepEqual([...ustunlar].sort(), [...imp.MAHSULOT_USTUNLARI].sort());
});

test("EKSPORT -> tahrir -> IMPORT aylanmasi ishlaydi", async () => {
  const { csvYasa } = await import("@/lib/csv");
  const qatorlar = await T(() => eksport.listMahsulotEksport(t.business.id));
  assert.ok(qatorlar.length >= 3);

  // Excel'da narx to'ldirilgandek: hammasiga 50 000 so'm qo'yamiz.
  const tahrirlangan = qatorlar.map((q: any) =>
    eksport.eksportQatoriMassiv({ ...q, sotuvNarx: 50000 })
  );
  const csv = csvYasa(eksport.EKSPORT_SARLAVHASI, tahrirlangan);

  const oqildi = imp.mahsulotlarniOqi(csv);
  assert.equal(oqildi.xatolar.length, 0);
  assert.equal(oqildi.qatorlar.length, qatorlar.length);

  const n = await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar: oqildi.qatorlar,
      ustunlar: oqildi.ustunlar,
      rejim: "yangilash",
    })
  );
  assert.equal(n.qoshildi, 0, "aylanma yangi tovar yaratmasligi kerak");
  assert.equal(n.yangilandi, qatorlar.length);

  const narxsiz = await rawPrisma.product.count({
    where: { businessId: t.business.id, sotuvNarx: { not: 50000 } },
  });
  assert.equal(narxsiz, 0);
});

test("boshqa tenant biznesiga import qilib bo'lmaydi", async () => {
  const boshqa = await createTenantWithOwner({
    kompaniyaNomi: "Begona kompaniya",
    ism: "Begona",
    login: "+998933333402",
    parol: "parol12345",
  });
  const { qatorlar, ustunlar } = imp.mahsulotlarniOqi("Nomi\nO'g'irlangan tovar");
  await assert.rejects(
    () =>
      T(() =>
        imp.mahsulotlarniYoz({
          businessId: boshqa.business.id,
          userId: t.user.id,
          qatorlar,
          ustunlar,
          rejim: "qoshish",
        })
      ),
    /tegishli emas/
  );
  const soni = await rawPrisma.product.count({ where: { businessId: boshqa.business.id } });
  assert.equal(soni, 0);
});

test("EXCEL (.xlsx) eksporti qayta o'qilib import qilinadi", async () => {
  const { buildMahsulotlarWorkbook } = await import("@/lib/excel/mahsulotlarWorkbook");
  const { xlsxdanCsv } = await import("@/lib/excel/xlsxOqi");

  const qatorlar = await T(() => eksport.listMahsulotEksport(t.business.id));
  const buffer = await buildMahsulotlarWorkbook(qatorlar);
  const csv = await xlsxdanCsv(buffer);

  const oqildi = imp.mahsulotlarniOqi(csv);
  assert.equal(oqildi.xatolar.length, 0, JSON.stringify(oqildi.xatolar));
  assert.equal(oqildi.qatorlar.length, qatorlar.length);
  assert.deepEqual([...oqildi.ustunlar].sort(), [...imp.MAHSULOT_USTUNLARI].sort());

  // Raqamlar Excel'dan matn emas, son bo'lib qaytadi — narx buzilmasin.
  const asl = qatorlar.find((q: any) => q.nomi === "Fanta 1L");
  const qayta = oqildi.qatorlar.find((q: any) => q.nomi === "Fanta 1L");
  assert.equal(qayta.sotuvNarx, asl.sotuvNarx);
  assert.equal(qayta.miqdor, asl.miqdor);
});

// ---------- Rasm ustuni ----------

test("Rasm ustuni yangi tovarga yoziladi, havola bo'lmagani e'tiborsiz qoladi", async () => {
  const csv = `Nomi,Sotuv narxi,Rasm
Rasmli shar,5000,https://misol.uz/shar.jpg
Rasmsiz shar,6000,IMG_0042.jpg`;
  const { qatorlar, ustunlar, xatolar } = imp.mahsulotlarniOqi(csv);
  assert.equal(xatolar.length, 0);
  assert.ok(ustunlar.includes("rasmUrl"));
  assert.equal(qatorlar[0].rasmUrl, "https://misol.uz/shar.jpg");
  // Bito kabi dasturlar bu ustunga fayl NOMINI yozadi — bu xato emas,
  // shunchaki "rasm yo'q".
  assert.equal(qatorlar[1].rasmUrl, null);

  const n = await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar,
      ustunlar,
      rejim: "qoshish",
    })
  );
  assert.equal(n.qoshildi, 2);
  const rasmli = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Rasmli shar" },
  });
  assert.equal(rasmli.rasmUrl, "https://misol.uz/shar.jpg");
  const rasmsiz = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Rasmsiz shar" },
  });
  assert.equal(rasmsiz.rasmUrl, null);
});

test("'yangilash' rejimi rasmni almashtiradi, rasm ustunisiz fayl esa tegmaydi", async () => {
  const yangilash = `Nomi,Rasm
Rasmli shar,https://misol.uz/yangi.jpg`;
  const b1 = imp.mahsulotlarniOqi(yangilash);
  await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar: b1.qatorlar,
      ustunlar: b1.ustunlar,
      rejim: "yangilash",
    })
  );
  let p = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Rasmli shar" },
  });
  assert.equal(p.rasmUrl, "https://misol.uz/yangi.jpg");

  // Rasm ustuni YO'Q fayl bilan yangilash rasmni o'chirmasin (narx qoidasi bilan bir xil).
  const rasmsizFayl = imp.mahsulotlarniOqi(`Nomi,Sotuv narxi\nRasmli shar,7000`);
  await T(() =>
    imp.mahsulotlarniYoz({
      businessId: t.business.id,
      userId: t.user.id,
      qatorlar: rasmsizFayl.qatorlar,
      ustunlar: rasmsizFayl.ustunlar,
      rejim: "yangilash",
    })
  );
  p = await rawPrisma.product.findFirst({
    where: { businessId: t.business.id, nomi: "Rasmli shar" },
  });
  assert.equal(p.rasmUrl, "https://misol.uz/yangi.jpg", "rasm o'chib ketdi");
  assert.equal(p.sotuvNarx, 7000);
});

// ---------- Katta/buzilgan Excel serverni osiltirmasin ----------

test("haddan katta Excel PARSE BOSHLANMASDAN rad etiladi", async () => {
  const { buildMahsulotlarWorkbook } = await import("@/lib/excel/mahsulotlarWorkbook");
  const { xlsxdanCsv, XlsxXato, zipXmlHajmi } = await import("@/lib/excel/xlsxOqi");

  const qatorlar = await T(() => eksport.listMahsulotEksport(t.business.id));
  const buffer = await buildMahsulotlarWorkbook(qatorlar);

  // Hajm o'lchagich sog'lom faylning ichki XML hajmini ko'radi.
  const hajm = zipXmlHajmi(buffer);
  assert.ok(hajm !== null && hajm > 0, `zipXmlHajmi qaytardi: ${hajm}`);

  // Chegara sun'iy pasaytiriladi — 200 ming qatorli faylni testda yasash shart
  // emas, muhimi rad etish yo'li: XlsxXato, ExcelJS ishga tushmasdan.
  await assert.rejects(
    () => xlsxdanCsv(buffer, { maksXmlHajm: 100 }),
    (e: unknown) => e instanceof XlsxXato && /juda katta/.test((e as Error).message)
  );
});

test("satr chegarasi ulkan CSV matn yasashning oldini oladi", async () => {
  const ExcelJS = (await import("exceljs")).default;
  const { xlsxdanCsv } = await import("@/lib/excel/xlsxOqi");

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Katalog");
  ws.addRow(["Nomi", "Sotuv narxi"]);
  for (let i = 0; i < 20; i++) ws.addRow([`Tovar ${i}`, 1000 + i]);
  const buffer = (await wb.xlsx.writeBuffer()) as unknown as ArrayBuffer;

  const csv = await xlsxdanCsv(buffer, { maksSatr: 5 });
  assert.equal(csv.trim().split("\n").length, 5);
});

test("10 MB dan katta fayl KLIENTDAN chiqmasdan rad etiladi", async () => {
  // 180 MB fayl avval to'liq tarmoqqa yuklanishi kerak edi — sekin internetda
  // bu o'zi o'nlab daqiqa "yuklanmoqda" degani. Endi fetch umuman chaqirilmaydi.
  const { importYubor, MAKS_FAYL_HAJM } = await import("@/app/app/ombor/importYuborish");
  const asliFetch = globalThis.fetch;
  let fetchChaqirildi = false;
  globalThis.fetch = (async () => {
    fetchChaqirildi = true;
    throw new Error("chaqirilmasligi kerak");
  }) as typeof fetch;
  try {
    const katta = new File([new Uint8Array(MAKS_FAYL_HAJM + 1)], "katta.xlsx");
    const javob = await importYubor(katta, "qoshish", true);
    assert.equal(javob.ok, false);
    assert.match((javob as { xabar: string }).xabar, /10 MB/);
    assert.equal(fetchChaqirildi, false);
  } finally {
    globalThis.fetch = asliFetch;
  }
});

test("zip bo'lmagan 'xlsx' tushunarli xato bilan rad etiladi", async () => {
  const { xlsxdanCsv, XlsxXato } = await import("@/lib/excel/xlsxOqi");
  const soxta = new TextEncoder().encode("bu excel emas, oddiy matn").buffer;
  await assert.rejects(
    () => xlsxdanCsv(soxta as ArrayBuffer),
    (e: unknown) => e instanceof XlsxXato
  );
});
