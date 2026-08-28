import { NextResponse } from "next/server";
import { withTenant } from "@/lib/auth/tenant";
import { requireManager } from "@/lib/auth/guard";
import { resolveActiveBusinessId } from "@/lib/business";
import { getDavomatTarixi } from "@/lib/queries/davomat";
import { toshkentSana } from "@/lib/davomat/vaqt";

const SANA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Direktor: davomat tarixi (sana oralig'i, xodim va holat filtrlari). */
export const GET = withTenant(
  async (request, _ctx, { session: user }) => {
    requireManager(user.rol);
    const businessId = await resolveActiveBusinessId(user);
    if (!businessId) return NextResponse.json([]);

    const p = new URL(request.url).searchParams;
    const bugun = toshkentSana(new Date());
    const from = SANA_RE.test(p.get("from") ?? "") ? p.get("from")! : bugun;
    const to = SANA_RE.test(p.get("to") ?? "") ? p.get("to")! : bugun;
    return NextResponse.json(
      await getDavomatTarixi(businessId, {
        from,
        to,
        employeeId: p.get("employeeId") || undefined,
        holat: p.get("holat") || undefined,
      })
    );
  },
  { module: "HR" }
);
