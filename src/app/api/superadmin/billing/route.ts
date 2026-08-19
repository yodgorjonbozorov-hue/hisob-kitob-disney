import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { tolovlarRoyxati, billingXulosa } from "@/lib/superadmin/billing";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { matn, sana } from "@/lib/superadmin/sorovParam";

export const dynamic = "force-dynamic";

export const GET = withSuperadmin(r("billing", "VIEW"), async (request) => {
  const p = new URL(request.url).searchParams;
  const [royxat, xulosa] = await Promise.all([
    tolovlarRoyxati(
      {
        qidiruv: matn(p, "qidiruv"),
        status: matn(p, "status"),
        provider: matn(p, "provider"),
        tenantId: matn(p, "tenantId"),
        sanadan: sana(p, "sanadan"),
        sanagacha: sana(p, "sanagacha"),
      },
      sahifaParametrlari(p)
    ),
    billingXulosa(),
  ]);
  return NextResponse.json({ ...royxat, xulosa });
});
