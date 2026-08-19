/**
 * E2E uchun toza baza tayyorlaydi.
 *
 *   node e2e/tayyorla.mjs
 *
 * Nima qiladi: eski sinov bazasini o'chiradi, migratsiyalarni qo'llaydi,
 * demo ma'lumotni ekadi va tenantni PRO tarifga o'tkazib BARCHA modullarni
 * yoqadi. Oxirgi qadam shart: yangi modullar (XARID, TASDIQLASH, MIJOZLAR,
 * HR, HUJJATLAR) standart holatda o'chiq va ularning sahifalari umuman
 * ochilmaydi — smoke test esa aynan o'shalarni tekshiradi.
 *
 * Baza HAR SAFAR noldan quriladi: testlar oldingi yurishdan qolgan
 * ma'lumotga tayanib qolmasligi kerak.
 */
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const BAZA = "prisma/e2e.db";
export const E2E_URL = `file:./${BAZA}`;

/** Registry'dagi core BO'LMAGAN modullar — yoqilishi kerak bo'lganlari. */
const MODULLAR = [
  "OMBOR",
  "MAGAZIN",
  "XARID",
  "TASDIQLASH",
  "MIJOZLAR",
  "HR",
  "HUJJATLAR",
  "CRM",
  "VAZIFALAR",
  "AI",
];

const env = {
  ...process.env,
  DATABASE_URL: E2E_URL,
  DATABASE_AUTH_TOKEN: "",
  // seed production'da ishlashdan bosh tortadi — bu lokal sinov bazasi.
  NODE_ENV: "development",
};

function bajar(nom, buyruq, args) {
  const res = spawnSync(buyruq, args, { env, encoding: "utf8" });
  if (res.status !== 0) {
    console.error(`XATO — ${nom}:\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
  return res.stdout;
}

async function main() {
  rmSync(BAZA, { force: true });
  rmSync(`${BAZA}-journal`, { force: true });

  bajar("migratsiya", process.execPath, ["scripts/db-migrate.mjs"]);
  bajar("seed", process.execPath, ["-r", "ts-node/register", "prisma/seed.ts"]);

  const { createClient } = await import("@libsql/client");
  const c = createClient({ url: E2E_URL });

  const tenant = await c.execute(`SELECT "id" FROM "Tenant" LIMIT 1`);
  const tenantId = String(tenant.rows[0].id);

  await c.execute({
    sql: `UPDATE "Tenant" SET "plan" = 'PRO', "status" = 'ACTIVE' WHERE "id" = ?`,
    args: [tenantId],
  });

  // Seed demo adminni parol almashtirishga majbur qiladi (to'g'ri qaror —
  // demo paroli bilan ishlab ketilmasin). Smoke test esa boshqa narsani
  // tekshiradi: shu bayroq qolsa HAR sahifa "Parolni o'zgartirish" ga
  // yo'naltiriladi va testlar aslida hech narsani sinamaydi.
  await c.execute(`UPDATE "User" SET "mustChangePassword" = 0`);

  for (const code of MODULLAR) {
    await c.execute({
      sql: `INSERT OR IGNORE INTO "TenantModule" ("id","tenantId","code","isActive","createdAt")
            VALUES (?, ?, ?, 1, ?)`,
      args: [`tm_${code.toLowerCase()}`, tenantId, code, new Date().toISOString()],
    });
  }

  await magazinniTayyorla(c, tenantId);

  const soni = await c.execute(
    `SELECT COUNT(*) n FROM "TenantModule" WHERE "isActive" = 1`
  );
  console.log(`E2E bazasi tayyor: ${BAZA} · ${Number(soni.rows[0].n)} modul yoqilgan`);
}

main().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});

/**
 * MAGAZIN (POS) uchun E2E holati.
 *
 * Ikki biznes ATAYLAB har xil sozlanadi — brauzer testi ikkala tomonni ham
 * tekshirishi kerak:
 *
 *   "Salyut"         — omborli + magazin YOQIQ  → kassa ochiladi;
 *   "Demo Xizmatlar" — ikkalasi ham O'CHIQ      → kassa umuman ko'rinmaydi
 *                                                 va route ham ochilmaydi.
 *
 * Shtrix-kodlar haqiqiy EAN-13 ko'rinishida: skaner testi aynan shunday
 * raqamlar bilan ishlaydi.
 */
async function magazinniTayyorla(c, tenantId) {
  // Kassa yuritiladigan do'kon.
  await c.execute(`UPDATE "Business" SET "omborli" = 1, "magazin" = 1 WHERE "id" = 'biz_salyut'`);
  // Kassasiz biznes — "modul yopiq" holatini tekshirish uchun.
  await c.execute(
    `UPDATE "Business" SET "omborli" = 0, "magazin" = 0 WHERE "id" = 'biz_disney_navoiy'`
  );

  // Naqd kassa: pul qayerga tushishini ko'rsatish uchun har biznesda kamida
  // bitta bo'lishi kerak (yangi biznes yaratish oqimidagi bilan bir xil qoida).
  for (const [id, biz] of [["acc_salyut", "biz_salyut"], ["acc_xizmat", "biz_disney_navoiy"]]) {
    await c.execute({
      sql: `INSERT OR IGNORE INTO "Account" ("id","businessId","nomi","turi","isActive","tartib","createdAt")
            VALUES (?, ?, 'Naqd kassa', 'naqd', 1, 0, ?)`,
      args: [id, biz, new Date().toISOString()],
    });
  }

  // Kassa uchun narxi va qoldig'i bor, shtrix-kodli mahsulotlar.
  const TOVARLAR = [
    ["p_kola", "Coca-Cola 1.5L", 12000, 8400, 100, "4601234567890"],
    ["p_fanta", "Fanta 1L", 10000, 7000, 50, "4600000000017"],
    ["p_non", "Uyda pishirilgan non", 5000, 3000, 40, null],
  ];
  for (const [id, nomi, sotuv, kelgan, miqdor, barcode] of TOVARLAR) {
    await c.execute({
      sql: `INSERT OR IGNORE INTO "Product"
              ("id","businessId","nomi","kelganNarx","sotuvNarx","miqdor","isActive","birlik","minQoldiq","createdAt","barcode")
            VALUES (?, 'biz_salyut', ?, ?, ?, ?, 1, 'dona', 0, ?, ?)`,
      args: [id, nomi, kelgan, sotuv, miqdor, new Date().toISOString(), barcode],
    });
  }

  // Do'konga BIRIKTIRILGAN kassir — rol tekshiruvlari uchun.
  // Parol seed'dagi kassir bilan bir xil hash (kassir123).
  const kassirHash = (
    await c.execute(`SELECT "parolHash" h FROM "User" WHERE "rol" = 'CASHIER' LIMIT 1`)
  ).rows[0]?.h;
  if (kassirHash) {
    await c.execute({
      sql: `INSERT OR IGNORE INTO "User"
              ("id","ism","login","parolHash","rol","isActive","createdAt","mustChangePassword","tenantId","businessId")
            VALUES ('u_kassir_salyut','Salyut kassiri','kassir-salyut',?,'CASHIER',1,?,0,?, 'biz_salyut')`,
      args: [String(kassirHash), new Date().toISOString(), tenantId],
    });
  }
}
