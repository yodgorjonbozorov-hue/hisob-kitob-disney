import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireMagazin } from "@/lib/business";
import { qrKodYarat } from "@/lib/services/mahsulotKod";

/**
 * Mahsulot uchun Balansa QR kalitini yaratish.
 *
 * Idempotent: kalit allaqachon bo'lsa o'sha qaytariladi. Kalit BARQAROR —
 * narx yoki qoldiq o'zgarganda chop etilgan stikerlar amal qilaveradi.
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    requireManager(user.rol);

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireMagazin(businessId);

    return NextResponse.json(await qrKodYarat({ businessId, productId: params.id }));
  },
  { module: "MAGAZIN" }
);
