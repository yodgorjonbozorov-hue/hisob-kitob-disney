import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * @libsql/client "file:./dev.db" (lokal) va "libsql://...turso.io" (production)
 * ikkalasini ham bir xil kodda qo'llab-quvvatlaydi — muhitlar orasida kod o'zgarmaydi,
 * faqat DATABASE_URL/DATABASE_AUTH_TOKEN qiymati farq qiladi.
 */
const libsqlClient = createClient({
  url: process.env.DATABASE_URL as string,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
const adapter = new PrismaLibSQL(libsqlClient);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
