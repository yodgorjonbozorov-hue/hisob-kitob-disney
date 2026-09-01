import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { sotuvPlaniBelgila } from "@/lib/kpi/vazifa";
import { sozlashHuquqi } from "@/lib/kpi/ruxsat";
import { sotuvPlaniSchema } from "@/lib/validation/kpi";

/** Xodimning shu oygi sotuv plani (standartdan farq qilsa). */
export const POST = withTenant(
  async (request, _ctx, { session }) => {
    await sozlashHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = sotuvPlaniSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    const natija = await sotuvPlaniBelgila({
      businessId,
      employeeId: parsed.data.employeeId,
      oy: parsed.data.oy,
      maqsad: parsed.data.maqsad,
      planBonus: parsed.data.planBonus,
      izoh: parsed.data.izoh,
      userId: session.userId,
    });
    return NextResponse.json(natija ?? { ok: true });
  },
  { module: "HR" }
);
