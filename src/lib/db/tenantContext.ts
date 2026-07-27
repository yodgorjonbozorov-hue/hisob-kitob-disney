import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Tenant konteksti — AsyncLocalStorage orqali joriy so'rovning tenantId'si saqlanadi.
 * `@/lib/prisma` dagi himoyalangan client shu kontekstsiz ishlamaydi (xato tashlaydi),
 * shuning uchun tenant filtrini "esdan chiqarish" texnik jihatdan imkonsiz.
 */
interface TenantStore {
  tenantId: string;
}

const als = new AsyncLocalStorage<TenantStore>();

/** Berilgan tenant nomidan fn'ni ishga tushiradi — fn ichidagi barcha `prisma` so'rovlari shu tenantga cheklanadi. */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return als.run({ tenantId }, fn);
}

/** Joriy tenantId. Kontekst bo'lmasa xato — jimgina hamma yozuvni qaytarish YO'Q. */
export function currentTenantId(): string {
  const store = als.getStore();
  if (!store) {
    throw new Error(
      "Tenant konteksti yo'q: so'rov runWithTenant/withTenant ichida bajarilishi shart. " +
        "Tizim ishlari (auth, bot, cron) uchun rawPrisma'dan ochiq foydalaning."
    );
  }
  return store.tenantId;
}

/** Kontekst bor-yo'qligini tekshirish (xatosiz). */
export function maybeTenantId(): string | null {
  return als.getStore()?.tenantId ?? null;
}
