import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { listKunlikTarix } from "@/lib/queries/kunlik";
import { getKunlikRuxsat } from "@/lib/services/kunlik";
import { TarixClient } from "./TarixClient";

export const dynamic = "force-dynamic";

/**
 * KUNLIK HISOBOT TARIXI — oldingi kunlar ro'yxati.
 * Faqat direktor va boshqaruvchilar; xodim bugungi sahifaga qaytariladi.
 */
export default async function KunlikTarixPage() {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "KUNLIK");

    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);
    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Kunlik hisobotlar</h1>
          <p className="text-muted">Hali biznes yaratilmagan.</p>
        </div>
      );
    }

    const ruxsat = await getKunlikRuxsat(businessId, {
      userId: session.userId,
      ism: session.ism,
      rol: session.rol,
    });
    if (!ruxsat.tarixniKoradi) redirect("/app/kunlik");

    const tarix = await listKunlikTarix(businessId);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-fg">Kunlik hisobotlar</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Har
            kunni bosib batafsil hisobotni oching
          </p>
        </div>
        <TarixClient tarix={tarix} />
      </div>
    );
  });
}
