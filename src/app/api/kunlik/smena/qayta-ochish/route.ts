import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { smenaQaytaOch } from "@/lib/services/smena";
import { smenaQaytaOchishSchema } from "@/lib/validation/smena";

/**
 * POST /api/kunlik/smena/qayta-ochish — xato yopilgan OXIRGI smenani bekor
 * qiladi (faqat direktor yoki boshqaruvchi). Qator o'chadi, audit jurnalida
 * barcha raqamlari bilan qoladi.
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = smenaQaytaOchishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    await smenaQaytaOch(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      parsed.data.smenaId
    );
    return NextResponse.json({ ok: true });
  },
  { module: "KUNLIK" }
);
