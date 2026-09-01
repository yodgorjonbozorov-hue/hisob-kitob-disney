import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { listVazifalar, vazifaYarat } from "@/lib/kpi/vazifa";
import { kpiSozlamasi } from "@/lib/kpi/sozlama";
import { sozlashHuquqi, kpiKirish } from "@/lib/kpi/ruxsat";
import { vazifaYaratSchema } from "@/lib/validation/kpi";

export const GET = withTenant(
  async (_request, _ctx, { session }) => {
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json([]);
    await kpiKirish(session, businessId);
    // Birinchi murojaatda standart to'plamni yaratadi (idempotent).
    await kpiSozlamasi(businessId);
    return NextResponse.json(await listVazifalar(businessId));
  },
  { module: "HR" }
);

export const POST = withTenant(
  async (request, _ctx, { session }) => {
    await sozlashHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = vazifaYaratSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await vazifaYarat(businessId, parsed.data), { status: 201 });
  },
  { module: "HR" }
);
