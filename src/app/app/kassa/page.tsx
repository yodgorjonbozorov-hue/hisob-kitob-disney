import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getAccountBalances, listTransfers } from "@/lib/queries/accounts";
import { KassaClient } from "./KassaClient";

/**
 * KASSALAR — har pul manbai (naqd, plastik, bank) bo'yicha joriy qoldiq.
 * Faqat boshqaruvchilar: kassir o'z smenasini "Kun yakuni" sahifasida ko'radi.
 */
export default async function KassaPage() {
  const { session, tenantId } = await requireTenantPage();
  return runWithTenant(tenantId, async () => {
    if (!isManager(session.rol)) {
      redirect("/app/tranzaksiyalar");
    }

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-fg">Kassalar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const [qoldiqlar, transferlar] = await Promise.all([
      getAccountBalances(businessId),
      listTransfers(businessId, 30),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Kassalar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Naqd,
            plastik va bank hisob-raqamlari bo&apos;yicha qoldiq
          </p>
        </div>
        <KassaClient qoldiqlar={qoldiqlar} transferlar={transferlar} />
      </div>
    );
  });
}
