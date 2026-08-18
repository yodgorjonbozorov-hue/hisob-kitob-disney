// MIGRATSIYA QO'LLASH — provayderga qarab ikki yo'l.
//
// SQLite/Turso: migratsiya SQL fayllari libsql orqali qo'llanadi (Prisma
// `migrate deploy` libsql:// protokolini qo'llab-quvvatlamaydi). Idempotent:
// qo'llanganlar `_applied_migrations` jadvalida belgilanadi.
//
// PostgreSQL: `prisma migrate deploy` ishlatiladi — Postgres'da bu standart
// yo'l va hisobotni Prisma o'zi (`_prisma_migrations`) yuritadi. Migratsiya
// SQL'ini qo'lda qo'llash u yerda faqat zarar qilardi: hisobot yuritilmay
// qolib, keyingi `prisma migrate` chaqiruvlari bazani "boshqa holatda" deb
// hisoblardi.
//
// Vercel build vaqtida avtomatik ishlaydi (build skriptida) — env Vercel'dan
// keladi, lokalda .env'dan (dotenv). DATABASE_URL bo'lmasa jimgina
// o'tkazib yuboriladi.
import "dotenv/config";
import { createClient } from "@libsql/client";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { isPostgres } from "../src/lib/db/provider.cjs";
import { RUXSAT_ENV, migratsiyaRuxsati } from "./lib/rejim.cjs";
import { pgKlient, kutayotganMigratsiyalar } from "./lib/pg-surat.cjs";

const MIGRATIONS_DIR = "prisma/migrations";
const SXEMA = "prisma/schema.prisma";

// DATABASE_URL bo'lmasa (masalan, env'siz lokal build) jimgina o'tkazib yuboriladi.
if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL yo'q — migratsiya o'tkazib yuborildi.");
  process.exit(0);
}

/**
 * PostgreSQL yo'li: `prisma migrate deploy`.
 *
 * OLDIN SXEMA TEKSHIRILADI. `DATABASE_URL` Postgres'ni ko'rsatib turgani
 * holda sxemada `provider = "sqlite"` qolgan bo'lsa — bu YARIM BAJARILGAN
 * ko'chish. Bunday holatda `migrate deploy` SQLite migratsiyalarini
 * Postgres'ga qo'llashga urinib, tushunarsiz xato bilan yiqilardi (yoki
 * yomoni — yarim qo'llardi). Shuning uchun aniq xabar bilan to'xtaymiz.
 */
/** Sxemadagi datasource provayderi ("sqlite" | "postgresql" | null). */
function sxemaProvayderi() {
  const sxema = existsSync(SXEMA) ? readFileSync(SXEMA, "utf8") : "";
  return /provider\s*=\s*"(sqlite|postgresql)"/.exec(sxema)?.[1] ?? null;
}

/**
 * Prisma CLI ni MAHALLIY o'rnatilganidan chaqiradi.
 *
 * `npx prisma` loyihaning `node_modules` idan topolmasa INTERNETDAN eng
 * so'nggi versiyani tortadi. Tekshirildi: bunday holatda Prisma 7.x tushadi
 * va loyihaning 5.x sxemasini "validation error" bilan rad etadi. Migratsiya
 * qo'llaydigan vositaning versiyasi tasodifga qolmasligi kerak.
 */
function prismaBinari() {
  const mahalliy = join("node_modules", ".bin", "prisma");
  return existsSync(mahalliy) ? mahalliy : null;
}

/**
 * Build muhitida: bazaga YOZMASDAN kutayotgan migratsiya bor-yo'qligini
 * tekshiradi. `pg_dump` ham, yozish huquqi ham kerak emas — faqat o'qish.
 */
async function kutayotganlarniTekshir() {
  let kutayotgan;
  try {
    const c = await pgKlient();
    try {
      kutayotgan = await kutayotganMigratsiyalar(c);
    } finally {
      await c.end();
    }
  } catch (e) {
    console.error(
      `\n❌ Bazaga ulanib bo'lmadi — kutayotgan migratsiyalarni tekshirib bo'lmadi.\n\n` +
        `   ${e.message}\n\n   Baza O'ZGARTIRILMADI.\n`
    );
    process.exit(1);
  }

  if (kutayotgan.length === 0) {
    console.log("PostgreSQL: kutayotgan migratsiya yo'q — build davom etadi.");
    process.exit(0);
  }

  console.error(
    `\n❌ ${kutayotgan.length} ta migratsiya hali qo'llanmagan:\n\n` +
      kutayotgan.map((d) => `     · ${d}`).join("\n") +
      "\n\n   PostgreSQL migratsiyasi build ichida BAJARILMAYDI — u zaxira bilan\n" +
      "   birga CI'da qo'llanadi (GitHub -> Actions -> \"Migratsiya qo'llash\").\n\n" +
      "   Avval o'sha workflow'ni ishga tushiring, keyin qayta deploy qiling.\n" +
      `   (CI o'zini ${RUXSAT_ENV}=ha bilan tanitadi.)\n\n` +
      "   Baza O'ZGARTIRILMADI.\n"
  );
  process.exit(1);
}

async function postgresMigratsiya() {
  if (sxemaProvayderi() === "sqlite") {
    console.error(
      "\n❌ DATABASE_URL PostgreSQL'ni ko'rsatmoqda, lekin prisma/schema.prisma hali " +
        '`provider = "sqlite"`.\n\n' +
        "   Ko'chish tartibi (docs/POSTGRES-KOCHISH.md):\n" +
        "     1. eski bazadan zaxira oling (npm run backup)\n" +
        '     2. sxemada provider ni "postgresql" ga almashtiring\n' +
        "     3. prisma/migrations <-> prisma/migrations-postgres papkalarini almashtiring\n" +
        "     4. npx prisma generate\n\n" +
        "   Baza O'ZGARTIRILMADI.\n"
    );
    process.exit(1);
  }

  // BUILD MUHITIDA MIGRATSIYA QILINMAYDI (audit: P0-3).
  //
  // Postgres migratsiyasi CI'da (`migratsiya.yml`) bajariladi: u yerda
  // `pg_dump` bor va zaxira olinadi. Vercel build esa faqat ilovani
  // yig'adi. Bu yerda ikki narsa ta'minlanadi:
  //   1. production migratsiyasi build ichida JIMGINA ishga tushmaydi;
  //   2. sxemasi bazadan OLDINDA bo'lgan ilova deploy bo'lib ketmaydi —
  //      kutayotgan migratsiya bo'lsa build to'xtaydi.
  if (!migratsiyaRuxsati()) {
    await kutayotganlarniTekshir();
    return;
  }

  const bin = prismaBinari();
  if (!bin) {
    console.error(
      "\n❌ Prisma CLI topilmadi (node_modules/.bin/prisma).\n\n" +
        "   `npm ci` bajarilganiga ishonch hosil qiling. Internetdan tortib olingan\n" +
        "   boshqa versiya bilan migratsiya qo'llash XAVFLI — versiya sxemaga mos\n" +
        "   kelmasligi mumkin.\n\n   Baza O'ZGARTIRILMADI.\n"
    );
    process.exit(1);
  }

  console.log("PostgreSQL — `prisma migrate deploy` ishlatiladi.");
  const res = spawnSync(bin, ["migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) {
    console.error("XATO: `prisma migrate deploy` yiqildi.");
    process.exit(1);
  }
  console.log("Migratsiya tugadi.");
  process.exit(0);
}

if (isPostgres(process.env.DATABASE_URL)) {
  await postgresMigratsiya();
}

// TESKARI YO'NALISH QO'RIQCHISI. Sxema Postgres'ga o'tkazilgan, lekin
// `DATABASE_URL` hali `file:`/`libsql:` bo'lsa — quyidagi SQLite yo'li
// `prisma/migrations/` dagi POSTGRES SQL'ini libsql orqali qo'llashga
// urinadi. Tekshirildi: u YARIM QO'LLANADI (47 jadval yaratilib, keyin
// `near "CONSTRAINT": syntax error` bilan to'xtadi) va hisobotga hech narsa
// yozilmaydi — qo'lda tozalashsiz tuzatib bo'lmaydigan holat.
if (sxemaProvayderi() === "postgresql") {
  console.error(
    "\n❌ prisma/schema.prisma PostgreSQL uchun sozlangan, lekin DATABASE_URL " +
      "SQLite/Turso bazasini ko'rsatmoqda.\n\n" +
      "   Bu holatda Postgres migratsiyalari SQLite'ga YARIM qo'llanadi —\n" +
      "   baza qo'lda tozalashsiz tuzatib bo'lmaydigan holatga tushadi.\n\n" +
      "   Yechim: DATABASE_URL ni Postgres bazasiga qarating, yoki sxemani\n" +
      "   va prisma/migrations papkasini SQLite holatiga qaytaring.\n\n" +
      "   Baza O'ZGARTIRILMADI.\n"
  );
  process.exit(1);
}

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function main() {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"
  );

  const dirs = readdirSync(MIGRATIONS_DIR)
    .filter((d) => existsSync(join(MIGRATIONS_DIR, d, "migration.sql")))
    .sort();

  const appliedRes = await client.execute("SELECT name FROM _applied_migrations");
  const applied = new Set(appliedRes.rows.map((r) => String(r.name)));

  for (const dir of dirs) {
    if (applied.has(dir)) {
      console.log("o'tkazib yuborildi (allaqachon):", dir);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
    await client.executeMultiple(sql);
    await client.execute({ sql: "INSERT INTO _applied_migrations (name) VALUES (?)", args: [dir] });
    console.log("qo'llandi:", dir);
  }

  console.log("Migratsiya tugadi.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("XATO:", e.message);
    process.exit(1);
  });
