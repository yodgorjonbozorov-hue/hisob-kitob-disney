import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { createCategorySchema } from "@/lib/validation/category";
import { resolveActiveBusinessId } from "@/lib/business";

export const GET = withTenant(async (request, _ctx, { session: user }) => {

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json([]);

  const { searchParams } = new URL(request.url);
  const turi = searchParams.get("turi");
  const activeParam = searchParams.get("active");

  const categories = await prisma.category.findMany({
    where: {
      businessId,
      ...(turi === "kirim" || turi === "chiqim" ? { turi } : {}),
      ...(activeParam === "true" ? { isActive: true } : {}),
    },
    orderBy: [{ tartib: "asc" }, { nomi: "asc" }],
  });

  return NextResponse.json(categories);
});

export const POST = withTenant(async (request, _ctx, { session: user }) => {
  requireManager(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const body = await request.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  // Kategoriya aktiv biznes ostida yaratiladi.
  const category = await prisma.category.create({ data: { ...parsed.data, businessId } });
  return NextResponse.json(category, { status: 201 });
});
