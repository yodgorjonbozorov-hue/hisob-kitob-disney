// Migratsiya SQL fayllarini libsql orqali qo'llaydi (Prisma migrate deploy libsql://
// protokolini qo'llab-quvvatlamaydi). Lokal (file:) va Turso (libsql://) ikkalasida ishlaydi.
// Idempotent: qo'llangan migratsiyalar `_applied_migrations` jadvalida belgilanadi.
// Vercel build vaqtida avtomatik ishlaydi (build skriptida) — env Vercel'dan keladi,
// lokalda .env'dan (dotenv). DATABASE_URL bo'lmasa jimgina o'tkazib yuboriladi.
import "dotenv/config";
import { createClient } from "@libsql/client";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "prisma/migrations";

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
