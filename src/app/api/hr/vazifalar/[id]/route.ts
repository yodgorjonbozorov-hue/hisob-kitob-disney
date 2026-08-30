import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager, ForbiddenError } from "@/lib/auth/guard";
import { isManager } from "@/lib/auth/roles";
import { resolveActiveBusinessId } from "@/lib/business";
import {
  updateXodimVazifa,
  deleteXodimVazifa,
  vazifaEgasimi,
} from "@/lib/services/xodimVazifa";
import { vazifaUpdateSchema } from "@/lib/validation/hr";

/**
 * Vazifani yangilash. Boshqaruvchi — hamma maydonni; oddiy xodim — FAQAT
 * o'z vazifasining holatini (bajarilgan deb belgilash).
 */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = vazifaUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    if (isManager(user.rol)) {
      return NextResponse.json(await updateXodimVazifa(businessId, ctx.params.id, parsed.data));
    }

    const egasi = await vazifaEgasimi(businessId, ctx.params.id, user.userId);
    if (!egasi) throw new ForbiddenError("Faqat o'z vazifangiz holatini o'zgartira olasiz");
    return NextResponse.json(
      await updateXodimVazifa(businessId, ctx.params.id, parsed.data, true)
    );
  },
  { module: "HR" }
);

export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    return NextResponse.json(await deleteXodimVazifa(businessId, ctx.params.id));
  },
  { module: "HR" }
);
