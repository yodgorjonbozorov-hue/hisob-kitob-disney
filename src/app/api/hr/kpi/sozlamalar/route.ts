import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { kpiSozlamasi } from "@/lib/kpi/sozlama";
import { sozlamaSaqla } from "@/lib/kpi/sozlamaYozish";
import { kpiKirish, sozlashHuquqi } from "@/lib/kpi/ruxsat";
import { sozlamaSchema } from "@/lib/validation/kpi";

export const GET = withTenant(
  async (_request, _ctx, { session }) => {
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await kpiKirish(session, businessId);
    return NextResponse.json(await kpiSozlamasi(businessId));
  },
  { module: "HR" }
);

export const PUT = withTenant(
  async (request, _ctx, { session }) => {
    await sozlashHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = sozlamaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await sozlamaSaqla(businessId, parsed.data));
  },
  { module: "HR" }
);
