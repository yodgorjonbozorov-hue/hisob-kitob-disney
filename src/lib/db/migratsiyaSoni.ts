import { rawPrisma } from "@/lib/db/rawPrisma";

/**
 * BAZAGA QO'LLANGAN MIGRATSIYALAR SONI (tizim darajasi, tenantsiz).
 *
 * Nega `lib/db/` da: `_applied_migrations` — TIZIM jadvali (`scripts/db-migrate.mjs`
 * yuritadi), Prisma sxemasida yo'q va hech qanday tenantga tegishli emas.
 * Shu sababli u faqat xom so'rov bilan o'qiladi va xom so'rov ruxsat etilgan
 * joyda — `lib/db/` ichida — turadi (CLAUDE.md: rawPrisma qoidasi).
 *
 * Faqat SON qaytadi: qaysi migratsiya qo'llangani repozitoriyada allaqachon
 * ochiq, lekin bu funksiya hech qanday tenant/mijoz ma'lumotini o'qimaydi.
 * Baza yoki jadval bo'lmasa `null` — chaqiruvchi buni "aniqlanmadi" deb
 * ko'rsatadi va yiqilmaydi.
 */
export async function qollanganMigratsiyaSoni(): Promise<number | null> {
  try {
    const rows = await rawPrisma.$queryRaw<Array<{ n: number | bigint }>>`
      SELECT COUNT(*) AS n FROM "_applied_migrations"
    `;
    return Number(rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}
