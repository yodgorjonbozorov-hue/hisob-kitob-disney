import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getBugungiDavomat } from "@/lib/queries/davomat";
import { toshkentSana } from "@/lib/davomat/vaqt";

/** Direktor paneli: bugungi (Toshkent kuni) davomat holati. */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const sanaParam = new URL(request.url).searchParams.get("sana");
    const sana = /^\d{4}-\d{2}-\d{2}$/.test(sanaParam ?? "") ? sanaParam! : toshkentSana(new Date());
    return NextResponse.json(await getBugungiDavomat(businessId, sana));
  },
  { module: "HR" }
);
