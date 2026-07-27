import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManager } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { bulkProductsSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";

/** Ko'p mahsulot turini birdan qo'shish (admin). */
export const POST = withTenant(async (request, _ctx, { session: user }) => {
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
}, { module: "OMBOR" });
