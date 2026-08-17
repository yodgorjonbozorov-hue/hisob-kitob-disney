import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { stornoTransactionSchema } from "@/lib/validation/transaction";
import { stornoTransaction } from "@/lib/services/transactionStorno";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * STORNO — moliyaviy yozuvni tuzatishning yagona yo'li (audit: Critical #3).
 *
 * `PATCH` endi summa/sana/turi kabi maydonlarni o'zgartirmaydi. Xato yozuv
 * shu yerda SABAB bilan bekor qilinadi va (ixtiyoriy) tuzatilgani yoziladi —
 * ikkalasi bitta atomik amalda. Asl yozuv bazada qoladi: savatda ko'rinadi,
 * tiklash mumkin, audit jurnalida kim/qachon/nega yozilgan.
 *
 * Body: { sabab: string, tuzatish?: <yangi tranzaksiya maydonlari> }
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) {
      return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = stornoTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" },
        { status: 400 }
      );
    }

    const natija = await stornoTransaction({
      businessId,
      transactionId: params.id,
      sabab: parsed.data.sabab,
      actorId: user.userId,
      actorRol: user.rol,
      tuzatish: parsed.data.tuzatish ?? null,
    });

    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  }
);
