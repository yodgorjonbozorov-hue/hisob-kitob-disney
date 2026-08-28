import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { davomatTuzat } from "@/lib/services/davomat";
import { tuzatishSchema } from "@/lib/validation/davomat";

/**
 * ADMIN TUZATISHI — istisno holatlar uchun (telefon ishlamadi, lekin xodim
 * ishda edi). Asl dalil o'chmaydi: tuzatish alohida "admin" manbali
 * AttendanceCheck yozuvi bo'lib qoladi (kim, qachon, sabab, avvalgi qiymat).
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = tuzatishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(
      await davomatTuzat({ businessId, userId: user.userId, data: parsed.data })
    );
  },
  { module: "HR" }
);
