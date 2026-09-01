import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { oylikTasdiqla } from "@/lib/kpi/payroll";
import { tasdiqHuquqi } from "@/lib/kpi/ruxsat";

export const POST = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session }) => {
    await tasdiqHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    return NextResponse.json(
      await oylikTasdiqla({ businessId, payrollId: params.id, userId: session.userId })
    );
  },
  { module: "HR" }
);
