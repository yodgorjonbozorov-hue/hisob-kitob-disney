import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { oylikTola } from "@/lib/services/hr";
import { oylikTolaSchema } from "@/lib/validation/hr";
import { dashboardYangilandi } from "@/lib/cache";

/** Oylikni to'lash — shu yerda chiqim tranzaksiyasi yoziladi. */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = oylikTolaSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }

    const natija = await oylikTola({
      businessId,
      payrollId: params.id,
      userId: user.userId,
      sana: parsed.data.sana,
    });
    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  },
  { module: "HR" }
);
