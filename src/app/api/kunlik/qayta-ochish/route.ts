import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { reopenKunlikReport } from "@/lib/services/kunlik";
import { kunlikSanaSchema } from "@/lib/validation/kunlik";

/**
 * POST /api/kunlik/qayta-ochish — tasdiqlangan kunni tuzatish uchun ochish.
 * Faqat direktor yoki boshqaruvchi (service tekshiradi).
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = kunlikSanaSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const report = await reopenKunlikReport(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      parsed.data.sana
    );
    return NextResponse.json(report);
  },
  { module: "KUNLIK" }
);
