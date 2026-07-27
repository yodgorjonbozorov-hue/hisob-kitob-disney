import { NextResponse } from "next/server";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { stockEntrySchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { createStockEntry } from "@/lib/services/inventory";

/** Ombor kirimi — mahsulot qoldig'ini oshiradi (admin). */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  const body = await request.json();
  const parsed = stockEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const entry = await createStockEntry({
    businessId,
    productId: parsed.data.productId,
    miqdor: parsed.data.miqdor,
    birlikNarx: parsed.data.birlikNarx,
    izoh: parsed.data.izoh,
    userId: user.userId,
  });

  return NextResponse.json(entry, { status: 201 });
});
