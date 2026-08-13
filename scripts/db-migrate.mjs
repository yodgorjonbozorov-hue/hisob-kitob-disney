// Migratsiya SQL fayllarini libsql orqali qo'llaydi (Prisma migrate deploy libsql://
// protokolini qo'llab-quvvatlamaydi). Lokal (file:) va Turso (libsql://) ikkalasida ishlaydi.
//
// Kafolatlar (H-5):
//  - Idempotent: qo'llanganlar `_applied_migrations` da belgilanadi.
//  - CHECKSUM: har faylning SHA-256 hash'i saqlanadi. Qo'llangan migratsiya
//    fayli keyin O'ZGARTIRILGAN bo'lsa skript aniq xato bilan TO'XTAYDI —
//    "fayl bir xil nomda, lekin boshqa mazmunda" degan jim xato yo'q.
//  - ATOMIK: har migratsiya (bookkeeping yozuvi bilan birga) BITTA
//    tranzaksiyada bajariladi — yarim qo'llangan migratsiya qolmaydi.
//  - Yiqilganda qaysi FAYL va qaysi STATEMENT ekani aniq yoziladi.
//
// DIQQAT: bu skript endi `npm run build` zanjirida EMAS (TASK 3.1) — build
// production bazasiga tegmaydi. Qo'llash yo'llari: `npm run db:apply` (lokal),
// `.github/workflows/migratsiya.yml` (production, zaxira bilan).
import "dotenv/config";
import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = "prisma/migrations";

// DATABASE_URL bo'lmasa (masalan, env'siz lokal build) jimgina o'tkazib yuboriladi.
if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL yo'q — migratsiya o'tkazib yuborildi.");
  process.exit(0);
}

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

function checksum(sql) {
  return createHash("sha256").update(sql, "utf8").digest("hex");
}

/**
 * SQL skriptni alohida statementlarga bo'ladi: '...'/"..." ichidagi va
 * -- izohlardagi ";" ni hurmat qiladi. Trigger (BEGIN...END bloklari)
 * migratsiyalarimizda yo'q — Prisma SQLite uchun ularni ishlatmaydi.
 */
function statementlarga(sql) {
  const natija = [];
  let joriy = "";
  let holat = null; // null | "'" | '"' | "--"
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (holat === "--") {
      joriy += ch;
      if (ch === "\n") holat = null;
      continue;
    }
    if (holat === "'" || holat === '"') {
      joriy += ch;
      if (ch === holat) holat = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      holat = ch;
      joriy += ch;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      holat = "--";
      joriy += ch;
      continue;
    }
    if (ch === ";") {
      if (joriy.trim()) natija.push(joriy.trim());
      joriy = "";
      continue;
    }
    joriy += ch;
  }
  if (joriy.trim()) natija.push(joriy.trim());
  return natija;
}

async function main() {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"
  );
  // Checksum ustuni keyin qo'shilgan — eski bazalarda yo'q bo'ladi.
  const ustunlar = await client.execute("PRAGMA table_info(_applied_migrations)");
  if (!ustunlar.rows.some((r) => String(r.name) === "checksum")) {
    await client.execute("ALTER TABLE _applied_migrations ADD COLUMN checksum TEXT");
  }

  const dirs = readdirSync(MIGRATIONS_DIR)
    .filter((d) => existsSync(join(MIGRATIONS_DIR, d, "migration.sql")))
    .sort();

  const appliedRes = await client.execute("SELECT name, checksum FROM _applied_migrations");
  const applied = new Map(
    appliedRes.rows.map((r) => [String(r.name), r.checksum == null ? null : String(r.checksum)])
  );

  for (const dir of dirs) {
    const sql = readFileSync(join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8");
    const hash = checksum(sql);

    if (applied.has(dir)) {
      const saqlangan = applied.get(dir);
      if (saqlangan === null) {
        // Checksum'gacha qo'llangan migratsiya — hozirgi hash yozib qo'yiladi.
        // (Retrospektiv tekshirib bo'lmaydi; bundan keyin o'zgarish ushlanadi.)
        await client.execute({
          sql: "UPDATE _applied_migrations SET checksum = ? WHERE name = ?",
          args: [hash, dir],
        });
        console.log("o'tkazib yuborildi (allaqachon, checksum yozildi):", dir);
      } else if (saqlangan !== hash) {
        console.error(`\n❌ QO'LLANGAN migratsiya fayli O'ZGARGAN: ${dir}`);
        console.error(`   Bazadagi checksum: ${saqlangan}`);
        console.error(`   Fayldagi checksum: ${hash}`);
        console.error(
          "   Qo'llangan migratsiya fayli hech qachon tahrirlanmaydi (CLAUDE.md) —\n" +
            "   o'zgarish YANGI migratsiya sifatida yoziladi. Faylni asl holiga qaytaring."
        );
        process.exit(1);
      } else {
        console.log("o'tkazib yuborildi (allaqachon):", dir);
      }
      continue;
    }

    // Har migratsiya + bookkeeping — bitta tranzaksiyada. O'rtada yiqilsa
    // hammasi orqaga qaytadi: "qo'llandi deb belgilanmagan yarim migratsiya"
    // yoki "belgilangan lekin qo'llanmagan" holat bo'lmaydi.
    const statementlar = statementlarga(sql);
    const tx = await client.transaction("write");
    try {
      for (let i = 0; i < statementlar.length; i++) {
        try {
          await tx.execute(statementlar[i]);
        } catch (e) {
          const qisqa = statementlar[i].replace(/\s+/g, " ").slice(0, 160);
          throw new Error(
            `${dir} — ${i + 1}/${statementlar.length}-statement yiqildi:\n` +
              `   ${qisqa}${statementlar[i].length > 160 ? "..." : ""}\n` +
              `   Sabab: ${e.message}`
          );
        }
      }
      await tx.execute({
        sql: "INSERT INTO _applied_migrations (name, checksum) VALUES (?, ?)",
        args: [dir, hash],
      });
      await tx.commit();
    } catch (e) {
      // Rollback best-effort — libsql tranzaksiyasi commit bo'lmagani uchun
      // baza o'zgarishlari baribir saqlanmaydi.
      await tx.rollback().catch(() => {});
      throw e;
    }
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
