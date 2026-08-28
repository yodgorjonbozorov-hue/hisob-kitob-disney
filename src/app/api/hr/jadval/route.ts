import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listJadvallar, createJadval } from "@/lib/services/davomatJadval";
import { createWorkScheduleSchema } from "@/lib/validation/davomat";

export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    return NextResponse.json(await listJadvallar(businessId));
  },
  { module: "HR" }
);

export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = createWorkScheduleSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await createJadval(businessId, parsed.data), { status: 201 });
  },
  { module: "HR" }
);
