// Tizim darajasidagi kalit-qiymat hisoblagichi (AppSetting) — tenantga
// tegishli emas, shu sababli `rawPrisma` (CLAUDE.md: `src/lib/db/`).
import { rawPrisma } from "./rawPrisma";

/**
 * ODDIY SANOQ HISOBLAGICHI (`AppSetting` ustida).
 *
 * Nega shunday: loyihada analytics stack YO'Q va faqat demo uchun yangisini
 * qurish ortiqcha bo'lardi. Bir nechta savolga javob berish uchun ("demo
 * necha marta ochildi", "demo'dan necha kishi ro'yxatdan o'tdi") kalit
 * bo'yicha kunlik sanoq yetarli. Mexanizm `lib/rateLimit.ts` dagi bilan bir
 * xil — atomik `UPDATE ... RETURNING`, poyga bo'lsa `create`.
 *
 * FAIL-OPEN: hisoblagich yozilmasa amal TO'XTAMAYDI. O'lchov — yordamchi
 * ma'lumot, u tufayli mijoz demo'ga kira olmay qolmasligi kerak.
 */
export async function sanoqOshir(kalit: string): Promise<void> {
  try {
    const oshirilgan = await rawPrisma.$queryRaw<Array<{ value: string }>>`
      UPDATE "AppSetting" SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT)
      WHERE "key" = ${kalit}
      RETURNING "value"
    `;
    if (oshirilgan.length > 0) return;
    try {
      await rawPrisma.appSetting.create({ data: { key: kalit, value: "1" } });
    } catch {
      // Poyga: boshqa so'rov ayni paytda yaratib ulgurdi.
      await rawPrisma.$queryRaw`
        UPDATE "AppSetting" SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT)
        WHERE "key" = ${kalit}
      `;
    }
  } catch (error) {
    console.error(`Hisoblagich yozilmadi (${kalit}):`, error);
  }
}

/** Kunlik hisoblagich kaliti: `demo:kirish:2026-09-07`. */
export function kunlikKalit(nom: string, kun: Date = new Date()): string {
  return `${nom}:${kun.toISOString().slice(0, 10)}`;
}
