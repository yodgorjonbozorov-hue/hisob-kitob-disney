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
const libsqlClient = createClient({
  url: process.env.DATABASE_URL as string,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const adapter = new PrismaLibSQL(libsqlClient);

export const rawPrisma =
  globalForPrisma.rawPrisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.rawPrisma = rawPrisma;
}
