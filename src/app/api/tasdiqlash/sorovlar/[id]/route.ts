import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { tasdiqla, radEt } from "@/lib/services/approval";
import { radEtSchema } from "@/lib/validation/approval";
import { dashboardYangilandi } from "@/lib/cache";

/** Qaror: `{ qaror: "tasdiq" }` yoki `{ qaror: "rad", sabab: "..." }`. */
export const POST = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const body = await request.json();
    const tasdiqlovchi = { id: user.userId, rol: user.rol };

    if (body?.qaror === "rad") {
      const parsed = radEtSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Xato ma'lumot" }, { status: 400 });
      }
      return NextResponse.json(
        await radEt({ businessId, requestId: params.id, tasdiqlovchi, sabab: parsed.data.sabab })
      );
    }

    const natija = await tasdiqla({ businessId, requestId: params.id, tasdiqlovchi });
    dashboardYangilandi(businessId);
    return NextResponse.json(natija);
  },
  { module: "TASDIQLASH" }
);
