/**
 * POSTGRES SINOV YURITUVCHISI.
 *
 *   node scripts/pg-sinov.mjs tests/magazin-postgres.test.ts
 *
 * NEGA KERAK: Prisma clientda provayder GENERATSIYA PAYTIDA qotib qoladi.
 * Loyiha sxemasi `provider = "sqlite"` bo'lgani uchun `@prisma/adapter-pg`
 * ishlashdan bosh tortadi:
 *
 *   "The Driver Adapter `@prisma/adapter-pg` ... is not compatible with the
 *    provider `sqlite` specified in the Prisma schema."
 *
 * Ya'ni `lib/db/rawPrisma.ts` dagi runtime adapter tanlovi O'ZI YETARLI EMAS
 * — Postgres'ga ko'chishda sxemadagi provayder ham almashtirilishi va client
 * qayta generatsiya qilinishi shart (docs/POSTGRES-KOCHISH.md, 1-qadam).
 *
 * Shu skript aynan o'sha qadamni SINOV UCHUN vaqtincha bajaradi:
 *   1. sxemaning nusxasini oladi va provayderni `postgresql` ga o'zgartiradi;
 *   2. client'ni shu nusxadan generatsiya qiladi;
 *   3. berilgan test faylini ishga tushiradi;
 *   4. `finally` — client'ni ASL (sqlite) sxemadan qayta generatsiya qiladi.
 *
 * To'rtinchi qadam MAJBURIY: client node_modules'dagi umumiy joyga
 * yoziladi, ya'ni tiklanmasa keyingi SQLite testlari yiqilardi. Shuning
 * uchun u `finally` da va jarayon uzilishida ham bajariladi.
 *
 * `PG_TEST_URL` berilmasa hech narsa qilinmaydi — test o'zi o'tkazib
 * yuboriladi (Postgres yo'q mashinada to'plam yashil qolsin).
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const SXEMA = "prisma/schema.prisma";
const testFayli = process.argv[2];

if (!testFayli) {
  console.error("Ishlatish: node scripts/pg-sinov.mjs <test-fayli>");
  process.exit(1);
}

// Postgres yo'q — testning o'zi skip qiladi, client'ga TEGMAYMIZ.
if (!process.env.PG_TEST_URL) {
  const res = spawnSync(process.execPath, ["-r", "ts-node/register", testFayli], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(res.status ?? 1);
}

function generatsiya(sxemaYoli, nom) {
  const res = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["prisma", "generate", "--schema", sxemaYoli],
    {
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: process.env.PG_TEST_URL },
    }
  );
  if (res.status !== 0) {
    throw new Error(`${nom} generatsiyasi yiqildi:\n${res.stdout}\n${res.stderr}`);
  }
}

/**
 * Vaqtinchalik sxema LOYIHA ICHIDA turadi (tmpdir'da emas).
 *
 * Prisma sxema joylashgan papkadan yuqoriga qarab `package.json` qidiradi;
 * u topilmasa Prisma'ni "avto-o'rnatishga" urinadi va yiqiladi. Aynan shu
 * sabab `scripts/pg-migratsiya.mjs` ham `prisma/` ichiga yozadi.
 */
const pgSxema = "prisma/.pg-sinov.tmp.prisma";

/** Client asl (sqlite) holatiga qaytarilganmi — ikki marta tiklamaslik uchun. */
let tiklandi = false;
function tikla() {
  if (tiklandi) return;
  tiklandi = true;
  try {
    generatsiya(SXEMA, "SQLite client (tiklash)");
    console.log("Prisma client SQLite holatiga qaytarildi.");
  } catch (e) {
    // Bu JIDDIY: tiklanmasa keyingi testlar yiqiladi. Baland ovozda aytamiz.
    console.error("OGOHLANTIRISH: client tiklanmadi — qo'lda `npx prisma generate` qiling.");
    console.error(String(e));
  }
  rmSync(pgSxema, { force: true });
}

// Uzilib qolgan yurishda ham client tiklansin.
process.once("SIGINT", () => {
  tikla();
  process.exit(130);
});
process.once("SIGTERM", () => {
  tikla();
  process.exit(143);
});

let holat = 1;
try {
  const asl = readFileSync(SXEMA, "utf8");
  // FAQAT datasource blokidagi provayder almashtiriladi — sxemaning
  // qolgan qismiga tegilmaydi (pg-migratsiya.mjs bilan bir xil usul).
  const pg = asl.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  if (pg === asl) throw new Error(`${SXEMA} da 'provider = "sqlite"' topilmadi`);
  writeFileSync(pgSxema, pg);

  generatsiya(pgSxema, "PostgreSQL client");

  const res = spawnSync(process.execPath, ["-r", "ts-node/register", testFayli], {
    stdio: "inherit",
    env: process.env,
  });
  holat = res.status ?? 1;
} catch (e) {
  console.error("XATO:", e instanceof Error ? e.message : String(e));
  holat = 1;
} finally {
  tikla();
}

process.exit(holat);
