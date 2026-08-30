import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getXodimDetal } from "@/lib/queries/xodimStatistika";
import { isTolovGuruhi, type TolovGuruhi } from "@/lib/tolovBolimi";
import { joriyOyOraliq, sanaOraliqOqi } from "@/lib/xodimDavr";

/**
 * BITTA XODIM TAFSILOTI — davr statistikasi + yozuvlar ro'yxati.
 * Reyting bilan bir xil himoya: `hisobot.korish` (butun biznes kesimi —
 * oddiy xodimga ochilmaydi).
 */
export const GET = withTenant<{ params: { id: string } }>(
  async (request, { params }, { session: user }) => {
    if (!(await hasPermission(user.userId, "hisobot.korish"))) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const oraliq = sanaOraliqOqi(searchParams) ?? joriyOyOraliq();

    const detal = await getXodimDetal({
      businessId,
      xodimId: params.id,
      ...oraliq,
      categoryId: searchParams.get("categoryId"),
      tolov: isTolovGuruhi(searchParams.get("tolov"))
        ? (searchParams.get("tolov") as TolovGuruhi)
        : null,
      page: parseInt(searchParams.get("page") ?? "1", 10),
    });
    return NextResponse.json({ ...detal, from: oraliq.from, to: oraliq.to });
  }
);
