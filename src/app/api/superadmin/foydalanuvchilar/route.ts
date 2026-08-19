import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { foydalanuvchilarRoyxati } from "@/lib/superadmin/foydalanuvchilar";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { matn, mantiq } from "@/lib/superadmin/sorovParam";

export const dynamic = "force-dynamic";

export const GET = withSuperadmin(r("foydalanuvchilar", "VIEW"), async (request) => {
  const p = new URL(request.url).searchParams;
  const natija = await foydalanuvchilarRoyxati(
    {
      qidiruv: matn(p, "qidiruv"),
      rol: matn(p, "rol"),
      tenantId: matn(p, "tenantId"),
      faol: mantiq(p, "faol"),
      telegram: mantiq(p, "telegram"),
    },
    sahifaParametrlari(p)
  );
  return NextResponse.json(natija);
});
