import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { updateProductSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId } from "@/lib/business";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireRole(user.rol, "admin");

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
    return NextResponse.json(product);
  } catch (error) {
    return handleApiError(error);
  }
}
