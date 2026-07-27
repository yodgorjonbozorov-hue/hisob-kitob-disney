import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getBoard } from "@/lib/crm/service";
import { CrmClient } from "./CrmClient";

/** CRM kanban — bitimlar doskasi. */
export default async function CrmPage() {
  const ctx = await requireTenantPage();
  const { tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "CRM");
    const businessId = await resolveActiveBusinessId(ctx.session);
    const business = await getActiveBusiness(ctx.session);

    const board = businessId ? await getBoard(businessId) : { stages: [], deals: [] };

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">CRM</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Bitimlarni
            bosqichlar bo'ylab yuriting
          </p>
        </div>
        <CrmClient
          stages={board.stages.map((s) => ({ id: s.id, nomi: s.nomi, turi: s.turi }))}
          deals={board.deals.map((d) => ({
            id: d.id,
            nomi: d.nomi,
            summa: d.summa,
            stageId: d.stageId,
            kontakt: d.contact?.ism ?? null,
            tel: d.contact?.tel ?? null,
          }))}
        />
      </div>
    );
  });
}
