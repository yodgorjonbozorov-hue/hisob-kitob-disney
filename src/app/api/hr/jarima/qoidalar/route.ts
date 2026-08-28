import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import {
  listJarimaQoidalari,
  createJarimaQoidasi,
  standartQoidalarniOrnat,
} from "@/lib/services/jarima";
import { createPenaltyRuleSchema } from "@/lib/validation/davomat";

export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    return NextResponse.json(await listJarimaQoidalari(businessId));
  },
  { module: "HR" }
);

export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const body = await request.json();
    // `standart: true` — namunaviy qoidalar to'plamini bir bosishda o'rnatish.
    if (body?.standart === true) {
      return NextResponse.json(await standartQoidalarniOrnat(businessId), { status: 201 });
    }
    const parsed = createPenaltyRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await createJarimaQoidasi(businessId, parsed.data), { status: 201 });
  },
  { module: "HR" }
);
