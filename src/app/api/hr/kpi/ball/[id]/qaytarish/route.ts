import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { ballQaytar } from "@/lib/kpi/ball";
import { ballHuquqi } from "@/lib/kpi/ruxsat";
import { ballQaytarSchema } from "@/lib/validation/kpi";

/**
 * BALLNI QAYTARISH — asl yozuv TEGILMAYDI, teskari yozuv qo'shiladi.
 * Silent tahrir/o'chirish yo'q: audit tarixida ikkalasi ham ko'rinadi.
 */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session }) => {
    await ballHuquqi(session);
    const businessId = await resolveActiveBusinessId(session);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const parsed = ballQaytarSchema.safeParse(body);
    const izoh = parsed.success ? parsed.data.izoh : null;

    const natija = await ballQaytar({
      businessId,
      logId: params.id,
      userId: session.userId,
      userIsm: session.ism ?? null,
      izoh,
    });
    return NextResponse.json(natija, { status: 201 });
  },
  { module: "HR" }
);
