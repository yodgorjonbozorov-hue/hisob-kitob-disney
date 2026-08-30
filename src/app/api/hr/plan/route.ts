import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { upsertXodimPlan } from "@/lib/services/xodimPlan";
import { planSchema } from "@/lib/validation/hr";
import { getXodimlarPerformance } from "@/lib/queries/xodimPlan";
import { currentMonthString } from "@/lib/date";

/** Oy bo'yicha barcha xodimlar samaradorligi (dashboard + kartochkalar + reyting). */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const oyParam = new URL(request.url).searchParams.get("oy") ?? "";
    const oy = /^\d{4}-\d{2}$/.test(oyParam) ? oyParam : currentMonthString();
    return NextResponse.json(await getXodimlarPerformance(businessId, oy));
  },
  { module: "HR" }
);

/** Plan belgilash/yangilash (upsert: bir xodim + bir oy = bitta yozuv). */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = planSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }
    return NextResponse.json(await upsertXodimPlan(businessId, user.userId, parsed.data), {
      status: 201,
    });
  },
  { module: "HR" }
);
