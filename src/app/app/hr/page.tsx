import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listXodimlar, listOyliklar, getHrStats } from "@/lib/queries/hr";
import { getXodimlarPerformance } from "@/lib/queries/xodimPlan";
import { getXodimlarJamoaKpi } from "@/lib/queries/xodimJamoaKpi";
import { listKategoriyaTablari } from "@/lib/queries/kategoriyaAnalitika";
import { oyOraligi } from "@/lib/xodimDavr";
import { currentMonthString } from "@/lib/date";
import { LinkButton } from "@/components/ui/LinkButton";
import { HrClient } from "./HrClient";

/** HR-LITE — xodimlar, avans va oylik vedomosti. */
export default async function HrPage({
  searchParams,
}: {
  searchParams: { oy?: string };
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Xodimlar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const oy = /^\d{4}-\d{2}$/.test(searchParams.oy ?? "")
      ? searchParams.oy!
      : currentMonthString();

    const [xodimlar, oyliklar, stats, performance, jamoa, lavozimlar] = await Promise.all([
      listXodimlar(businessId),
      listOyliklar(businessId, oy),
      getHrStats(businessId, oy),
      getXodimlarPerformance(businessId, oy),
      // Lavozim kesimidagi oy KPI'si — barcha xodimlar bitta so'rovda (39-talab).
      getXodimlarJamoaKpi(businessId, oyOraligi(oy)),
      listKategoriyaTablari(businessId),
    ]);

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-fg">Xodimlar</h1>
            <p className="text-sm text-muted mt-1">
              Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> ·
              Oylik to&apos;langanda chiqim tranzaksiya avtomatik yoziladi
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <LinkButton href="/app/hr/kpi" size="sm">
              KPI va oylik
            </LinkButton>
            <LinkButton href="/app/hr/sotuvchilar" variant="secondary" size="sm">
              Sotuvchilar
            </LinkButton>
            <LinkButton href="/app/hr/samaradorlik" variant="secondary" size="sm">
              Samaradorlik
            </LinkButton>
            <LinkButton href="/app/hr/kategoriyalar" variant="secondary" size="sm">
              Lavozimlar
            </LinkButton>
          </div>
        </div>
        <HrClient
          xodimlar={xodimlar}
          oyliklar={oyliklar}
          stats={stats}
          performance={performance}
          jamoaKpi={Object.fromEntries(jamoa)}
          lavozimlar={lavozimlar.map((l) => ({ id: l.id, nomi: l.nomi }))}
          oy={oy}
          initialTab="xodimlar"
        />
      </div>
    );
  });
}
