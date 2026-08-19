import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { obunalarRoyxati, tariflarQamrovi } from "@/lib/superadmin/obunalar";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { matn, son } from "@/lib/superadmin/sorovParam";

export const dynamic = "force-dynamic";

export const GET = withSuperadmin(r("obunalar", "VIEW"), async (request) => {
  const p = new URL(request.url).searchParams;
  const [royxat, tariflar] = await Promise.all([
    obunalarRoyxati(
      {
        qidiruv: matn(p, "qidiruv"),
        holat: matn(p, "holat"),
        plan: matn(p, "plan"),
        tugaydiKun: son(p, "tugaydiKun"),
      },
      sahifaParametrlari(p)
    ),
    tariflarQamrovi(),
  ]);
  return NextResponse.json({ ...royxat, tariflar });
});
