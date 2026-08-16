import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getKassaHolat, listKassaTarix } from "@/lib/queries/kassirKassa";
import { KassamClient } from "./KassamClient";

/**
 * MENING KASSAM — xodimning QO'LIDAGI real naqd pul.
 *
 * Bu sahifa biznes hisobotidan (Kirim/Chiqim/Sof) ATAYLAB ajratilgan:
 * kassani topshirish kirimni kamaytirmaydi va sof balansni o'zgartirmaydi,
 * faqat shu yerdagi qoldiqni 0 ga tushiradi (lib/services/kassirKassa.ts).
 */
export default async function KassamPage() {
  const { session, tenantId } = await requireTenantPage();
  return runWithTenant(tenantId, async () => {
    const businessId = await resolveActiveBusinessId(session);
    const business = await getActiveBusiness(session);

    if (!businessId) {
      return (
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-fg">Mening kassam</h1>
          <p className="text-muted">Sizga biznes biriktirilmagan. Admin bilan bog&apos;laning.</p>
        </div>
      );
    }

    const kassir = { id: session.userId, ism: session.ism };
    const [holat, tarix] = await Promise.all([
      getKassaHolat(businessId, kassir),
      listKassaTarix(businessId, kassir.id, 20),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-fg">Mening kassam</h1>
          <p className="text-sm text-muted mt-1">
            Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Qo&apos;lingizdagi
            naqd pul. Kirim/chiqim hisobotlariga ta&apos;sir qilmaydi.
          </p>
        </div>
        <KassamClient holat={holat} tarix={tarix} />
      </div>
    );
  });
}
