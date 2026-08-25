import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { taminotBekor } from "@/lib/services/taminot";
import { bekorTaminotSchema } from "@/lib/validation/taminot";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * TA'MINOTNI BEKOR QILISH — teskari yozuvlar bilan (xizmat qatlamida).
 *
 * Bu yerda oddiy `delete` YO'Q: ta'minot allaqachon ombor, qarz yoki
 * chiqim yozgan bo'lishi mumkin. Xizmat qatlami ularni birma-bir qaytaradi
 * yoki (tovar sotilgan, qarz to'langan bo'lsa) amalni butunlay rad etadi.
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    await requireOmborli(businessId);

    const parsed = bekorTaminotSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await taminotBekor({
      businessId,
      orderId: params.id,
      userId: user.userId,
      sabab: parsed.data.sabab,
    });
    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  },
  { module: "OMBOR" }
);
