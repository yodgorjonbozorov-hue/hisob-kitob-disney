import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

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

// @libsql/client "file:./dev.db" (lokal) va "libsql://...turso.io" (production)
// ikkalasini ham bir xil kodda qo'llab-quvvatlaydi.
function createRawPrisma(): PrismaClient {
  const libsqlClient = createClient({
    url: process.env.DATABASE_URL as string,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return new PrismaClient({
    adapter: new PrismaLibSQL(libsqlClient),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
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
