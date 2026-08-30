import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getXodimDetal } from "@/lib/queries/xodimStatistika";
import { joriyOyOraliq } from "@/lib/xodimDavr";
import { EmptyState } from "@/components/ui/EmptyState";
import { XodimDetal } from "./XodimDetal";

/**
 * BITTA XODIM TAFSILOTI — davr statistikasi va yozuvlari (direktor/admin
 * reytingdan bosib kiradi). Himoya ro'yxat sahifasi bilan bir xil:
 * `hisobot.korish`.
 */
export default async function XodimDetalPage({ params }: { params: { id: string } }) {
  const { session, tenantId } = await requireTenantPage();
  return runWithTenant(tenantId, async () => {
    const ruxsat = await hasPermission(session.userId, "hisobot.korish");
    if (!ruxsat) {
      return (
        <EmptyState
          title="Ruxsat yo'q"
          description="Xodimlar statistikasi faqat boshqaruvchiga ko'rinadi."
        />
      );
    }

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) {
      return <EmptyState title="Biznes topilmadi" description="Sizga biznes biriktirilmagan." />;
    }

    // Birinchi ko'rinish — "Bu oy"; filtrlar (davr, kategoriya, to'lov)
    // klientda, /api/transactions/xodimlar-statistika/[id] orqali.
    const oraliq = joriyOyOraliq();
    const [detal, kategoriyalar] = await Promise.all([
      getXodimDetal({ businessId, xodimId: params.id, ...oraliq }),
      prisma.category.findMany({
        where: { businessId, turi: "kirim", isActive: true },
        select: { id: true, nomi: true },
        orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
      }),
    ]);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/tranzaksiyalar/xodimlar"
            aria-label="Xodimlar ro'yxatiga qaytish"
            className="w-10 h-10 rounded-xl border border-line bg-surface flex items-center justify-center text-muted hover:text-fg transition"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-fg">{detal.xodim.ism}</h1>
            <p className="text-sm text-muted">Xodim savdo statistikasi</p>
          </div>
        </div>
        <XodimDetal xodimId={params.id} initial={detal} kategoriyalar={kategoriyalar} />
      </div>
    );
  });
}
