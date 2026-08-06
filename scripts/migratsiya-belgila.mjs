/**
 * Allaqachon QO'LLANGAN migratsiyalarni hisobotda belgilash.
 *
 *   npm run migratsiya:belgila -- <oxirgi-qo'llangan-migratsiya-nomi>
 *   npm run migratsiya:belgila -- --royxat        (nomlarni ko'rsatadi)
 *
 * NEGA KERAK: `scripts/db-migrate.mjs` qaysi migratsiya qo'llanganini
 * `_applied_migrations` jadvalida yuritadi. Agar baza boshqa yo'l bilan
 * qurilgan bo'lsa (`prisma migrate deploy`, `db push`, qo'lda SQL), bu
 * jadval bo'sh qoladi va runner hammasini boshidan qo'llashga urinib
 * "table already exists" bilan yiqiladi.
 *
 * Bu skript SQL BAJARMAYDI — faqat berilgan migratsiyagacha bo'lganlarini
 * "qo'llangan" deb belgilaydi. Ya'ni u bazaga tegmaydi, faqat hisobotni
 * haqiqatga moslashtiradi.
 *
 * ⚠️ Noto'g'ri nom bersangiz, hali qo'llanmagan migratsiya "qo'llangan" deb
 * belgilanadi va u HECH QACHON bajarilmaydi. Shu bois skript belgilashdan
 * oldin ro'yxatni ko'rsatadi va tasdiq so'raydi (`--tasdiq`).
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const MIGRATSIYALAR = "prisma/migrations";

function royxat() {
  return readdirSync(MIGRATSIYALAR)
    .filter((d) => existsSync(join(MIGRATSIYALAR, d, "migration.sql")))
    .sort();
}

async function main() {
  const args = process.argv.slice(2);
  const hammasi = royxat();

  if (args.includes("--royxat") || args.length === 0) {
    console.log("\nMigratsiyalar (tartib bo'yicha):\n");
    hammasi.forEach((d, i) => console.log(`  ${String(i + 1).padStart(2)}. ${d}`));
    console.log(
      "\nBelgilash:\n  npm run migratsiya:belgila -- <nom> --tasdiq\n" +
        "\nQaysi biri qo'llanganini bilish uchun bazadagi jadvallarga qarang:\n" +
        "  Account bor        -> 20260804130000_kassa_hisob_raqamlar qo'llangan\n" +
        "  Supplier bor       -> 20260804160000_xarid_moduli qo'llangan\n" +
        "  Employee bor       -> 20260804190000_hr_moduli qo'llangan\n"
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("XATO: DATABASE_URL sozlanmagan.");
    process.exit(1);
  }

  const nom = args.find((a) => !a.startsWith("--"));
  const tasdiq = args.includes("--tasdiq");

  const indeks = hammasi.indexOf(nom);
  if (indeks < 0) {
    console.error(`XATO: "${nom}" migratsiyasi topilmadi.\n`);
    console.error("Mavjud nomlar uchun: npm run migratsiya:belgila -- --royxat");
    process.exit(1);
  }

  const belgilanadi = hammasi.slice(0, indeks + 1);
  const qolgan = hammasi.slice(indeks + 1);

  console.log(`\n"Qo'llangan" deb belgilanadi (${belgilanadi.length} ta):`);
  for (const d of belgilanadi) console.log(`  ✓ ${d}`);
  console.log(`\nKeyin qo'llanadi (${qolgan.length} ta):`);
  for (const d of qolgan) console.log(`  · ${d}`);

  if (!tasdiq) {
    console.log(
      "\n⚠️  Hech narsa o'zgartirilmadi. Ro'yxat to'g'ri bo'lsa `--tasdiq` qo'shing:\n" +
        `   npm run migratsiya:belgila -- ${nom} --tasdiq\n`
    );
    return;
  }

  const client = createClient({
    url: process.env.DATABASE_URL,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  await client.execute(
    "CREATE TABLE IF NOT EXISTS _applied_migrations (name TEXT PRIMARY KEY, applied_at TEXT DEFAULT CURRENT_TIMESTAMP)"
  );

  let yangi = 0;
  for (const d of belgilanadi) {
    const res = await client.execute({
      sql: "INSERT OR IGNORE INTO _applied_migrations (name) VALUES (?)",
      args: [d],
    });
    if (res.rowsAffected > 0) yangi++;
  }

  console.log(`\n✅ ${yangi} ta yangi yozuv belgilandi (jami ${belgilanadi.length}).`);
  console.log("Endi `npm run apply:hammasi` ishga tushirishingiz mumkin.\n");
}

main().catch((e) => {
  console.error("XATO:", e.message);
  process.exit(1);
});
