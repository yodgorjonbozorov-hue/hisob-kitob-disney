import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { addKunlikTushum } from "@/lib/services/kunlik";
import { createKunlikTushumSchema } from "@/lib/validation/kunlik";

/**
 * POST /api/kunlik/tushum — bugungi kunga tushum kiritish.
 * Barcha rollar kirita oladi (xodimning asosiy amali).
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = createKunlikTushumSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const tushum = await addKunlikTushum(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      parsed.data
    );
    return NextResponse.json(tushum, { status: 201 });
  },
  { module: "KUNLIK" }
);
