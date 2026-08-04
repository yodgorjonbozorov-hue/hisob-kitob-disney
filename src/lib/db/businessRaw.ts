import { Prisma } from "@prisma/client";
import { rawPrisma } from "./rawPrisma";
import { currentTenantId } from "./tenantContext";

/**
 * TENANT-HIMOYALANGAN XOM SQL.
 *
 * Nima uchun xom SQL: ba'zi agregatlarni Prisma qila olmaydi — oy bo'yicha
 * guruhlash (`GROUP BY substr(sana,1,7)`) yoki ifoda yig'indisi
 * (`SUM(tannarx * miqdor)`). Ularsiz 12+ alohida so'rov ketardi.
 *
 * MUHIM: `$queryRaw` tenant extension'idan O'TMAYDI — filtr avtomatik
 * qo'shilmaydi. Shuning uchun bu yerda tenant sharti SQL'ning O'ZIGA
 * `JOIN "Business"` orqali kiritiladi. Ya'ni himoya baza darajasida qoladi
 * va qo'shimcha so'rov ham ketmaydi.
 *
 * Qoida: shu fayldagi yordamchilardan tashqarida `$queryRaw` ISHLATILMAYDI.
 */

/**
 * `businessId` bo'yicha filtrlangan xom so'rov uchun WHERE bo'lagi.
 * Chaqiruvchi SQL'da `"Business" b` alias'i bo'lishi shart.
 *
 * Misol:
 *   FROM "Transaction" t JOIN "Business" b ON b."id" = t."businessId"
 *   WHERE ${businessScope("t", businessId)} AND ...
 */
export function businessScope(alias: string, businessId: string): Prisma.Sql {
  return Prisma.sql`${Prisma.raw(`"${alias}"."businessId"`)} = ${businessId} AND b."tenantId" = ${currentTenantId()}`;
}

/** Tenant sharti SQL ichida bo'lgan xom so'rovni bajaradi. */
export function businessQueryRaw<T>(sql: Prisma.Sql): Promise<T[]> {
  return rawPrisma.$queryRaw<T[]>(sql);
}

/** SQLite `SUM()` BigInt qaytaradi — pul har doim `Int` (so'm) bo'lishi shart. */
export function songa(value: unknown): number {
  if (value == null) return 0;
  return typeof value === "bigint" ? Number(value) : Number(value);
}

/**
 * DateTime ustunidan "YYYY-MM" yoki "YYYY-MM-DD" kalitini oladi.
 *
 * libsql adapteri DateTime'ni ISO matn sifatida saqlaydi
 * ("2026-07-10T00:00:00+00:00"), lekin eski yozuvlar (yoki Prisma'ning
 * o'z SQLite konnektori) millisekund INTEGER bo'lishi mumkin — ikkala
 * holat ham qo'llab-quvvatlanadi.
 */
export function sanaKalit(column: string, uzunlik: 7 | 10): Prisma.Sql {
  const col = Prisma.raw(column);
  const fmt = uzunlik === 7 ? "%Y-%m" : "%Y-%m-%d";
  return Prisma.sql`CASE WHEN typeof(${col}) = 'text'
      THEN substr(${col}, 1, ${uzunlik})
      ELSE strftime(${fmt}, ${col} / 1000, 'unixepoch') END`;
}
