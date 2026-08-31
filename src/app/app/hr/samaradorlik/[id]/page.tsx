import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getXodimKategoriyaDetal } from "@/lib/queries/kategoriyaAnalitika";
import { joriyOyOraliq } from "@/lib/xodimDavr";
import { EmptyState } from "@/components/ui/EmptyState";
import { XodimDetalClient } from "./XodimDetalClient";

/**
 * XODIM SAMARADORLIK TAFSILOTI — kategoriya kesimidagi KPI, plan, reyting
 * o'rni va davrdagi CRM zakazlari lentasi.
 */
export default async function XodimSamaradorlikPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { kategoriya?: string; from?: string; to?: string };
}) {
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

    const sanaRegex = /^\d{4}-\d{2}-\d{2}$/;
    const oraliq =
      searchParams.from && searchParams.to && sanaRegex.test(searchParams.from) && sanaRegex.test(searchParams.to)
        ? { from: searchParams.from, to: searchParams.to }
        : joriyOyOraliq();

    const detal = await getXodimKategoriyaDetal({
      businessId,
      employeeId: params.id,
      categoryId: searchParams.kategoriya ?? null,
      ...oraliq,
    });
    if (!detal) {
      return <EmptyState title="Xodim topilmadi" description="Xodim o'chirilgan yoki mavjud emas." />;
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/hr/samaradorlik"
            aria-label="Samaradorlikka qaytish"
            className="w-10 h-10 rounded-xl border border-line bg-surface flex items-center justify-center text-muted hover:text-fg transition"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-fg">{detal.xodim.ism}</h1>
            <p className="text-sm text-muted">
              {detal.kategoriya ? `Kategoriya: ${detal.kategoriya.nomi}` : "Barcha kategoriyalar"}
            </p>
          </div>
        </div>
        <XodimDetalClient
          initial={detal}
          employeeId={params.id}
          categoryId={searchParams.kategoriya ?? null}
          initialOraliq={oraliq}
        />
      </div>
    );
  });
}
