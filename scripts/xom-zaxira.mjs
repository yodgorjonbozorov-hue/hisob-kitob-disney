/**
 * XOM SNAPSHOT — sxemaga BOG'LIQ BO'LMAGAN zaxira.
 *
 *   npm run zaxira:xom                       -> prisma/backups/ ichiga yozadi
 *   npm run zaxira:xom -- <fayl>             -> ko'rsatilgan faylga
 *   npm run zaxira:xom -- --tikla <fayl>     -> shu fayldan tiklaydi
 *
 * NEGA KERAK — bu oddiy zaxiraning o'rniga emas, undan OLDINGI qadam.
 *
 * `npm run backup` Prisma orqali ishlaydi, ya'ni u joriy KOD sxemasini
 * biladi. Migratsiya qo'llashdan oldin esa baza koddan ORQADA bo'ladi:
 * `Account` jadvali yo'q, `Transaction.accountId` ustuni yo'q. Shu holatda
 * Prisma zaxirasi `no such table` / `no such column` bilan YIQILADI —
 * ya'ni zaxira aynan eng kerak bo'lgan paytda ishlamaydi.
 *
 * Bu skript sxemani umuman bilmaydi: `sqlite_master` dan jadvallarni topadi
 * va har birini `SELECT *` bilan o'qiydi. Baza qanday holatda bo'lsa,
 * shundayligicha suratga oladi. Shuning uchun u migratsiyadan OLDIN
 * ishlaydi va orqaga qaytish yo'lini ochiq qoldiradi.
 *
 * Cheklov: bu FIZIK surat, mantiqiy zaxira emas. Uni faqat SHU BAZAGA,
 * SHU sxema holatiga qaytarish uchun ishlating. Server ko'chirish va
 * PostgreSQL'ga o'tish uchun `npm run backup` (mantiqiy zaxira) kerak.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const VERSIYA = 1;

/** Prisma/SQLite xizmat jadvallari — suratga kirmaydi. */
function xizmatJadvalmi(nom) {
  return nom.startsWith("sqlite_") || nom === "_applied_migrations" || nom.startsWith("_prisma");
}

function klient() {
  if (!process.env.DATABASE_URL) {
    console.error("XATO: DATABASE_URL sozlanmagan.");
    process.exit(1);
  }
  return createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
}

/** BigInt JSON'ga tushmaydi — matnga aylantiramiz (qiymat aniqligi saqlanadi). */
function tozala(qiymat) {
  if (typeof qiymat === "bigint") return Number(qiymat);
  if (qiymat instanceof Uint8Array) return { __bayt: Buffer.from(qiymat).toString("base64") };
  return qiymat;
}

function qaytar(qiymat) {
  if (qiymat && typeof qiymat === "object" && "__bayt" in qiymat) {
    return Buffer.from(qiymat.__bayt, "base64");
  }
  return qiymat;
}

async function ol(yol) {
  const c = klient();
  const jadvallar = (
    await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  ).rows
    .map((r) => String(r.name))
    .filter((n) => !xizmatJadvalmi(n));

  const surat = { versiya: VERSIYA, olingan: new Date().toISOString(), jadvallar: {} };
  let jami = 0;

  for (const jadval of jadvallar) {
    const res = await c.execute(`SELECT * FROM "${jadval}"`);
    const ustunlar = res.columns ?? [];
    const qatorlar = res.rows.map((r) => ustunlar.map((u) => tozala(r[u])));
    surat.jadvallar[jadval] = { ustunlar, qatorlar };
    jami += qatorlar.length;
  }

  mkdirSync(dirname(yol), { recursive: true });
  writeFileSync(yol, JSON.stringify(surat), "utf8");

  console.log(`\n✅ Xom surat tayyor: ${yol}`);
  console.log(`   ${jadvallar.length} jadval, ${jami} yozuv`);
  for (const [j, v] of Object.entries(surat.jadvallar)) {
    if (v.qatorlar.length > 0) console.log(`   ${j}: ${v.qatorlar.length}`);
  }
}

async function tikla(yol) {
  const surat = JSON.parse(readFileSync(yol, "utf8"));
  if (surat.versiya !== VERSIYA) {
    console.error(`XATO: surat versiyasi mos emas (faylda ${surat.versiya}, kutilgan ${VERSIYA}).`);
    process.exit(1);
  }

  const c = klient();
  console.log(`Tiklanmoqda: ${yol} (${surat.olingan})\n`);

  // FK tekshiruvi vaqtincha o'chiriladi: jadval tartibi suratda saqlanmagan,
  // shuning uchun bola jadval ota jadvaldan oldin tiklanishi mumkin.
  await c.execute("PRAGMA foreign_keys = OFF");

  let jami = 0;
  for (const [jadval, { ustunlar, qatorlar }] of Object.entries(surat.jadvallar)) {
    await c.execute(`DELETE FROM "${jadval}"`);
    if (qatorlar.length === 0) continue;

    const ustunMatn = ustunlar.map((u) => `"${u}"`).join(", ");
    const belgilar = ustunlar.map(() => "?").join(", ");
    for (const qator of qatorlar) {
      await c.execute({
        sql: `INSERT INTO "${jadval}" (${ustunMatn}) VALUES (${belgilar})`,
        args: qator.map(qaytar),
      });
    }
    jami += qatorlar.length;
    console.log(`   ✓ ${jadval}: ${qatorlar.length}`);
  }

  await c.execute("PRAGMA foreign_keys = ON");
  const fk = await c.execute("PRAGMA foreign_key_check");
  if (fk.rows.length > 0) {
    console.error(`\n❌ Tiklashdan keyin ${fk.rows.length} ta tashqi kalit buzilishi — tekshiring.`);
    process.exit(1);
  }

  console.log(`\n✅ Tiklandi: ${jami} yozuv, tashqi kalitlar toza.`);
}

const args = process.argv.slice(2);
const tiklash = args.includes("--tikla");
const yol =
  args.find((a) => !a.startsWith("--")) ??
  `prisma/backups/xom-surat-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;

(tiklash ? tikla(yol) : ol(yol)).catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
