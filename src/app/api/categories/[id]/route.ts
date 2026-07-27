import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireManager, ForbiddenError, UnauthorizedError } from "@/lib/auth/guard";
import { updateCategorySchema } from "@/lib/validation/category";
import { resolveActiveBusinessId } from "@/lib/business";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    const existing = await prisma.category.findUnique({
      where: { id: params.id },
      select: { businessId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Kategoriya topilmadi" }, { status: 404 });
    }
    // Faqat aktiv biznes kategoriyasi o'zgartiriladi.
    if (existing.businessId !== businessId) {
      throw new ForbiddenError("Bu kategoriya boshqa biznesga tegishli");
    }

    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const category = await prisma.category.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json(category);
  } catch (error) {
    return handleApiError(error);
  }
}
