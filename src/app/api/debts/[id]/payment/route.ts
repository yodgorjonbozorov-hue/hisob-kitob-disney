import { forbidSeller } from "@/lib/auth/guard";
import { withTenant } from "@/lib/auth/tenant";
import { NextResponse } from "next/server";
import { debtPaymentSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { recordDebtPayment } from "@/lib/services/inventory";
import { dashboardYangilandi } from "@/lib/cache";

/** Qarz to'lovi qabul qilish — admin va kassir. */
export const POST = withTenant<{ params: { id: string } }>(async (request, { params }, { session: user }) => {
  forbidSeller(user.rol);

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });
  await requireOmborli(businessId);

  const body = await request.json();
  const parsed = debtPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
  }

  const debt = await recordDebtPayment({
    businessId,
    debtId: params.id,
    summa: parsed.data.summa,
    userId: user.userId,
  });

  dashboardYangilandi(businessId);
  return NextResponse.json({
    id: debt.id,
    tolangan: debt.tolangan,
    qolgan: debt.jamiSumma - debt.tolangan,
    isYopilgan: debt.isYopilgan,
  });
}, { module: "OMBOR" });
