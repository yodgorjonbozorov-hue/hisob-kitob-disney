import { rawPrisma } from "@/lib/db/rawPrisma";

/**
 * AUDIT ARXIVLASH (M-6, cron) — `AuditLog` cheksiz o'smasin.
 *
 * 12 oydan eski yozuvlar `AuditLogArxiv` ga KO'CHIRILADI (o'chirilmaydi —
 * moliyaviy audit uchun tarix kerak, odatda 5 yil). Asosiy jadval kichik
 * qoladi va audit sahifasi/indekslar tez ishlaydi.
 *
 * Partiyalab (1000 tadan) ko'chiriladi — bitta ulkan tranzaksiya SQLite
 * yozuv qulfini uzoq ushlab qolmasin. Har partiya atomik: insert + delete
 * bitta tranzaksiyada, yarim ko'chgan yozuv bo'lmaydi.
 */

const SAQLASH_OY = 12;
const PARTIYA = 1000;

export async function auditArxivla(now: Date = new Date()): Promise<number> {
  const chegara = new Date(now);
  chegara.setUTCMonth(chegara.getUTCMonth() - SAQLASH_OY);

  let jami = 0;
  // Har aylanishda bitta partiya — bo'sh qaytguncha.
  for (;;) {
    const eski = await rawPrisma.auditLog.findMany({
      where: { createdAt: { lt: chegara } },
      orderBy: { createdAt: "asc" },
      take: PARTIYA,
    });
    if (eski.length === 0) break;

    await rawPrisma.$transaction([
      rawPrisma.auditLogArxiv.createMany({
        data: eski.map((l) => ({
          id: l.id,
          tenantId: l.tenantId,
          businessId: l.businessId,
          userId: l.userId,
          userIsm: l.userIsm,
          impersonatedBy: l.impersonatedBy,
          action: l.action,
          entity: l.entity,
          entityId: l.entityId,
          before: l.before,
          after: l.after,
          ip: l.ip,
          createdAt: l.createdAt,
        })),
      }),
      rawPrisma.auditLog.deleteMany({ where: { id: { in: eski.map((l) => l.id) } } }),
    ]);
    jami += eski.length;
  }
  return jami;
}
