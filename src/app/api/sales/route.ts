import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { createSaleSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { createSale } from "@/lib/services/inventory";
import { listRecentSales } from "@/lib/queries/inventory";

export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);
  await requireOmborli(businessId);

  const sales = await listRecentSales(businessId);
  return NextResponse.json(sales);
}, { module: "OMBOR" });

/** Sotuv — admin va kassir. */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  const body = await request.json();
  const parsed = createSaleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const sale = await createSale({
    businessId,
    productId: parsed.data.productId,
    miqdor: parsed.data.miqdor,
    tolovTuri: parsed.data.tolovTuri,
    mijozNomi: parsed.data.mijozNomi,
    mijozTel: parsed.data.mijozTel,
    userId: user.userId,
  });

  return NextResponse.json(sale, { status: 201 });
}, { module: "OMBOR" });
