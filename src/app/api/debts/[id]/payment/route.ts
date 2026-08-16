import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { qarzTolovSchema } from "@/lib/validation/qarz";
import { resolveActiveBusinessId } from "@/lib/business";
import { qarzTolov } from "@/lib/services/qarz";
import { dashboardYangilandi } from "@/lib/cache";

/**
 * Qarz to'lovi qabul qilish — admin va kassir.
 *
 * Pul HAQIQATDA kelgani uchun aynan shu yerda kirim tranzaksiyasi yoziladi.
 * Sana — to'lov sanasi (qarz berilgan sana emas), summa esa qolgan qarzdan
 * oshmasligi serverda tekshiriladi.
 */
export const POST = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const parsed = qarzTolovSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const natija = await qarzTolov({
    businessId,
    debtId: params.id,
    userId: user.userId,
    summa: parsed.data.summa,
    sana: parsed.data.sana,
    tolovTuri: parsed.data.tolovTuri,
    accountId: parsed.data.accountId,
    izoh: parsed.data.izoh,
    idempotencyKey: parsed.data.idempotencyKey,
  });

  dashboardYangilandi(businessId);
  return NextResponse.json(natija);
});
