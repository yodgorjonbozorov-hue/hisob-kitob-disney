import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager, ForbiddenError } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { updateCategorySchema } from "@/lib/validation/category";
import { resolveActiveBusinessId } from "@/lib/business";

export const PATCH = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  const existing = await prisma.category.findUnique({
    where: { id: params.id },
    select: { businessId: true, turi: true },
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

  // Kg savdosi bayrog'i faqat kirim kategoriyasida ma'noga ega (chiqimda
  // "sotilgan kg" degan tushuncha yo'q).
  if (parsed.data.kgAsosli && existing.turi !== "kirim") {
    return NextResponse.json(
      { error: "Kg savdosi faqat kirim kategoriyasida bo'ladi" },
      { status: 400 }
    );
  }

  const category = await prisma.category.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json(category);
});
