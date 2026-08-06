import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import { isPostgres } from "./dialect";

/**
 * XOM (scope'siz) Prisma client — tenant filtri YO'Q.
 *
 * Faqat quyidagi tizim joylarida ochiq ishlatilishi mumkin:
 *  - autentifikatsiya (login bo'yicha global qidiruv, parol tekshirish)
 *  - Telegram bot foydalanuvchini chatId bo'yicha aniqlash
 *  - cron (tenantlar bo'ylab aylanish — har tenant ichida runWithTenant)
 *  - kelajakda SUPERADMIN panel
 *
 * Oddiy route/sahifa kodida BUNI ISHLATMANG — `@/lib/prisma` dagi
 * tenant-himoyalangan clientni ishlating.
 */
const globalForPrisma = globalThis as unknown as {
  rawPrisma: PrismaClient | undefined;
};

/**
 * Adapter `DATABASE_URL` sxemasiga qarab tanlanadi:
 *
 *  - `postgresql://` / `postgres://` — PostgreSQL (`@prisma/adapter-pg`);
 *  - qolgani (`file:`, `libsql://`) — SQLite/Turso (`@prisma/adapter-libsql`).
 *
 * Postgres adapteri KECH yuklanadi (`require` shu tarmoqda). Sababi: paket
 * SQLite muhitida o'rnatilmagan bo'lishi mumkin va statik import butun
 * ilovani yiqitardi. Postgres yo'li tanlanmagunicha unga umuman tegilmaydi.
 */
function createRawPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL as string;
  const log: ("error" | "warn")[] =
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

  if (isPostgres(url)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Pool } = require("pg") as typeof import("pg");
    return new PrismaClient({
      adapter: new PrismaPg(new Pool({ connectionString: url })),
      log,
    });
  }

  // @libsql/client "file:./dev.db" (lokal) va "libsql://...turso.io" (production)
  // ikkalasini ham bir xil kodda qo'llab-quvvatlaydi.
  const libsqlClient = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return new PrismaClient({ adapter: new PrismaLibSQL(libsqlClient), log });
}

/**
 * Client BIRINCHI MUROJAATDA yaratiladi (modul import bo'lganda emas).
 *
 * Sababi: `next build` sahifa/route modullarini import qiladi ("Collecting page
 * data"). Import paytida client yaratilsa, DATABASE_URL yo'q muhitda build
 * `URL_INVALID: The URL 'undefined' is not in a valid format` bilan yiqiladi.
 * Kechiktirilgan yaratish bilan build env'siz ham o'tadi; baza faqat haqiqiy
 * so'rov paytida (runtime) kerak bo'ladi.
 */
function getRawPrisma(): PrismaClient {
  globalForPrisma.rawPrisma ??= createRawPrisma();
  return globalForPrisma.rawPrisma;
}

export const rawPrisma = new Proxy({} as Record<string | symbol, unknown>, {
  get(_target, prop) {
    const client = getRawPrisma() as any;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as unknown as PrismaClient;
