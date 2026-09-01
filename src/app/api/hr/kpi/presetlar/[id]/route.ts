import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { presetOchir } from "@/lib/kpi/vazifa";
import { sozlashHuquqi } from "@/lib/kpi/ruxsat";

export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session }) => {
    await sozlashHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await presetOchir(businessId, params.id);
    return NextResponse.json({ ok: true });
  },
  { module: "HR" }
);
