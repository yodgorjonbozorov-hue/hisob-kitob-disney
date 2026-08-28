import { redirect, notFound } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { getDavomatTarixi, listJarimalar, listBonuslar } from "@/lib/queries/davomat";
import { listJadvallar, listIshJoylari } from "@/lib/services/davomatJadval";
import { toshkentSana } from "@/lib/davomat/vaqt";
import { utcDateToDateOnlyString } from "@/lib/date";
import { XodimDetalClient } from "./XodimDetalClient";

/** XODIM SAHIFASI — davomat tarixi, dalillar va davomat siyosati. */
export default async function XodimDetalPage({ params }: { params: { id: string } }) {
  const ctx = await requireTenantPage();
  const { session, tenantId } = ctx;
  return runWithTenant(tenantId, async () => {
    await requireModulePage(ctx, "HR");
    if (!isManager(session.rol)) redirect("/app");

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) redirect("/app/hr");

    const xodim = await prisma.employee.findFirst({
      where: { id: params.id, businessId, deletedAt: null },
    });
    if (!xodim) notFound();

    const bugun = toshkentSana(new Date());
    const from = utcDateToDateOnlyString(new Date(Date.now() - 30 * 24 * 3600_000));
    const [tarix, jarimalar, bonuslar, jadvallar, joylar] = await Promise.all([
      getDavomatTarixi(businessId, { from, to: bugun, employeeId: xodim.id }),
      listJarimalar(businessId, { employeeId: xodim.id, from }),
      listBonuslar(businessId, { employeeId: xodim.id, from }),
      listJadvallar(businessId),
      listIshJoylari(businessId),
    ]);

    return (
      <XodimDetalClient
        xodim={{
          id: xodim.id,
          ism: xodim.ism,
          lavozim: xodim.lavozim,
          tel: xodim.tel,
          isActive: xodim.isActive,
          workScheduleId: xodim.workScheduleId,
          workLocationId: xodim.workLocationId,
          selfieTalab: xodim.selfieTalab,
          gpsTalab: xodim.gpsTalab,
          radiusTalab: xodim.radiusTalab,
        }}
        bugun={bugun}
        tarix={tarix}
        jarimalar={jarimalar}
        bonuslar={bonuslar}
        jadvallar={jadvallar.map((j) => ({ id: j.id, nomi: j.nomi, standart: j.standart }))}
        joylar={joylar.map((j) => ({ id: j.id, nomi: j.nomi, standart: j.standart }))}
      />
    );
  });
}
