import { NextResponse } from "next/server";
import { withSuperadmin } from "@/lib/auth/superadmin";
import { r } from "@/lib/superadmin/rbac";
import { dashboardMalumot, davrniHisobla, type DavrKalit } from "@/lib/superadmin/dashboard";
import { matn, sana } from "@/lib/superadmin/sorovParam";

export const dynamic = "force-dynamic";

/** Control Center bosh sahifasi ma'lumoti (KPI, ogohlantirish, grafik). */
export const GET = withSuperadmin(r("dashboard", "VIEW"), async (request) => {
  const p = new URL(request.url).searchParams;
  const kalit = (matn(p, "davr") ?? "30kun") as DavrKalit | "custom";
  const dan = sana(p, "dan");
  const gacha = sana(p, "gacha");
  const davr =
    kalit === "custom" && dan && gacha
      ? davrniHisobla("custom", new Date(), { dan, gacha })
      : davrniHisobla(kalit === "custom" ? "30kun" : kalit);

  return NextResponse.json(await dashboardMalumot(davr));
});
