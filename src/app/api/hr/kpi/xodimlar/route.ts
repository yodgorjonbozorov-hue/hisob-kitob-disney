import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString } from "@/lib/date";
import { hisoblaBarchasi } from "@/lib/kpi/oylik";
import { kpiKirish } from "@/lib/kpi/ruxsat";
import { dashboardXulosasi } from "@/lib/kpi/dashboard";

/**
 * XODIMLAR KPI DASHBOARD'i — bir oyning butun manzarasi bitta so'rovda.
 * Xodim (boshqaruvchi bo'lmagan) chaqirsa javob FAQAT o'z yozuvidan iborat
 * bo'ladi — reyting va boshqalarning oyligi unga umuman yuborilmaydi.
 */
export const GET = withTenant(
  async (request, _ctx, { session }) => {
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const kirish = await kpiKirish(session, businessId);
    const oyParam = new URL(request.url).searchParams.get("oy");
    const oy = /^\d{4}-\d{2}$/.test(oyParam ?? "") ? oyParam! : currentMonthString();

    const { xodimlar } = await hisoblaBarchasi(businessId, oy);
    const korinadigan = kirish.hammasi
      ? xodimlar
      : xodimlar.filter((x) => x.employeeId === kirish.ozEmployeeId);

    return NextResponse.json({
      oy,
      hammasi: kirish.hammasi,
      xodimlar: korinadigan,
      // Xulosa va reyting FAQAT rahbarga: xodim boshqalarning raqamini
      // umumlashtirilgan ko'rinishda ham ko'rmasligi kerak.
      xulosa: kirish.hammasi ? dashboardXulosasi(xodimlar) : null,
    });
  },
  { module: "HR" }
);
