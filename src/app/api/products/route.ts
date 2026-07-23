import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireRole, UnauthorizedError } from "@/lib/auth/guard";
import { createProductSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { listProducts } from "@/lib/queries/inventory";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);
    await requireOmborli(businessId);

    const { searchParams } = new URL(request.url);
    const faqatFaol = searchParams.get("active") === "true";
    // Kassir uchun miqdor RAQAMI berilmaydi (faqat mavjudlik).
    const products = await listProducts(businessId, { forKassir: user.rol === "kassir", faqatFaol });
    return NextResponse.json(products);
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
  } catch (error) {
    return handleApiError(error);
  }
}
