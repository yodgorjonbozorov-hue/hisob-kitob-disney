import { redirect } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { transactionScopeUserId } from "@/lib/auth/visibility";
import { getExpectedCash, listShiftCloses } from "@/lib/queries/shift";
import { todayTashkentDateOnlyString } from "@/lib/date";
import { SmenaClient } from "./SmenaClient";

export default async function SmenaPage() {
  const { session, tenantId } = await requireTenantPage();
  // Tenant konteksti: quyidagi barcha prisma so'rovlari shu tenantga avtomatik cheklanadi.
  return runWithTenant(tenantId, async () => {
  // Sotuvchi faqat kirim/chiqim kiritadi — bu sahifa unga yopiq.
  if (session.rol === "SELLER") {
    redirect("/app");
  }
  const businessId = await resolveActiveBusinessId(session);
  const business = await getActiveBusiness(session);
  const today = todayTashkentDateOnlyString();

  // Kassir o'z smenasini yakunlaydi — kutilgan naqd ham faqat uning kirimlaridan.
  const [kutilgan, recent] = businessId
    ? await Promise.all([
        getExpectedCash(businessId, today, transactionScopeUserId(session)),
        listShiftCloses(businessId),
      ])
    : [0, []];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Kun yakuni (smena)</h1>
        <p className="text-sm text-muted mt-1">
          Biznes: <span className="font-medium text-fg">{business?.nomi ?? "—"}</span> · Kutilgan naqd bilan
          sanalgan naqdni solishtiring
        </p>
      </div>
      <SmenaClient today={today} kutilgan={kutilgan} recent={recent} />
    </div>
  );
  });
}
