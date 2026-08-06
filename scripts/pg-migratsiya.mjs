/**
 * PostgreSQL boshlang'ich migratsiyasini QAYTA generatsiya qiladi.
 *
 *   npm run pg:migratsiya
 *
 * Nega kerak: `prisma/migrations-postgres/` hozircha ishlatilmaydi, ya'ni
 * sxemaga yangi model qo'shilganda u avtomatik yangilanmaydi va jimgina
 * eskirib qoladi. Ko'chishdan oldin shu skript ishga tushiriladi.
 *
 * Baza ULANISHI SHART EMAS: `prisma migrate diff --from-empty` sxemani
 * o'qib SQL yozadi, hech qayerga ulanmaydi. `DATABASE_URL` faqat provayder
 * aniqlash uchun kerak, shuning uchun soxta qiymat beriladi.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const ILDIZ = join(dirname(new URL(import.meta.url).pathname), "..");
const SXEMA = join(ILDIZ, "prisma/schema.prisma");
const VAQTINCHA = join(ILDIZ, "prisma/.pg-schema.tmp.prisma");
const ODATDAGI = join(ILDIZ, "prisma/migrations-postgres/00000000000000_init/migration.sql");

/**
 * `--chiqish <yol>` — boshqa faylga yozish.
 *
 * Nega kerak: `tests/postgres.test.ts` fayl eskirmaganini tekshiradi, ya'ni
 * qayta generatsiya qilib solishtiradi. Chiqish yo'li qotib qolgan bo'lsa,
 * test tekshirayotgan faylning O'ZINI qayta yozib yuborardi va hech qachon
 * qizil bo'lmasdi.
 */
function chiqishYoli() {
  const i = process.argv.indexOf("--chiqish");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : ODATDAGI;
}

const MAQSAD = chiqishYoli();

/**
 * Login uchun funksional indeks — Prisma sxemadan generatsiya qilmaydi.
 * `lib/db/dialect.ts` dagi `registrsizTeng()` Postgres yo'lida
 * `WHERE LOWER("login") = ...` yozadi; indekssiz bu butun jadvalni
 * skanerlaydi va login sahifasi eng ko'p chaqiriladigan joy.
 */
const QOLDA = `
-- ---------------------------------------------------------------------------
-- QO'LDA QO'SHILGAN: registrsiz login qidiruvi uchun funksional indeks.
-- (scripts/pg-migratsiya.mjs har generatsiyada qo'shib qo'yadi.)
-- ---------------------------------------------------------------------------
CREATE INDEX "User_login_lower_idx" ON "User" (LOWER("login"));
`;

function main() {
  const sxema = readFileSync(SXEMA, "utf8");
  if (!sxema.includes('provider = "sqlite"')) {
    console.error(
      'XATO: sxemada provider "sqlite" emas. Ko\'chish allaqachon bajarilgan bo\'lsa, ' +
        "bu skript endi kerak emas — oddiy `prisma migrate dev` ishlating."
    );
    process.exit(1);
  }

  writeFileSync(VAQTINCHA, sxema.replace('provider = "sqlite"', 'provider = "postgresql"'));

  try {
    const res = spawnSync(
      "npx",
      [
        "prisma",
        "migrate",
        "diff",
        "--from-empty",
        "--to-schema-datamodel",
        VAQTINCHA,
        "--script",
      ],
      {
        cwd: ILDIZ,
        encoding: "utf8",
        // Soxta URL — faqat provayder aniqlash uchun, ulanish bo'lmaydi.
        env: { ...process.env, DATABASE_URL: "postgresql://u:p@localhost:5432/db" },
      }
    );

    if (res.status !== 0) {
      console.error("Generatsiya xatosi:\n", res.stdout, res.stderr);
      process.exit(1);
    }

    mkdirSync(dirname(MAQSAD), { recursive: true });
    writeFileSync(MAQSAD, res.stdout + QOLDA);

    const jadval = (res.stdout.match(/CREATE TABLE/g) ?? []).length;
    const indeks = (res.stdout.match(/CREATE (UNIQUE )?INDEX/g) ?? []).length + 1;
    const fk = (res.stdout.match(/FOREIGN KEY/g) ?? []).length;
    console.log(`✅ ${MAQSAD}`);
    console.log(`   ${jadval} jadval, ${indeks} indeks, ${fk} tashqi kalit`);
  } finally {
    rmSync(VAQTINCHA, { force: true });
  }
}

main();
