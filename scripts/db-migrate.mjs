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
function postgresMigratsiya() {
  const sxema = existsSync(SXEMA) ? readFileSync(SXEMA, "utf8") : "";
  if (/provider\s*=\s*"sqlite"/.test(sxema)) {
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

  console.log("PostgreSQL — `prisma migrate deploy` ishlatiladi.");
  const res = spawnSync("npx", ["prisma", "migrate", "deploy"], {
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
  postgresMigratsiya();
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
