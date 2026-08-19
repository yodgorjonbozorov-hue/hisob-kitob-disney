import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireMagazin } from "@/lib/business";
import { barcodeSchema } from "@/lib/validation/pos";
import { barcodeBiriktir } from "@/lib/services/mahsulotKod";

/**
 * Mahsulotga zavod shtrix-kodini biriktirish (yoki olib tashlash).
 * Katalogni o'zgartirish — boshqaruvchi amali (mahsulot tahrirlash bilan bir xil).
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireMagazin(businessId);

    const parsed = barcodeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      await barcodeBiriktir({
        businessId,
        productId: params.id,
        barcode: parsed.data.barcode ?? null,
      })
    );
  },
  { module: "MAGAZIN" }
);
