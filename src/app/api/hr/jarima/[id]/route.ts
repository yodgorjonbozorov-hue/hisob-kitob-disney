import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { jarimaQaror } from "@/lib/services/jarima";
import { penaltyQarorSchema } from "@/lib/validation/davomat";

/** Jarima bo'yicha qaror: tasdiqlash (summani tahrirlash mumkin) yoki rad. */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = penaltyQarorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(
      await jarimaQaror({ businessId, userId: user.userId, penaltyId: params.id, data: parsed.data })
    );
  },
  { module: "HR" }
);
