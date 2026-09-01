import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { listPresetlar, presetYarat } from "@/lib/kpi/vazifa";
import { kpiKirish, sozlashHuquqi } from "@/lib/kpi/ruxsat";
import { presetYaratSchema } from "@/lib/validation/kpi";

export const GET = withTenant(
  async (_request, _ctx, { session }) => {
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json([]);
    await kpiKirish(session, businessId);
    return NextResponse.json(await listPresetlar(businessId));
  },
  { module: "HR" }
);

export const POST = withTenant(
  async (request, _ctx, { session }) => {
    await sozlashHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = presetYaratSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await presetYarat(businessId, parsed.data), { status: 201 });
  },
  { module: "HR" }
);
