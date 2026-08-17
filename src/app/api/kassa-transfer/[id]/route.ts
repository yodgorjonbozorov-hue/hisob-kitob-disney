import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { kassaTransferQaror } from "@/lib/services/kassaTransfer";
import { transferQarorSchema } from "@/lib/validation/account";
import { requirePermission } from "@/lib/permissions/tekshir";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * KUTILAYOTGAN O'TKAZMA BO'YICHA QAROR.
 *
 *  - `{ amal: "qabul" }` — qabul qiluvchi pulni sanab oldi, o'tkazma yakunlanadi;
 *  - `{ amal: "rad", qarorIzoh? }` — qabul qiluvchi rad etadi;
 *  - `{ amal: "bekor" }` — yuboruvchining o'zi bekor qiladi.
 *
 * Kim nima qila olishi xizmat qatlamida (kassaTransferQaror) — bitta joyda.
 * Ikkinchi marta qaror bazada bloklanadi, shuning uchun tugma ikki marta
 * bosilsa ham pul ikki marta ko'chmaydi.
 */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    await requirePermission(user.userId, "pul.qabul");

    const parsed = transferQarorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await kassaTransferQaror(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      params.id,
      parsed.data
    );
    dashboardYangilandi(businessId);
    return NextResponse.json({ ok: true, holat: natija.holat });
  }
);
