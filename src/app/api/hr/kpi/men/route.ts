import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { currentMonthString } from "@/lib/date";
import { hisoblaXodim } from "@/lib/kpi/oylik";
import { ballTarixi } from "@/lib/kpi/ball";
import { ozEmployeeId } from "@/lib/kpi/ruxsat";

/**
 * "MENING KPI'im" — xodimning O'Z ko'rsatkichlari.
 *
 * Xodim id'si MIJOZDAN QABUL QILINMAYDI: u sessiyadagi `userId` orqali
 * serverda topiladi, shuning uchun bu route bilan boshqa xodimning
 * ma'lumotini olishning yo'li yo'q.
 */
export const GET = withTenant(
  async (request, _ctx, { session }) => {
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ xodim: null });

    const employeeId = await ozEmployeeId(businessId, session.userId);
    if (!employeeId) return NextResponse.json({ xodim: null });

    const oyParam = new URL(request.url).searchParams.get("oy");
    const oy = /^\d{4}-\d{2}$/.test(oyParam ?? "") ? oyParam! : currentMonthString();

    const natija = await hisoblaXodim(businessId, employeeId, oy);
    if (!natija) return NextResponse.json({ xodim: null });

    return NextResponse.json({
      oy,
      xodim: natija.hisob,
      sozlama: natija.sozlama,
      tarix: await ballTarixi(businessId, employeeId, oy),
    });
  },
  { module: "HR" }
);
