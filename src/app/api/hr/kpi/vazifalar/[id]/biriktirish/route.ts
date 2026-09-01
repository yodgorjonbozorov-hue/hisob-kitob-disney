import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { biriktiruvOzgartir } from "@/lib/kpi/vazifa";
import { sozlashHuquqi } from "@/lib/kpi/ruxsat";
import { biriktiruvSchema } from "@/lib/validation/kpi";

/** Vazifani xodimga biriktirish / olib tashlash (yozuv o'chirilmaydi). */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session }) => {
    await sozlashHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = biriktiruvSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    await biriktiruvOzgartir({
      businessId,
      taskId: params.id,
      employeeId: parsed.data.employeeId,
      aktiv: parsed.data.aktiv,
      userId: session.userId,
    });
    return NextResponse.json({ ok: true });
  },
  { module: "HR" }
);
