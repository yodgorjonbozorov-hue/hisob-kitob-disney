/**
 * QARZ — MIJOZ KESIMI (customer-based debt).
 *
 * Asosiy invariant (buzilsa qarzdorlar ro'yxati yolg'on ko'rsatadi):
 *
 *   1 ta mijoz = N ta qarz operatsiyasi = 1 ta qarzdor qatori = 1 ta jami qarz
 *
 * Ilgari kassa va Sotuv oynasi qarzga sotganda mijoz kartochkasi
 * yaratmasdi (`Debt.contactId = null`), shuning uchun bir mijozning besh
 * qarzi ro'yxatda besh qarzdor bo'lib chiqardi. Tuzatish —
 * `src/lib/services/mijozAniqla.ts`: qarz yozadigan UCHALA yo'l ham
 * mijozni bir xil qoida bilan aniqlaydi.
 *
 * Ishga tushirish: npm run test:qarz-mijoz
 */
process.env.DATABASE_URL = "file:./prisma/test-qarz-mijoz.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let runWithTenant: any;
let createTenantWithOwner: any;
let qarzSvc: any;
let qarzQ: any;
let mijozSvc: any;
let posSvc: any;

let T: any;
let naqdKassa: any;

function A<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(T.tenant.id, fn, { userId: T.user.id, ism: "Direktor" });
}

/** Qarz yozish — Qarzlar sahifasidagi forma bilan bir xil yo'l. */
function qarzYoz(p: {
  ism?: string;
  tel?: string;
  contactId?: string;
  summa: number;
  sana?: string;
}) {
  return A(async () =>
    qarzSvc.createQarz({
      businessId: T.business.id,
      userId: T.user.id,
      turi: "olinadigan",
      contactId: p.contactId,
      mijozNomi: p.ism,
      mijozTel: p.tel,
      mijozSaqla: true,
      jamiSumma: p.summa,
      sana: p.sana ?? "2026-08-10",
    })
  );
}

function qarzdorlar() {
  return A(async () => qarzQ.listQarzdorlar(T.business.id, { turi: "olinadigan" }));
}

before(async () => {
  rmSync("prisma/test-qarz-mijoz.db", { force: true });
  rmSync("prisma/test-qarz-mijoz.db-journal", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));
  qarzSvc = await import("@/lib/services/qarz");
  qarzQ = await import("@/lib/queries/qarz");
  mijozSvc = await import("@/lib/services/mijozAniqla");
  posSvc = await import("@/lib/services/pos");

  T = await createTenantWithOwner({
    kompaniyaNomi: "Ali do'koni",
    ism: "Direktor",
    login: "+998900000301",
    parol: "parol12345",
  });

  const accountsQ = await import("@/lib/queries/accounts");
  naqdKassa = (await A(async () => accountsQ.listAccounts(T.business.id)))[0];
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------------------------------------------------------------------------
// 1-3. Yangi mijoz va unga uch marta qarz
// ---------------------------------------------------------------------------

let aliContactId: string;

test("1. Yangi mijoz yaratiladi va kartochka ochiladi", async () => {
  const m = await A(async () =>
    mijozSvc.qarzMijozYarat({
      businessId: T.business.id,
      userId: T.user.id,
      ism: "Ali Valiyev",
      tel: "+998901112233",
      izoh: "Qo'shni do'kon",
    })
  );
  assert.ok(m.contactId, "kartochka yaratilishi kerak");
  assert.equal(m.ochiqQarz, 0, "yangi mijozda qarz yo'q");
  aliContactId = m.contactId;
});

test("2. Mijozga 500 000 so'm qarz yoziladi", async () => {
  const q = await qarzYoz({ contactId: aliContactId, summa: 500_000, sana: "2026-08-01" });
  assert.equal(q.contactId, aliContactId, "qarz kartochkaga bog'lanishi kerak");
  assert.equal(q.jamiSumma, 500_000);
});

test("3. Shu mijozga yana 300 000 so'm — YANGI qarzdor yaratilmaydi", async () => {
  const q = await qarzYoz({ contactId: aliContactId, summa: 300_000, sana: "2026-08-02" });
  assert.equal(q.contactId, aliContactId);

  const kartochkalar = await A(async () =>
    rawPrisma.contact.count({ where: { businessId: T.business.id, deletedAt: null } })
  );
  assert.equal(kartochkalar, 1, "ikkinchi qarz ikkinchi kartochka ochmasligi kerak");
});

test("4. Yana 700 000 so'm qarz", async () => {
  const q = await qarzYoz({ contactId: aliContactId, summa: 700_000, sana: "2026-08-03" });
  assert.equal(q.contactId, aliContactId);
});

// ---------------------------------------------------------------------------
// 5-7. Qarzdorlar ro'yxati va tarix
// ---------------------------------------------------------------------------

test("5. Qarzdorlar ro'yxatida FAQAT BITTA Ali chiqadi", async () => {
  const royxat = await qarzdorlar();
  assert.equal(royxat.length, 1, "uchta qarz — bitta qarzdor qatori");
  assert.equal(royxat[0].ism, "Ali Valiyev");
  assert.equal(royxat[0].ochiqSoni, 3, "uchta ochiq qarz operatsiyasi");
});

test("6. Jami qarz 1 500 000 so'm", async () => {
  const royxat = await qarzdorlar();
  assert.equal(royxat[0].qarz, 1_500_000);

  // Bosh sahifadagi karta ham AYNI raqamni ko'rsatishi kerak.
  const j = await A(async () => qarzQ.getQarzJamlari(T.business.id));
  assert.equal(j.olinadigan, 1_500_000);
  assert.equal(j.olinadiganSoni, 1, "bir shaxs — bitta qarzdor");
});

test("7. Ali ichida uchala operatsiya ko'rinadi", async () => {
  const royxat = await qarzdorlar();
  const t = await A(async () =>
    qarzQ.getQarzdorTafsilot(T.business.id, "olinadigan", royxat[0].kalit)
  );
  assert.ok(t);
  assert.equal(t.hodisalar.length, 3, "uchta qarz hodisasi");
  assert.deepEqual(
    t.hodisalar.map((h: any) => h.summa),
    [500_000, 300_000, 700_000]
  );
  assert.equal(t.jamiQarz, 1_500_000);
  assert.equal(t.ochiqQarzlar.length, 3);
});

// ---------------------------------------------------------------------------
// 8-9. Qisman to'lov
// ---------------------------------------------------------------------------

test("8-9. 500 000 to'langach qoldiq 1 000 000 bo'ladi va to'lov tarixda ko'rinadi", async () => {
  const royxat = await qarzdorlar();
  const t = await A(async () =>
    qarzQ.getQarzdorTafsilot(T.business.id, "olinadigan", royxat[0].kalit)
  );
  // To'lov aynan bitta qarzga yoziladi — eng eskisiga (500 000).
  const eng = t.ochiqQarzlar[0];

  await A(async () =>
    qarzSvc.qarzTolov({
      businessId: T.business.id,
      debtId: eng.id,
      userId: T.user.id,
      summa: 500_000,
      sana: "2026-08-20",
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      idempotencyKey: "test-ali-500",
    })
  );

  const keyin = await qarzdorlar();
  assert.equal(keyin.length, 1, "to'lovdan keyin ham bitta qarzdor");
  assert.equal(keyin[0].qarz, 1_000_000, "qoldiq 1 000 000 bo'lishi kerak");

  const t2 = await A(async () =>
    qarzQ.getQarzdorTafsilot(T.business.id, "olinadigan", keyin[0].kalit)
  );
  assert.equal(t2.jamiQarz, 1_000_000);
  const tolovlar = t2.hodisalar.filter((h: any) => h.turi === "tolov");
  assert.equal(tolovlar.length, 1, "to'lov tarixda ko'rinishi kerak");
  assert.equal(tolovlar[0].summa, 500_000);

  // Tarixdagi hodisalardan hisoblangan qoldiq jami bilan MOS kelishi shart.
  const hisob = t2.hodisalar.reduce(
    (acc: number, h: any) => acc + (h.turi === "qarz" ? h.summa : -h.summa),
    0
  );
  assert.equal(hisob, t2.jamiQarz);
});

// ---------------------------------------------------------------------------
// 10-11. Qarzga sotish oynasidan mavjud mijozni topish va tanlash
// ---------------------------------------------------------------------------

test("10. Qidiruvda Ali topiladi va joriy qarzi to'g'ri ko'rsatiladi", async () => {
  const natija = await A(async () => qarzQ.qarzMijozlariTakror(T.business.id, "Ali"));
  const ali = natija.find((m: any) => m.contactId === aliContactId);
  assert.ok(ali, "qidiruvda mavjud mijoz chiqishi kerak");
  assert.equal(ali.ochiqQarz, 1_000_000, "qidiruvdagi qarz serverdan aniq kelishi kerak");

  // Telefon bo'yicha ham topilishi kerak.
  const telBoyicha = await A(async () => qarzQ.qarzMijozlariTakror(T.business.id, "901112233"));
  assert.ok(telBoyicha.some((m: any) => m.contactId === aliContactId));
});

test("11. Mavjud mijozni tanlab yana qarz qo'shiladi — qarzdor bitta qoladi", async () => {
  await qarzYoz({ contactId: aliContactId, summa: 200_000, sana: "2026-08-21" });
  const royxat = await qarzdorlar();
  assert.equal(royxat.length, 1);
  assert.equal(royxat[0].qarz, 1_200_000);
  // 500 000 lik qarz 8-9 testda to'liq to'landi va YOPILDI, shuning uchun
  // ochiq qarzlar: 300 000 + 700 000 + yangi 200 000 = 3 ta.
  assert.equal(royxat[0].ochiqSoni, 3);
});

// ---------------------------------------------------------------------------
// 12-13. Yangi mijoz va dublikatdan himoya
// ---------------------------------------------------------------------------

test("12. Boshqa yangi mijoz alohida qarzdor bo'ladi", async () => {
  const v = await A(async () =>
    mijozSvc.qarzMijozYarat({
      businessId: T.business.id,
      userId: T.user.id,
      ism: "Vali Karimov",
      tel: "+998902223344",
    })
  );
  await qarzYoz({ contactId: v.contactId, summa: 800_000, sana: "2026-08-22" });

  const royxat = await qarzdorlar();
  assert.equal(royxat.length, 2, "ikki xil mijoz — ikki qarzdor");
  const vali = royxat.find((r: any) => r.ism === "Vali Karimov");
  assert.equal(vali.qarz, 800_000);
});

test("13a. Ism qo'lda yozilsa ham mavjud kartochkaga tushadi (dublikat yo'q)", async () => {
  // Kassir qidiruvni o'tkazib yuborib ismni qo'lda yozdi.
  const q = await qarzYoz({ ism: "Ali Valiyev", tel: "+998901112233", summa: 100_000 });
  assert.equal(q.contactId, aliContactId, "telefon bo'yicha mavjud kartochka topilishi kerak");

  const soni = await A(async () =>
    rawPrisma.contact.count({ where: { businessId: T.business.id, ism: "Ali Valiyev", deletedAt: null } })
  );
  assert.equal(soni, 1, "dublikat kartochka yaratilmasligi kerak");
});

test("13b. Telefonsiz takroriy ism ham bitta kartochkaga tushadi", async () => {
  const birinchi = await qarzYoz({ ism: "Sardor Akmalov", tel: "+998903334455", summa: 350_000 });
  // Ikkinchi marta telefonsiz — ism bo'yicha AYNI kartochka topilishi kerak.
  const ikkinchi = await qarzYoz({ ism: "sardor akmalov", summa: 150_000 });
  assert.equal(ikkinchi.contactId, birinchi.contactId, "registr farqi dublikat ochmasligi kerak");

  const royxat = await qarzdorlar();
  const sardor = royxat.filter((r: any) => r.ism.toLowerCase().includes("sardor"));
  assert.equal(sardor.length, 1, "Sardor bitta qarzdor bo'lishi kerak");
  assert.equal(sardor[0].qarz, 500_000);
});

test("13c. Bir xil ismli IKKI mijoz bo'lsa tizim taxmin qilmaydi", async () => {
  // Ataylab ikkita "Bobur Toshev" kartochkasi — turli telefon bilan.
  await A(async () =>
    mijozSvc.qarzMijozYarat({
      businessId: T.business.id,
      userId: T.user.id,
      ism: "Bobur Toshev",
      tel: "+998904445566",
    })
  );
  await A(async () =>
    rawPrisma.contact.create({
      data: {
        businessId: T.business.id,
        ism: "Bobur Toshev",
        tel: "+998905556677",
        createdBy: T.user.id,
      },
    })
  );

  // TELEFONSIZ yozilgan qarz hech qaysi kartochkaga TAXMINAN bog'lanmaydi:
  // "Bobur Toshev" ikkita va qaysi biri ekani noma'lum. Noto'g'ri odamning
  // qarziga qo'shib yuborishdan ko'ra bog'lamagan ma'qul — operator
  // ro'yxatdan (telefoni va qarzi ko'rinib turadi) o'zi tanlaydi.
  const ikkilanish = await qarzYoz({ ism: "Bobur Toshev", summa: 50_000 });
  assert.equal(ikkilanish.contactId, null, "ikkilanishda kartochka tanlanmasligi kerak");

  // Telefon BOSHQA bo'lsa — bu uchinchi odam, yangi kartochka to'g'ri javob.
  const uchinchi = await qarzYoz({
    ism: "Bobur Toshev",
    tel: "+998906667788",
    summa: 60_000,
  });
  assert.ok(uchinchi.contactId, "yangi telefon — yangi kartochka");

  const boburlar = await A(async () =>
    rawPrisma.contact.count({
      where: { businessId: T.business.id, ism: "Bobur Toshev", deletedAt: null },
    })
  );
  assert.equal(boburlar, 3, "har telefon uchun bittadan kartochka");
});

// ---------------------------------------------------------------------------
// 14. Kassadan qarzga sotuv ham kartochkaga bog'lanadi
// ---------------------------------------------------------------------------

test("14. Kassadan (POS) qarzga sotuv mavjud mijoz kartochkasiga tushadi", async () => {
  const mahsulot = await A(async () =>
    rawPrisma.product.create({
      data: {
        businessId: T.business.id,
        nomi: "Un 50kg",
        miqdor: 10,
        kelganNarx: 80_000,
        sotuvNarx: 100_000,
      },
    })
  );

  const oldin = (await qarzdorlar()).length;

  await A(async () =>
    posSvc.posSotuv({
      businessId: T.business.id,
      satrlar: [{ productId: mahsulot.id, miqdor: 2 }],
      tolovTuri: "qarz",
      // Kassir ismni qo'lda yozdi — kartochka tanlanmadi.
      mijozNomi: "Ali Valiyev",
      mijozTel: "+998901112233",
      mijozSaqla: true,
      sana: "2026-08-25",
      userId: T.user.id,
    })
  );

  const keyin = await qarzdorlar();
  assert.equal(keyin.length, oldin, "POS sotuvi YANGI qarzdor qatori ochmasligi kerak");

  const ali = keyin.find((r: any) => r.contactId === aliContactId);
  assert.ok(ali, "POS qarzi mavjud kartochkaga bog'lanishi kerak");

  // 1 200 000 (11-test) + 100 000 (13a) + 200 000 (POS: 2 × 100 000)
  assert.equal(ali.qarz, 1_500_000);
});

test("14b. Naqd POS sotuvi qarz yaratmaydi va mijoz kartochkasi ochmaydi", async () => {
  const mahsulot = await A(async () =>
    rawPrisma.product.create({
      data: {
        businessId: T.business.id,
        nomi: "Shakar 1kg",
        miqdor: 5,
        kelganNarx: 8_000,
        sotuvNarx: 12_000,
      },
    })
  );
  const kartochkaOldin = await A(async () =>
    rawPrisma.contact.count({ where: { businessId: T.business.id, deletedAt: null } })
  );
  const qarzOldin = await qarzdorlar();

  await A(async () =>
    posSvc.posSotuv({
      businessId: T.business.id,
      satrlar: [{ productId: mahsulot.id, miqdor: 1 }],
      tolovTuri: "naqd",
      accountId: naqdKassa.id,
      mijozSaqla: true,
      sana: "2026-08-25",
      userId: T.user.id,
    })
  );

  const kartochkaKeyin = await A(async () =>
    rawPrisma.contact.count({ where: { businessId: T.business.id, deletedAt: null } })
  );
  assert.equal(kartochkaKeyin, kartochkaOldin, "naqd sotuv kartochka ochmasligi kerak");

  const qarzKeyin = await qarzdorlar();
  assert.equal(qarzKeyin.length, qarzOldin.length);
  assert.equal(
    qarzKeyin.reduce((a: number, r: any) => a + r.qarz, 0),
    qarzOldin.reduce((a: number, r: any) => a + r.qarz, 0),
    "naqd sotuv qarz jamiga tegmasligi kerak"
  );
});
