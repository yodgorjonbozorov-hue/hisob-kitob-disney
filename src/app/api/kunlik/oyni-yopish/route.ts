import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { oyniYop } from "@/lib/services/kunlik";
import { kunlikOyniYopishSchema } from "@/lib/validation/kunlik";

/**
 * POST /api/kunlik/oyni-yopish — davr yopish (M-10): oy ichidagi barcha
 * CONFIRMED kunlar LOCKED bo'ladi va QAYTARIB BO'LMAYDI (qayta ochish yo'q).
 * Faqat direktor yoki boshqaruvchi (service tekshiradi).
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = kunlikOyniYopishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await oyniYop(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      parsed.data.oy
    );
    return NextResponse.json(natija);
  },
  { module: "KUNLIK" }
);
