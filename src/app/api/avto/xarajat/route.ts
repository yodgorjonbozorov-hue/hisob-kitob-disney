import { NextResponse } from "next/server";
import { requireManager, forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createProductExpenseSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId } from "@/lib/business";
import { addProductExpense } from "@/lib/services/inventory";
import { listProductExpenses } from "@/lib/queries/inventory";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * Mashinaga xarajat qo'shish (ta'mirlash, bo'yoq, yuvish, rasmiylashtirish...).
 * Xarajat aynan shu mashinaga yoziladi va sof foydadan ayriladi.
 */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = createProductExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const xarajat = await addProductExpense({
    businessId,
    productId: parsed.data.productId,
    turi: parsed.data.turi,
    summa: parsed.data.summa,
    izoh: parsed.data.izoh,
    tolovTuri: parsed.data.tolovTuri,
    kimga: parsed.data.kimga,
    userId: user.userId,
  });

  dashboardYangilandi(businessId);
  return NextResponse.json(xarajat, { status: 201 });
}, { module: "OMBOR" });

/** Bitta mashinaning xarajatlari: /api/avto/xarajat?productId=... */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const productId = new URL(request.url).searchParams.get("productId");
  if (!productId) return NextResponse.json({ error: "productId kerak" }, { status: 400 });

  return NextResponse.json(await listProductExpenses(businessId, productId));
}, { module: "OMBOR" });
