import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { requireModulePage } from "@/lib/modules/guard";
import { isManager } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getSotuvchiDetal } from "@/lib/queries/sotuvchiKpi";
import { joriyOyOraliq } from "@/lib/xodimDavr";
import { EmptyState } from "@/components/ui/EmptyState";
import { SotuvchiDetalClient } from "./SotuvchiDetalClient";
import type { Davr } from "@/app/app/tranzaksiyalar/xodimlar/DavrFiltri";

const SANA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * SOTUVCHI PROFILI — oy (yoki tanlangan davr) statistikasi.
 *
 * HIMOYA (28-talab): `hisobot.korish` bo'lsa istalgan sotuvchi ko'rinadi;
 * bo'lmasa FAQAT o'zining kartochkasi. Ya'ni sotuvchi o'z natijasini
 * ko'radi, boshqalarning oyligi/bonusi/KPI'si unga ko'rinmaydi.
 */
export default async function SotuvchiDetalPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return <EmptyState title="Biznes topilmadi" description="Sizga biznes biriktirilmagan." />;
    }

    if (!(await hasPermission(session.userId, "hisobot.korish"))) {
      const ozi = await prisma.employee.findFirst({
        where: { id: params.id, businessId, userId: session.userId, deletedAt: null },
        select: { id: true },
      });
      if (!ozi) {
        return (
          <EmptyState
            title="Ruxsat yo'q"
            description="Faqat o'z sotuv statistikangizni ko'ra olasiz."
          />
        );
      }
    }

    const oraliq =
      searchParams.from && searchParams.to && SANA.test(searchParams.from) && SANA.test(searchParams.to)
        ? { from: searchParams.from, to: searchParams.to }
        : joriyOyOraliq();

    const detal = await getSotuvchiDetal({ businessId, employeeId: params.id, ...oraliq });
    if (!detal) notFound();

    const boshDavr: Davr = { turi: "sana", ...oraliq };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/app/hr/sotuvchilar"
            aria-label="Sotuvchilarga qaytish"
            className="w-10 h-10 rounded-xl border border-line bg-surface flex items-center justify-center text-muted hover:text-fg transition"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-fg truncate">
              {detal.sotuvchi.ism}
            </h1>
            <p className="text-sm text-muted">
              Sotuvchi
              {detal.kpi.orin > 0 ? ` · reytingda ${detal.kpi.orin}-o'rin` : ""}
              {!detal.sotuvchi.isActive ? " · nofaol" : ""}
            </p>
          </div>
        </div>

        <SotuvchiDetalClient
          initial={detal}
          boshDavr={boshDavr}
          bonusYozaOladi={isManager(session.rol)}
        />
      </div>
    );
  });
}
