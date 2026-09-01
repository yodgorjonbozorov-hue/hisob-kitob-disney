import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { oylikTolandi } from "@/lib/kpi/payroll";
import { tolovHuquqi } from "@/lib/kpi/ruxsat";
import { tolovSchema } from "@/lib/validation/kpi";

export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session }) => {
    await tolovHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const parsed = tolovSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(
      await oylikTolandi({
        businessId,
        payrollId: params.id,
        userId: session.userId,
        summa: parsed.data.summa,
      })
    );
  },
  { module: "HR" }
);
