import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { isManager } from "@/lib/auth/roles";
import { createProductSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { listProducts } from "@/lib/queries/inventory";

export const GET = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);
  await requireOmborli(businessId);

  const { searchParams } = new URL(request.url);
  const faqatFaol = searchParams.get("active") === "true";
  // Admin bo'lmaganlar (kassir/sotuvchi) uchun tannarx va miqdor RAQAMI berilmaydi (faqat mavjudlik).
  const products = await listProducts(businessId, { forKassir: !isManager(user.rol), faqatFaol });
  return NextResponse.json(products);
}, { module: "OMBOR" });

export const POST = withTenant(async (request, _ctx, { session: user }) => {
  forbidSeller(user.rol);
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  const body = await request.json();
  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      businessId,
      nomi: parsed.data.nomi,
      kelganNarx: parsed.data.kelganNarx ?? 0,
      sotuvNarx: parsed.data.sotuvNarx ?? 0,
    },
  });
  return NextResponse.json(product, { status: 201 });
}, { module: "OMBOR" });
