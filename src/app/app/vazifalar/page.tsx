import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { prisma } from "@/lib/prisma";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { VazifalarClient } from "./VazifalarClient";

/** Vazifalar — 3 ustunli kanban (Ochiq / Jarayonda / Bajarildi). */
export default async function VazifalarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "VAZIFALAR");
    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);

    const [tasks, users] = businessId
      ? await Promise.all([
          prisma.task.findMany({
            where: { businessId, deletedAt: null },
            include: { deal: { select: { id: true, nomi: true } } },
            orderBy: [{ muddat: "asc" }, { createdAt: "desc" }],
            take: 300,
          }),
          prisma.user.findMany({ where: { isActive: true }, select: { id: true, ism: true }, orderBy: { ism: "asc" } }),
        ])
      : [[], []];

    const ismlar = new Map(users.map((u) => [u.id, u.ism]));

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Vazifalar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Jamoa ishlari bir joyda
          </p>
        </div>
        <VazifalarClient
          meId={session.userId}
          users={users}
          tasks={tasks.map((t) => ({
            id: t.id,
            nomi: t.nomi,
            izoh: t.izoh,
            holat: t.holat,
            masulId: t.masulId,
            masulIsm: ismlar.get(t.masulId) ?? "—",
            muddat: t.muddat?.toISOString() ?? null,
            deal: t.deal ? { id: t.deal.id, nomi: t.deal.nomi } : null,
          }))}
        />
      </div>
    );
  });
}
