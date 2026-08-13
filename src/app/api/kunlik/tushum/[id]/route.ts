import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { deleteKunlikTushum, updateKunlikTushum } from "@/lib/services/kunlik";
import { updateKunlikTushumSchema } from "@/lib/validation/kunlik";

/**
 * PATCH — tushumni tahrirlash, DELETE — yumshoq o'chirish.
 * OPEN kunda: kiritgan xodimning o'zi yoki direktor/boshqaruvchi.
 * Tasdiqlangan kunda ikkalasi ham rad etiladi (service tekshiradi).
 */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = updateKunlikTushumSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const yangi = await updateKunlikTushum(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      params.id,
      parsed.data
    );
    return NextResponse.json(yangi);
  },
  { module: "KUNLIK" }
);

export const DELETE = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const natija = await deleteKunlikTushum(
      businessId,
      { userId: user.userId, ism: user.ism, rol: user.rol },
      params.id
    );
    return NextResponse.json(natija);
  },
  { module: "KUNLIK" }
);
