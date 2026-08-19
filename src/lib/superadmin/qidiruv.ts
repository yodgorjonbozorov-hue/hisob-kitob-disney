import { rawPrisma } from "@/lib/db/rawPrisma";
import { can, type SuperRol } from "./rbac";
import type { QidiruvNatija } from "./turlar";

/**
 * GLOBAL QIDIRUV / COMMAND PALETTE (talab 33).
 *
 * Bitta so'rov bilan kompaniya, foydalanuvchi, to'lov, obuna va audit
 * yozuvini topadi. HUQUQGA MOS: superadmin ko'ra olmaydigan turdagi natija
 * umuman qidirilmaydi (masalan READ_ONLY roliga audit qaytmaydi).
 */

// Turlar va yorliqlar CLIENT (command palette) uchun ham kerak — ular sof
// `turlar.ts` faylida, shu yerdan qayta eksport qilinadi.
export { turLabel, type NatijaTuri, type QidiruvNatija } from "./turlar";

/** Har turdan ko'pi bilan shuncha natija — palitra uzun ro'yxatga aylanmasin. */
const HAR_TURDAN = 5;

export async function globalQidiruv(
  matn: string,
  superRol: SuperRol
): Promise<QidiruvNatija[]> {
  const q = matn.trim();
  if (q.length < 2) return [];
  const past = q.toLowerCase();

  const vazifalar: Promise<QidiruvNatija[]>[] = [];

  if (can(superRol, "bizneslar", "VIEW")) {
    vazifalar.push(
      rawPrisma.tenant
        .findMany({
          where: {
            OR: [{ name: { contains: q } }, { name: { contains: past } }, { slug: { contains: past } }, { id: q }],
          },
          take: HAR_TURDAN,
          select: { id: true, name: true, slug: true, status: true, plan: true },
        })
        .then((rows) =>
          rows.map((t) => ({
            turi: "biznes" as const,
            id: t.id,
            sarlavha: t.name,
            izoh: `${t.slug} · ${t.plan} · ${t.status}`,
            href: `/superadmin/bizneslar/${t.id}`,
          }))
        )
    );
  }

  if (can(superRol, "foydalanuvchilar", "VIEW")) {
    vazifalar.push(
      rawPrisma.user
        .findMany({
          where: {
            OR: [
              { ism: { contains: q } },
              { ism: { contains: past } },
              { login: { contains: q } },
              { login: { contains: past } },
              { id: q },
            ],
          },
          take: HAR_TURDAN,
          select: { id: true, ism: true, login: true, rol: true, tenant: { select: { name: true } } },
        })
        .then((rows) =>
          rows.map((u) => ({
            turi: "foydalanuvchi" as const,
            id: u.id,
            sarlavha: u.ism,
            izoh: `${u.login} · ${u.rol}${u.tenant ? ` · ${u.tenant.name}` : ""}`,
            href: `/superadmin/foydalanuvchilar/${u.id}`,
          }))
        )
    );
  }

  if (can(superRol, "billing", "VIEW")) {
    vazifalar.push(
      rawPrisma.payment
        .findMany({
          where: { OR: [{ id: q }, { externalId: q }, { tenant: { name: { contains: q } } }] },
          take: HAR_TURDAN,
          select: {
            id: true,
            amount: true,
            status: true,
            provider: true,
            tenant: { select: { name: true } },
          },
        })
        .then((rows) =>
          rows.map((p) => ({
            turi: "tolov" as const,
            id: p.id,
            sarlavha: `${p.amount.toLocaleString("ru-RU")} so'm · ${p.tenant.name}`,
            izoh: `${p.provider} · ${p.status}`,
            href: `/superadmin/billing?qidiruv=${encodeURIComponent(p.id)}`,
          }))
        )
    );
  }

  if (can(superRol, "obunalar", "VIEW")) {
    vazifalar.push(
      rawPrisma.subscription
        .findMany({
          where: { OR: [{ id: q }, { tenant: { name: { contains: q } } }] },
          take: HAR_TURDAN,
          select: {
            id: true,
            plan: true,
            status: true,
            periodEnd: true,
            tenantId: true,
            tenant: { select: { name: true } },
          },
        })
        .then((rows) =>
          rows.map((s) => ({
            turi: "obuna" as const,
            id: s.id,
            sarlavha: `${s.tenant.name} · ${s.plan}`,
            izoh: `${s.status} · ${s.periodEnd.toISOString().slice(0, 10)} gacha`,
            href: `/superadmin/bizneslar/${s.tenantId}?tab=obuna`,
          }))
        )
    );
  }

  if (can(superRol, "audit", "VIEW")) {
    vazifalar.push(
      rawPrisma.auditLog
        .findMany({
          where: { OR: [{ id: q }, { entityId: q }, { ip: q }] },
          take: HAR_TURDAN,
          orderBy: { createdAt: "desc" },
          select: { id: true, action: true, entity: true, entityId: true, userIsm: true, createdAt: true },
        })
        .then((rows) =>
          rows.map((a) => ({
            turi: "audit" as const,
            id: a.id,
            sarlavha: `${a.action} · ${a.entity}`,
            izoh: `${a.userIsm ?? "—"} · ${a.createdAt.toISOString().slice(0, 16).replace("T", " ")}`,
            href: `/superadmin/audit?qidiruv=${encodeURIComponent(a.entityId)}`,
          }))
        )
    );
  }

  const natijalar = await Promise.all(vazifalar);
  return natijalar.flat();
}
