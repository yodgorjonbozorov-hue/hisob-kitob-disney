import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getXodimKategoriyaDetal } from "@/lib/queries/kategoriyaAnalitika";
import { joriyOyOraliq, sanaOraliqOqi } from "@/lib/xodimDavr";

/** Bitta xodimning kategoriya kesimidagi tafsiloti (KPI + zakazlar lentasi). */
export const GET = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    const ruxsat = await hasPermission(user.userId, "hisobot.korish");
    if (!ruxsat) return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const sp = new URL(request.url).searchParams;
    const oraliq = sanaOraliqOqi(sp) ?? joriyOyOraliq();
    const detal = await getXodimKategoriyaDetal({
      businessId,
      employeeId: params.id,
      categoryId: sp.get("categoryId"),
      ...oraliq,
    });
    if (!detal) return NextResponse.json({ error: "Xodim topilmadi" }, { status: 404 });
    return NextResponse.json(detal);
  },
  { module: "HR" }
);
