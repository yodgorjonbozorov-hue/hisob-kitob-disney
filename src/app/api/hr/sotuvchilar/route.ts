import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { getSotuvchilarKpi } from "@/lib/queries/sotuvchiKpi";
import { joriyOyOraliq, sanaOraliqOqi } from "@/lib/xodimDavr";

/**
 * SOTUVCHILAR REYTINGI (23-talab) — davr kesimida, "puli kelgan sotuv"
 * bo'yicha saralangan.
 *
 * HIMOYA: `hisobot.korish` — boshqa sotuvchilarning KPI va savdosi oddiy
 * xodimga ko'rinmaydi (28-talab). O'z statistikasi uchun `[id]` yo'nalishi.
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const ruxsat = await hasPermission(user.userId, "hisobot.korish");
    if (!ruxsat) return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const sp = new URL(request.url).searchParams;
    const oraliq = sanaOraliqOqi(sp) ?? joriyOyOraliq();
    return NextResponse.json(await getSotuvchilarKpi({ businessId, ...oraliq }));
  },
  { module: "HR" }
);
