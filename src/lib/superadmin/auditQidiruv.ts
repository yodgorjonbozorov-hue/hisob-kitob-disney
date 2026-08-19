import { rawPrisma } from "@/lib/db/rawPrisma";
import { amalLabel } from "./audit";
import { skip, sahifaNatija, type SahifaNatija, type SahifaSorovi } from "./sahifalash";

/**
 * AUDIT JURNALI QIDIRUVI (talab 22).
 *
 * Har yozuv WHO / WHAT / TARGET / WHEN / WHERE / BEFORE / AFTER / REASON
 * ko'rinishida qaytadi. Jurnal APPEND-ONLY: bu modulda o'chirish yoki
 * o'zgartirish funksiyasi ATAYLAB YO'Q.
 */

export interface AuditFiltr {
  qidiruv?: string | null;
  action?: string | null;
  entity?: string | null;
  userId?: string | null;
  tenantId?: string | null;
  sanadan?: Date | null;
  sanagacha?: Date | null;
  /** Faqat superadmin amallari. */
  faqatSuperadmin?: boolean;
}

export interface AuditQator {
  id: string;
  kim: string | null;
  userId: string | null;
  amal: string;
  amalLabel: string;
  entity: string;
  entityId: string;
  tenantId: string | null;
  tenantNomi: string | null;
  ip: string | null;
  userAgent: string | null;
  sabab: string | null;
  before: string | null;
  after: string | null;
  createdAt: Date;
}

function whereBoylab(f: AuditFiltr) {
  const AND: Record<string, unknown>[] = [];
  if (f.action) AND.push({ action: f.action });
  if (f.entity) AND.push({ entity: f.entity });
  if (f.userId) AND.push({ userId: f.userId });
  if (f.tenantId) AND.push({ tenantId: f.tenantId });
  if (f.sanadan) AND.push({ createdAt: { gte: f.sanadan } });
  if (f.sanagacha) AND.push({ createdAt: { lte: f.sanagacha } });
  if (f.faqatSuperadmin) AND.push({ userIsm: { startsWith: "[SUPERADMIN" } });
  if (f.qidiruv) {
    const q = f.qidiruv.trim();
    AND.push({
      OR: [
        { entityId: q },
        { userIsm: { contains: q } },
        { userIsm: { contains: q.toLowerCase() } },
        { ip: q },
        { sabab: { contains: q } },
      ],
    });
  }
  return AND.length > 0 ? { AND } : {};
}

export async function auditRoyxati(
  filtr: AuditFiltr,
  sorov: SahifaSorovi
): Promise<SahifaNatija<AuditQator>> {
  const where = whereBoylab(filtr);
  const [jami, rows] = await Promise.all([
    rawPrisma.auditLog.count({ where }),
    rawPrisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: skip(sorov),
      take: sorov.limit,
      select: {
        id: true,
        userId: true,
        userIsm: true,
        action: true,
        entity: true,
        entityId: true,
        tenantId: true,
        ip: true,
        userAgent: true,
        sabab: true,
        before: true,
        after: true,
        createdAt: true,
      },
    }),
  ]);

  // Kompaniya nomlari — faqat joriy sahifadagi tenantlar uchun (N+1 emas).
  const tenantIdlar = [...new Set(rows.map((r) => r.tenantId).filter((x): x is string => !!x))];
  const tenantlar = tenantIdlar.length
    ? await rawPrisma.tenant.findMany({
        where: { id: { in: tenantIdlar } },
        select: { id: true, name: true },
      })
    : [];
  const nomMap = new Map(tenantlar.map((t) => [t.id, t.name]));

  const qatorlar: AuditQator[] = rows.map((a) => ({
    id: a.id,
    kim: a.userIsm,
    userId: a.userId,
    amal: a.action,
    amalLabel: amalLabel(a.action),
    entity: a.entity,
    entityId: a.entityId,
    tenantId: a.tenantId,
    tenantNomi: a.tenantId ? (nomMap.get(a.tenantId) ?? null) : null,
    ip: a.ip,
    userAgent: a.userAgent,
    sabab: a.sabab,
    before: a.before,
    after: a.after,
    createdAt: a.createdAt,
  }));

  return sahifaNatija(qatorlar, jami, sorov);
}

/** Filtr ro'yxatlari uchun: jurnalda uchraydigan amal va obyekt turlari. */
export async function auditFiltrVariantlari(): Promise<{ amallar: string[]; entitylar: string[] }> {
  const [amallar, entitylar] = await Promise.all([
    rawPrisma.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
    rawPrisma.auditLog.groupBy({ by: ["entity"], _count: { _all: true }, orderBy: { entity: "asc" } }),
  ]);
  return {
    amallar: amallar.map((a) => a.action),
    entitylar: entitylar.map((e) => e.entity),
  };
}
