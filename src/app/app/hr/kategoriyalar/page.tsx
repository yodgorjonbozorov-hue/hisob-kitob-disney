import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { listKategoriyalar } from "@/lib/services/xodimKategoriya";
import { listXodimlar } from "@/lib/queries/hr";
import { EmptyState } from "@/components/ui/EmptyState";
import { KategoriyalarClient } from "./KategoriyalarClient";

/**
 * XODIM KATEGORIYALARI boshqaruvi (faqat boshqaruvchi): yaratish, nomlash,
 * tartib, aktiv/noaktiv va a'zolik. Kategoriyalar CRM "Yangi zakaz"
 * formasidagi selektorlar va samaradorlik tablarini beradi.
 */
export default async function KategoriyalarPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return <EmptyState title="Biznes topilmadi" description="Sizga biznes biriktirilmagan." />;
    }

    const [kategoriyalar, xodimlar] = await Promise.all([
      listKategoriyalar(businessId),
      listXodimlar(businessId, true),
    ]);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/hr"
            aria-label="Xodimlarga qaytish"
            className="w-10 h-10 rounded-xl border border-line bg-surface flex items-center justify-center text-muted hover:text-fg transition"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-fg">Lavozimlar</h1>
            <p className="text-sm text-muted">
              Sotuvchi, Animator, Shofyor, Videochi... — zakaz jamoasi va samaradorlik shu ro&apos;yxatga tayanadi
            </p>
          </div>
        </div>
        <KategoriyalarClient
          kategoriyalar={kategoriyalar}
          xodimlar={xodimlar.map((x) => ({ id: x.id, ism: x.ism, rasmUrl: x.rasmUrl }))}
        />
      </div>
    );
  });
}
