import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { getDavomat } from "@/lib/queries/hr";
import { currentMonthString } from "@/lib/date";
import { DavomatClient } from "./DavomatClient";

/** Davomat jadvali — xodim × kun. */
export default async function DavomatPage({ searchParams }: { searchParams: { oy?: string } }) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-fg">Davomat</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const oy = /^\d{4}-\d{2}$/.test(searchParams.oy ?? "")
      ? searchParams.oy!
      : currentMonthString();
    const davomat = await getDavomat(businessId, oy);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Davomat</h1>
          <p className="text-sm text-muted mt-1">
            Kunlik stavkadagi xodimlarning oyligi shu jadvaldan hisoblanadi.
          </p>
        </div>
        <DavomatClient davomat={davomat} oy={oy} />
      </div>
    );
  });
}
