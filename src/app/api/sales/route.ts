import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";
import { createSaleSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { createSale } from "@/lib/services/inventory";
import { listRecentSales } from "@/lib/queries/inventory";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    await requireOmborli(businessId);

    const sales = await listRecentSales(businessId);
    return NextResponse.json(sales);
  } catch (error) {
    return handleApiError(error);
  }
}

/** Sotuv — admin va kassir. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

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
  } catch (error) {
    return handleApiError(error);
  }
}
