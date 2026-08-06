/**
 * XOM SURAT — sxemaga bog'liq bo'lmagan zaxira mantig'i.
 *
 * Bu yerda faqat mantiq turadi; buyruq qatori qobig'i `scripts/xom-zaxira.mjs`
 * da, deploy paytidagi avtomatik chaqiruv esa `scripts/deploy-zaxira.mjs` da.
 * Ikkalasi bitta manbadan foydalanadi — surat formati ikki joyda ajralib
 * ketmasligi uchun.
 *
 * NEGA XOM — `npm run backup` Prisma orqali ishlaydi, ya'ni u joriy KOD
 * sxemasini biladi. Migratsiya qo'llashdan oldin esa baza koddan ORQADA
 * bo'ladi: `Account` jadvali yo'q, `Transaction.accountId` ustuni yo'q.
 * Shu holatda Prisma zaxirasi `no such table` bilan YIQILADI — ya'ni zaxira
 * aynan eng kerak bo'lgan paytda ishlamaydi.
 *
 * Bu kod sxemani umuman bilmaydi: `sqlite_master` dan jadvallarni topadi va
 * har birini `SELECT *` bilan o'qiydi. Baza qanday holatda bo'lsa, shundayligicha
 * suratga oladi.
 *
 * Cheklov: bu FIZIK surat, mantiqiy zaxira emas. Uni faqat SHU BAZAGA, SHU
 * sxema holatiga qaytarish uchun ishlating. Server ko'chirish va PostgreSQL'ga
 * o'tish uchun `npm run backup` (mantiqiy zaxira) kerak.
 */
import { createClient } from "@libsql/client";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const VERSIYA = 1;

const MIGRATSIYALAR = "prisma/migrations";

/** Prisma/SQLite xizmat jadvallari — suratga kirmaydi. */
export function xizmatJadvalmi(nom) {
  return nom.startsWith("sqlite_") || nom === "_applied_migrations" || nom.startsWith("_prisma");
}

export function klient() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL sozlanmagan.");
  }
  return createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
}

/** BigInt JSON'ga tushmaydi — songa aylantiramiz; baytlar base64 bo'ladi. */
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

/** Diskdagi migratsiya papkalari (tartib bo'yicha). */
export function migratsiyaRoyxati() {
  if (!existsSync(MIGRATSIYALAR)) return [];
  return readdirSync(MIGRATSIYALAR)
    .filter((d) => existsSync(join(MIGRATSIYALAR, d, "migration.sql")))
    .sort();
}

/** Bazadagi ilova jadvallari (xizmat jadvallari hisobga olinmaydi). */
export async function ilovaJadvallari(c) {
  const res = await c.execute("SELECT name FROM sqlite_master WHERE type='table'");
  return res.rows.map((r) => String(r.name)).filter((n) => !xizmatJadvalmi(n));
}

/** `_applied_migrations` dagi yozuvlar soni; jadval yo'q bo'lsa 0. */
export async function hisobotSoni(c) {
  const bor = await c.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='_applied_migrations'"
  );
  if (bor.rows.length === 0) return 0;
  const res = await c.execute("SELECT COUNT(*) n FROM _applied_migrations");
  return Number(res.rows[0].n);
}

/**
 * Hali qo'llanmagan migratsiyalar.
 *
 * `_applied_migrations` jadvali yo'q bo'lsa — hisobot umuman yuritilmagan,
 * ya'ni HAMMASI kutayotgan deb qaraladi. Bu ataylab ehtiyotkor: noaniqlikda
 * "zaxira kerak emas" deb qaror qilish xavfli.
 */
export async function kutayotganMigratsiyalar(c) {
  const hammasi = migratsiyaRoyxati();
  const bor = await c.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='_applied_migrations'"
  );
  if (bor.rows.length === 0) return hammasi;

  const res = await c.execute("SELECT name FROM _applied_migrations");
  const qollangan = new Set(res.rows.map((r) => String(r.name)));
  return hammasi.filter((d) => !qollangan.has(d));
}

/** Butun bazani o'qib, surat obyektini qaytaradi. */
export async function suratOl(c) {
  const jadvallar = (
    await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  ).rows
    .map((r) => String(r.name))
    .filter((n) => !xizmatJadvalmi(n));

  const surat = { versiya: VERSIYA, olingan: new Date().toISOString(), jadvallar: {} };

  for (const jadval of jadvallar) {
    const res = await c.execute(`SELECT * FROM "${jadval}"`);
    const ustunlar = res.columns ?? [];
    surat.jadvallar[jadval] = {
      ustunlar,
      qatorlar: res.rows.map((r) => ustunlar.map((u) => tozala(r[u]))),
    };
  }

  return surat;
}

/** Suratdagi jami yozuvlar soni. */
export function jamiYozuv(surat) {
  return Object.values(surat.jadvallar).reduce((s, v) => s + v.qatorlar.length, 0);
}

/**
 * Suratni bazaga qaytaradi.
 *
 * FK tekshiruvi vaqtincha o'chiriladi: jadval tartibi suratda saqlanmagan,
 * shuning uchun bola jadval ota jadvaldan oldin tiklanishi mumkin. Tiklash
 * oxirida `foreign_key_check` bilan butunlik qayta tasdiqlanadi.
 */
export async function suratTikla(c, surat, hisobot = () => {}) {
  if (surat.versiya !== VERSIYA) {
    throw new Error(`surat versiyasi mos emas (faylda ${surat.versiya}, kutilgan ${VERSIYA})`);
  }

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
    hisobot(jadval, qatorlar.length);
  }

  await c.execute("PRAGMA foreign_keys = ON");
  const fk = await c.execute("PRAGMA foreign_key_check");
  if (fk.rows.length > 0) {
    throw new Error(`tiklashdan keyin ${fk.rows.length} ta tashqi kalit buzilishi`);
  }

  return jami;
}
