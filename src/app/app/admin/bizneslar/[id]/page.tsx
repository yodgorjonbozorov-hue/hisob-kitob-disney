import { notFound, redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { getEnabledModules } from "@/lib/modules/guard";
import { planByCode } from "@/lib/billing/plans";
import { biznesTafsiloti } from "@/lib/services/biznesTafsilot";
import { BiznesDetail } from "./BiznesDetail";
import { BOLIMLAR, type Bolim } from "./bolimlar";

/**
 * BIZNES TAFSILOTI — bitta biznesning boshqaruv markazi.
 *
 * Tenant izolyatsiyasi: `biznesTafsiloti` tenant-scoped client bilan ishlaydi,
 * shuning uchun BEGONA tenant biznesining id'si URL'ga qo'lda yozilsa ham
 * bu yerda `null` qaytadi va 404 ko'rsatiladi — hech qanday ma'lumot sizmaydi.
 */
export default async function BiznesTafsilotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bolim?: string }>;
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  const { id } = await params;
  const { bolim } = await searchParams;

  return runWithTenant(tenantId, async () => {
    if (!isManager(session.rol)) {
      redirect("/app");
    }

    const [biznes, yoqilganModullar] = await Promise.all([
      biznesTafsiloti(id),
      getEnabledModules(ctx),
    ]);
    if (!biznes) notFound();

    const boshlangich: Bolim =
      BOLIMLAR.find((b) => b.kod === bolim)?.kod ?? "umumiy";

    return (
      <BiznesDetail
        biznes={biznes}
        rol={session.rol}
        boshlangichBolim={boshlangich}
        yoqilganModullar={[...yoqilganModullar]}
        tarifModullari={planByCode(ctx.tenant.plan)?.modullar ?? []}
      />
    );
  });
}
