import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { createCategorySchema } from "@/lib/validation/category";
import { resolveActiveBusinessId } from "@/lib/business";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

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
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireRole(user.rol, "admin");

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
  } catch (error) {
    return handleApiError(error);
  }
}
