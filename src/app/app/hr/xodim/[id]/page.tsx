import { redirect, notFound } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import { prisma } from "@/lib/prisma";
import { getDavomatTarixi, listJarimalar, listBonuslar } from "@/lib/queries/davomat";
import { listJadvallar, listIshJoylari } from "@/lib/services/davomatJadval";
import {
  getXodimlarPerformance,
  getXodimPlanTarixi,
  getXodimZakazlari,
  listXodimOyliklari,
} from "@/lib/queries/xodimPlan";
import { listXodimVazifalari } from "@/lib/services/xodimVazifa";
import { getSotuvchilarKpi } from "@/lib/queries/sotuvchiKpi";
import { getXodimlarJamoaKpi } from "@/lib/queries/xodimJamoaKpi";
import { getXodimKategoriyaDetal } from "@/lib/queries/kategoriyaAnalitika";
import { oyOraligi } from "@/lib/xodimDavr";
import { toshkentSana } from "@/lib/davomat/vaqt";
import { utcDateToDateOnlyString, currentMonthString } from "@/lib/date";
import { XodimDetalClient } from "./XodimDetalClient";

/** XODIM SAHIFASI — performance, zakazlar, vazifalar, davomat va oylik tablari. */
export default async function XodimDetalPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { oy?: string };
}) {
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

    const oy = /^\d{4}-\d{2}$/.test(searchParams.oy ?? "")
      ? searchParams.oy!
      : currentMonthString();

    const bugun = toshkentSana(new Date());
    const from = utcDateToDateOnlyString(new Date(Date.now() - 30 * 24 * 3600_000));
    const [
      tarix,
      jarimalar,
      bonuslar,
      jadvallar,
      joylar,
      hammasi,
      planTarixi,
      vazifalar,
      oyliklar,
      zakazlar,
      sotuvchilar,
      jamoaHammasi,
      jamoaDetal,
    ] = await Promise.all([
        getDavomatTarixi(businessId, { from, to: bugun, employeeId: xodim.id }),
        listJarimalar(businessId, { employeeId: xodim.id, from }),
        listBonuslar(businessId, { employeeId: xodim.id, from }),
        listJadvallar(businessId),
        listIshJoylari(businessId),
        getXodimlarPerformance(businessId, oy),
        getXodimPlanTarixi(businessId, xodim.id),
        listXodimVazifalari(businessId, xodim.id, oy),
        listXodimOyliklari(businessId, xodim.id),
        xodim.userId ? getXodimZakazlari(businessId, xodim.userId, oy) : Promise.resolve([]),
        // CRM sotuvchi KPI'si (24-talab) — bitta o'qish, xodim boshiga emas.
        getSotuvchilarKpi({ businessId, ...oyOraligi(oy) }),
        // Lavozim kesimidagi KPI (17-23-talab) va zakaz qatnashuvlari lentasi.
        getXodimlarJamoaKpi(businessId, oyOraligi(oy)),
        getXodimKategoriyaDetal({ businessId, employeeId: xodim.id, ...oyOraligi(oy) }),
      ]);

    const performance = hammasi.xodimlar.find((x) => x.id === xodim.id) ?? null;
    // Sotuvchi bo'lmasa null — "Sotuv" tabi umuman ko'rsatilmaydi.
    const sotuvKpi = sotuvchilar.sotuvchilar.find((s) => s.employeeId === xodim.id) ?? null;

    return (
      <XodimDetalClient
        xodim={{
          id: xodim.id,
          ism: xodim.ism,
          lavozim: xodim.lavozim,
          tel: xodim.tel,
          rasmUrl: xodim.rasmUrl,
          isActive: xodim.isActive,
          userId: xodim.userId,
          workScheduleId: xodim.workScheduleId,
          workLocationId: xodim.workLocationId,
          selfieTalab: xodim.selfieTalab,
          gpsTalab: xodim.gpsTalab,
          radiusTalab: xodim.radiusTalab,
        }}
        oy={oy}
        bugun={bugun}
        performance={performance}
        planTarixi={planTarixi}
        vazifalar={vazifalar}
        oyliklar={oyliklar}
        zakazlar={zakazlar}
        sotuvKpi={sotuvKpi}
        jamoa={jamoaHammasi.get(xodim.id) ?? null}
        jamoaZakazlar={jamoaDetal?.zakazlar ?? []}
        tarix={tarix}
        jarimalar={jarimalar}
        bonuslar={bonuslar}
        jadvallar={jadvallar.map((j) => ({ id: j.id, nomi: j.nomi, standart: j.standart }))}
        joylar={joylar.map((j) => ({ id: j.id, nomi: j.nomi, standart: j.standart }))}
      />
    );
  });
}
