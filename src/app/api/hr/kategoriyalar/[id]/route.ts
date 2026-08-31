import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { updateKategoriya } from "@/lib/services/xodimKategoriya";
import { kategoriyaPatchSchema } from "@/lib/validation/xodimKategoriya";

/**
 * Kategoriyani tahrirlash: nomi, turi, tartib, aktiv/noaktiv.
 * O'CHIRISH YO'Q — faqat `aktiv=false` (tarixiy biriktiruvlar saqlansin).
 */
export const PATCH = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const parsed = kategoriyaPatchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
    }
    return NextResponse.json(await updateKategoriya(businessId, params.id, parsed.data));
  },
  { module: "HR" }
);
