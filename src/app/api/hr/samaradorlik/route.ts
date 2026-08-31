import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { resolveActiveBusinessId } from "@/lib/business";
import { hasPermission } from "@/lib/permissions/tekshir";
import { listKategoriyaTablari, getKategoriyaAnalitika } from "@/lib/queries/kategoriyaAnalitika";
import { joriyOyOraliq, sanaOraliqOqi } from "@/lib/xodimDavr";

/**
 * Kategoriya kesimidagi xodim samaradorligi (davr filtri bilan).
 * HIMOYA: `hisobot.korish` — xodim statistikasi sahifasi bilan bir xil qoida
 * (OWNER/ADMIN da bor, oddiy sotuvchi/kassirda yo'q).
 */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    const ruxsat = await hasPermission(user.userId, "hisobot.korish");
    if (!ruxsat) return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });

    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json({ error: "Biznes topilmadi" }, { status: 404 });

    const sp = new URL(request.url).searchParams;
    const oraliq = sanaOraliqOqi(sp) ?? joriyOyOraliq();
    const categoryId = sp.get("categoryId");

    const tablar = await listKategoriyaTablari(businessId);
    const tanlangan = categoryId ?? tablar[0]?.id ?? null;
    const analitika = tanlangan
      ? await getKategoriyaAnalitika({ businessId, categoryId: tanlangan, ...oraliq })
      : null;

    if (categoryId && !analitika) {
      return NextResponse.json({ error: "Kategoriya topilmadi" }, { status: 404 });
    }
    return NextResponse.json({ tablar, analitika });
  },
  { module: "HR" }
);
