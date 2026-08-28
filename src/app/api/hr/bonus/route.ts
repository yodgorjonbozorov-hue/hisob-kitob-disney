import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listBonuslar } from "@/lib/queries/davomat";
import { createBonus } from "@/lib/services/jarima";
import { createBonusSchema } from "@/lib/validation/davomat";

export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);

    const p = new URL(request.url).searchParams;
    return NextResponse.json(
      await listBonuslar(businessId, {
        from: p.get("from") || undefined,
        to: p.get("to") || undefined,
        employeeId: p.get("employeeId") || undefined,
      })
    );
  },
  { module: "HR" }
);

export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = createBonusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await createBonus(businessId, user.userId, parsed.data), {
      status: 201,
    });
  },
  { module: "HR" }
);
