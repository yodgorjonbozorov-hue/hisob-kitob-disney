import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, requireManager, UnauthorizedError } from "@/lib/auth/guard";
import { bulkProductsSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";

/** Ko'p mahsulot turini birdan qo'shish (admin). */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireOmborli(businessId);

    const body = await request.json();
    const parsed = bulkProductsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const created = await prisma.$transaction(
      parsed.data.mahsulotlar.map((m) =>
        prisma.product.create({
          data: {
            businessId,
            nomi: m.nomi,
            kelganNarx: m.kelganNarx ?? 0,
            sotuvNarx: m.sotuvNarx ?? 0,
          },
        })
      )
    );

    return NextResponse.json({ soni: created.length, mahsulotlar: created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
