import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { listSuppliers } from "@/lib/queries/xarid";
import { createSupplier } from "@/lib/services/xarid";
import { createSupplierSchema } from "@/lib/validation/xarid";

export const GET = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);
  const faqatFaol = new URL(request.url).searchParams.get("faol") === "1";
  return NextResponse.json(await listSuppliers(businessId, faqatFaol));
}, { module: "XARID" });

export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);
  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = createSupplierSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }
  return NextResponse.json(await createSupplier(businessId, parsed.data), { status: 201 });
}, { module: "XARID" });
