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
 * AUDIT JURNALI O'ZGARTIRILGANDA tashlanadigan xato.
 *
 * ATAYLAB shu faylda va oddiy `Error` merosxo'ri: `@/lib/auth/guard` ni import
 * qilish db qatlamiga Next.js bog'liqligini olib kirardi, rawPrisma esa
 * skriptlarda (zaxira, migratsiya) Next'siz ishlaydi.
 */
export class AuditOzgarmasXatosi extends Error {
  constructor(operation: string) {
    super(
      `Audit jurnali o'zgartirilmaydi (append-only): AuditLog.${operation} taqiqlangan. ` +
        "Yozuvni to'g'rilash kerak bo'lsa YANGI audit yozuvi qo'shiladi."
    );
    this.name = "AuditOzgarmasXatosi";
  }
}

/**
 * APPEND-ONLY AUDIT (Superadmin 2.0, talab 23).
 *
 * Audit jurnali oddiy jadval bo'lib qolsa, superadmin o'z izini o'chira oladi —
 * ya'ni jurnalning ma'nosi yo'qoladi. Shu sababli `AuditLog` ustidagi HAR
 * qanday o'zgartirish/o'chirish amali CLIENT DARAJASIDA bloklanadi:
 * `create` (va `createMany`) dan boshqa yozish amali xato beradi.
 *
 * Qamrov: bu extension `rawPrisma` ning O'ZIGA qo'llanadi, ya'ni tenant
 * clienti (u shu clientdan `$extends` bilan quriladi), superadmin paneli,
 * cron va skriptlar — hammasi shu qoida ostida.
 *
 * CHEKLOV (ochiq aytiladi): `$queryRaw`/`$executeRaw` extension'lardan chetlab
 * o'tadi va baza foydalanuvchisi DELETE huquqiga ega. To'liq kafolat uchun
 * baza darajasidagi trigger yoki alohida rol kerak — bu infratuzilma qarori,
 * ilova kodi bilan hal qilinmaydi. Kod ichida esa o'chirish yo'li YO'Q.
 */
const AUDIT_YOZISH_RUXSATI = new Set(["create", "createMany"]);

function withAuditImmutability(client: PrismaClient): PrismaClient {
  return client.$extends({
    name: "audit-append-only",
    query: {
      auditLog: {
        async $allOperations({ operation, args, query }) {
          const yozish =
            operation.startsWith("create") ||
            operation.startsWith("update") ||
            operation.startsWith("delete") ||
            operation === "upsert";
          if (yozish && !AUDIT_YOZISH_RUXSATI.has(operation)) {
            throw new AuditOzgarmasXatosi(operation);
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

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
  globalForPrisma.rawPrisma ??= withAuditImmutability(createRawPrisma());
  return globalForPrisma.rawPrisma;
}

export const rawPrisma = new Proxy({} as Record<string | symbol, unknown>, {
  get(_target, prop) {
    const client = getRawPrisma() as any;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as unknown as PrismaClient;
