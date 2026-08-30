import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getXodimlarStatistika } from "@/lib/queries/xodimStatistika";
import { joriyOyOraliq, sanaOraliqOqi } from "@/lib/xodimDavr";

/**
 * XODIMLAR STATISTIKASI (reyting + KPI).
 *
 * MAXFIY ma'lumot: butun biznes bo'yicha xodimlar savdosi. Shu bois mavjud
 * granular huquq bilan yopiladi — `hisobot.korish` (davr yakuni bilan bir xil
 * qoida): OWNER/ADMIN da bor, oddiy sotuvchi/kassirda YO'Q, maxsus rolga esa
 * direktor o'zi bera oladi. Yangi parallel ruxsat tizimi kiritilmaydi.
 */
export const GET = withTenant(async (request, _ctx, { session: user }) => {
  if (!(await hasPermission(user.userId, "hisobot.korish"))) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const businessId = await resolveActiveBusinessId(user);
  if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const oraliq = sanaOraliqOqi(searchParams) ?? joriyOyOraliq();

  const stat = await getXodimlarStatistika({ businessId, ...oraliq });
  return NextResponse.json({ ...stat, from: oraliq.from, to: oraliq.to });
});
