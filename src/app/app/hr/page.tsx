import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listXodimlar, listOyliklar, getHrStats } from "@/lib/queries/hr";
import { currentMonthString } from "@/lib/date";
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
          <h1 className="text-2xl font-bold text-fg">Xodimlar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const oy = /^\d{4}-\d{2}$/.test(searchParams.oy ?? "")
      ? searchParams.oy!
      : currentMonthString();

    const [xodimlar, oyliklar, stats] = await Promise.all([
      listXodimlar(businessId),
      listOyliklar(businessId, oy),
      getHrStats(businessId, oy),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Xodimlar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> ·
            Oylik to&apos;langanda chiqim tranzaksiya avtomatik yoziladi
          </p>
        </div>
        <HrClient xodimlar={xodimlar} oyliklar={oyliklar} stats={stats} oy={oy} />
      </div>
    );
  });
}
