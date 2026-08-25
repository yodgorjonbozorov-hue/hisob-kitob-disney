import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { qarorKunlikReport } from "@/lib/services/kunlik";
import { kunlikQarorSchema } from "@/lib/validation/kunlik";

/**
 * POST /api/kunlik/tasdiqlash — DIREKTOR QARORI: qabul qilish yoki rad etish.
 *
 * Ruxsat service ichida: faqat tayinlangan direktor (direktor yo'q bo'lsa —
 * boshqaruvchi), va o'z topshirig'ini o'zi tasdiqlay olmaydi.
 *
 * Qabul qilinganda pul kassirdan direktorga KO'CHADI (bitta tranzaksiyada).
 * Qayta bosilsa holat sharti tufayli xato qaytadi — pul ikki marta ko'chmaydi.
 *
 * `amal` berilmasa "qabul" deb qabul qilinadi (eski chaqiruvchilar bilan mos).
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const tana = await request.json();
    const parsed = kunlikQarorSchema.safeParse({ amal: "qabul", ...tana });
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const { report, pulHolati } = await qarorKunlikReport(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      parsed.data
    );
    return NextResponse.json({ ...report, pulHolati });
  },
  { module: "KUNLIK" }
);
