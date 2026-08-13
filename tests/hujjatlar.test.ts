/**
 * HUJJATLAR MODULI (Faza 6.6) — shartnomalar reyestri va fayl ilovalari.
 *
 * Ikki nozik joy:
 *  1. Muddat hisobi — shartnoma "muddati yaqin" ekanini bildirishnoma shu
 *     hisobdan biladi. Sana chegaralarida xato bo'lsa ogohlantirish bir kun
 *     kech (yoki umuman) chiqmasdi.
 *  2. Ilova polimorf bog'lanish (FK yo'q), shuning uchun EGALIK xizmat
 *     qatlamida tekshiriladi — begona yozuvga ilova osib bo'lmasligi kerak.
 *
 * Ishga tushirish: npm run test:hujjatlar
 */
process.env.DATABASE_URL = "file:./prisma/test-hujjatlar.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

let rawPrisma: any;
let runWithTenant: any;
let hujjat: any;
let queries: any;
let driver: any;

let t: any;
let t2: any;
let shartnoma: any;
let begonaTranzaksiya: any;
let ozTranzaksiya: any;

/** Testda "bugun" — sanani muzlatib, muddat hisobini aniq tekshiramiz. */
const BUGUN = new Date("2026-08-04T00:00:00.000Z");

function T<R>(fn: () => Promise<R>): Promise<R> {
  return runWithTenant(t.tenant.id, fn, { userId: t.user.id, ism: "Direktor" });
}

before(async () => {
  rmSync("prisma/test-hujjatlar.db", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ runWithTenant } = await import("@/lib/db/tenantContext"));
  hujjat = await import("@/lib/services/hujjat");
  queries = await import("@/lib/queries/hujjat");
  driver = await import("@/lib/storage/driver");
  const { createTenantWithOwner } = await import("@/lib/services/signup");

  t = await createTenantWithOwner({
    kompaniyaNomi: "Hujjat test",
    ism: "Egasi",
    login: "+998922222701",
    parol: "parol12345",
  });
  t2 = await createTenantWithOwner({
    kompaniyaNomi: "Begona firma",
    ism: "Begona",
    login: "+998922222702",
    parol: "parol12345",
  });

  const kat = await rawPrisma.category.create({
    data: { businessId: t.business.id, nomi: "Test chiqim", turi: "chiqim" },
  });
  ozTranzaksiya = await rawPrisma.transaction.create({
    data: {
      businessId: t.business.id, categoryId: kat.id, turi: "chiqim",
      summa: 100_000, sana: BUGUN, userId: t.user.id,
    },
  });

  const begonaKat = await rawPrisma.category.create({
    data: { businessId: t2.business.id, nomi: "Begona chiqim", turi: "chiqim" },
  });
  begonaTranzaksiya = await rawPrisma.transaction.create({
    data: {
      businessId: t2.business.id, categoryId: begonaKat.id, turi: "chiqim",
      summa: 50_000, sana: BUGUN, userId: t2.user.id,
    },
  });
});

after(async () => {
  await rawPrisma?.$disconnect();
});

// ---------- Shartnomalar ----------

test("shartnoma yaratiladi", async () => {
  shartnoma = await T(async () =>
    hujjat.createContract(t.business.id, t.user.id, {
      raqam: "SH-001",
      nomi: "Ijara shartnomasi",
      turi: "boshqa",
      kontragent: "Toshkent Plaza",
      summa: 12_000_000,
      boshlanish: "2026-01-01",
      tugash: "2026-08-20",
      eslatmaKun: 30,
    })
  );
  assert.equal(shartnoma.holat, "faol");
  assert.equal(shartnoma.eslatmaKun, 30);
});

test("bir xil raqamdagi ikkinchi shartnoma rad etiladi", async () => {
  await assert.rejects(
    () => T(async () => hujjat.createContract(t.business.id, t.user.id, {
      raqam: "SH-001", nomi: "Boshqa", turi: "boshqa",
      summa: 0, boshlanish: "2026-01-01", eslatmaKun: 30,
    })),
    /allaqachon bor/
  );
});

test("tugash sanasi boshlanishdan oldin bo'lolmaydi", async () => {
  await assert.rejects(
    () => T(async () => hujjat.createContract(t.business.id, t.user.id, {
      raqam: "SH-XATO", nomi: "Teskari", turi: "boshqa",
      summa: 0, boshlanish: "2026-05-01", tugash: "2026-04-01", eslatmaKun: 30,
    })),
    /oldin bo'lishi mumkin emas/
  );
});

test("begona mijozni kontragent qilib biriktirib bo'lmaydi", async () => {
  const begonaMijoz = await rawPrisma.contact.create({
    data: { businessId: t2.business.id, ism: "Begona mijoz", createdBy: t2.user.id },
  });
  await assert.rejects(
    () => T(async () => hujjat.createContract(t.business.id, t.user.id, {
      raqam: "SH-002", nomi: "O'g'irlik", turi: "mijoz",
      contactId: begonaMijoz.id, summa: 0, boshlanish: "2026-01-01", eslatmaKun: 30,
    })),
    /Mijoz topilmadi/
  );
});

// ---------- Muddat hisobi ----------

test("eslatma oynasiga kirgan shartnoma ogohlantiriladi", async () => {
  // 2026-08-04 dan 2026-08-20 gacha 16 kun — 30 kunlik oynaga kiradi.
  const royxat = await T(async () => queries.listShartnomalar(t.business.id, BUGUN));
  const s = royxat.find((x: any) => x.raqam === "SH-001");
  assert.equal(s.kunQoldi, 16);
  assert.equal(s.ogohlantirish, true);
});

test("oynadan uzoq shartnoma ogohlantirilmaydi", async () => {
  await T(async () =>
    hujjat.createContract(t.business.id, t.user.id, {
      raqam: "SH-003", nomi: "Uzoq muddatli", turi: "boshqa",
      summa: 0, boshlanish: "2026-01-01", tugash: "2027-01-01", eslatmaKun: 30,
    })
  );
  const royxat = await T(async () => queries.listShartnomalar(t.business.id, BUGUN));
  const s = royxat.find((x: any) => x.raqam === "SH-003");
  assert.equal(s.ogohlantirish, false, "150 kun qolgan — hali erta");
});

test("muddati o'tgan shartnomada kunQoldi manfiy bo'ladi", async () => {
  await T(async () =>
    hujjat.createContract(t.business.id, t.user.id, {
      raqam: "SH-004", nomi: "Tugagan", turi: "boshqa",
      summa: 0, boshlanish: "2025-01-01", tugash: "2026-07-30", eslatmaKun: 10,
    })
  );
  const royxat = await T(async () => queries.listShartnomalar(t.business.id, BUGUN));
  const s = royxat.find((x: any) => x.raqam === "SH-004");
  assert.equal(s.kunQoldi, -5);
  assert.equal(s.ogohlantirish, true, "o'tib ketgan ham ogohlantirish");
});

test("muddatsiz shartnoma hech qachon ogohlantirmaydi", async () => {
  await T(async () =>
    hujjat.createContract(t.business.id, t.user.id, {
      raqam: "SH-005", nomi: "Muddatsiz", turi: "boshqa",
      summa: 0, boshlanish: "2026-01-01", eslatmaKun: 30,
    })
  );
  const royxat = await T(async () => queries.listShartnomalar(t.business.id, BUGUN));
  const s = royxat.find((x: any) => x.raqam === "SH-005");
  assert.equal(s.kunQoldi, null);
  assert.equal(s.ogohlantirish, false);
});

test("tugagan holatdagi shartnoma ogohlantirmaydi", async () => {
  const royxat = await T(async () => queries.listShartnomalar(t.business.id, BUGUN));
  const tugagan = royxat.find((x: any) => x.raqam === "SH-004");
  await T(async () => hujjat.updateContract(t.business.id, tugagan.id, { holat: "tugagan" }));

  const yangi = await T(async () => queries.listShartnomalar(t.business.id, BUGUN));
  const s = yangi.find((x: any) => x.raqam === "SH-004");
  assert.equal(s.ogohlantirish, false, "yopilgan shartnoma eslatmaydi");
});

test("statistika faqat faol va ogohlantiriladiganlarni sanaydi", async () => {
  const stats = await T(async () => queries.getHujjatStats(t.business.id, BUGUN));
  // Faol: SH-001, SH-003, SH-005 (SH-004 tugagan).
  assert.equal(stats.faolShartnoma, 3);
  assert.equal(stats.ogohlantirish, 1, "faqat SH-001 oynada");
});

// ---------- Ilovalar ----------

test("havola biriktiriladi (saqlagichsiz ham ishlaydi)", async () => {
  const i = await T(async () =>
    hujjat.havolaBiriktir(t.business.id, t.user.id, {
      entity: "contract",
      entityId: shartnoma.id,
      nomi: "Skan nusxasi",
      url: "https://drive.google.com/file/abc",
    })
  );
  assert.equal(i.saqlagich, "havola");
  assert.match(i.url, /drive\.google\.com/);

  const royxat = await T(async () => queries.listShartnomalar(t.business.id, BUGUN));
  const s = royxat.find((x: any) => x.raqam === "SH-001");
  assert.equal(s.ilovalar.length, 1);
});

test("xavfli havolalar rad etiladi", async () => {
  for (const url of ["javascript:alert(1)", "data:text/html,<script>", "shunchaki matn"]) {
    await assert.rejects(
      () => T(async () => hujjat.havolaBiriktir(t.business.id, t.user.id, {
        entity: "contract", entityId: shartnoma.id, nomi: "Yomon", url,
      })),
      /havola|http/i,
      `"${url}" o'tib ketmasligi kerak`
    );
  }
});

test("tranzaksiyaga ilova biriktiriladi", async () => {
  await T(async () =>
    hujjat.havolaBiriktir(t.business.id, t.user.id, {
      entity: "transaction",
      entityId: ozTranzaksiya.id,
      nomi: "Chek rasmi",
      url: "https://example.com/chek.jpg",
    })
  );
  const royxat = await T(async () =>
    queries.listIlovalar(t.business.id, "transaction", ozTranzaksiya.id)
  );
  assert.equal(royxat.length, 1);
  assert.equal(royxat[0].nomi, "Chek rasmi");
});

test("BEGONA yozuvga ilova biriktirib bo'lmaydi", async () => {
  await assert.rejects(
    () => T(async () => hujjat.havolaBiriktir(t.business.id, t.user.id, {
      entity: "transaction",
      entityId: begonaTranzaksiya.id,
      nomi: "O'g'irlik",
      url: "https://example.com/x",
    })),
    /topilmadi|boshqa biznesga/
  );
});

test("ilova yumshoq o'chiriladi", async () => {
  const royxat = await T(async () =>
    queries.listIlovalar(t.business.id, "transaction", ozTranzaksiya.id)
  );
  await T(async () => hujjat.ilovaniOchir(t.business.id, royxat[0].id));

  const yozuv = await rawPrisma.attachment.findUnique({ where: { id: royxat[0].id } });
  assert.ok(yozuv.deletedAt, "yozuv qoladi — tasodifan o'chirilgani tiklanishi kerak");

  const yangi = await T(async () =>
    queries.listIlovalar(t.business.id, "transaction", ozTranzaksiya.id)
  );
  assert.equal(yangi.length, 0);
});

// ---------- Saqlagich drayveri ----------

test("saqlagich sozlanmagan bo'lsa aniq xato beriladi", async () => {
  const eski = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    assert.equal(driver.saqlagichBor(), false);
    await assert.rejects(
      () => driver.faylYukla({ nomi: "a.pdf", mimeType: "application/pdf", mazmun: Buffer.from("x") }),
      (e: any) => e instanceof driver.SaqlagichSozlanmaganError
    );
  } finally {
    if (eski !== undefined) process.env.BLOB_READ_WRITE_TOKEN = eski;
  }
});

test("ruxsatsiz fayl turi va katta fayl rad etiladi", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  try {
    await assert.rejects(
      () => driver.faylYukla({
        nomi: "virus.exe", mimeType: "application/x-msdownload", mazmun: Buffer.from("x"),
      }),
      /qabul qilinmaydi/
    );
    await assert.rejects(
      () => driver.faylYukla({
        nomi: "katta.pdf", mimeType: "application/pdf",
        mazmun: Buffer.alloc(driver.MAX_FAYL_BAYT + 1),
      }),
      /10 MB/
    );
  } finally {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  }
});

test("fayl nomidagi yo'l belgilari tozalanadi", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  let sorovUrl = "";
  const fetchImpl = (async (url: string) => {
    sorovUrl = url;
    return {
      ok: true, status: 200,
      json: async () => ({ url: "https://blob.example/fayl.pdf" }),
      text: async () => "",
    } as unknown as Response;
  }) as unknown as typeof fetch;

  try {
    const natija = await driver.faylYukla({
      nomi: "../../etc/passwd.pdf",
      mimeType: "application/pdf",
      // Magic-bayt tekshiruvi (H-9) uchun mazmun haqiqiy PDF bilan boshlanadi.
      mazmun: Buffer.from("%PDF-1.4 test"),
      fetchImpl,
    });
    assert.equal(natija.saqlagich, "blob");
    assert.ok(!decodeURIComponent(sorovUrl).includes(".."), "yo'ldan chiqish belgilari qolmasligi kerak");
    assert.ok(!decodeURIComponent(sorovUrl).includes("/etc/"));
  } finally {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  }
});

// ---------- Izolyatsiya ----------

test("begona tenant shartnoma va ilovalarni ko'rmaydi", async () => {
  const royxat = await runWithTenant(t2.tenant.id, async () =>
    queries.listShartnomalar(t2.business.id, BUGUN)
  );
  assert.equal(royxat.length, 0);

  const stats = await runWithTenant(t2.tenant.id, async () =>
    queries.getHujjatStats(t2.business.id, BUGUN)
  );
  assert.equal(stats.faolShartnoma, 0);
  assert.equal(stats.jamiIlova, 0);
});

test("o'chirilgan shartnoma ro'yxatdan chiqadi, ilovasi qoladi", async () => {
  await T(async () => hujjat.deleteContract(t.business.id, shartnoma.id));

  const royxat = await T(async () => queries.listShartnomalar(t.business.id, BUGUN));
  assert.ok(!royxat.some((x: any) => x.raqam === "SH-001"));

  const ilovalar = await rawPrisma.attachment.count({
    where: { entity: "contract", entityId: shartnoma.id, deletedAt: null },
  });
  assert.equal(ilovalar, 1, "shartnoma tiklansa hujjatlari joyida bo'lsin");
});

// ---------- Magic-bayt tekshiruvi (H-9) ----------

test("mazmun e'lon qilingan MIME turiga mos kelmasa yuklash rad etiladi", async () => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  try {
    // .exe mazmuni (MZ) "PDF" niqobi ostida — rad.
    await assert.rejects(
      () => driver.faylYukla({
        nomi: "hisobot.pdf", mimeType: "application/pdf",
        mazmun: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
      }),
      /mos emas/
    );
    // NUL baytli "matn" — aslida binar, rad.
    await assert.rejects(
      () => driver.faylYukla({
        nomi: "royxat.csv", mimeType: "text/csv",
        mazmun: Buffer.from([0x61, 0x00, 0x62]),
      }),
      /mos emas/
    );
  } finally {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  }
});

test("magicBaytMos: to'g'ri imzolar qabul, yotlari rad", () => {
  assert.equal(driver.magicBaytMos("application/pdf", Buffer.from("%PDF-1.7")), true);
  assert.equal(driver.magicBaytMos("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d])), true);
  assert.equal(driver.magicBaytMos("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(
    driver.magicBaytMos(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      Buffer.from([0x50, 0x4b, 0x03, 0x04])
    ),
    true
  );
  assert.equal(driver.magicBaytMos("text/plain", Buffer.from("oddiy matn")), true);

  assert.equal(driver.magicBaytMos("application/pdf", Buffer.from("PDF emas")), false);
  assert.equal(driver.magicBaytMos("image/png", Buffer.from("%PDF-1.7")), false);
});

// ---------- Blob URL yashirilgan (H-9) ----------

test("ro'yxatda blob ilova proksi manzili bilan, havola o'z manzilida chiqadi", async () => {
  // Blob ilova to'g'ridan-to'g'ri bazaga yoziladi (yuklashni chetlab) —
  // bizni DTO qatlami qiziqtiradi.
  const blobIlova = await runWithTenant(t.tenant.id, async () => {
    const { prisma } = await import("@/lib/prisma");
    return prisma.attachment.create({
      data: {
        businessId: t.business.id,
        entity: "contract",
        entityId: shartnoma.id,
        nomi: "maxfiy-shartnoma.pdf",
        url: "https://blob.vercel-storage.com/maxfiy-xyz.pdf",
        saqlagich: "blob",
        mimeType: "application/pdf",
        userId: t.user.id,
      },
    });
  });

  const royxat = await runWithTenant(t.tenant.id, async () =>
    queries.listIlovalar(t.business.id, "contract", shartnoma.id)
  );
  const blob = royxat.find((i: any) => i.id === blobIlova.id);
  assert.ok(blob);
  assert.equal(blob.url, `/api/hujjatlar/ilova/${blobIlova.id}/fayl`, "ochiq blob URL chiqmasin");
  assert.ok(!JSON.stringify(royxat).includes("blob.vercel-storage.com"), "blob manzili DTO'da yo'q");

  const havola = royxat.find((i: any) => i.saqlagich === "havola");
  if (havola) {
    assert.ok(havola.url.startsWith("http"), "tashqi havola o'z manzilida qoladi");
  }
});
