import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { bizneslarRoyxati, type BiznesSaralash } from "@/lib/superadmin/bizneslar";
import { sahifaParametrlari } from "@/lib/superadmin/sahifalash";
import { matn, sana, mantiq } from "@/lib/superadmin/sorovParam";

export const dynamic = "force-dynamic";

/** Kompaniyalar ro'yxati — filtr/saralash/sahifalash BAZADA. */
export const GET = withSuperadmin(r("bizneslar", "VIEW"), async (request) => {
  const p = new URL(request.url).searchParams;
  const natija = await bizneslarRoyxati(
    {
      qidiruv: matn(p, "qidiruv"),
      status: matn(p, "status"),
      plan: matn(p, "plan"),
      modul: matn(p, "modul"),
      bepul: mantiq(p, "bepul"),
      sanadan: sana(p, "sanadan"),
      sanagacha: sana(p, "sanagacha"),
      saralash: (matn(p, "saralash") ?? "yangi") as BiznesSaralash,
    },
    sahifaParametrlari(p)
  );
  return NextResponse.json(natija);
});
