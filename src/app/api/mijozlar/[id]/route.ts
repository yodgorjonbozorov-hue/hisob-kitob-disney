import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { updateMijoz, deleteMijoz } from "@/lib/services/mijoz";
import { updateMijozSchema } from "@/lib/validation/mijoz";

export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = updateMijozSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    // Qarz limiti — pul qarori, uni faqat boshqaruvchi o'zgartiradi.
    if (parsed.data.qarzLimit !== undefined) requireManager(user.rol);
    return NextResponse.json(await updateMijoz(businessId, params.id, parsed.data));
  },
  { module: "MIJOZLAR" }
);

export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    return NextResponse.json(await deleteMijoz(businessId, params.id));
  },
  { module: "MIJOZLAR" }
);
