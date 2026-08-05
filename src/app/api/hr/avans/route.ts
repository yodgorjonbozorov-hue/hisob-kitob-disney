import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { avansBer } from "@/lib/services/hr";
import { avansSchema } from "@/lib/validation/hr";
import { dashboardYangilandi } from "@/lib/cache";

/** Avans — pul DARHOL chiqadi, shuning uchun dashboard keshi yangilanadi. */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = avansSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    const natija = await avansBer(businessId, user.userId, parsed.data);
    dashboardYangilandi(businessId);
    return NextResponse.json(natija, { status: 201 });
  },
  { module: "HR" }
);
