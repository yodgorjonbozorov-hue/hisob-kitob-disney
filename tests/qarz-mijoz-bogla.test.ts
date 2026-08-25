/**
 * ESKI QARZLARNI MIJOZGA BOG'LASH SKRIPTI — `scripts/qarz-mijoz-bogla.ts`.
 *
 * Bu skript PRODUCTION bazasiga yozadi, shuning uchun uning xatti-harakati
 * testda mixlab qo'yiladi. Tekshiriladigan kafolatlar:
 *
 *   1. KO'RISH rejimi bazaga UMUMAN yozmaydi;
 *   2. telefon aynan mos kelsa bog'laydi;
 *   3. ism bo'yicha AYNAN BITTA moslik bo'lsa bog'laydi;
 *   4. bir xil ismli BIR NECHTA kartochka bo'lsa TEGMAYDI (taxmin yo'q);
 *   5. mos kartochkasi yo'q qarz tegilmay qoladi;
 *   6. PUL SUMMALARI o'zgarmaydi (faqat `contactId` yoziladi);
 *   7. idempotent — ikkinchi marta ishga tushirish hech narsani buzmaydi.
 *
 * Ishga tushirish: npm run test:qarz-mijoz-bogla
 */
process.env.DATABASE_URL = "file:./prisma/test-qarz-bogla.db";

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

/* eslint-disable @typescript-eslint/no-explicit-any */
let rawPrisma: any;
let createTenantWithOwner: any;
let T: any;

/** Qarz IDlari — stsenariy bo'yicha nomlangan. */
const Q: Record<string, string> = {};
/** Kartochka IDlari. */
const C: Record<string, string> = {};

/** Skriptni alohida jarayonda ishga tushiradi (workflow bilan bir xil buyruq). */
function skript(yoz: boolean) {
  const args = ["-r", "ts-node/register", "scripts/qarz-mijoz-bogla.ts"];
  if (yoz) args.push("--yoz");
  const r = spawnSync(process.execPath, args, {
    env: { ...process.env, DATABASE_URL: "file:./prisma/test-qarz-bogla.db" },
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error(`Skript yiqildi:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

function kartochka(ism: string, tel: string | null) {
  return rawPrisma.contact.create({
    data: { businessId: T.business.id, ism, tel, createdBy: T.user.id },
    select: { id: true },
  });
}

function qarz(mijozNomi: string, mijozTel: string | null, jamiSumma: number) {
  return rawPrisma.debt.create({
    data: {
      businessId: T.business.id,
      turi: "olinadigan",
      mijozNomi,
      mijozTel,
      jamiSumma,
      status: "OPEN",
      sana: new Date("2026-08-01T00:00:00.000Z"),
      userId: T.user.id,
    },
    select: { id: true },
  });
}

before(async () => {
  rmSync("prisma/test-qarz-bogla.db", { force: true });
  rmSync("prisma/test-qarz-bogla.db-journal", { force: true });
  const res = spawnSync(process.execPath, ["scripts/db-migrate.mjs"], {
    env: { ...process.env },
    encoding: "utf8",
  });
  if (res.status !== 0) throw new Error(`Migratsiya xatosi:\n${res.stdout}\n${res.stderr}`);

  ({ rawPrisma } = await import("@/lib/db/rawPrisma"));
  ({ createTenantWithOwner } = await import("@/lib/services/signup"));

  T = await createTenantWithOwner({
    kompaniyaNomi: "Bog'lash sinovi",
    ism: "Direktor",
    login: "+998900000401",
    parol: "parol12345",
  });

  // --- Kartochkalar ---
  C.ali = (await kartochka("Ali Valiyev", "+998901112233")).id;
  C.vali = (await kartochka("Vali Karimov", null)).id;
  // Bir xil ismli IKKI kartochka — ataylab ikkilanish holati.
  C.bobur1 = (await kartochka("Bobur Toshev", "+998904445566")).id;
  C.bobur2 = (await kartochka("Bobur Toshev", "+998905556677")).id;

  // --- Kartochkasiz qarzlar ---
  // telefon bo'yicha topiladi
  Q.telMos = (await qarz("Ali V.", "+998901112233", 500_000)).id;
  // ism bo'yicha aynan bitta moslik (registr/bo'shliq farqi bilan)
  Q.ismMos = (await qarz("  vali   karimov ", null, 300_000)).id;
  // ikkilanish — tegilmasligi kerak
  Q.ikkilanish = (await qarz("Bobur Toshev", null, 700_000)).id;
  // umuman mos kartochka yo'q
  Q.notanish = (await qarz("Sardor Akmalov", "+998909998877", 200_000)).id;
});

after(async () => {
  await rawPrisma?.$disconnect();
  rmSync("prisma/test-qarz-bogla.db", { force: true });
  rmSync("prisma/test-qarz-bogla.db-journal", { force: true });
});

/** Barcha sinov qarzlarining joriy `contactId` holati. */
async function holat() {
  const rows = await rawPrisma.debt.findMany({
    where: { businessId: T.business.id },
    select: { id: true, contactId: true, jamiSumma: true, tolangan: true, mijozNomi: true },
  });
  return new Map<string, any>(rows.map((r: any) => [r.id, r]));
}

test("KO'RISH rejimi bazaga yozmaydi", async () => {
  const oldin = await holat();
  const chiqish = skript(false);

  assert.match(chiqish, /KO'RISH REJIMI/, "rejim log'da ko'rinishi kerak");

  const keyin = await holat();
  for (const [id, r] of keyin) {
    assert.equal(r.contactId, oldin.get(id).contactId, "ko'rish rejimida contactId o'zgarmasligi kerak");
  }
  // Hammasi hali ham kartochkasiz.
  assert.equal([...keyin.values()].every((r) => r.contactId === null), true);
});

test("KO'RISH log'ida mijoz ismi ham, biznes nomi ham chiqmaydi", async () => {
  const chiqish = skript(false);
  // Repozitoriya ommaviy — Actions log'iga shaxsiy ma'lumot tushmasligi shart.
  assert.equal(chiqish.includes("Ali"), false, "mijoz ismi log'ga chiqmasligi kerak");
  assert.equal(chiqish.includes("Bobur"), false, "mijoz ismi log'ga chiqmasligi kerak");
  assert.equal(chiqish.includes("Bog'lash sinovi"), false, "biznes nomi log'ga chiqmasligi kerak");
});

test("YOZISH: telefon va ism bo'yicha aniq mosliklar bog'lanadi", async () => {
  skript(true);
  const h = await holat();

  assert.equal(h.get(Q.telMos).contactId, C.ali, "telefon aynan mos — bog'lanishi kerak");
  assert.equal(
    h.get(Q.ismMos).contactId,
    C.vali,
    "ism bo'yicha aynan bitta moslik — bog'lanishi kerak (registr/bo'shliq farqiga qaramay)"
  );
});

test("YOZISH: ikkilanish va notanish qarzlar TEGILMAYDI", async () => {
  const h = await holat();

  assert.equal(
    h.get(Q.ikkilanish).contactId,
    null,
    "bir xil ismli ikki kartochka bo'lsa taxmin qilinmasligi kerak"
  );
  assert.equal(
    h.get(Q.notanish).contactId,
    null,
    "mos kartochkasi yo'q qarz uchun yangi kartochka yaratilmasligi kerak"
  );
});

test("Kartochkalar soni o'zgarmaydi — skript yangi mijoz yaratmaydi", async () => {
  const soni = await rawPrisma.contact.count({
    where: { businessId: T.business.id, deletedAt: null },
  });
  assert.equal(soni, 4, "boshlang'ich 4 ta kartochka o'sha-o'sha qolishi kerak");
});

test("PUL SUMMALARI o'zgarmaydi — faqat bog'lanish yoziladi", async () => {
  const h = await holat();
  assert.equal(h.get(Q.telMos).jamiSumma, 500_000);
  assert.equal(h.get(Q.ismMos).jamiSumma, 300_000);
  assert.equal(h.get(Q.ikkilanish).jamiSumma, 700_000);
  assert.equal(h.get(Q.notanish).jamiSumma, 200_000);
  assert.equal([...h.values()].every((r) => r.tolangan === 0), true);
  // Ism snapshoti ham tegilmaydi — tarix o'zgarmasligi kerak.
  assert.equal(h.get(Q.telMos).mijozNomi, "Ali V.");
});

test("Idempotent — ikkinchi marta ishga tushirish hech narsani o'zgartirmaydi", async () => {
  const oldin = await holat();
  const chiqish = skript(true);
  const keyin = await holat();

  for (const [id, r] of keyin) {
    assert.equal(r.contactId, oldin.get(id).contactId);
    assert.equal(r.jamiSumma, oldin.get(id).jamiSumma);
  }
  // Bog'lanadigan yangi qarz qolmagan.
  assert.match(chiqish, /Kartochkaga bog'landi\s*:\s*0/);
});

test("Qarzdorlar ro'yxati bog'langandan keyin ham to'g'ri jamlaydi", async () => {
  const { runWithTenant } = await import("@/lib/db/tenantContext");
  const qarzQ = await import("@/lib/queries/qarz");

  const royxat = await runWithTenant(
    T.tenant.id,
    async () => qarzQ.listQarzdorlar(T.business.id, { turi: "olinadigan" }),
    { userId: T.user.id, ism: "Direktor" }
  );

  // Ali (500k, kartochkali), Vali (300k, kartochkali),
  // Bobur (700k, kartochkasiz — ism bo'yicha), Sardor (200k, kartochkasiz).
  assert.equal(royxat.length, 4);
  assert.equal(
    royxat.reduce((a: number, r: any) => a + r.qarz, 0),
    1_700_000,
    "jami qarz o'zgarmasligi kerak"
  );

  const ali = royxat.find((r: any) => r.contactId === C.ali);
  assert.ok(ali, "bog'langan qarz kartochka kaliti bilan chiqishi kerak");
  assert.equal(ali.qarz, 500_000);
});
