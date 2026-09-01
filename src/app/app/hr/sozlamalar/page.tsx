import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { listIshJoylari, getHrSozlama } from "@/lib/services/davomatJadval";
import { listJarimaQoidalari } from "@/lib/services/jarima";
import { SozlamalarClient } from "./SozlamalarClient";

/** DAVOMAT SOZLAMALARI — ish joylari (GPS), jarima qoidalari, umumiy siyosat. */
export default async function HrSozlamalarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Davomat sozlamalari</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const [joylar, qoidalar, sozlama] = await Promise.all([
      listIshJoylari(businessId),
      listJarimaQoidalari(businessId),
      getHrSozlama(businessId),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Davomat sozlamalari</h1>
          <p className="text-sm text-muted mt-1">
            Ish joyi (GPS radius), jarima qoidalari va xodim uchun ko&apos;rinish siyosati.
          </p>
        </div>
        <SozlamalarClient
          joylar={joylar.map((j) => ({
            id: j.id,
            nomi: j.nomi,
            lat: j.lat,
            lng: j.lng,
            radiusM: j.radiusM,
            standart: j.standart,
            isActive: j.isActive,
          }))}
          qoidalar={qoidalar.map((q) => ({
            id: q.id,
            turi: q.turi,
            minDaqiqa: q.minDaqiqa,
            maxDaqiqa: q.maxDaqiqa,
            summa: q.summa,
            isActive: q.isActive,
          }))}
          xodimOylikKoradi={sozlama.xodimOylikKoradi}
          crmSotuvchiMajburiy={sozlama.crmSotuvchiMajburiy}
        />
      </div>
    );
  });
}
