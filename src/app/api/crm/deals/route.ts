import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { createDeal } from "@/lib/crm/service";
import { buyurtmaSchema } from "@/lib/validation/crm";

/** Yangi kunlik buyurtma (kategoriya + mijoz + narx + sana). */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = buyurtmaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const deal = await createDeal({ businessId, userId: user.userId, ...parsed.data });
    return NextResponse.json(deal, { status: 201 });
  },
  { module: "CRM" }
);
