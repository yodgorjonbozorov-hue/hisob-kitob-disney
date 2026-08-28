import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { listJarimalar, listBonuslar } from "@/lib/queries/davomat";
import { JarimaClient } from "./JarimaClient";

/** JARIMA & BONUS — tasdiqlash navbati, tarix va bonuslar. */
export default async function JarimaPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Jarima &amp; Bonus</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const [jarimalar, bonuslar, xodimlar] = await Promise.all([
      listJarimalar(businessId, {}),
      listBonuslar(businessId, {}),
      prisma.employee.findMany({
        where: { businessId, deletedAt: null, isActive: true },
        select: { id: true, ism: true },
        orderBy: { ism: "asc" },
      }),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Jarima &amp; Bonus</h1>
          <p className="text-sm text-muted mt-1">
            Jarima avtomatik ochiladi (kechikish/kelmaganlik qoidalari), lekin oylikka FAQAT siz
            tasdiqlagandan keyin kiradi.
          </p>
        </div>
        <JarimaClient jarimalar={jarimalar} bonuslar={bonuslar} xodimlar={xodimlar} />
      </div>
    );
  });
}
