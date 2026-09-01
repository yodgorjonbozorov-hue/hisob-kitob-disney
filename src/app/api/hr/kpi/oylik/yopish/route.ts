import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { oyniYop } from "@/lib/kpi/payroll";
import { tasdiqHuquqi } from "@/lib/kpi/ruxsat";
import { oyniYopSchema } from "@/lib/validation/kpi";

/**
 * OYNI YOPISH — joriy hisob snapshot bo'lib muzlatiladi.
 * Shundan keyin CRM/zakaz o'zgarsa ham bu oyning oyligi siljimaydi.
 */
export const POST = withTenant(
  async (request, _ctx, { session }) => {
    await tasdiqHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = oyniYopSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    const payroll = await oyniYop({
      businessId,
      employeeId: parsed.data.employeeId,
      oy: parsed.data.oy,
      izoh: parsed.data.izoh,
      userId: session.userId,
    });
    return NextResponse.json(payroll, { status: 201 });
  },
  { module: "HR" }
);
