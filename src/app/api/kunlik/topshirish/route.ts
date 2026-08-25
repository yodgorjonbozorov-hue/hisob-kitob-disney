import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { submitKunlikReport } from "@/lib/services/kunlik";
import { kunlikTopshirishSchema } from "@/lib/validation/kunlik";

/**
 * POST /api/kunlik/topshirish — kassa topshirish (kun yakunini direktorga yuborish).
 * Har qanday faol xodim topshira oladi; sanagan naqdini kiritadi — direktor
 * tizim hisobi bilan solishtiradi (pul nazorati). Direktorga Telegram xabar boradi.
 */
export const POST = withTenant(
  async (request, _ctx, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = kunlikTopshirishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const { report, pulSababi } = await submitKunlikReport(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      parsed.data.sana,
      parsed.data.sanalganNaqd,
      parsed.data.izoh
    );
    // `pulSababi` — pul KO'CHIRILMAGAN bo'lsa sababi (masalan shaxsiy kassa
    // rejimi yoqilmagan). UI uni ogohlantirish sifatida ko'rsatadi.
    return NextResponse.json({ ...report, pulSababi });
  },
  { module: "KUNLIK" }
);
