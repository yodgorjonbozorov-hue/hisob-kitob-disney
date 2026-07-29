import { rawPrisma } from "@/lib/db/rawPrisma";

/** Har tenant uchun kunlik AI so'rovlar limiti (xarajat nazorati). */
export const KUNLIK_AI_LIMIT = 50;

/**
 * So'rovni hisobga oladi. Limit oshgan bo'lsa false.
 * Hisoblagich AppSetting'da (kalit tenant+kun) — serverless instansiyalar aro barqaror.
 */
export async function aiLimitTekshir(tenantId: string): Promise<{ ok: boolean; qoldi: number }> {
  const bugun = new Date().toISOString().slice(0, 10);
  const key = `aiUsage:${tenantId}:${bugun}`;

  const joriy = await rawPrisma.appSetting.findUnique({ where: { key } });
  const soni = joriy ? parseInt(joriy.value, 10) || 0 : 0;

  if (soni >= KUNLIK_AI_LIMIT) {
    return { ok: false, qoldi: 0 };
  }

  await rawPrisma.appSetting.upsert({
    where: { key },
    update: { value: String(soni + 1) },
    create: { key, value: "1" },
  });
  return { ok: true, qoldi: KUNLIK_AI_LIMIT - soni - 1 };
}
