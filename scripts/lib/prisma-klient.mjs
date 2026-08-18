/**
 * BUILD SKRIPTLARI UCHUN PRISMA KLIENTI — provayderga qarab adapter tanlaydi.
 *
 * NEGA KERAK. `bootstrap-superadmin.mjs` va `bir-martalik-parol.mjs`
 * `PrismaLibSQL` ni QOTIRIB qurardi. `DATABASE_URL` Postgres bo'lsa
 * `createClient` modul yuklanayotgan paytda (try/catch'siz) yiqilardi:
 *
 *   URL_SCHEME_NOT_SUPPORTED: The client supports only "libsql:", ... got "postgresql:"
 *
 * Bu ikki skript `&&` bilan bog'langan build zanjirida turadi, ya'ni butun
 * deploy shu yerda to'xtardi — garchi skriptlarning o'zi "xato bo'lsa ham
 * build yiqilmasin" degan qoidaga qurilgan bo'lsa ham (xato ularning
 * `.catch()` iga umuman yetib bormasdi).
 *
 * Adapter tanlash qoidasi `src/lib/db/rawPrisma.ts` dagi bilan BIR XIL:
 * `postgresql://`/`postgres://` — `@prisma/adapter-pg`, qolgani —
 * `@prisma/adapter-libsql`. Postgres adapteri KECH yuklanadi, ya'ni SQLite
 * muhitida `pg` paketiga umuman tegilmaydi.
 */
import { PrismaClient } from "@prisma/client";
import { isPostgres } from "../../src/lib/db/provider.cjs";

/**
 * Joriy `DATABASE_URL` uchun mos Prisma klientini quradi.
 *
 * @returns {Promise<PrismaClient>}
 */
export async function prismaKlient(url = process.env.DATABASE_URL) {
  if (isPostgres(url)) {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const { default: pg } = await import("pg");
    return new PrismaClient({ adapter: new PrismaPg(new pg.Pool({ connectionString: url })) });
  }

  const { PrismaLibSQL } = await import("@prisma/adapter-libsql");
  const { createClient } = await import("@libsql/client");
  return new PrismaClient({
    adapter: new PrismaLibSQL(createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN })),
  });
}
