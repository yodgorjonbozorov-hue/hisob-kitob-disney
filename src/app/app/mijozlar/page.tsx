import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listMijozlar } from "@/lib/queries/mijoz";
import { MijozlarClient } from "./MijozlarClient";

/** MIJOZLAR — mijoz kartochkasi va qarz limiti. */
export default async function MijozlarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "MIJOZLAR");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Mijozlar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const mijozlar = await listMijozlar(businessId);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Mijozlar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> ·
            {mijozlar.length} ta mijoz
          </p>
        </div>
        <MijozlarClient mijozlar={mijozlar} boshqaruvchi={isManager(session.rol)} />
      </div>
    );
  });
}
