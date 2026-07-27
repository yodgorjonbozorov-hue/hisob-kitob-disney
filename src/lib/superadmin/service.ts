import { rawPrisma } from "@/lib/db/rawPrisma";
import { computeAccess } from "@/lib/billing/access";
import { planByCode } from "@/lib/billing/plans";
import { hashPassword } from "@/lib/auth/password";
import { BadRequestError } from "@/lib/auth/guard";

/**
 * SUPERADMIN xizmat qatlami — barcha amallar rawPrisma bilan (tenantlar aro)
 * va MAJBURIY audit log bilan bajariladi. Faqat requireSuperadmin* guard'idan
 * o'tgan route'lar chaqiradi.
 */

/** Superadmin amalini audit jurnaliga yozadi (kim, qachon, nima). */
export async function logSuperadminAction(params: {
  superadminId: string;
  superadminIsm: string;
  action: string; // "impersonate" | "extend" | "block" | "unblock" | "payment_confirm" | "payment_reject" | "password_reset"
  entity: string; // "tenant" | "payment" | "user"
  entityId: string;
  detail?: Record<string, unknown>;
}) {
  await rawPrisma.auditLog.create({
    data: {
      businessId: null,
      userId: params.superadminId,
      userIsm: `[SUPERADMIN] ${params.superadminIsm}`,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      after: params.detail ? JSON.stringify(params.detail) : null,
    },
  });
}

export interface TenantOverview {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  createdAt: Date;
  /** Amaldagi muddat (TRIAL -> trialEndsAt, aks holda currentPeriodEnd). */
  deadline: Date | null;
  accessMode: string;
  userCount: number;
  businessCount: number;
  lastActivity: Date | null;
  pendingPayments: number;
}

/** Barcha tenantlar ro'yxati (panel jadvali uchun). */
export async function listTenantsOverview(): Promise<TenantOverview[]> {
  const tenants = await rawPrisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { select: { lastLoginAt: true } },
      _count: { select: { users: true, businesses: true } },
    },
  });
  const pending = await rawPrisma.payment.groupBy({
    by: ["tenantId"],
    where: { status: "PENDING" },
    _count: { _all: true },
  });
  const pendingMap = new Map(pending.map((p) => [p.tenantId, p._count._all]));

  return tenants.map((t) => {
    const lastActivity = t.users.reduce<Date | null>((acc, u) => {
      if (!u.lastLoginAt) return acc;
      return !acc || u.lastLoginAt > acc ? u.lastLoginAt : acc;
    }, null);
    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      plan: t.plan,
      createdAt: t.createdAt,
      deadline: t.status === "TRIAL" ? t.trialEndsAt : t.currentPeriodEnd,
      accessMode: computeAccess(t).mode,
      userCount: t._count.users,
      businessCount: t._count.businesses,
      lastActivity,
      pendingPayments: pendingMap.get(t.id) ?? 0,
    };
  });
}

export interface Metrics {
  jamiTenant: number;
  faolObuna: number;
  sinovda: number;
  bloklangan: number;
  /** Oylik takrorlanuvchi tushum (so'm) — faol obunadagi tenantlar tarifi yig'indisi. */
  mrr: number;
}

export async function getMetrics(): Promise<Metrics> {
  const tenants = await rawPrisma.tenant.findMany({ select: { status: true, plan: true } });
  let faolObuna = 0;
  let sinovda = 0;
  let bloklangan = 0;
  let mrr = 0;
  for (const t of tenants) {
    if (t.status === "ACTIVE") {
      faolObuna++;
      mrr += planByCode(t.plan)?.oylikNarx ?? 0;
    } else if (t.status === "TRIAL") {
      sinovda++;
    } else if (t.status === "BLOCKED") {
      bloklangan++;
    }
  }
  return { jamiTenant: tenants.length, faolObuna, sinovda, bloklangan, mrr };
}

/** Tenantni bloklaydi. */
export async function blockTenant(tenantId: string) {
  return rawPrisma.tenant.update({ where: { id: tenantId }, data: { status: "BLOCKED" } });
}

/**
 * Blokdan chiqaradi — status sanalarga qarab tiklanadi:
 * trial hali tugamagan -> TRIAL; obuna davri tugamagan -> ACTIVE; aks holda PAST_DUE.
 */
export function resolveUnblockStatus(
  t: { trialEndsAt: Date | null; currentPeriodEnd: Date | null },
  now: Date = new Date()
): "TRIAL" | "ACTIVE" | "PAST_DUE" {
  if (t.currentPeriodEnd && t.currentPeriodEnd.getTime() > now.getTime()) return "ACTIVE";
  if (t.trialEndsAt && t.trialEndsAt.getTime() > now.getTime()) return "TRIAL";
  return "PAST_DUE";
}

export async function unblockTenant(tenantId: string, now: Date = new Date()) {
  const tenant = await rawPrisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new BadRequestError("Tenant topilmadi");
  return rawPrisma.tenant.update({
    where: { id: tenantId },
    data: { status: resolveUnblockStatus(tenant, now) },
  });
}

/** Foydalanuvchi parolini tiklaydi (yangi parol qaytariladi — bir marta ko'rsatiladi). */
export async function resetUserPassword(userId: string): Promise<{ login: string; yangiParol: string }> {
  const user = await rawPrisma.user.findUnique({ where: { id: userId }, select: { id: true, login: true } });
  if (!user) throw new BadRequestError("Foydalanuvchi topilmadi");
  // 10 belgili tasodifiy parol (o'qilishi oson belgilar).
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let yangiParol = "";
  for (let i = 0; i < 10; i++) {
    yangiParol += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  await rawPrisma.user.update({
    where: { id: userId },
    data: { parolHash: await hashPassword(yangiParol), mustChangePassword: true },
  });
  return { login: user.login, yangiParol };
}

/** Impersonatsiya uchun tenantning birinchi faol boshqaruvchisini (OWNER, bo'lmasa ADMIN) topadi. */
export async function findImpersonationTarget(tenantId: string) {
  const owner = await rawPrisma.user.findFirst({
    where: { tenantId, isActive: true, rol: "OWNER" },
    orderBy: { createdAt: "asc" },
  });
  if (owner) return owner;
  return rawPrisma.user.findFirst({
    where: { tenantId, isActive: true, rol: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
}
