import { requireSuperadminPage } from "@/lib/auth/superadmin";
import { listTenantsOverview, getMetrics } from "@/lib/superadmin/service";
import { listDemoRequests } from "@/lib/services/demoRequest";
import { rawPrisma } from "@/lib/db/rawPrisma";
import { SuperadminClient } from "./SuperadminClient";

export const metadata = { title: "SUPERADMIN — Platforma boshqaruvi" };

/** Platforma egasi paneli. Faqat SUPERADMIN — boshqa har qanday rol "/" ga qaytariladi. */
export default async function SuperadminPage() {
  const session = await requireSuperadminPage();

  const [metrics, tenants, pendingPayments, users, demoRequests] = await Promise.all([
    getMetrics(),
    listTenantsOverview(),
    rawPrisma.payment.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { tenant: { select: { name: true } } },
    }),
    rawPrisma.user.findMany({
      where: { tenantId: { not: null } },
      select: { id: true, ism: true, login: true, rol: true, isActive: true, tenantId: true, lastLoginAt: true },
      orderBy: { createdAt: "asc" },
    }),
    listDemoRequests(),
  ]);

  return (
    <SuperadminClient
      superadminIsm={session.ism}
      metrics={metrics}
      tenants={tenants.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        deadline: t.deadline?.toISOString() ?? null,
        lastActivity: t.lastActivity?.toISOString() ?? null,
        setupFeePaidAt: t.setupFeePaidAt?.toISOString() ?? null,
      }))}
      demoRequests={demoRequests.map((d) => ({
        id: d.id,
        ism: d.ism,
        telefon: d.telefon,
        biznesTuri: d.biznesTuri,
        izoh: d.izoh,
        status: d.status,
        createdAt: d.createdAt.toISOString(),
      }))}
      pendingPayments={pendingPayments.map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        tenantName: p.tenant.name,
        amount: p.amount,
        createdAt: p.createdAt.toISOString(),
      }))}
      users={users.map((u) => ({
        id: u.id,
        ism: u.ism,
        login: u.login,
        rol: u.rol,
        isActive: u.isActive,
        tenantId: u.tenantId!,
      }))}
    />
  );
}
