import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { deleteXodimPlan } from "@/lib/services/xodimPlan";

export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    return NextResponse.json(await deleteXodimPlan(businessId, ctx.params.id));
  },
  { module: "HR" }
);
