import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getHrSozlama, updateHrSozlama } from "@/lib/services/davomatJadval";
import { hrSettingSchema } from "@/lib/validation/davomat";

export const GET = withTenant(
  async (_request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    return NextResponse.json(await getHrSozlama(businessId));
  },
  { module: "HR" }
);

export const PATCH = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = hrSettingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await updateHrSozlama(businessId, parsed.data));
  },
  { module: "HR" }
);
