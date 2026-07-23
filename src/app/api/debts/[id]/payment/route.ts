import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { handleApiError, UnauthorizedError } from "@/lib/auth/guard";
import { debtPaymentSchema } from "@/lib/validation/inventory";
import { resolveActiveBusinessId, requireOmborli } from "@/lib/business";
import { recordDebtPayment } from "@/lib/services/inventory";

/** Qarz to'lovi qabul qilish — admin va kassir. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

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

    return NextResponse.json({
      id: debt.id,
      tolangan: debt.tolangan,
      qolgan: debt.jamiSumma - debt.tolangan,
      isYopilgan: debt.isYopilgan,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
