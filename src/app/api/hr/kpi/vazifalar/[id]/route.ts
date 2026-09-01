import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { vazifaYangila, vazifaOchir } from "@/lib/kpi/vazifa";
import { sozlashHuquqi } from "@/lib/kpi/ruxsat";
import { vazifaYangilaSchema } from "@/lib/validation/kpi";

export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session }) => {
    await sozlashHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = vazifaYangilaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await vazifaYangila(businessId, params.id, parsed.data));
  },
  { module: "HR" }
);

export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session }) => {
    await sozlashHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await vazifaOchir(businessId, params.id);
    return NextResponse.json({ ok: true });
  },
  { module: "HR" }
);
