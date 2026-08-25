import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { suhbatlarRoyxati } from "@/lib/ai/suhbatlar";

/** Foydalanuvchining SHU bizneste ochgan suhbatlari ro'yxati (chat tarixi). */
export const GET = withTenant(
  async (_request, _routeCtx, ctx) => {
    const businessId = await resolveActiveBusinessId(ctx.session);
    if (!businessId) return NextResponse.json({ suhbatlar: [] });

    const suhbatlar = await suhbatlarRoyxati({ businessId, userId: ctx.session.userId });
    return NextResponse.json({ suhbatlar });
  },
  { module: "AI" }
);
