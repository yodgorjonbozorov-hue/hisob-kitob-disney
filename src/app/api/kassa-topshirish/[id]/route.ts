import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { topshiriqQaror } from "@/lib/services/kassirKassa";
import { qarorSchema } from "@/lib/validation/kassirKassa";

/**
 * KASSA TOPSHIRIG'I BO'YICHA QAROR.
 *
 *  - `{ amal: "qabul", farqYopildi? }` — direktor/admin qabul qiladi;
 *  - `{ amal: "rad", qarorIzoh? }`     — direktor/admin rad etadi;
 *  - `{ amal: "bekor" }`               — topshiruvchining o'zi bekor qiladi.
 *
 * Ikkinchi marta qaror qabul qilish bazada bloklanadi (holat sharti bilan
 * `updateMany`), shuning uchun tugma ikki marta bosilsa ham pul ikki marta
 * hisobdan chiqmaydi.
 */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = qarorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await topshiriqQaror(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      params.id,
      parsed.data
    );
    return NextResponse.json({
      ok: true,
      holat: natija.holat,
      qoldiq: "yangiQoldiq" in natija ? natija.yangiQoldiq : null,
    });
  }
);
