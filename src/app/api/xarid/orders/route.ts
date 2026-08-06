import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { listOrders } from "@/lib/queries/xarid";
import { createOrder } from "@/lib/services/xarid";
import { createOrderSchema } from "@/lib/validation/xarid";

export const GET = withTenant(async (_request, _ctx, { session: user }) => {
  requireManager(user.rol);
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);
  return NextResponse.json(await listOrders(businessId));
}, { module: "XARID" });

export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  // Xarid tovar bilan ishlaydi — ombor tizimisiz ma'nosi yo'q.
  await requireOmborli(businessId);

  const parsed = createOrderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }
  const order = await createOrder(businessId, user.userId, parsed.data);
  return NextResponse.json(order, { status: 201 });
}, { module: "XARID" });
