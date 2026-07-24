import { requireUser } from "@/lib/auth/session";
import { resolveActiveBusinessId, getActiveBusiness } from "@/lib/business";
import { getExpectedCash, listShiftCloses } from "@/lib/queries/shift";
import { todayDateOnlyString } from "@/lib/date";
import { SmenaClient } from "./SmenaClient";

export default async function SmenaPage() {
  const session = await requireUser();
  const businessId = await resolveActiveBusinessId(session);
  const business = await getActiveBusiness(session);
  const today = todayDateOnlyString();

  const [kutilgan, recent] = businessId
    ? await Promise.all([getExpectedCash(businessId, today), listShiftCloses(businessId)])
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
}
