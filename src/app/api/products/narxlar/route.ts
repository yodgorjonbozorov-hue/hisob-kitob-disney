import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { narxToldirishSchema } from "@/lib/validation/inventory";
import { narxlarniToldir } from "@/lib/services/narxToldirish";
import { dashboardYangilandi } from "@/lib/cache";

/** Narx va qoldiqni bir yo'la to'ldirish — faqat direktor/admin. */
export const PATCH = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  const parsed = narxToldirishSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
      { status: 400 }
    );
  }

  const natija = await narxlarniToldir({
    businessId,
    userId: user.userId,
    qatorlar: parsed.data.qatorlar,
  });

  dashboardYangilandi(businessId);
  return NextResponse.json(natija);
}, { module: "OMBOR" });
