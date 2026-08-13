import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Tenant konteksti — AsyncLocalStorage orqali joriy so'rovning tenantId'si saqlanadi.
 * `@/lib/prisma` dagi himoyalangan client shu kontekstsiz ishlamaydi (xato tashlaydi),
 * shuning uchun tenant filtrini "esdan chiqarish" texnik jihatdan imkonsiz.
 *
 * Kontekstda AKTOR ham saqlanadi (kim, qaysi IP'dan) — audit jurnali shundan
 * oziqlanadi (lib/db/tenantDb.ts). Aktorsiz ham ishlaydi (cron, bot, tizim
 * amallari): audit yozuvida `userId` bo'sh qoladi.
 */

/** Amalni bajarayotgan foydalanuvchi — audit jurnali uchun. */
export interface Aktor {
  userId: string;
  ism: string | null;
  ip?: string | null;
  /** Impersonatsiya (H-3): amal aslida shu SUPERADMIN tomonidan bajarilgan. */
  impersonatedBy?: string | null;
}

interface TenantStore {
  tenantId: string;
  aktor: Aktor | null;
}

const als = new AsyncLocalStorage<TenantStore>();

/**
 * Berilgan tenant nomidan fn'ni ishga tushiradi — fn ichidagi barcha `prisma`
 * so'rovlari shu tenantga cheklanadi.
 *
 * `aktor` berilsa, fn ichidagi yozish amallari audit jurnaliga shu foydalanuvchi
 * nomidan tushadi.
 *
 * DIQQAT: Prisma promise'i DANGASA — so'rov `await` qilingan joyda bajariladi.
 * Shuning uchun `fn` so'rovni O'Z ICHIDA await qilishi kerak
 * (`async () => await prisma...`), aks holda so'rov kontekstdan tashqarida
 * bajarilib aktor yo'qoladi. `withTenant` va sahifalar aynan shunday qiladi.
 */
export function runWithTenant<T>(tenantId: string, fn: () => T, aktor: Aktor | null = null): T {
  return als.run({ tenantId, aktor }, fn);
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

/** Joriy aktor (audit uchun). Tizim amallarida (cron, bot) null. */
export function currentAktor(): Aktor | null {
  return als.getStore()?.aktor ?? null;
}
