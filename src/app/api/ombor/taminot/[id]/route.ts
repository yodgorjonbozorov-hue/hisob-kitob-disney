import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { taminotDetal } from "@/lib/queries/ombor";
import { taminotTahrir } from "@/lib/services/taminot";
import { updateTaminotSchema } from "@/lib/validation/taminot";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * BITTA TA'MINOT — o'qish va TAHRIRLASH (direktor huquqi).
 *
 * PATCH oddiy `update` EMAS: ta'minot allaqachon omborni oshirgan, kassadan
 * pul chiqargan yoki qarz yozgan. Xizmat qatlami (`taminotTahrir`) farqni
 * hisoblab ombor to'g'rilashini yozadi va pul yozuvini noldan qayta yozadi —
 * shu bois Naqd → Qarz va Qarz → Naqd o'tishlari ham to'g'ri hisoblanadi.
 *
 * RBAC: `requireManager` — ta'minotni tahrirlash pul qarori, kassir uni
 * o'zgartira olmaydi. Bu route hech kimga yangi huquq OCHMAYDI.
 */
export const GET = withTenant<{ params: { id: string } }>(
  async (_request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const taminot = await taminotDetal(businessId, params.id);
    if (!taminot) return NextResponse.json({ error: "Ta'minot topilmadi" }, { status: 404 });
    return NextResponse.json(taminot);
  },
  { module: "OMBOR" }
);

export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireOmborli(businessId);

    const parsed = updateTaminotSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    await taminotTahrir({
      businessId,
      orderId: params.id,
      userId: user.userId,
      data: parsed.data,
    });
    // Ombor qoldig'i, kassa va qarz o'zgardi — bosh sahifa keshi eskirmasin.
    dashboardYangilandi(businessId);
    return NextResponse.json(await taminotDetal(businessId, params.id));
  },
  { module: "OMBOR" }
);
