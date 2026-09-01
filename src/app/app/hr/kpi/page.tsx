import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { currentMonthString } from "@/lib/date";
import { hisoblaBarchasi } from "@/lib/kpi/oylik";
import { dashboardXulosasi } from "@/lib/kpi/dashboard";
import { kpiKirish } from "@/lib/kpi/ruxsat";
import { hasPermission } from "@/lib/permissions/tekshir";
import { LinkButton } from "@/components/ui/LinkButton";
import { KpiDashboardClient } from "./KpiDashboardClient";

/**
 * XODIMLAR KPI VA OYLIK — bosh sahifa.
 *
 * Ko'rinish RUXSATGA qarab kesiladi: rahbar barcha xodimni va reytingni
 * ko'radi, oddiy xodim FAQAT o'zini. Kesish SERVERDA bo'ladi — boshqa
 * xodimlarning raqamlari brauzerga umuman yuborilmaydi.
 */
export default async function KpiPage({ searchParams }: { searchParams: { oy?: string } }) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Xodimlar KPI</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    // Huquqi bo'lmasa bu yerda ForbiddenError — sahifa xato chegarasiga tushadi.
    const kirish = await kpiKirish(session, businessId);
    const sozlashMumkin = await hasPermission(session.userId, "kpi.sozlash");

    const oy = /^\d{4}-\d{2}$/.test(searchParams.oy ?? "") ? searchParams.oy! : currentMonthString();
    const { sozlama, xodimlar } = await hisoblaBarchasi(businessId, oy);

    const korinadigan = kirish.hammasi
      ? xodimlar
      : xodimlar.filter((x) => x.employeeId === kirish.ozEmployeeId);

    const lavozimlar = [
      ...new Set(korinadigan.map((x) => x.lavozim).filter((l): l is string => Boolean(l))),
    ].sort();

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-fg">Xodimlar KPI va oylik</h1>
            <p className="text-sm text-muted mt-1">
              {kirish.hammasi ? (
                <>
                  Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Sotuv
                  CRM va kirim yozuvlaridan avtomatik hisoblanadi
                </>
              ) : (
                "O'z ko'rsatkichlaringiz va hisoblangan oyligingiz"
              )}
            </p>
          </div>
          <LinkButton href="/app/hr" variant="secondary" size="sm">
            Xodimlar
          </LinkButton>
        </div>

        <KpiDashboardClient
          oy={oy}
          xodimlar={korinadigan}
          xulosa={kirish.hammasi ? dashboardXulosasi(xodimlar) : null}
          boshlangichBall={sozlama.boshlangichBall}
          lavozimlar={lavozimlar}
          sozlashMumkin={kirish.hammasi && sozlashMumkin}
        />
      </div>
    );
  });
}
