import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { smenaYop } from "@/lib/services/smena";
import { smenaYopishSchema } from "@/lib/validation/smena";

/**
 * POST /api/kunlik/smena — smenani yopish.
 *
 * Xodim kassadagi naqdni SANAB kiritadi; tizim o'sha oynadagi hisobni
 * muzlatib, farqni yozadi. Kunlik kirim/chiqim raqamlariga tegilmaydi.
 * Kassa topshirish bilan bir xil qoida: har qanday faol xodim o'z smenasini
 * yopa oladi, nazorat esa "kim yopdi" ismi va farq raqamida.
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = smenaYopishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const smena = await smenaYop(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      parsed.data
    );
    return NextResponse.json({
      ok: true,
      raqam: smena.raqam,
      kutilganNaqd: smena.kutilganNaqd,
      sanalganNaqd: smena.sanalganNaqd,
      farq: smena.farq,
    });
  },
  { module: "KUNLIK" }
);
