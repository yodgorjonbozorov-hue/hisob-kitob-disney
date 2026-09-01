import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { tuzatishQosh } from "@/lib/kpi/payroll";
import { tasdiqHuquqi } from "@/lib/kpi/ruxsat";
import { tuzatishSchema } from "@/lib/validation/kpi";

/** Yopilgan oylikka tuzatish qatori — snapshot raqami tegilmaydi. */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session }) => {
    await tasdiqHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = tuzatishSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(
      await tuzatishQosh({
        businessId,
        payrollId: params.id,
        summa: parsed.data.summa,
        sabab: parsed.data.sabab,
        userId: session.userId,
        userIsm: session.ism ?? null,
      }),
      { status: 201 }
    );
  },
  { module: "HR" }
);
