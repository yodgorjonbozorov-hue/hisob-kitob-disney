import { rawPrisma } from "@/lib/db/rawPrisma";

/** Har tenant uchun kunlik AI so'rovlar limiti (xarajat nazorati). */
export const KUNLIK_AI_LIMIT = 50;

/**
 * So'rovni hisobga oladi. Limit oshgan bo'lsa false.
 *
 * Hisoblagich `AppSetting`da (kalit tenant+kun) — serverless instansiyalar aro
 * barqaror. ATOMIK: ilgari `read → write` ketma-ketligi edi, parallel so'rovlar
 * bir xil `soni` ni o'qib limitdan oshib ketardi. Endi oshirish bitta
 * `UPDATE ... value + 1` amalida bajariladi va NATIJA bo'yicha qaror qilinadi.
 */
export async function aiLimitTekshir(tenantId: string): Promise<{ ok: boolean; qoldi: number }> {
  const bugun = new Date().toISOString().slice(0, 10);
  const key = `aiUsage:${tenantId}:${bugun}`;

  // Atomik oshirish + O'Z natijasini olish (`RETURNING`). Alohida SELECT bilan
  // parallel so'rovlar bir xil qiymatni o'qib limitdan oshib ketardi.
  const oshirilgan = await rawPrisma.$queryRaw<Array<{ value: string }>>`
    UPDATE "AppSetting" SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT)
    WHERE "key" = ${key}
    RETURNING "value"
  `;

  let soni: number;
  if (oshirilgan.length > 0) {
    soni = Number(oshirilgan[0].value);
  } else {
    try {
      await rawPrisma.appSetting.create({ data: { key, value: "1" } });
      soni = 1;
    } catch {
      // Poyga: boshqa so'rov ayni paytda yaratdi — oshiramiz.
      const qayta = await rawPrisma.$queryRaw<Array<{ value: string }>>`
        UPDATE "AppSetting" SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT)
        WHERE "key" = ${key}
        RETURNING "value"
      `;
      soni = Number(qayta[0]?.value ?? "1");
    }
  }

  if (soni > KUNLIK_AI_LIMIT) {
    return { ok: false, qoldi: 0 };
  }
  return { ok: true, qoldi: Math.max(0, KUNLIK_AI_LIMIT - soni) };
}
