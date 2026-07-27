import type { PrismaClient } from "@prisma/client";
import { tenantClient } from "./db/tenantDb";
import { currentTenantId } from "./db/tenantContext";

/**
 * TENANT-HIMOYALANGAN Prisma client.
 *
 * Bu obyektga har qanday murojaat joriy tenant kontekstini talab qiladi
 * (runWithTenant / withTenant / requireTenant orqali o'rnatiladi). Kontekst
 * bo'lmasa — xato tashlanadi; jimgina barcha yozuvlarni qaytarish YO'Q.
 *
 * Barcha so'rovlarga tenant filtri avtomatik qo'shiladi (batafsil: lib/db/tenantDb.ts).
 * Tizim ishlari (auth, bot foydalanuvchi aniqlash, cron aylanishi) uchun
 * `@/lib/db/rawPrisma` dan ochiq foydalaniladi.
 */
export const prisma = new Proxy({} as Record<string | symbol, unknown>, {
  get(_target, prop) {
    const client = tenantClient(currentTenantId()) as any;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as unknown as PrismaClient;
