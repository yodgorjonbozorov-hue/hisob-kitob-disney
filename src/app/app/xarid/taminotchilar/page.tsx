import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/auth/roles";
import { isPro } from "@/lib/billing/pro";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listSuppliers } from "@/lib/queries/xarid";
import { TaminotchilarClient } from "./TaminotchilarClient";

/** TA'MINOTCHILAR — kimdan tovar olamiz va ular bilan hisob-kitob. */
export default async function TaminotchilarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "XARID");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Ta&apos;minotchilar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const pro = isPro(ctx.tenant.plan);
    const [suppliers, userlar] = await Promise.all([
      listSuppliers(businessId),
      // Ta'minotchini tizim useriga bog'lash (PRO) uchun tanlov ro'yxati.
      pro
        ? prisma.user.findMany({
            where: { isActive: true },
            select: { id: true, ism: true },
            orderBy: { ism: "asc" },
          })
        : Promise.resolve([]),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Ta&apos;minotchilar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> ·
            Har ta&apos;minotchi bo&apos;yicha jami xarid va ochiq buyurtmalar
          </p>
        </div>
        <TaminotchilarClient suppliers={suppliers} userlar={userlar} />
      </div>
    );
  });
}
