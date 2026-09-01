import { notFound } from "next/navigation";
import { requireTenantPage } from "@/lib/auth/tenant";
import { requireModulePage } from "@/lib/modules/guard";
import { runWithTenant } from "@/lib/db/tenantContext";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString, utcDateToDateOnlyString } from "@/lib/date";
import { toshkentSana } from "@/lib/davomat/vaqt";
import { hisoblaXodim } from "@/lib/kpi/oylik";
import { ballTarixi } from "@/lib/kpi/ball";
import { listPresetlar } from "@/lib/kpi/vazifa";
import { sotuvYozuvlari } from "@/lib/kpi/sotuv";
import { tuzatishlar } from "@/lib/kpi/payroll";
import { kpiKirish, xodimKirishTekshir } from "@/lib/kpi/ruxsat";
import { hasPermission } from "@/lib/permissions/tekshir";
import { isManager } from "@/lib/auth/roles";
import { KpiDetalClient } from "./KpiDetalClient";

/**
 * XODIM KPI TAFSILOTI.
 *
 * IDOR himoyasi: URL'dagi id `xodimKirishTekshir` dan o'tadi — boshqa
 * xodimning sahifasini ochish uchun rahbar huquqi kerak, aks holda
 * faqat o'z yozuvi ochiladi.
 */
export default async function KpiDetalPage({
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

    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) notFound();

    await xodimKirishTekshir(session, businessId, params.id);
    const kirish = await kpiKirish(session, businessId);

    const oy = /^\d{4}-\d{2}$/.test(searchParams.oy ?? "") ? searchParams.oy! : currentMonthString();
    const natija = await hisoblaXodim(businessId, params.id, oy);
    if (!natija) notFound();

    const boshqaruvchi = isManager(session.rol);
    const [tarix, presetlar, sotuvlar, tuzatishRoyxati, ballHuquq, tasdiqHuquq, tolovHuquq] =
      await Promise.all([
        ballTarixi(businessId, params.id, oy),
        listPresetlar(businessId),
        natija.hisob.userId
          ? sotuvYozuvlari(businessId, natija.hisob.userId, oy)
          : Promise.resolve([]),
        natija.hisob.payrollId
          ? tuzatishlar(businessId, natija.hisob.payrollId)
          : Promise.resolve([]),
        hasPermission(session.userId, "kpi.ball"),
        hasPermission(session.userId, "kpi.oylik.tasdiq"),
        hasPermission(session.userId, "kpi.oylik.tolash"),
      ]);

    return (
      <KpiDetalClient
        hisob={natija.hisob}
        tarix={tarix}
        presetlar={presetlar}
        tuzatishlar={tuzatishRoyxati}
        sotuvlar={sotuvlar.map((s) => ({ ...s, sana: utcDateToDateOnlyString(s.sana) }))}
        boshlangichBall={natija.sozlama.boshlangichBall}
        kunlikLimit={natija.sozlama.kunlikLimit}
        bugun={toshkentSana(new Date())}
        ballBerish={boshqaruvchi && ballHuquq}
        tasdiqMumkin={boshqaruvchi && tasdiqHuquq}
        tolovMumkin={boshqaruvchi && tolovHuquq}
        rahbar={kirish.hammasi}
      />
    );
  });
}
