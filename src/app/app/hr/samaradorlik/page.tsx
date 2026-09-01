import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { listKategoriyaTablari, getKategoriyaAnalitika } from "@/lib/queries/kategoriyaAnalitika";
import { joriyOyOraliq } from "@/lib/xodimDavr";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { SamaradorlikClient } from "./SamaradorlikClient";

/**
 * XODIMLAR SAMARADORLIGI — kategoriya (Sotuvchi/Diktor/...) kesimidagi
 * CRM zakaz analitikasi: KPI, reyting, plan progress, davr filtri.
 *
 * HIMOYA: `hisobot.korish` (xodim statistikasi sahifasi bilan bir xil qoida) —
 * API routelar ham ayni huquqni tekshiradi.
 */
export default async function SamaradorlikPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    const ruxsat = await hasPermission(session.userId, "hisobot.korish");
    if (!ruxsat) {
      return (
        <EmptyState
          title="Ruxsat yo'q"
          description="Xodimlar samaradorligi faqat boshqaruvchiga ko'rinadi."
        />
      );
    }

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return <EmptyState title="Biznes topilmadi" description="Sizga biznes biriktirilmagan." />;
    }

    // Birinchi ko'rinish — "Bu oy" (server hisoblab beradi, sahifa darhol
    // to'liq ochiladi); filtr/tab almashganda klient API'ga o'tadi.
    const oraliq = joriyOyOraliq();
    const tablar = await listKategoriyaTablari(businessId);
    const analitika = tablar[0]
      ? await getKategoriyaAnalitika({ businessId, categoryId: tablar[0].id, ...oraliq })
      : null;

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
            <h1 className="text-xl sm:text-2xl font-bold text-fg">Xodimlar samaradorligi</h1>
            <p className="text-sm text-muted">Kategoriya kesimida zakaz natijalari va reyting</p>
          </div>
          <LinkButton href="/app/hr/sotuvchilar" variant="secondary" size="sm">
            Sotuvchilar reytingi
          </LinkButton>
          {isManager(session.rol) && (
            <LinkButton href="/app/hr/kategoriyalar" variant="secondary" size="sm">
              Kategoriyalar
            </LinkButton>
          )}
        </div>

        {tablar.length === 0 ? (
          <EmptyState
            icon="🏷️"
            title="Xodim kategoriyalari hali yo'q"
            description="Avval kategoriyalar (Sotuvchi, Diktor, Shofer, ...) yaratib, xodimlarni biriktiring — keyin zakazlardagi qatnashuv shu yerda hisoblanadi."
            action={
              isManager(session.rol) ? (
                <LinkButton href="/app/hr/kategoriyalar">Kategoriya yaratish</LinkButton>
              ) : undefined
            }
          />
        ) : (
          <SamaradorlikClient tablar={tablar} initial={analitika} />
        )}
      </div>
    );
  });
}
