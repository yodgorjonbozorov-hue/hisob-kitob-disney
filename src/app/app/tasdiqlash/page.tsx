import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { listRequests, getTasdiqStats } from "@/lib/queries/approval";
import { TasdiqlashClient } from "./TasdiqlashClient";

/** TASDIQLASH — chegaradan oshgan chiqimlar rahbar qarorini kutadi. */
export default async function TasdiqlashPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "TASDIQLASH");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Tasdiqlash</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    // Xodim faqat o'z so'rovlarini ko'radi — tranzaksiyalardagi qoida bilan bir xil.
    const ozi = transactionScopeUserId(session);
    const [sorovlar, stats] = await Promise.all([
      listRequests({ businessId, userId: ozi }),
      getTasdiqStats(businessId),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Tasdiqlash</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> ·
            Chegaradan oshgan chiqim tasdiqlanmaguncha hisobotlarga tushmaydi
          </p>
        </div>
        <TasdiqlashClient
          sorovlar={sorovlar}
          stats={stats}
          boshqaruvchi={isManager(session.rol)}
          meId={session.userId}
        />
      </div>
    );
  });
}
