import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getSotuvchilarKpi } from "@/lib/queries/sotuvchiKpi";
import { joriyOyOraliq } from "@/lib/xodimDavr";
import { EmptyState } from "@/components/ui/EmptyState";
import { SotuvchilarClient } from "./SotuvchilarClient";

/**
 * SOTUVCHILAR REYTINGI (23-talab) — CRM zakazlari kesimida.
 *
 * HIMOYA: `hisobot.korish` — boshqa sotuvchilarning KPI/savdosi oddiy
 * xodimga ko'rinmaydi (28-talab). Sotuvchining O'Z statistikasi
 * `/app/hr/sotuvchilar/[id]` sahifasida ochiq.
 */
export default async function SotuvchilarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    if (!(await hasPermission(session.userId, "hisobot.korish"))) {
      return (
        <EmptyState
          title="Ruxsat yo'q"
          description="Sotuvchilar reytingi faqat boshqaruvchiga ko'rinadi."
        />
      );
    }

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return <EmptyState title="Biznes topilmadi" description="Sizga biznes biriktirilmagan." />;
    }

    // Birinchi ko'rinish — "Bu oy" (server hisoblaydi, sahifa darhol ochiladi).
    const initial = await getSotuvchilarKpi({ businessId, ...joriyOyOraliq() });

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/app/hr"
            aria-label="Xodimlarga qaytish"
            className="w-10 h-10 rounded-xl border border-line bg-surface flex items-center justify-center text-muted hover:text-fg transition"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-fg">Sotuvchilar reytingi</h1>
            <p className="text-sm text-muted">
              Reyting puli kelgan sotuv bo&apos;yicha — bonus ham shundan hisoblanadi
            </p>
          </div>
        </div>

        <SotuvchilarClient initial={initial} />
      </div>
    );
  });
}
