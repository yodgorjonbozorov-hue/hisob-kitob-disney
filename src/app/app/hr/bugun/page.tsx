import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getBugungiDavomat } from "@/lib/queries/davomat";
import { toshkentSana } from "@/lib/davomat/vaqt";
import { BugunClient } from "./BugunClient";

/** DAVOMAT BUGUN — direktorning jonli davomat paneli. */
export default async function BugunPage({ searchParams }: { searchParams: { sana?: string } }) {
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
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Davomat bugun</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const sana = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.sana ?? "")
      ? searchParams.sana!
      : toshkentSana(new Date());
    const bugun = await getBugungiDavomat(businessId, sana);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Davomat bugun</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Kelish
            selfie + GPS bilan tasdiqlanadi
          </p>
        </div>
        <BugunClient bugun={bugun} />
      </div>
    );
  });
}
