import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateProductSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId } from "@/lib/business";
import { dashboardYangilandi } from "@/lib/cache";

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  const existing = await prisma.product.findUnique({
    where: { id: params.id },
    select: { businessId: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Mahsulot topilmadi" }, { status: 404 });
  }
  if (existing.businessId !== businessId) {
    throw new ForbiddenError("Bu mahsulot boshqa biznesga tegishli");
  }

  const body = await request.json();
  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const product = await prisma.product.update({
    where: { id: params.id },
    data: parsed.data,
  });
  // Qoldiq yoki faollik o'zgargan bo'lishi mumkin — kartani yangilaymiz.
  dashboardYangilandi(businessId);
  return NextResponse.json(product);
}, { module: "OMBOR" });
