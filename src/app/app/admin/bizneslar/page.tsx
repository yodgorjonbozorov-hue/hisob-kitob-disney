import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { getEnabledModules } from "@/lib/modules/guard";
import { biznesStatlari } from "@/lib/services/biznesRoyxat";
import { biznesModulNomlari } from "@/lib/modules/biznesModullari";
import { planByCode } from "@/lib/billing/plans";
import { BusinessesClient } from "./BusinessesClient";
import type { BusinessDTO } from "./turlar";

/**
 * BIZNESLAR — bir nechta biznesni bitta joydan boshqarish markazi.
 *
 * Ma'lumot BIR MARTA agregatsiya bilan olinadi (lib/services/biznesRoyxat.ts):
 * biznes soniga qarab so'rov soni oshmaydi. Qidiruv/filtr/saralash esa
 * clientda — har harfda serverga borish shart emas.
 */
export default async function BizneslarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
    if (!isManager(session.rol)) {
      redirect("/app");
    }

    const [statlar, yoqilganModullar] = await Promise.all([
      biznesStatlari(),
      getEnabledModules(ctx),
    ]);

    const dto: BusinessDTO[] = statlar.map((b) => ({
      ...b,
      // Modul chiplari menyu bilan BIR XIL qoidadan hisoblanadi
      // (tenant moduli + biznes bayrog'i) — qarama-qarshilik bo'lmaydi.
      modullar: biznesModulNomlari(yoqilganModullar, { omborli: b.omborli, magazin: b.magazin }),
    }));

    // Wizard uchun: qaysi modul tarifda bor va qaysisi allaqachon yoqilgan.
    // Yangi modul tizimi EMAS — mavjud plan/registry ma'lumotining ko'chirmasi.
    const tarifModullari = planByCode(ctx.tenant.plan)?.modullar ?? [];

    return (
      <BusinessesClient
        initialBusinesses={dto}
        rol={session.rol}
        tarifModullari={tarifModullari}
        yoqilganModullar={[...yoqilganModullar]}
      />
    );
  });
}
