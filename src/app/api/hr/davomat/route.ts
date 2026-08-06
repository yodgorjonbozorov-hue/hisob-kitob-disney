import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getDavomat } from "@/lib/queries/hr";
import { davomatBelgila } from "@/lib/services/hr";
import { davomatSchema } from "@/lib/validation/hr";
import { currentMonthString } from "@/lib/date";

export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ xodimlar: [], kunlar: [] });

    const oy = new URL(request.url).searchParams.get("oy") ?? currentMonthString();
    return NextResponse.json(await getDavomat(businessId, oy));
  },
  { module: "HR" }
);

export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = davomatSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await davomatBelgila(businessId, parsed.data));
  },
  { module: "HR" }
);
