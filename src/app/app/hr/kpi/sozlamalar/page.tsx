import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId } from "@/lib/business";
import { isManager } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/permissions/tekshir";
import { prisma } from "@/lib/prisma";
import { kpiSozlamasi } from "@/lib/kpi/sozlama";
import { listVazifalar, listPresetlar } from "@/lib/kpi/vazifa";
import { LinkButton } from "@/components/ui/LinkButton";
import { SozlamalarClient } from "./SozlamalarClient";

/**
 * XODIMLAR → OYLIK VA BONUS SOZLAMALARI.
 *
 * Faqat boshqaruvchi va `kpi.sozlash` huquqi bo'lganlarga ochiq. Sahifa
 * guard'i himoya emas — har API route ham shu huquqni qayta tekshiradi.
 */
export default async function KpiSozlamalarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    if (!isManager(session.rol)) redirect("/app");
    if (!(await hasPermission(session.userId, "kpi.sozlash"))) redirect("/app/hr/kpi");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) redirect("/app/hr");

    // Birinchi ochilishda standart to'plamni yozadi (idempotent).
    const sozlama = await kpiSozlamasi(businessId);

    const [vazifalar, presetlar, xodimlar, biriktiruvlar] = await Promise.all([
      listVazifalar(businessId),
      listPresetlar(businessId),
      prisma.employee.findMany({
        where: { businessId, deletedAt: null, isActive: true },
        orderBy: { ism: "asc" },
        select: { id: true, ism: true, lavozim: true, rasmUrl: true },
      }),
      prisma.kpiTaskAssignment.findMany({
        where: { businessId, aktiv: true },
        select: { employeeId: true, taskId: true },
      }),
    ]);

    const biriktiruvMap = new Map<string, string[]>();
    for (const b of biriktiruvlar) {
      biriktiruvMap.set(b.employeeId, [...(biriktiruvMap.get(b.employeeId) ?? []), b.taskId]);
    }

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-fg">Oylik va bonus sozlamalari</h1>
            <p className="text-sm text-muted mt-1">
              Vazifalar, progressiv sotuv bonusi, sotuv plani va ball jadvali
            </p>
          </div>
          <LinkButton href="/app/hr/kpi" variant="secondary" size="sm">
            KPI ro&apos;yxati
          </LinkButton>
        </div>

        <SozlamalarClient
          sozlama={sozlama}
          vazifalar={vazifalar}
          presetlar={presetlar}
          xodimlar={xodimlar.map((x) => ({
            id: x.id,
            ism: x.ism,
            lavozim: x.lavozim,
            rasmUrl: x.rasmUrl,
            vazifaIdlari: biriktiruvMap.get(x.id) ?? [],
          }))}
        />
      </div>
    );
  });
}
