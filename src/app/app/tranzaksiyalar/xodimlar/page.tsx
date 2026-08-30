import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getXodimlarStatistika } from "@/lib/queries/xodimStatistika";
import { joriyOyOraliq } from "@/lib/xodimDavr";
import { EmptyState } from "@/components/ui/EmptyState";
import { XodimlarClient } from "./XodimlarClient";

/**
 * XODIMLAR — sotuvchilar kesimidagi analitika sahifasi (Kirim/Chiqim bo'limi
 * ichida). Bu moliyaviy kategoriya EMAS: hech qanday yozuv yaratmaydi, faqat
 * mavjud kirim tranzaksiyalarini xodim kesimida o'qiydi.
 *
 * HIMOYA: `hisobot.korish` (davr yakuni bilan bir xil qoida) — OWNER/ADMIN da
 * bor, oddiy sotuvchi/kassirda yo'q; maxsus rolga direktor o'zi bera oladi.
 * API routelar ham AYNI huquqni tekshiradi — sahifani yashirish himoya emas.
 */
export default async function XodimlarPage() {
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

    // Birinchi ko'rinish — "Bu oy" (server hisoblab beradi, sahifa darhol
    // to'liq ochiladi); filtr almashtirilganda klient API'ga o'tadi.
    const oraliq = joriyOyOraliq();
    const stat = await getXodimlarStatistika({ businessId, ...oraliq });

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/app/tranzaksiyalar"
            aria-label="Kirim va chiqimlarga qaytish"
            className="w-10 h-10 rounded-xl border border-line bg-surface flex items-center justify-center text-muted hover:text-fg transition"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-fg">Xodimlar</h1>
            <p className="text-sm text-muted">Sotuvchilar bo&apos;yicha zakaz va savdo statistikasi</p>
          </div>
        </div>
        <XodimlarClient initial={stat} />
      </div>
    );
  });
}
