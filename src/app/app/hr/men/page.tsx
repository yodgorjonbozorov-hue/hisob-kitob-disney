import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId } from "@/lib/business";
import { getMenHolati } from "@/lib/queries/davomat";
import { getMenPerformance } from "@/lib/queries/xodimPlan";
import { listXodimVazifalari } from "@/lib/services/xodimVazifa";
import { currentMonthString } from "@/lib/date";
import { MenClient } from "./MenClient";
import { MenNatijalarim } from "./MenNatijalarim";

/** DAVOMATIM — xodimning o'z check-in/check-out sahifasi (mobil ustuvor). */
export default async function MenPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Davomatim</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const oy = currentMonthString();
    const [holat, performance] = await Promise.all([
      getMenHolati(businessId, session.userId),
      getMenPerformance(businessId, session.userId, oy),
    ]);
    // Vazifalar faqat xodim kartochkasi topilganda o'qiladi (o'z vazifalari).
    const vazifalar = performance
      ? await listXodimVazifalari(businessId, performance.id, oy)
      : [];

    return (
      <div className="space-y-6">
        <MenClient boshlangich={holat} ism={session.ism} />
        {performance && (
          <MenNatijalarim oy={oy} performance={performance} vazifalar={vazifalar} />
        )}
      </div>
    );
  });
}
