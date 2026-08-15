import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getKunlikReport, getKunlikDirektor } from "@/lib/queries/kunlik";
import { getSmenaHolat } from "@/lib/queries/smena";
import { getKunlikRuxsat, kunlikBugun } from "@/lib/services/kunlik";
import { KunlikClient } from "./KunlikClient";

export const dynamic = "force-dynamic";

/**
 * KUNLIK HISOBOT — bugungi tushumlar (naqd/Click/qarz) va kun yakuni.
 * Oylik hisobotdan alohida tizim; kun Toshkent yarim tunida almashadi.
 */
export default async function KunlikPage({
  searchParams,
}: {
  searchParams?: { sana?: string };
}) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "KUNLIK");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-fg">Kunlik hisobot</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const aktor = { userId: session.userId, ism: session.ism, rol: session.rol };
    const bugun = kunlikBugun();
    const ruxsat = await getKunlikRuxsat(businessId, aktor);

    // Xodim faqat bugunni ko'radi — boshqa sana so'ralsa jimgina bugunga qaytariladi.
    const soralgan = searchParams?.sana;
    const sana =
      soralgan && /^\d{4}-\d{2}-\d{2}$/.test(soralgan) && ruxsat.tarixniKoradi ? soralgan : bugun;

    const [report, direktor, smena] = await Promise.all([
      getKunlikReport(businessId, sana),
      getKunlikDirektor(businessId),
      getSmenaHolat(businessId, sana, bugun),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Kunlik hisobot</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Kun
            yakunini {direktor.direktorIsm ? `direktor ${direktor.direktorIsm}` : "direktor"}{" "}
            tasdiqlaydi
          </p>
        </div>
        <KunlikClient
          report={report}
          ruxsat={ruxsat}
          bugun={bugun}
          direktor={direktor}
          smena={smena}
        />
      </div>
    );
  });
}
