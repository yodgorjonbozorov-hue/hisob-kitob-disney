import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { listMijozlar } from "@/lib/queries/mijoz";
import { createMijoz } from "@/lib/services/mijoz";
import { createMijozSchema } from "@/lib/validation/mijoz";

export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    return NextResponse.json(await listMijozlar(businessId));
  },
  { module: "MIJOZLAR" }
);

export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = createMijozSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await createMijoz(businessId, user.userId, parsed.data), { status: 201 });
  },
  { module: "MIJOZLAR" }
);
